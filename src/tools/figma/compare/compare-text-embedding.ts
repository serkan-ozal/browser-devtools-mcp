import {
    AMAZON_BEDROCK_ENABLE,
    AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID,
    AMAZON_BEDROCK_VISION_MODEL_ID,
    AWS_PROFILE,
    AWS_REGION,
} from '../../../config';
import { ImageType, ScreenshotInfo } from './types';
import { cosineSimilarity, Vector } from './vector';

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import sharp from 'sharp';

/**
 * -----------------------------------------------------------------------------
 * Public types
 * -----------------------------------------------------------------------------
 */

export type CompareOptions = {
    /**
     * Vision-capable model id used to analyze images and produce
     * a layout-focused textual description.
     *
     * This model must support image + text inputs (multimodal).
     *
     * Examples:
     * - anthropic.claude-3-7-sonnet-20250219-v1:0 (Amazon Bedrock)
     * - gpt-4.1 / gpt-5 (OpenAI, if used)
     *
     * If omitted, a sensible default is selected based on the active
     * provider and environment configuration.
     */
    visionModelId?: string;

    /**
     * Text embedding model id used to embed the generated vision
     * descriptions for semantic similarity comparison.
     *
     * Examples:
     * - amazon.titan-embed-text-v2:0
     * - text-embedding-3-large
     *
     * If omitted, a provider-specific default is used.
     */
    textEmbedModelId?: string;

    /**
     * If true, L2-normalize text embeddings before cosine similarity.
     *
     * Normalization improves numerical stability and makes similarity
     * scores comparable across different models and runs.
     *
     * Default: true
     */
    normalize?: boolean;

    /**
     * Optional override for the vision prompt used to describe the UI.
     *
     * This allows callers to specialize the comparison strategy,
     * for example:
     * - Focus more on layout vs components
     * - Emphasize navigation structure
     * - Ignore colors / typography explicitly
     *
     * If omitted, a built-in layout-focused prompt is used.
     */
    prompt?: string;

    /**
     * Maximum width or height (in pixels) for image preprocessing
     * before sending images to the vision model.
     *
     * The image is resized with aspect ratio preserved so that:
     *   max(width, height) <= maxDim
     *
     * This helps:
     * - Avoid model input size limits
     * - Reduce noise from very high-resolution screenshots
     * - Improve consistency across different viewport sizes
     *
     * Typical values:
     * - 512   : fast, very layout-oriented
     * - 1024  : good default for UI comparison
     * - 2048+ : rarely useful for semantic layout matching
     */
    maxDim?: number;

    /**
     * Image encoding format used when sending images to the vision model.
     *
     * PNG is lossless and preferred when fine structural details
     * (edges, alignment) matter.
     *
     * JPEG produces smaller payloads but introduces compression
     * artifacts that may slightly affect vision understanding.
     *
     * Default: 'png'
     */
    imageFormat?: ImageType;

    /**
     * JPEG quality used when encoding images before sending them
     * to the vision model (only relevant when imageFormat = 'jpeg').
     *
     * Lower values reduce payload size but may introduce compression
     * artifacts.
     *
     * Typical values:
     * - 75–85 : smaller payloads, usually acceptable
     * - 90    : high quality, recommended default
     * - 100   : maximum quality, larger payload, usually unnecessary
     */
    jpegQuality?: number;
};

export type CompareResult = {
    score: number;
};

const UI_DESCRIBE_PROMPT: string = `
You are analyzing a UI screenshot to compare it against another UI.

Your goal is to produce a STRUCTURAL LAYOUT FINGERPRINT that remains stable
even when real data, text values, or content change.

Write a concise but highly informative description using the rules below.

GENERAL RULES
- Describe WHAT EXISTS and WHERE IT IS, not how it looks visually.
- Prefer explicit structure and hierarchy over natural language.
- Be consistent and deterministic in wording.
- Do NOT describe colors, fonts, themes, or exact text.
- Do NOT include user data, names, numbers, timestamps, or labels.

LAYOUT STRUCTURE
Describe the UI from top to bottom:

1) PAGE REGIONS
- Identify major regions in order:
  - top header / app bar
  - left or right sidebar
  - main content area
  - footer (if present)

2) REGION DETAILS
For EACH region, describe:
- Position (top / left / right / center / full-width)
- Layout type (row, column, grid, split, stacked)
- Whether it is fixed or scrollable
- Primary purpose (navigation, content, controls, metadata)

3) COMPONENT INVENTORY
List the components that exist, grouped by region:
- navigation menus
- tabs
- tables (rows/columns, header present or not)
- lists (vertical/horizontal, item density: sparse/medium/dense)
- cards (count: single / few / many)
- forms (inline / multi-section)
- modals, drawers, overlays (present or not)

4) HIERARCHY & RELATIONSHIPS
Explicitly mention:
- parent → child relationships
- repeated patterns (e.g. "repeating card list", "uniform table rows")
- alignment relationships (sidebar + main content, header spanning all columns)

5) ABSENCE IS SIGNAL
If something is NOT present, state it explicitly when relevant:
- no sidebar
- no table
- no modal
- no pagination

FORMAT
- Use short bullet-style sentences.
- Use consistent phrasing across similar structures.
- Avoid synonyms (always say “sidebar”, not sometimes “side panel”).
- Keep the output under ~30 lines.

Return plain text only. No markdown.
`;

/**
 * -----------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------
 */

function _resolvePrompt(opt?: CompareOptions): string {
    return opt?.prompt ?? UI_DESCRIBE_PROMPT.trim();
}

function _resolveMaxDim(opt?: CompareOptions): number {
    return typeof opt?.maxDim === 'number' && opt.maxDim > 0
        ? Math.floor(opt.maxDim)
        : 1024;
}

function _resolveImageFormat(opt?: CompareOptions): 'png' | 'jpeg' {
    return opt?.imageFormat === 'jpeg' ? 'jpeg' : 'png';
}

function _resolveJpegQuality(opt?: CompareOptions): number {
    const q: number | undefined = opt?.jpegQuality;
    return typeof q === 'number' && q >= 50 && q <= 100 ? Math.floor(q) : 90;
}

async function _preprocessImage(
    buf: Buffer,
    opt?: CompareOptions
): Promise<{ bytes: Buffer; mimeType: string }> {
    const maxDim: number = _resolveMaxDim(opt);
    const format: 'png' | 'jpeg' = _resolveImageFormat(opt);
    const jpegQuality: number = _resolveJpegQuality(opt);

    let img: sharp.Sharp = sharp(buf).resize({
        width: maxDim,
        height: maxDim,
        fit: 'inside',
        withoutEnlargement: true,
    });

    let out: Buffer;
    let mimeType: string;

    if (format === 'png') {
        out = await img.png().toBuffer();
        mimeType = 'image/png';
    } else {
        out = await img.jpeg({ quality: jpegQuality }).toBuffer();
        mimeType = 'image/jpeg';
    }

    return { bytes: out, mimeType };
}

/**
 * -----------------------------------------------------------------------------
 * Amazon Bedrock specific embedding implementations
 * -----------------------------------------------------------------------------
 */

////////////////////////////////////////////////////////////////////////////////

const SUPPORTED_AMAZON_BEDROCK_TEXT_EMBED_MODEL_IDS: Set<string> = new Set([
    'amazon.titan-embed-text-v2:0',
]);
const DEFAULT_AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID: string =
    'amazon.titan-embed-text-v2:0';

const SUPPORTED_AMAZON_BEDROCK_VISION_MODEL_IDS: Set<string> = new Set([
    'anthropic.claude-3-haiku-20240307-v1',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-7-sonnet-20250219-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
    'anthropic.claude-haiku-4-5-20251001-v1:0',
    'anthropic.claude-opus-4-1-20250805-v1:0',
    'anthropic.claude-opus-4-5-20251101-v1:0',
]);
const DEFAULT_AMAZON_BEDROCK_VISION_MODEL_ID: string =
    'anthropic.claude-3-sonnet-20240229-v1:0';

let _bedrockClient: BedrockRuntimeClient | undefined;

function _isAwsBedrockActive(): boolean {
    // Minimal "is Bedrock usable?" check:
    // - Amazon Bedrock must be enabled
    // - Region must exist
    // - Credentials are resolved by AWS SDK default chain or AWS_PROFILE
    return AMAZON_BEDROCK_ENABLE && Boolean(AWS_REGION);
}

function _getOrCreateBedrockClient(): BedrockRuntimeClient | undefined {
    if (_bedrockClient) {
        return _bedrockClient;
    }

    const region: string | undefined = AWS_REGION;
    if (!region) {
        return undefined;
    }

    const profile: string | undefined = AWS_PROFILE;

    if (profile) {
        _bedrockClient = new BedrockRuntimeClient({
            region,
            credentials: fromIni({ profile }),
        });
        return _bedrockClient;
    }

    _bedrockClient = new BedrockRuntimeClient({ region });

    return _bedrockClient;
}

async function _invokeBedrock(
    client: BedrockRuntimeClient,
    modelId: string,
    payload: Record<string, unknown>
): Promise<any> {
    const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(JSON.stringify(payload)),
    });

    const resp: any = await client.send(cmd);
    const raw: string = Buffer.from(resp.body as Uint8Array).toString('utf-8');
    return JSON.parse(raw);
}

async function _describeUIWithAmazonBedrockClaude(
    ss: ScreenshotInfo,
    opt: CompareOptions | undefined,
    client: BedrockRuntimeClient,
    modelId: string
): Promise<string> {
    const { bytes, mimeType } = await _preprocessImage(ss.image, opt);
    const prompt: string = _resolvePrompt(opt);

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10_000,
        temperature: 0,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: bytes.toString('base64'),
                        },
                    },
                ],
            },
        ],
    };

    const parsed: any = await _invokeBedrock(client, modelId, payload);

    const text: string | undefined =
        parsed?.content?.[0]?.text ?? parsed?.output_text ?? parsed?.completion;

    if (!text || !text.trim()) {
        throw new Error('Amazon Bedrock Claude returned empty description.');
    }

    return text.trim();
}

async function _embedTextWithAmazonBedrockTitan(
    text: string,
    client: BedrockRuntimeClient,
    modelId: string
): Promise<Vector> {
    const payload = {
        inputText: text,
    };

    const parsed: any = await _invokeBedrock(client, modelId, payload);

    const emb: unknown = parsed?.embedding;

    if (!Array.isArray(emb) || typeof emb[0] !== 'number') {
        throw new Error(
            'Unexpected embedding response for Amazon Bedrock Titan text embedding.'
        );
    }

    return emb as number[];
}

async function _describeUIWithAmazonBedrock(
    ss: ScreenshotInfo,
    opt: CompareOptions | undefined,
    client: BedrockRuntimeClient
): Promise<string> {
    const modelId: string =
        opt?.visionModelId ??
        AMAZON_BEDROCK_VISION_MODEL_ID ??
        DEFAULT_AMAZON_BEDROCK_VISION_MODEL_ID;
    if (!SUPPORTED_AMAZON_BEDROCK_VISION_MODEL_IDS.has(modelId)) {
        throw new Error(
            `Unsupported Amazon Bedrock vision model id: ${modelId}`
        );
    }
    return await _describeUIWithAmazonBedrockClaude(ss, opt, client, modelId);
}

async function _embedTextWithAmazonBedrock(
    text: string,
    opt: CompareOptions | undefined,
    client: BedrockRuntimeClient
): Promise<Vector> {
    const modelId: string =
        opt?.textEmbedModelId ??
        AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID ??
        DEFAULT_AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID;
    if (!SUPPORTED_AMAZON_BEDROCK_TEXT_EMBED_MODEL_IDS.has(modelId)) {
        throw new Error(
            `Unsupported Amazon Bedrock text embedding model id: ${modelId}`
        );
    }
    return await _embedTextWithAmazonBedrockTitan(text, client, modelId);
}

/**
 * -----------------------------------------------------------------------------
 * Routing (LLM-agnostic)
 * -----------------------------------------------------------------------------
 */

async function _describeUI(
    ss: ScreenshotInfo,
    opt?: CompareOptions
): Promise<string | undefined> {
    // Provider A: Amazon Bedrock
    if (_isAwsBedrockActive()) {
        const client: BedrockRuntimeClient | undefined =
            _getOrCreateBedrockClient();
        if (!client) {
            return undefined;
        }
        return _describeUIWithAmazonBedrock(ss, opt, client);
    }

    // No providers active
    return undefined;
}

async function _embedTextVector(
    text: string,
    opt?: CompareOptions
): Promise<Vector | undefined> {
    // Provider A: Amazon Bedrock
    if (_isAwsBedrockActive()) {
        const client: BedrockRuntimeClient | undefined =
            _getOrCreateBedrockClient();
        if (!client) {
            return undefined;
        }
        return _embedTextWithAmazonBedrock(text, opt, client);
    }

    // No providers active
    return undefined;
}

/**
 * -----------------------------------------------------------------------------
 * Public API
 * -----------------------------------------------------------------------------
 */

export async function compare(
    page: ScreenshotInfo,
    figma: ScreenshotInfo,
    options?: CompareOptions
): Promise<CompareResult | undefined> {
    const normalize: boolean =
        typeof options?.normalize === 'boolean' ? options.normalize : true;

    const figmaDesc: string | undefined = await _describeUI(figma, options);
    if (!figmaDesc) {
        return undefined;
    }

    const pageDesc: string | undefined = await _describeUI(page, options);
    if (!pageDesc) {
        return undefined;
    }

    const figmaVec: Vector | undefined = await _embedTextVector(
        figmaDesc,
        options
    );
    if (!figmaVec) {
        return undefined;
    }

    const pageVec: Vector | undefined = await _embedTextVector(
        pageDesc,
        options
    );
    if (!pageVec) {
        return undefined;
    }

    const score: number = cosineSimilarity(figmaVec, pageVec, normalize);

    return { score };
}
