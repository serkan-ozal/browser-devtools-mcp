import { ScreenshotInfo } from './types';

import sharp from 'sharp';
import ssim from 'ssim.js';

export type Mode = 'raw' | 'semantic';

export type CompareOptions = {
    /**
     * Compare mode:
     * - raw: strict pixel-level structural similarity
     * - semantic: layout-oriented preprocessing (downscale + grayscale + blur)
     *
     * Default: 'semantic'
     */
    mode?: Mode;

    /**
     * Optional override for reference canvas size.
     * If omitted, uses figma image dimensions as reference canvas.
     */
    canvasWidth?: number;

    /**
     * Optional override for reference canvas size.
     * If omitted, uses figma image dimensions as reference canvas.
     */
    canvasHeight?: number;
};

type LoadedImage = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};

export type CompareResult = {
    /**
     * Similarity score in [0..1].
     * Higher means more structurally similar.
     */
    score: number;
};

const DEFAULT_GRAYSCALE: boolean = false;
const DEFAULT_BLUR: number = 10;

function _clamp01(v: number): number {
    if (!Number.isFinite(v)) {
        return 0;
    }
    return Math.max(0, Math.min(1, v));
}

/**
 * Loads an image buffer and normalizes it into the SAME CANVAS SIZE using fit='contain'
 * (no stretching). This matters a lot for UI screenshots:
 * stretching (fit='fill') can destroy SSIM even when layouts are similar.
 *
 * Modes:
 * - raw:    normalize only (contain + padding), then raw RGBA
 * - semantic: normalize + downscale + grayscale + blur(1) to suppress data/text noise
 */
async function _loadNormalized(
    input: Buffer,
    canvasWidth: number,
    canvasHeight: number,
    mode: Mode
): Promise<LoadedImage> {
    let img: sharp.Sharp;

    if (mode === 'semantic') {
        img = sharp(input).resize(canvasWidth, canvasHeight, {
            fit: 'cover',
            position: 'centre',
        });

        const w: number = Math.max(1, Math.floor(canvasWidth / 2));
        const h: number = Math.max(1, Math.floor(canvasHeight / 2));

        img = img
            .resize(w, h, {
                fit: 'cover',
                position: 'centre',
            })
            // Enabling grayscale increases false positives
            .grayscale(DEFAULT_GRAYSCALE)
            .blur(DEFAULT_BLUR);
    } else {
        img = sharp(input).resize(canvasWidth, canvasHeight, {
            fit: 'cover',
            position: 'centre',
        });
    }

    const out: { data: Buffer; info: sharp.OutputInfo } = await img
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const clamped: Uint8ClampedArray = new Uint8ClampedArray(
        out.data.buffer,
        out.data.byteOffset,
        out.data.byteLength
    );

    return {
        data: clamped,
        width: out.info.width,
        height: out.info.height,
    };
}

function _computeSsim(a: LoadedImage, b: LoadedImage): number {
    const details: any = ssim(
        { data: a.data, width: a.width, height: a.height },
        { data: b.data, width: b.width, height: b.height }
    );

    // Some builds expose `mssim`, some `ssim`.
    const rawScore: number = Number(details.mssim ?? details.ssim ?? 0);
    return _clamp01(rawScore);
}

/**
 * Compares a page screenshot against a Figma design screenshot using MSSIM.
 *
 * Notes:
 * - Uses Figma dimensions as the reference canvas by default (unless overridden).
 * - Normalizes both images into the same canvas using contain+padding (no stretching).
 * - 'semantic' mode suppresses data/text noise and focuses more on layout structure.
 */
export async function compare(
    page: ScreenshotInfo,
    figma: ScreenshotInfo,
    options?: CompareOptions
): Promise<CompareResult> {
    const mode: Mode = options?.mode ?? 'semantic';

    let canvasWidth: number | undefined = options?.canvasWidth;
    let canvasHeight: number | undefined = options?.canvasHeight;

    if (
        typeof canvasWidth !== 'number' ||
        !Number.isFinite(canvasWidth) ||
        canvasWidth <= 0 ||
        typeof canvasHeight !== 'number' ||
        !Number.isFinite(canvasHeight) ||
        canvasHeight <= 0
    ) {
        // Use the Figma image dimensions as the reference canvas.
        const figmaMeta: sharp.Metadata = await sharp(figma.image).metadata();
        canvasWidth = figmaMeta.width ?? 0;
        canvasHeight = figmaMeta.height ?? 0;

        if (canvasWidth <= 0 || canvasHeight <= 0) {
            throw new Error('Failed to read Figma image dimensions.');
        }
    }

    const figmaImg: LoadedImage = await _loadNormalized(
        figma.image,
        canvasWidth,
        canvasHeight,
        mode
    );

    const pageImg: LoadedImage = await _loadNormalized(
        page.image,
        canvasWidth,
        canvasHeight,
        mode
    );

    const score: number = _computeSsim(figmaImg, pageImg);

    return { score };
}
