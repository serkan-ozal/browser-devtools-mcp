import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const DEFAULT_WAIT_MS: number = 0;
const MAX_WAIT_MS: number = 30_000;

type MetricRating = 'good' | 'needs_improvement' | 'poor' | 'not_available';

type WebVitalsRating = {
    rating: MetricRating;
    value: number | null;
    unit: 'ms' | 'score';
    thresholds: {
        good: number;
        poor: number;
    };
};

type WebVitalsRecommendations = {
    coreWebVitalsPassed: boolean;
    summary: Array<string>;

    lcp: Array<string>;
    inp: Array<string>;
    cls: Array<string>;

    ttfb: Array<string>;
    fcp: Array<string>;

    general: Array<string>;
};

export interface GetWebVitalsInput extends ToolInput {
    /**
     * Optional wait duration (ms) before reading metrics.
     * Useful to allow LCP/INP/CLS to settle after interactions.
     */
    waitMs?: number;

    /**
     * If true, returns extra debug details (entry counts and LCP element selector hint).
     */
    includeDebug?: boolean;
}

export interface GetWebVitalsOutput extends ToolOutput {
    url: string;
    title: string;
    timestampMs: number;

    metrics: {
        /**
         * Core Web Vitals
         */
        lcpMs: number | null;
        inpMs: number | null;
        cls: number | null;

        /**
         * Supporting diagnostics
         */
        ttfbMs: number | null;
        fcpMs: number | null;
    };

    ratings: {
        lcp: WebVitalsRating;
        inp: WebVitalsRating;
        cls: WebVitalsRating;
        ttfb: WebVitalsRating;
        fcp: WebVitalsRating;
    };

    recommendations: WebVitalsRecommendations;

    notes: Array<string>;

    debug?: {
        waitMs: number;
        entries: {
            navigation: number;
            paint: number;
            lcp: number;
            layoutShift: number;
            eventTiming: number;
        };
        lastLcpSelectorHint: string | null;
        lastLcpTagName: string | null;
    };
}

function rateMs(
    value: number | null,
    good: number,
    poor: number
): WebVitalsRating {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
            rating: 'not_available',
            value: null,
            unit: 'ms',
            thresholds: { good, poor },
        };
    }

    if (value <= good) {
        return {
            rating: 'good',
            value,
            unit: 'ms',
            thresholds: { good, poor },
        };
    }

    if (value > poor) {
        return {
            rating: 'poor',
            value,
            unit: 'ms',
            thresholds: { good, poor },
        };
    }

    return {
        rating: 'needs_improvement',
        value,
        unit: 'ms',
        thresholds: { good, poor },
    };
}

function rateScore(
    value: number | null,
    good: number,
    poor: number
): WebVitalsRating {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
            rating: 'not_available',
            value: null,
            unit: 'score',
            thresholds: { good, poor },
        };
    }

    if (value <= good) {
        return {
            rating: 'good',
            value,
            unit: 'score',
            thresholds: { good, poor },
        };
    }

    if (value > poor) {
        return {
            rating: 'poor',
            value,
            unit: 'score',
            thresholds: { good, poor },
        };
    }

    return {
        rating: 'needs_improvement',
        value,
        unit: 'score',
        thresholds: { good, poor },
    };
}

function formatRating(r: MetricRating): string {
    if (r === 'needs_improvement') {
        return 'needs improvement';
    }
    if (r === 'not_available') {
        return 'not available';
    }
    return r;
}

function buildRecommendations(params: {
    ratings: GetWebVitalsOutput['ratings'];
    lcpSelectorHint: string | null;
}): WebVitalsRecommendations {
    const lcpRating: MetricRating = params.ratings.lcp.rating;
    const inpRating: MetricRating = params.ratings.inp.rating;
    const clsRating: MetricRating = params.ratings.cls.rating;

    const ttfbRating: MetricRating = params.ratings.ttfb.rating;
    const fcpRating: MetricRating = params.ratings.fcp.rating;

    const coreWebVitalsPassed: boolean =
        lcpRating === 'good' && inpRating === 'good' && clsRating === 'good';

    const summary: Array<string> = [];

    if (coreWebVitalsPassed) {
        summary.push(
            'Core Web Vitals look good (LCP, INP and CLS are all within recommended thresholds).'
        );
    } else {
        summary.push(
            'Core Web Vitals need attention. Focus on the worst-rated metric first (LCP, INP, or CLS).'
        );
    }

    const lcp: Array<string> = [];
    const inp: Array<string> = [];
    const cls: Array<string> = [];
    const ttfb: Array<string> = [];
    const fcp: Array<string> = [];
    const general: Array<string> = [];

    if (params.lcpSelectorHint) {
        general.push(
            `LCP element hint (best-effort): ${params.lcpSelectorHint}`
        );
    }

    // LCP guidance
    if (lcpRating === 'poor' || lcpRating === 'needs_improvement') {
        lcp.push(
            'Optimize the LCP element (often the hero image, headline, or main content above the fold).'
        );
        lcp.push(
            'Reduce render-blocking resources (critical CSS, JS). Consider inlining critical CSS and deferring non-critical JS.'
        );
        lcp.push(
            'Preload the LCP resource (e.g., <link rel="preload"> for the hero image/font) and ensure it is discoverable without heavy JS.'
        );
        lcp.push(
            'Improve server response and caching. A slow TTFB often delays LCP.'
        );
        lcp.push(
            'Avoid client-only rendering for above-the-fold content when possible; stream/SSR critical content.'
        );
    } else if (lcpRating === 'good') {
        lcp.push(
            'LCP is within the recommended threshold. Keep the above-the-fold path lean.'
        );
    } else {
        lcp.push(
            'LCP is not available in this browser/session. Consider using Chromium or a page-load scenario that produces LCP entries.'
        );
    }

    // INP guidance
    if (inpRating === 'poor' || inpRating === 'needs_improvement') {
        inp.push(
            'Break up long main-thread tasks. Aim to keep tasks under ~50ms (split work, yield to the event loop).'
        );
        inp.push(
            'Reduce expensive work in input handlers (click, pointer, key events). Move non-urgent work to idle time.'
        );
        inp.push(
            'Avoid synchronous layout thrash during interactions (batch DOM reads/writes, reduce forced reflow).'
        );
        inp.push(
            'Defer heavy third-party scripts and reduce JavaScript bundle size to improve responsiveness.'
        );
    } else if (inpRating === 'good') {
        inp.push(
            'INP is within the recommended threshold. Keep interaction handlers lightweight.'
        );
    } else {
        inp.push(
            'INP is not available in this browser/session. It requires Event Timing support and user interactions.'
        );
    }

    // CLS guidance
    if (clsRating === 'poor' || clsRating === 'needs_improvement') {
        cls.push(
            'Reserve space for images/iframes/ads (set width/height or aspect-ratio) to prevent layout jumps.'
        );
        cls.push(
            'Avoid inserting content above existing content unless it is in response to a user interaction.'
        );
        cls.push(
            'Use stable font loading (font-display: swap/optional) and consider preloading critical fonts to reduce text shifts.'
        );
        cls.push(
            'Be careful with late-loading banners/toasts; render them in reserved containers.'
        );
    } else if (clsRating === 'good') {
        cls.push(
            'CLS is within the recommended threshold. Keep layout stable during load and async updates.'
        );
    } else {
        cls.push(
            'CLS is not available in this browser/session. Consider Chromium or a scenario with visible layout changes.'
        );
    }

    // TTFB guidance (supporting)
    if (ttfbRating === 'poor' || ttfbRating === 'needs_improvement') {
        ttfb.push(
            'Improve backend latency: reduce server processing time, optimize DB queries, and eliminate unnecessary middleware.'
        );
        ttfb.push(
            'Enable CDN/edge caching where possible. Use caching headers and avoid dynamic responses for static content.'
        );
        ttfb.push(
            'Reduce cold-start and TLS overhead (keep-alive, warm pools, edge runtimes).'
        );
    } else if (ttfbRating === 'good') {
        ttfb.push(
            'TTFB is good. Backend/network latency is unlikely to be the primary bottleneck.'
        );
    } else {
        ttfb.push('TTFB is not available in this browser/session.');
    }

    // FCP guidance (supporting)
    if (fcpRating === 'poor' || fcpRating === 'needs_improvement') {
        fcp.push(
            'Reduce render-blocking CSS/JS and prioritize critical content for first paint.'
        );
        fcp.push(
            'Optimize above-the-fold resources and avoid large synchronous scripts during initial load.'
        );
        fcp.push(
            'Consider code-splitting and preloading critical assets to improve first paint.'
        );
    } else if (fcpRating === 'good') {
        fcp.push('FCP is good. The page provides early visual feedback.');
    } else {
        fcp.push('FCP is not available in this browser/session.');
    }

    general.push(
        'For reliable debugging, capture metrics after navigation and after user actions that trigger loading or layout changes.'
    );
    general.push(
        'If values look unstable, try adding waitMs (e.g., 1000-3000) and re-measure after the UI settles.'
    );

    return {
        coreWebVitalsPassed,
        summary,
        lcp,
        inp,
        cls,
        ttfb,
        fcp,
        general,
    };
}

export class GetWebVitals implements Tool {
    name(): string {
        return 'o11y_get-web-vitals';
    }

    description(): string {
        return `
Collects Web Vitals-style performance metrics and provides recommendations based on Google's thresholds.

Core Web Vitals:
- LCP (ms): Largest Contentful Paint (good <= 2500, poor > 4000)
- INP (ms): Interaction to Next Paint (good <= 200, poor > 500)
- CLS (score): Cumulative Layout Shift (good <= 0.1, poor > 0.25)

Supporting diagnostics:
- TTFB (ms): Time to First Byte (good <= 800, poor > 1800)
- FCP (ms): First Contentful Paint (good <= 1800, poor > 3000)

Guidance:
- Call after navigation and after user actions.
- If you need more stable LCP/CLS/INP, pass waitMs (e.g. 1000-3000).
- Some metrics may be unavailable depending on browser support and whether interactions occurred.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            waitMs: z
                .number()
                .int()
                .min(0)
                .max(MAX_WAIT_MS)
                .optional()
                .default(DEFAULT_WAIT_MS)
                .describe(
                    'Optional wait duration in milliseconds before reading metrics (default: 0).'
                ),
            includeDebug: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                    'If true, returns additional debug details such as entry counts and LCP element hint.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        const ratingSchema = z.object({
            rating: z
                .enum(['good', 'needs_improvement', 'poor', 'not_available'])
                .describe('Rating based on Google thresholds.'),
            value: z
                .number()
                .nullable()
                .describe('Metric value (null if unavailable).'),
            unit: z.enum(['ms', 'score']).describe('Unit of the metric.'),
            thresholds: z
                .object({
                    good: z
                        .number()
                        .describe('Upper bound for the "good" rating.'),
                    poor: z
                        .number()
                        .describe('Lower bound for the "poor" rating.'),
                })
                .describe('Thresholds used for rating.'),
        });

        return {
            url: z.string().describe('Current page URL.'),
            title: z.string().describe('Current page title.'),
            timestampMs: z
                .number()
                .int()
                .describe(
                    'Unix epoch timestamp (ms) when the metrics were captured.'
                ),
            metrics: z
                .object({
                    lcpMs: z
                        .number()
                        .nullable()
                        .describe('Largest Contentful Paint in milliseconds.'),
                    inpMs: z
                        .number()
                        .nullable()
                        .describe(
                            'Interaction to Next Paint in milliseconds (best-effort approximation).'
                        ),
                    cls: z
                        .number()
                        .nullable()
                        .describe('Cumulative Layout Shift score.'),
                    ttfbMs: z
                        .number()
                        .nullable()
                        .describe('Time to First Byte in milliseconds.'),
                    fcpMs: z
                        .number()
                        .nullable()
                        .describe('First Contentful Paint in milliseconds.'),
                })
                .describe('Raw metric values (null if unavailable).'),
            ratings: z
                .object({
                    lcp: ratingSchema.describe('LCP rating.'),
                    inp: ratingSchema.describe('INP rating.'),
                    cls: ratingSchema.describe('CLS rating.'),
                    ttfb: ratingSchema.describe('TTFB rating.'),
                    fcp: ratingSchema.describe('FCP rating.'),
                })
                .describe('Ratings computed from Google thresholds.'),
            recommendations: z
                .object({
                    coreWebVitalsPassed: z
                        .boolean()
                        .describe(
                            'True if all Core Web Vitals are rated "good".'
                        ),
                    summary: z
                        .array(z.string())
                        .describe(
                            'High-level summary and prioritization guidance.'
                        ),
                    lcp: z
                        .array(z.string())
                        .describe('Recommendations for improving LCP.'),
                    inp: z
                        .array(z.string())
                        .describe('Recommendations for improving INP.'),
                    cls: z
                        .array(z.string())
                        .describe('Recommendations for improving CLS.'),
                    ttfb: z
                        .array(z.string())
                        .describe('Recommendations for improving TTFB.'),
                    fcp: z
                        .array(z.string())
                        .describe('Recommendations for improving FCP.'),
                    general: z
                        .array(z.string())
                        .describe('General measurement and debugging notes.'),
                })
                .describe(
                    'Recommendations based on the measured values and their ratings.'
                ),
            notes: z
                .array(z.string())
                .describe(
                    'Notes about metric availability, browser limitations, and interpretation.'
                ),
            debug: z
                .object({
                    waitMs: z
                        .number()
                        .int()
                        .describe(
                            'Actual wait duration used before reading metrics.'
                        ),
                    entries: z
                        .object({
                            navigation: z
                                .number()
                                .int()
                                .describe('Count of navigation entries.'),
                            paint: z
                                .number()
                                .int()
                                .describe('Count of paint entries.'),
                            lcp: z
                                .number()
                                .int()
                                .describe(
                                    'Count of largest-contentful-paint entries.'
                                ),
                            layoutShift: z
                                .number()
                                .int()
                                .describe('Count of layout-shift entries.'),
                            eventTiming: z
                                .number()
                                .int()
                                .describe('Count of event timing entries.'),
                        })
                        .describe(
                            'Counts of PerformanceEntry types used to compute metrics.'
                        ),
                    lastLcpSelectorHint: z
                        .string()
                        .nullable()
                        .describe(
                            'Best-effort selector hint for the last LCP element (if available).'
                        ),
                    lastLcpTagName: z
                        .string()
                        .nullable()
                        .describe(
                            'Tag name of the last LCP element (if available).'
                        ),
                })
                .optional()
                .describe('Optional debug details.'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: GetWebVitalsInput
    ): Promise<GetWebVitalsOutput> {
        const waitMs: number = args.waitMs ?? DEFAULT_WAIT_MS;
        const includeDebug: boolean = args.includeDebug === true;

        const pageUrl: string = String(context.page.url());
        const pageTitle: string = String(await context.page.title());
        const timestampMs: number = Date.now();

        const result: any = await context.page.evaluate(
            async ({
                waitMsEval,
                includeDebugEval,
            }: {
                waitMsEval: number;
                includeDebugEval: boolean;
            }): Promise<any> => {
                const notes: Array<string> = [];

                const sleep = (ms: number): Promise<void> => {
                    return new Promise(
                        (resolve: (value: void) => void): void => {
                            setTimeout((): void => resolve(), ms);
                        }
                    );
                };

                if (waitMsEval > 0) {
                    await sleep(waitMsEval);
                }

                // -------------------------
                // TTFB (Navigation Timing)
                // -------------------------
                let ttfbMs: number | null = null;
                const navEntries: PerformanceEntry[] =
                    performance.getEntriesByType('navigation') ?? [];
                if (navEntries.length > 0) {
                    const nav: any = navEntries[0] as any;
                    if (
                        typeof nav.responseStart === 'number' &&
                        nav.responseStart >= 0
                    ) {
                        ttfbMs = nav.responseStart;
                    }
                } else {
                    notes.push(
                        'TTFB: navigation entries not available (older browser or restricted timing).'
                    );
                }

                // -------------------------
                // FCP (Paint Timing)
                // -------------------------
                let fcpMs: number | null = null;
                const paintEntries: PerformanceEntry[] =
                    performance.getEntriesByType('paint') ?? [];
                const fcp: PerformanceEntry | undefined = paintEntries.find(
                    (e: PerformanceEntry): boolean =>
                        e.name === 'first-contentful-paint'
                );
                if (fcp && typeof fcp.startTime === 'number') {
                    fcpMs = fcp.startTime;
                } else {
                    notes.push(
                        'FCP: paint entries not available (browser may not support Paint Timing).'
                    );
                }

                // -------------------------
                // LCP (LargestContentfulPaint)
                // -------------------------
                let lcpMs: number | null = null;
                let lastLcpEl: Element | null = null;

                const lcpEntries: any[] =
                    (performance.getEntriesByType(
                        'largest-contentful-paint'
                    ) as any[]) ?? [];

                if (lcpEntries.length > 0) {
                    const last: any = lcpEntries[lcpEntries.length - 1];
                    if (typeof last.startTime === 'number') {
                        lcpMs = last.startTime;
                    }
                    if (last.element && last.element instanceof Element) {
                        lastLcpEl = last.element as Element;
                    }
                } else {
                    notes.push(
                        'LCP: largest-contentful-paint entries not available (requires LCP support).'
                    );
                }

                const selectorHintFor = (el: Element | null): string | null => {
                    if (!el) {
                        return null;
                    }

                    const dt: string | null =
                        el.getAttribute('data-testid') ||
                        el.getAttribute('data-test-id') ||
                        el.getAttribute('data-test');

                    if (dt && dt.trim()) {
                        return (
                            '[data-testid="' + dt.replace(/"/g, '\\"') + '"]'
                        );
                    }

                    const ds: string | null = el.getAttribute('data-selector');
                    if (ds && ds.trim()) {
                        return (
                            '[data-selector="' + ds.replace(/"/g, '\\"') + '"]'
                        );
                    }

                    if ((el as any).id) {
                        try {
                            return '#' + (CSS as any).escape((el as any).id);
                        } catch {
                            return '#' + String((el as any).id);
                        }
                    }

                    return el.tagName ? el.tagName.toLowerCase() : null;
                };

                // -------------------------
                // CLS (Layout Instability)
                // -------------------------
                let cls: number | null = null;
                const layoutShiftEntries: any[] =
                    (performance.getEntriesByType('layout-shift') as any[]) ??
                    [];

                if (layoutShiftEntries.length > 0) {
                    let sum: number = 0;
                    for (const e of layoutShiftEntries) {
                        if (e && e.hadRecentInput === true) {
                            continue;
                        }
                        if (typeof e.value === 'number') {
                            sum += e.value;
                        }
                    }
                    cls = sum;
                } else {
                    notes.push(
                        'CLS: layout-shift entries not available (requires Layout Instability API support).'
                    );
                }

                // -------------------------
                // INP (Event Timing approximation)
                // -------------------------
                let inpMs: number | null = null;

                const eventEntries: any[] =
                    (performance.getEntriesByType('event') as any[]) ?? [];

                if (eventEntries.length > 0) {
                    let maxDur: number = 0;
                    for (const e of eventEntries) {
                        const interactionId: number =
                            typeof e.interactionId === 'number'
                                ? e.interactionId
                                : 0;
                        const duration: number =
                            typeof e.duration === 'number' ? e.duration : 0;

                        if (interactionId > 0) {
                            if (duration > maxDur) {
                                maxDur = duration;
                            }
                        }
                    }

                    if (maxDur > 0) {
                        inpMs = maxDur;
                    } else {
                        notes.push(
                            'INP: event timing entries exist but no interactionId-based events were found.'
                        );
                    }
                } else {
                    notes.push(
                        'INP: event timing entries not available (requires Event Timing API support).'
                    );
                }

                if (notes.length === 0) {
                    notes.push('All requested metrics were available.');
                } else {
                    notes.push(
                        'Some metrics may be null due to browser support limitations.'
                    );
                }

                const out: any = {
                    metrics: {
                        ttfbMs,
                        fcpMs,
                        lcpMs,
                        cls,
                        inpMs,
                    },
                    notes,
                    lcp: {
                        selectorHint: selectorHintFor(lastLcpEl),
                        tagName: lastLcpEl
                            ? String(lastLcpEl.tagName).toLowerCase()
                            : null,
                    },
                    debug: {
                        waitMs: waitMsEval,
                        entries: {
                            navigation: navEntries.length,
                            paint: paintEntries.length,
                            lcp: lcpEntries.length,
                            layoutShift: layoutShiftEntries.length,
                            eventTiming: eventEntries.length,
                        },
                    },
                };

                if (!includeDebugEval) {
                    delete out.debug;
                } else {
                    out.debug.lastLcpSelectorHint = out.lcp.selectorHint;
                    out.debug.lastLcpTagName = out.lcp.tagName;
                }

                return out;
            },
            {
                waitMsEval: waitMs,
                includeDebugEval: includeDebug,
            }
        );

        const lcpMs: number | null =
            typeof result?.metrics?.lcpMs === 'number'
                ? result.metrics.lcpMs
                : null;
        const inpMs: number | null =
            typeof result?.metrics?.inpMs === 'number'
                ? result.metrics.inpMs
                : null;
        const cls: number | null =
            typeof result?.metrics?.cls === 'number'
                ? result.metrics.cls
                : null;
        const ttfbMs: number | null =
            typeof result?.metrics?.ttfbMs === 'number'
                ? result.metrics.ttfbMs
                : null;
        const fcpMs: number | null =
            typeof result?.metrics?.fcpMs === 'number'
                ? result.metrics.fcpMs
                : null;

        // Google thresholds (commonly cited):
        // LCP: good <= 2500ms, poor > 4000ms
        // INP: good <= 200ms, poor > 500ms
        // CLS: good <= 0.1, poor > 0.25
        // Supporting:
        // TTFB: good <= 800ms, poor > 1800ms
        // FCP: good <= 1800ms, poor > 3000ms
        const ratings: GetWebVitalsOutput['ratings'] = {
            lcp: rateMs(lcpMs, 2500, 4000),
            inp: rateMs(inpMs, 200, 500),
            cls: rateScore(cls, 0.1, 0.25),
            ttfb: rateMs(ttfbMs, 800, 1800),
            fcp: rateMs(fcpMs, 1800, 3000),
        };

        const lcpHint: string | null =
            typeof result?.lcp?.selectorHint === 'string'
                ? result.lcp.selectorHint
                : null;

        const recommendations: WebVitalsRecommendations = buildRecommendations({
            ratings,
            lcpSelectorHint: lcpHint,
        });

        const notes: Array<string> = Array.isArray(result?.notes)
            ? (result.notes as Array<string>)
            : [];

        notes.push(
            `Ratings: LCP=${formatRating(ratings.lcp.rating)}, INP=${formatRating(
                ratings.inp.rating
            )}, CLS=${formatRating(ratings.cls.rating)}.`
        );

        const output: GetWebVitalsOutput = {
            url: pageUrl,
            title: pageTitle,
            timestampMs: timestampMs,

            metrics: {
                lcpMs,
                inpMs,
                cls,
                ttfbMs,
                fcpMs,
            },

            ratings,
            recommendations,
            notes,
        };

        if (includeDebug && result?.debug) {
            output.debug = result.debug as GetWebVitalsOutput['debug'];
        }

        return output;
    }
}
