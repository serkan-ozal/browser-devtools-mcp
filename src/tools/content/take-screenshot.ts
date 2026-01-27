import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutputSchema,
    ToolOutputWithImage,
} from '../types';
import {
    createEnumTransformer,
    formattedTimeForFilename,
    getEnumKeyTuples,
} from '../../utils';

import os from 'os';
import path from 'path';

import jpegjs from 'jpeg-js';
import type { ElementHandle } from 'playwright';
import { PNG } from 'pngjs';
import { z } from 'zod';

export enum ScreenshotType {
    PNG = 'png',
    JPEG = 'jpeg',
}

export interface TakeScreenshotInput extends ToolInput {
    outputPath: string;
    name?: string;
    selector?: string;
    fullPage?: boolean;
    type?: ScreenshotType;
    quality?: number;
    includeBase64?: boolean;
}

export interface TakeScreenshotOutput extends Partial<ToolOutputWithImage> {
    filePath: string;
}

type ImageData = { width: number; height: number; data: Buffer };

const DEFAULT_SCREENSHOT_NAME: string = 'screenshot';
const DEFAULT_SCREENSHOT_TYPE: ScreenshotType = ScreenshotType.PNG;
const DEFAULT_SCREENSHOT_QUALITY: number = 100;

export class TakeScreenshot implements Tool {
    name(): string {
        return 'content_take-screenshot';
    }

    description(): string {
        return `Takes a screenshot of the current page or a specific element.
The screenshot is always saved to the file system and the file path is returned.
By default, the image data is NOT included in the response to reduce payload size.
If the AI assistant cannot access the MCP server's file system (e.g., remote MCP server, 
containerized environment, or different machine), set "includeBase64" to true to receive 
the image data directly in the response.`;
    }

    inputSchema(): ToolInputSchema {
        return {
            outputPath: z
                .string()
                .describe(
                    'Directory path where screenshot will be saved. By default OS tmp directory is used.'
                )
                .optional()
                .default(os.tmpdir()),
            name: z
                .string()
                .describe(
                    `Name of the screenshot. Default value is "${DEFAULT_SCREENSHOT_NAME}". ` +
                        'Note that final saved/exported file name is in the "{name}-{time}.{type}" format ' +
                        'in which "{time}" is in the "YYYYMMDD-HHmmss" format.'
                )
                .optional()
                .default(DEFAULT_SCREENSHOT_NAME),
            selector: z
                .string()
                .describe('CSS selector for element to take screenshot.')
                .optional(),
            fullPage: z
                .boolean()
                .describe(
                    'Whether to take a screenshot of the full scrollable page, instead of the currently visible viewport (default: "false").'
                )
                .optional()
                .default(false),
            type: z
                .enum(getEnumKeyTuples(ScreenshotType))
                .transform(createEnumTransformer(ScreenshotType))
                .describe(
                    `Page format. Valid values are: ${getEnumKeyTuples(ScreenshotType)}`
                )
                .optional()
                .default(DEFAULT_SCREENSHOT_TYPE),
            quality: z
                .number()
                .int()
                .min(0)
                .max(DEFAULT_SCREENSHOT_QUALITY)
                .describe(
                    'The quality of the image, between 0-100. Not applicable to png images.'
                )
                .optional(),
            includeBase64: z
                .boolean()
                .describe(
                    'If true, includes the screenshot image data (base64-encoded) in the response. ' +
                        'Default is false since the file path is usually sufficient when the AI assistant ' +
                        'can access the MCP server file system. Set to true when the AI assistant cannot ' +
                        'access the file system where the MCP server runs (e.g., remote server, container, ' +
                        'or different machine) and needs to receive the image directly in the response.'
                )
                .optional()
                .default(false),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            filePath: z
                .string()
                .describe('Full path of the saved screenshot file.'),
            image: z
                .object({
                    data: z.any().describe('Base64-encoded image data.'),
                    mimeType: z.string().describe('MIME type of the image.'),
                })
                .optional()
                .describe(
                    'Image data included only when "includeBase64" input parameter is set to true.'
                ),
        };
    }

    // Imported and adapter from Playwright:
    // https://github.com/microsoft/playwright/blob/342d6aa843f0c4470d71ba1671dacfdedc57ef79/packages/playwright-core/src/server/utils/imageUtils.ts#L43
    private _scaleImageToSize(
        image: ImageData,
        size: { width: number; height: number }
    ): ImageData {
        const { data: src, width: w1, height: h1 } = image;
        const w2: number = Math.max(1, Math.floor(size.width));
        const h2: number = Math.max(1, Math.floor(size.height));

        if (w1 === w2 && h1 === h2) {
            return image;
        }

        if (w1 <= 0 || h1 <= 0) {
            throw new Error('Invalid input image');
        }
        if (
            size.width <= 0 ||
            size.height <= 0 ||
            !isFinite(size.width) ||
            !isFinite(size.height)
        ) {
            throw new Error('Invalid output dimensions');
        }

        const clamp = (v: number, lo: number, hi: number): number =>
            v < lo ? lo : v > hi ? hi : v;

        // Catmull–Rom weights
        const weights = (t: number, o: Float32Array): void => {
            const t2 = t * t,
                t3 = t2 * t;
            o[0] = -0.5 * t + 1.0 * t2 - 0.5 * t3;
            o[1] = 1.0 - 2.5 * t2 + 1.5 * t3;
            o[2] = 0.5 * t + 2.0 * t2 - 1.5 * t3;
            o[3] = -0.5 * t2 + 0.5 * t3;
        };

        const srcRowStride: number = w1 * 4;
        const dstRowStride: number = w2 * 4;

        // Precompute X: indices, weights, and byte offsets (idx*4)
        const xOff = new Int32Array(w2 * 4); // byte offsets = xIdx*4
        const xW = new Float32Array(w2 * 4);
        const wx = new Float32Array(4);
        const xScale: number = w1 / w2;
        for (let x: number = 0; x < w2; x++) {
            const sx: number = (x + 0.5) * xScale - 0.5;
            const sxi: number = Math.floor(sx);
            const t: number = sx - sxi;
            weights(t, wx);
            const b: number = x * 4;
            const i0: number = clamp(sxi - 1, 0, w1 - 1);
            const i1: number = clamp(sxi + 0, 0, w1 - 1);
            const i2: number = clamp(sxi + 1, 0, w1 - 1);
            const i3: number = clamp(sxi + 2, 0, w1 - 1);
            xOff[b + 0] = i0 << 2;
            xOff[b + 1] = i1 << 2;
            xOff[b + 2] = i2 << 2;
            xOff[b + 3] = i3 << 2;
            xW[b + 0] = wx[0];
            xW[b + 1] = wx[1];
            xW[b + 2] = wx[2];
            xW[b + 3] = wx[3];
        }

        // Precompute Y: indices, weights, and row-base byte offsets (y*rowStride)
        const yRow = new Int32Array(h2 * 4); // row base in bytes
        const yW = new Float32Array(h2 * 4);
        const wy = new Float32Array(4);
        const yScale: number = h1 / h2;
        for (let y: number = 0; y < h2; y++) {
            const sy: number = (y + 0.5) * yScale - 0.5;
            const syi: number = Math.floor(sy);
            const t: number = sy - syi;
            weights(t, wy);
            const b: number = y * 4;
            const j0: number = clamp(syi - 1, 0, h1 - 1);
            const j1: number = clamp(syi + 0, 0, h1 - 1);
            const j2: number = clamp(syi + 1, 0, h1 - 1);
            const j3: number = clamp(syi + 2, 0, h1 - 1);
            yRow[b + 0] = j0 * srcRowStride;
            yRow[b + 1] = j1 * srcRowStride;
            yRow[b + 2] = j2 * srcRowStride;
            yRow[b + 3] = j3 * srcRowStride;
            yW[b + 0] = wy[0];
            yW[b + 1] = wy[1];
            yW[b + 2] = wy[2];
            yW[b + 3] = wy[3];
        }

        const dst = new Uint8Array(w2 * h2 * 4);

        for (let y: number = 0; y < h2; y++) {
            const yb: number = y * 4;
            const rb0: number = yRow[yb + 0],
                rb1 = yRow[yb + 1],
                rb2 = yRow[yb + 2],
                rb3 = yRow[yb + 3];
            const wy0: number = yW[yb + 0],
                wy1 = yW[yb + 1],
                wy2 = yW[yb + 2],
                wy3 = yW[yb + 3];
            const dstBase: number = y * dstRowStride;

            for (let x: number = 0; x < w2; x++) {
                const xb: number = x * 4;
                const xo0: number = xOff[xb + 0],
                    xo1 = xOff[xb + 1],
                    xo2 = xOff[xb + 2],
                    xo3 = xOff[xb + 3];
                const wx0: number = xW[xb + 0],
                    wx1 = xW[xb + 1],
                    wx2 = xW[xb + 2],
                    wx3 = xW[xb + 3];
                const di: number = dstBase + (x << 2);

                // unrolled RGBA
                for (let c: number = 0; c < 4; c++) {
                    const r0: number =
                        src[rb0 + xo0 + c] * wx0 +
                        src[rb0 + xo1 + c] * wx1 +
                        src[rb0 + xo2 + c] * wx2 +
                        src[rb0 + xo3 + c] * wx3;
                    const r1: number =
                        src[rb1 + xo0 + c] * wx0 +
                        src[rb1 + xo1 + c] * wx1 +
                        src[rb1 + xo2 + c] * wx2 +
                        src[rb1 + xo3 + c] * wx3;
                    const r2: number =
                        src[rb2 + xo0 + c] * wx0 +
                        src[rb2 + xo1 + c] * wx1 +
                        src[rb2 + xo2 + c] * wx2 +
                        src[rb2 + xo3 + c] * wx3;
                    const r3: number =
                        src[rb3 + xo0 + c] * wx0 +
                        src[rb3 + xo1 + c] * wx1 +
                        src[rb3 + xo2 + c] * wx2 +
                        src[rb3 + xo3 + c] * wx3;
                    const v: number = r0 * wy0 + r1 * wy1 + r2 * wy2 + r3 * wy3;
                    dst[di + c] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
                }
            }
        }

        return { data: Buffer.from(dst.buffer), width: w2, height: h2 };
    }

    // Imported and adapter from Playwright:
    // https://github.com/microsoft/playwright/blob/391081ed1dac7ee1ebb1ccb88c31e7e3c3dd32ba/packages/playwright/src/mcp/browser/tools/screenshot.ts#L86
    private _scaleImageToFitMessage(
        buffer: Buffer,
        screenshotType: ScreenshotType
    ): Buffer {
        // https://docs.claude.com/en/docs/build-with-claude/vision#evaluate-image-size
        // Not more than 1.15 megapixel, linear size not more than 1568.
        // Additionally, we aim for max ~800KB buffer size to stay well under 1MB limit.

        const MAX_BUFFER_SIZE: number = 800 * 1024; // 800KB target
        const MAX_PIXELS: number = 1.15 * 1024 * 1024; // 1.15 megapixel
        const MAX_LINEAR_SIZE: number = 1568;

        const image =
            screenshotType === ScreenshotType.PNG
                ? PNG.sync.read(buffer)
                : jpegjs.decode(buffer, { maxMemoryUsageInMB: 512 });
        const pixels: number = image.width * image.height;

        // Initial shrink based on Claude's limits
        let shrink: number = Math.min(
            MAX_LINEAR_SIZE / image.width,
            MAX_LINEAR_SIZE / image.height,
            Math.sqrt(MAX_PIXELS / pixels)
        );

        // If already within limits, check buffer size
        if (shrink > 1) {
            shrink = 1;
        }

        let width: number = (image.width * shrink) | 0;
        let height: number = (image.height * shrink) | 0;
        let scaledImage: ImageData = this._scaleImageToSize(image, {
            width,
            height,
        });

        // Convert PNG to JPEG for better compression, or use lower quality JPEG
        let result: Buffer;
        let currentType: ScreenshotType = screenshotType;
        let quality: number = screenshotType === ScreenshotType.PNG ? 75 : 70;

        if (screenshotType === ScreenshotType.PNG) {
            // Convert PNG to JPEG for better compression (smaller file size)
            result = jpegjs.encode(scaledImage, quality).data;
            currentType = ScreenshotType.JPEG;
        } else {
            result = jpegjs.encode(scaledImage, quality).data;
        }

        // Buffer size check - if still too large, apply more aggressive scaling
        let iterations: number = 0;
        const MAX_ITERATIONS: number = 5;
        while (result.length > MAX_BUFFER_SIZE && iterations < MAX_ITERATIONS) {
            // Reduce quality
            quality = Math.max(50, quality - 10);

            // If reducing quality is not enough, increase scaling
            if (quality <= 50 && result.length > MAX_BUFFER_SIZE) {
                shrink *= 0.85; // Scale down by 15%
                width = Math.max(200, (image.width * shrink) | 0);
                height = Math.max(200, (image.height * shrink) | 0);
                scaledImage = this._scaleImageToSize(image, { width, height });
            }

            result = jpegjs.encode(scaledImage, quality).data;
            iterations++;
        }

        return result;
    }

    async handle(
        context: ToolSessionContext,
        args: TakeScreenshotInput
    ): Promise<TakeScreenshotOutput> {
        const screenshotType: ScreenshotType =
            args.type || DEFAULT_SCREENSHOT_TYPE;
        const filename: string = `${args.name || DEFAULT_SCREENSHOT_NAME}-${formattedTimeForFilename()}.${screenshotType}`;
        const filePath: string = path.resolve(args.outputPath, filename);
        const quality: number | undefined =
            screenshotType === ScreenshotType.PNG
                ? undefined
                : (args.quality ?? DEFAULT_SCREENSHOT_QUALITY);

        const options: any = {
            path: filePath,
            type: screenshotType,
            fullPage: !!args.fullPage,
            quality,
        };

        if (args.selector) {
            const element: ElementHandle | null = await context.page.$(
                args.selector
            );
            if (!element) {
                throw new Error(`Element not found: ${args.selector}`);
            }
            options.element = element;
        }

        const screenshot: Buffer<ArrayBufferLike> =
            await context.page.screenshot(options);

        const result: TakeScreenshotOutput = {
            filePath,
        };

        // Only include image data if explicitly requested
        if (args.includeBase64) {
            result.image = {
                data: this._scaleImageToFitMessage(screenshot, screenshotType),
                mimeType: `image/${screenshotType}`,
            };
        }

        return result;
    }
}
