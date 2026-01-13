import {
    AMAZON_BEDROCK_ENABLE,
    AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID,
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
     * Embedding model id to use for image embeddings.
     * If omitted, a provider-specific default is used
     * (e.g. amazon.titan-embed-image-v1).
     */
    modelId?: string;

    /**
     * If true, L2-normalize embeddings before cosine similarity.
     * Normalization makes similarity scores more stable and
     * comparable across runs and models.
     *
     * Default: true
     */
    normalize?: boolean;

    /**
     * Maximum width or height (in pixels) for image preprocessing
     * before embedding.
     *
     * The image is resized with aspect ratio preserved so that:
     *   max(width, height) <= maxDim
     *
     * This serves two purposes:
     * - Prevents exceeding model input limits (e.g. Bedrock pixel caps)
     * - Reduces noise from very high-resolution screenshots while
     *   preserving overall layout and structure
     *
     * Typical values:
     * - 512   : faster, more layout-focused
     * - 1024  : good balance (recommended default)
     * - 2048+ : rarely useful for UI similarity
     */
    maxDim?: number;

    /**
     * JPEG quality used when encoding images before sending them
     * to the embedding model (only relevant if the image is encoded
     * as JPEG instead of PNG).
     *
     * Lower values reduce payload size but may introduce compression
     * artifacts that slightly affect embeddings.
     *
     * Typical values:
     * - 75–85 : smaller payloads, usually acceptable for layout similarity
     * - 90    : high quality, good default
     * - 100   : maximum quality, larger payload, usually unnecessary
     */
    jpegQuality?: number;
};

export type CompareResult = {
    /**
     * Cosine similarity score.
     */
    score: number;
};

/**
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

const DEFAULT_MAX_DIMENSION: number = 1024;
const DEFAULT_JPEG_QUALITY: number = 90;
const DEFAULT_AMAZON_BEDROCK_TITAN_OUTPUT_EMBEDDING_LENGTH: number = 1024;

/**
 * -----------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------
 */

async function _prepareImage(
    buf: Buffer,
    imageType: ImageType,
    opt?: CompareOptions
): Promise<Buffer> {
    let img: sharp.Sharp = sharp(buf);

    const maxDim: number = opt?.maxDim || DEFAULT_MAX_DIMENSION;

    img = img.resize({
        width: maxDim,
        height: maxDim,
        fit: 'inside',
        withoutEnlargement: true,
    });

    if (imageType === 'png') {
        return await img.png().toBuffer();
    }

    const jpegQuality: number = opt?.jpegQuality || DEFAULT_JPEG_QUALITY;

    return await img.jpeg({ quality: jpegQuality }).toBuffer();
}

/**
 * -----------------------------------------------------------------------------
 * Amazon Bedrock specific embedding implementations
 * -----------------------------------------------------------------------------
 */

////////////////////////////////////////////////////////////////////////////////

const SUPPORTED_AMAZON_BEDROCK_IMAGE_EMBED_MODEL_IDS: Set<string> = new Set([
    'amazon.titan-embed-image-v1',
]);
const DEFAULT_AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID: string =
    'amazon.titan-embed-image-v1';

// Cache Bedrock client so we don't re-create it for every compare call.
let _bedrockClient: BedrockRuntimeClient | undefined = undefined;

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

async function _embedImageWithAmazonBedrockTitan(
    ss: ScreenshotInfo,
    client: BedrockRuntimeClient,
    opt: CompareOptions | undefined,
    modelId: string
): Promise<Vector> {
    const image: Buffer = await _prepareImage(ss.image, ss.type, opt);

    const bodyObj: Record<string, unknown> = {
        inputImage: image.toString('base64'),
        // Optional but recommended: control embedding length
        embeddingConfig: {
            outputEmbeddingLength:
                DEFAULT_AMAZON_BEDROCK_TITAN_OUTPUT_EMBEDDING_LENGTH,
        },
    };

    const cmd: InvokeModelCommand = new InvokeModelCommand({
        modelId, // should be 'amazon.titan-embed-image-v1' (or with :0 if your account uses that)
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(JSON.stringify(bodyObj), 'utf-8'),
    });

    const resp: any = await client.send(cmd);

    const raw: Uint8Array =
        resp?.body instanceof Uint8Array
            ? (resp.body as Uint8Array)
            : new Uint8Array(resp?.body ?? []);

    const text: string = Buffer.from(raw).toString('utf-8');

    let parsed: any;
    try {
        parsed = text ? JSON.parse(text) : {};
    } catch (e: unknown) {
        throw new Error(
            `Amazon Bedrock Titan returned non-JSON response for embeddings: ${text.slice(0, 300)}`
        );
    }

    const emb: unknown =
        parsed?.embedding ??
        parsed?.embeddings?.[0] ??
        parsed?.outputEmbedding ??
        parsed?.vector;

    if (!Array.isArray(emb) || emb.length === 0 || typeof emb[0] !== 'number') {
        throw new Error(
            `Unexpected Amazon Bedrock Titan image embedding response format: ${text.slice(0, 500)}`
        );
    }

    return emb as number[];
}

async function _embedImageWithAmazonBedrock(
    ss: ScreenshotInfo,
    opt: CompareOptions | undefined,
    client: BedrockRuntimeClient
): Promise<Vector> {
    const modelId: string =
        opt?.modelId ??
        AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID ??
        DEFAULT_AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID;
    if (!SUPPORTED_AMAZON_BEDROCK_IMAGE_EMBED_MODEL_IDS.has(modelId)) {
        throw new Error(
            `Unsupported Amazon Bedrock image embedding model id: ${modelId}`
        );
    }
    return await _embedImageWithAmazonBedrockTitan(ss, client, opt, modelId);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * -----------------------------------------------------------------------------
 * Routing (LLM-agnostic)
 * -----------------------------------------------------------------------------
 */

async function _embedImage(
    ss: ScreenshotInfo,
    opt?: CompareOptions
): Promise<Vector | undefined> {
    // Provider A: Amazon Bedrock
    if (_isAwsBedrockActive()) {
        const client: BedrockRuntimeClient | undefined =
            _getOrCreateBedrockClient();
        if (!client) {
            return undefined;
        }
        return _embedImageWithAmazonBedrock(ss, opt, client);
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

    const figmaVec: Vector | undefined = await _embedImage(figma, options);
    if (!figmaVec) {
        return undefined;
    }

    const pageVec: Vector | undefined = await _embedImage(page, options);
    if (!pageVec) {
        return undefined;
    }

    const score: number = cosineSimilarity(figmaVec, pageVec, normalize);

    return { score };
}
