import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { compareWithNotes } from './compare';
import type {
    ScreenshotInfo as CompareScreenshotInfo,
    ImageType,
} from './compare';

import { getFigmaDesignScreenshot } from './figma-service';

import { z } from 'zod';

const DEFAULT_SCREENSHOT_TYPE: 'png' = 'png';
const DEFAULT_FULL_PAGE: boolean = true;
const DEFAULT_MSSIM_MODE: 'semantic' = 'semantic';

export interface ComparePageWithDesignInput extends ToolInput {
    /**
     * Figma file key (the part after /file/ in Figma URL).
     */
    figmaFileKey: string;

    /**
     * Figma node id (frame/component node). Usually looks like "12:34".
     */
    figmaNodeId: string;

    /**
     * Optional CSS selector to screenshot only a specific element instead of the whole page.
     */
    selector?: string;

    /**
     * If true, captures the full scrollable page.
     * Ignored when selector is provided.
     */
    fullPage?: boolean;

    /**
     * Optional scale for Figma raster export (e.g. 1, 2, 3).
     */
    figmaScale?: number;

    /**
     * Optional format for Figma export (default: png).
     */
    figmaFormat?: 'png' | 'jpg';

    /**
     * Optional weights for combining signals.
     * Missing/inactive signals are ignored and weights are renormalized.
     */
    weights?: {
        mssim?: number;
        imageEmbedding?: number;
        textEmbedding?: number;
    };

    /**
     * MSSIM mode (raw is stricter, semantic is more layout-oriented).
     */
    mssimMode?: 'raw' | 'semantic';

    /**
     * Optional compare options passed through to compareWithNotes:
     * - maxDim/jpegQuality etc are handled inside compare modules
     * - keep this minimal here to avoid coupling
     */
    maxDim?: number;

    /**
     * JPEG quality for preprocess pipelines that use JPEG encoding.
     * Default handled inside compare modules; provided here as a convenient override.
     */
    jpegQuality?: number;
}

export interface ComparePageWithDesignOutput extends ToolOutput {
    score: number;
    notes: string[];

    meta: {
        pageUrl: string;
        pageTitle: string;

        figmaFileKey: string;
        figmaNodeId: string;

        selector: string | null;
        fullPage: boolean;

        pageImageType: ImageType;
        figmaImageType: ImageType;
    };
}

export class ComparePageWithDesign implements Tool {
    name(): string {
        return 'figma_compare-page-with-design';
    }

    description(): string {
        return `
Compares the CURRENT PAGE UI against a Figma design snapshot and returns a combined similarity score.

What this tool does:
1) Fetches a raster snapshot from Figma (frame/node screenshot)
2) Takes a screenshot of the live browser page (full page or a specific selector)
3) Computes multiple similarity signals and combines them into one score:
   - MSSIM (structural similarity; always available)
   - Image embedding similarity (optional; may be skipped if provider is not configured)
   - Vision→text→text embedding similarity (optional; may be skipped if provider is not configured)

How to use it effectively:
- Prefer 'semantic' MSSIM mode when comparing Figma sample data vs real data (less sensitive to text/value differences).
- Use 'raw' MSSIM mode only when you expect near pixel-identical output.
- If you suspect layout/structure mismatch, run with fullPage=true first, then retry with a selector for the problematic region.
- Notes explain which signals were used or skipped; skipped signals usually mean missing cloud configuration (e.g. AWS_REGION, inference profile, etc).

This tool is designed for UI regression checks, design parity checks, and "does this page still match the intended layout?" validation.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            figmaFileKey: z
                .string()
                .min(1)
                .describe(
                    'Figma file key (the part after /file/ in Figma URL).'
                ),
            figmaNodeId: z
                .string()
                .min(1)
                .describe(
                    'Figma node id to render (frame/component node id like "12:34").'
                ),
            selector: z
                .string()
                .optional()
                .describe(
                    'Optional CSS selector to compare only a specific region of the page.'
                ),
            fullPage: z
                .boolean()
                .optional()
                .default(DEFAULT_FULL_PAGE)
                .describe(
                    'If true, captures the full scrollable page. Ignored when selector is provided.'
                ),
            figmaScale: z
                .number()
                .int()
                .positive()
                .optional()
                .describe(
                    'Optional scale factor for Figma raster export (e.g. 1, 2, 3).'
                ),
            figmaFormat: z
                .enum(['png', 'jpg'])
                .optional()
                .describe('Optional raster format for Figma snapshot.'),
            weights: z
                .object({
                    mssim: z
                        .number()
                        .positive()
                        .optional()
                        .describe('Weight for MSSIM signal.'),
                    imageEmbedding: z
                        .number()
                        .positive()
                        .optional()
                        .describe('Weight for image embedding signal.'),
                    textEmbedding: z
                        .number()
                        .positive()
                        .optional()
                        .describe(
                            'Weight for vision→text→text embedding signal.'
                        ),
                })
                .optional()
                .describe(
                    'Optional weights to combine signals. Only active signals participate.'
                ),
            mssimMode: z
                .enum(['raw', 'semantic'])
                .optional()
                .default(DEFAULT_MSSIM_MODE)
                .describe(
                    'MSSIM mode. semantic is more robust for real-data vs design-data comparisons.'
                ),
            maxDim: z
                .number()
                .int()
                .positive()
                .optional()
                .describe(
                    'Optional preprocessing max dimension forwarded to compare pipeline.'
                ),
            jpegQuality: z
                .number()
                .int()
                .min(50)
                .max(100)
                .optional()
                .describe(
                    'Optional JPEG quality forwarded to compare pipeline (used only when JPEG encoding is selected internally).'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            score: z
                .number()
                .describe(
                    'Combined similarity score in the range [0..1]. Higher means more similar.'
                ),
            notes: z
                .array(z.string())
                .describe(
                    'Human-readable notes explaining which signals were used and their individual scores.'
                ),
            meta: z
                .object({
                    pageUrl: z
                        .string()
                        .describe('URL of the page that was compared.'),
                    pageTitle: z
                        .string()
                        .describe('Title of the page that was compared.'),
                    figmaFileKey: z
                        .string()
                        .describe(
                            'Figma file key used for the design snapshot.'
                        ),
                    figmaNodeId: z
                        .string()
                        .describe(
                            'Figma node id used for the design snapshot.'
                        ),
                    selector: z
                        .string()
                        .nullable()
                        .describe(
                            'Selector used for page screenshot, if any. Null means full page.'
                        ),
                    fullPage: z
                        .boolean()
                        .describe('Whether the page screenshot was full-page.'),
                    pageImageType: z
                        .enum(['png', 'jpeg'])
                        .describe(
                            'Image type of the captured page screenshot.'
                        ),
                    figmaImageType: z
                        .enum(['png', 'jpeg'])
                        .describe('Image type of the captured Figma snapshot.'),
                })
                .describe('Metadata about what was compared.'),
        };
    }

    async handle(
        context: McpSessionContext,
        args: ComparePageWithDesignInput
    ): Promise<ComparePageWithDesignOutput> {
        const pageUrl: string = String(context.page.url());
        const pageTitle: string = String(await context.page.title());

        /**
         * 1) Get Figma snapshot
         */
        const figmaFormat: 'png' | 'jpg' =
            (args.figmaFormat as 'png' | 'jpg' | undefined) ?? 'png';

        const figmaScale: number | undefined =
            typeof args.figmaScale === 'number' ? args.figmaScale : undefined;

        const figmaSnapshot: { image: Buffer; type: ImageType } =
            await getFigmaDesignScreenshot({
                fileKey: args.figmaFileKey,
                nodeId: args.figmaNodeId,
                format: figmaFormat,
                scale: figmaScale,
            });

        /**
         * 2) Take page screenshot
         */
        let pagePng: Buffer;

        if (typeof args.selector === 'string' && args.selector.trim()) {
            const selector: string = args.selector.trim();
            const locator = context.page.locator(selector);

            const count: number = await locator.count();
            if (count === 0) {
                throw new Error(`Element not found for selector: ${selector}`);
            }

            // Screenshot the first matching element
            pagePng = await locator.first().screenshot({
                type: DEFAULT_SCREENSHOT_TYPE,
            });
        } else {
            const fullPage: boolean = args.fullPage !== false;
            pagePng = await context.page.screenshot({
                type: DEFAULT_SCREENSHOT_TYPE,
                fullPage,
            });
        }

        /**
         * 3) Compare via compareWithNotes
         */
        const pageSs: CompareScreenshotInfo = {
            image: pagePng,
            type: 'png',
            name: 'page',
        };

        const figmaSs: CompareScreenshotInfo = {
            image: figmaSnapshot.image,
            type: figmaSnapshot.type === 'jpeg' ? 'jpeg' : 'png',
            name: 'figma',
        };

        const result: { score: number; notes: string[] } =
            await compareWithNotes(pageSs, figmaSs, {
                weights: args.weights
                    ? {
                          mssim: args.weights.mssim,
                          vectorEmbedding: args.weights.imageEmbedding,
                          textEmbedding: args.weights.textEmbedding,
                      }
                    : undefined,

                mssim: {
                    mode: (args.mssimMode ?? DEFAULT_MSSIM_MODE) as
                        | 'raw'
                        | 'semantic',
                },

                // Forward optional preprocessing params if your compare modules support them.
                // If your compareWithNotes signature doesn't accept these, remove them.
                imageEmbedding: {
                    maxDim: args.maxDim,
                    jpegQuality:
                        typeof args.jpegQuality === 'number'
                            ? args.jpegQuality
                            : undefined,
                },

                textEmbedding: {
                    maxDim: args.maxDim,
                    jpegQuality:
                        typeof args.jpegQuality === 'number'
                            ? args.jpegQuality
                            : undefined,
                },
            } as any);

        return {
            score: result.score,
            notes: result.notes,
            meta: {
                pageUrl,
                pageTitle,
                figmaFileKey: args.figmaFileKey,
                figmaNodeId: args.figmaNodeId,
                selector:
                    typeof args.selector === 'string' && args.selector.trim()
                        ? args.selector.trim()
                        : null,
                fullPage: !(
                    typeof args.selector === 'string' && args.selector.trim()
                )
                    ? args.fullPage !== false
                    : false,
                pageImageType: 'png',
                figmaImageType: figmaSnapshot.type,
            },
        };
    }
}
