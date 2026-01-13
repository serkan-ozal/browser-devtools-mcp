import { ScreenshotInfo } from './types';

import { compare as compareMssim } from './compare-mssim';
import type {
    CompareOptions as MssimCompareOptions,
    CompareResult as MssimCompareResult,
} from './compare-mssim';

import { compare as compareImage } from './compare-image-embedding';
import type {
    CompareOptions as ImageCompareOptions,
    CompareResult as ImageCompareResult,
} from './compare-image-embedding';

import { compare as compareText } from './compare-text-embedding';
import type {
    CompareOptions as TextCompareOptions,
    CompareResult as TextCompareResult,
} from './compare-text-embedding';

/**
 * ------------------------------------------------------------
 * Types
 * ------------------------------------------------------------
 */

export type CompareAllOptions = {
    /**
     * Relative weights for each signal.
     * Missing / inactive signals are ignored and weights renormalized.
     */
    weights?: {
        mssim?: number;
        vectorEmbedding?: number;
        textEmbedding?: number;
    };

    /**
     * Forwarded directly to compare-mssim
     */
    mssim?: MssimCompareOptions;

    /**
     * Forwarded directly to compare-image-embedding
     */
    imageEmbedding?: ImageCompareOptions;

    /**
     * Forwarded directly to compare-text-embedding
     */
    textEmbedding?: TextCompareOptions;
};

export type CompareAllResult = {
    /**
     * Final similarity score in [0..1]
     */
    score: number;

    /**
     * Human-readable explanation of what contributed
     */
    notes: string[];
};

/**
 * ------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------
 */

const DEFAULT_MSSIM_WEIGHT: number = 0.25;
const DEFAULT_VECTOR_EMBEDDING_WEIGHT: number = 0.5;
const DEFAULT_TEXT_EMBEDDING_WEIGHT: number = 0.25;

/**
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */

function _clamp01(v: number): number {
    if (!Number.isFinite(v)) {
        return 0;
    }
    return Math.max(0, Math.min(1, v));
}

function _weightOrDefault(v: unknown, def: number): number {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return v;
    }
    return def;
}

/**
 * ------------------------------------------------------------
 * Main combiner
 * ------------------------------------------------------------
 *
 * - MSSIM is assumed to always work
 * - Image / text embedding may return `undefined`
 * - Only successful signals participate in the weighted average
 */
export async function compareWithNotes(
    page: ScreenshotInfo,
    figma: ScreenshotInfo,
    options?: CompareAllOptions
): Promise<CompareAllResult> {
    const notes: string[] = [];

    const wMssim: number = _weightOrDefault(
        options?.weights?.mssim,
        DEFAULT_MSSIM_WEIGHT
    );
    const wVector: number = _weightOrDefault(
        options?.weights?.vectorEmbedding,
        DEFAULT_VECTOR_EMBEDDING_WEIGHT
    );
    const wText: number = _weightOrDefault(
        options?.weights?.textEmbedding,
        DEFAULT_TEXT_EMBEDDING_WEIGHT
    );

    /**
     * --------------------------------------------------------
     * 1) MSSIM (always)
     * --------------------------------------------------------
     */
    const mssimRes: MssimCompareResult = await compareMssim(
        page,
        figma,
        options?.mssim
    );
    const mssimScore: number = _clamp01(mssimRes.score);

    notes.push(`mssim=${mssimScore.toFixed(5)}`);

    /**
     * --------------------------------------------------------
     * 2) Image embedding (optional)
     * --------------------------------------------------------
     */
    let imageScore: number | undefined;

    try {
        const res: ImageCompareResult | undefined = await compareImage(
            page,
            figma,
            options?.imageEmbedding
        );
        if (res && typeof res.score === 'number') {
            imageScore = _clamp01(res.score);
            notes.push(`image-embedding=${imageScore.toFixed(5)}`);
        } else {
            notes.push('image-embedding=skipped (inactive)');
        }
    } catch (err) {
        notes.push(
            `image-embedding=skipped (${err instanceof Error ? err.message : String(err)})`
        );
    }

    /**
     * --------------------------------------------------------
     * 3) Vision → text → text embedding (optional)
     * --------------------------------------------------------
     */
    let textScore: number | undefined;

    try {
        const res: TextCompareResult | undefined = await compareText(
            page,
            figma,
            options?.textEmbedding
        );
        if (res && typeof res.score === 'number') {
            textScore = _clamp01(res.score);
            notes.push(`text-embedding=${textScore.toFixed(5)}`);
        } else {
            notes.push('text-embedding=skipped (inactive)');
        }
    } catch (err) {
        notes.push(
            `text-embedding=skipped (${err instanceof Error ? err.message : String(err)})`
        );
    }

    /**
     * --------------------------------------------------------
     * Combine scores (weight renormalization)
     * --------------------------------------------------------
     */
    const parts: Array<{ score: number; weight: number; name: string }> = [
        { name: 'mssim', score: mssimScore, weight: wMssim },
    ];

    if (typeof imageScore === 'number') {
        parts.push({
            name: 'image-embedding',
            score: imageScore,
            weight: wVector,
        });
    }

    if (typeof textScore === 'number') {
        parts.push({
            name: 'text-embedding',
            score: textScore,
            weight: wText,
        });
    }

    const totalWeight: number = parts.reduce((s, p) => s + p.weight, 0);

    const combined: number =
        totalWeight > 0
            ? parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0)
            : 0;

    const score: number = _clamp01(combined);

    notes.push(
        `combined=${score.toFixed(5)} (signals=${parts
            .map((p) => p.name)
            .join(', ')})`
    );

    return { score, notes };
}

export * from './types';
export { CompareOptions as MssimCompareOptions } from './compare-mssim';
export { CompareOptions as ImageCompareOptions } from './compare-image-embedding';
export { CompareOptions as TextCompareOptions } from './compare-text-embedding';
