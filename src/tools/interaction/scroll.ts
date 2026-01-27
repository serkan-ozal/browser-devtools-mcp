import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const DEFAULT_BEHAVIOR: 'auto' | 'smooth' = 'auto';
const DEFAULT_MODE: 'by' | 'to' | 'top' | 'bottom' | 'left' | 'right' = 'by';

export interface ScrollInput extends ToolInput {
    mode?: 'by' | 'to' | 'top' | 'bottom' | 'left' | 'right';

    /**
     * Optional selector. If provided, scrolls inside that element.
     * Otherwise scrolls the document viewport.
     */
    selector?: string;

    /**
     * Used for mode='by'
     */
    dx?: number;
    dy?: number;

    /**
     * Used for mode='to'
     */
    x?: number;
    y?: number;

    /**
     * Scroll behavior (browser-native).
     */
    behavior?: 'auto' | 'smooth';
}

export interface ScrollOutput extends ToolOutput {
    mode: 'by' | 'to' | 'top' | 'bottom' | 'left' | 'right';
    selector: string | null;
    behavior: 'auto' | 'smooth';

    before: {
        x: number;
        y: number;
        scrollWidth: number;
        scrollHeight: number;
        clientWidth: number;
        clientHeight: number;
    };

    after: {
        x: number;
        y: number;
        scrollWidth: number;
        scrollHeight: number;
        clientWidth: number;
        clientHeight: number;
    };

    canScrollX: boolean;
    canScrollY: boolean;
    maxScrollX: number;
    maxScrollY: number;
    isAtLeft: boolean;
    isAtRight: boolean;
    isAtTop: boolean;
    isAtBottom: boolean;
}

export class Scroll implements Tool {
    name(): string {
        return 'interaction_scroll';
    }

    description(): string {
        return `
Scrolls the page viewport or a specific scrollable element.

Modes:
- 'by': Scrolls by a relative delta (dx/dy) from the current scroll position.
- 'to': Scrolls to an absolute scroll position (x/y).
- 'top': Scrolls to the very top.
- 'bottom': Scrolls to the very bottom.
- 'left': Scrolls to the far left.
- 'right': Scrolls to the far right.

Use this tool to:
- Reveal content below the fold
- Jump to the top/bottom without knowing exact positions
- Bring elements into view before clicking
- Inspect lazy-loaded content that appears on scroll
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            mode: z
                .enum(['by', 'to', 'top', 'bottom', 'left', 'right'])
                .optional()
                .default(DEFAULT_MODE)
                .describe(
                    'Scroll mode. "by" uses dx/dy, "to" uses x/y, and top/bottom/left/right jump to edges.'
                ),
            selector: z
                .string()
                .optional()
                .describe(
                    'Optional CSS selector for a scrollable container. If omitted, scrolls the document viewport.'
                ),
            dx: z
                .number()
                .optional()
                .describe(
                    'Horizontal scroll delta in pixels (used when mode="by"). Default: 0.'
                ),
            dy: z
                .number()
                .optional()
                .describe(
                    'Vertical scroll delta in pixels (used when mode="by"). Default: 0.'
                ),
            x: z
                .number()
                .optional()
                .describe(
                    'Absolute horizontal scroll position in pixels (used when mode="to").'
                ),
            y: z
                .number()
                .optional()
                .describe(
                    'Absolute vertical scroll position in pixels (used when mode="to").'
                ),
            behavior: z
                .enum(['auto', 'smooth'])
                .optional()
                .default(DEFAULT_BEHAVIOR)
                .describe(
                    'Native scroll behavior. Use "auto" for deterministic automation.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            mode: z
                .enum(['by', 'to', 'top', 'bottom', 'left', 'right'])
                .describe('The scroll mode used.'),
            selector: z
                .string()
                .nullable()
                .describe(
                    'The selector of the scroll container if provided; otherwise null (document viewport).'
                ),
            behavior: z
                .enum(['auto', 'smooth'])
                .describe('The scroll behavior used.'),
            before: z
                .object({
                    x: z.number().describe('ScrollLeft before scrolling.'),
                    y: z.number().describe('ScrollTop before scrolling.'),
                    scrollWidth: z
                        .number()
                        .describe('Total scrollable width before scrolling.'),
                    scrollHeight: z
                        .number()
                        .describe('Total scrollable height before scrolling.'),
                    clientWidth: z
                        .number()
                        .describe(
                            'Viewport/container client width before scrolling.'
                        ),
                    clientHeight: z
                        .number()
                        .describe(
                            'Viewport/container client height before scrolling.'
                        ),
                })
                .describe('Scroll metrics before the scroll action.'),
            after: z
                .object({
                    x: z.number().describe('ScrollLeft after scrolling.'),
                    y: z.number().describe('ScrollTop after scrolling.'),
                    scrollWidth: z
                        .number()
                        .describe('Total scrollable width after scrolling.'),
                    scrollHeight: z
                        .number()
                        .describe('Total scrollable height after scrolling.'),
                    clientWidth: z
                        .number()
                        .describe(
                            'Viewport/container client width after scrolling.'
                        ),
                    clientHeight: z
                        .number()
                        .describe(
                            'Viewport/container client height after scrolling.'
                        ),
                })
                .describe('Scroll metrics after the scroll action.'),
            canScrollX: z
                .boolean()
                .describe(
                    'Whether horizontal scrolling is possible (scrollWidth > clientWidth).'
                ),
            canScrollY: z
                .boolean()
                .describe(
                    'Whether vertical scrolling is possible (scrollHeight > clientHeight).'
                ),
            maxScrollX: z
                .number()
                .describe(
                    'Maximum horizontal scrollLeft (scrollWidth - clientWidth).'
                ),
            maxScrollY: z
                .number()
                .describe(
                    'Maximum vertical scrollTop (scrollHeight - clientHeight).'
                ),
            isAtLeft: z
                .boolean()
                .describe('Whether the scroll position is at the far left.'),
            isAtRight: z
                .boolean()
                .describe('Whether the scroll position is at the far right.'),
            isAtTop: z
                .boolean()
                .describe('Whether the scroll position is at the very top.'),
            isAtBottom: z
                .boolean()
                .describe('Whether the scroll position is at the very bottom.'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: ScrollInput
    ): Promise<ScrollOutput> {
        const mode: 'by' | 'to' | 'top' | 'bottom' | 'left' | 'right' =
            args.mode ?? DEFAULT_MODE;

        const selector: string | undefined = args.selector;
        const behavior: 'auto' | 'smooth' = args.behavior ?? DEFAULT_BEHAVIOR;

        const dx: number = args.dx ?? 0;
        const dy: number = args.dy ?? 0;

        const x: number | undefined = args.x;
        const y: number | undefined = args.y;

        if (mode === 'to') {
            if (typeof x !== 'number' && typeof y !== 'number') {
                throw new Error('mode="to" requires at least one of x or y.');
            }
        }

        if (mode === 'by') {
            if (dx === 0 && dy === 0) {
                throw new Error(
                    'mode="by" requires dx and/or dy to be non-zero.'
                );
            }
        }

        const result: any = await context.page.evaluate(
            ({
                modeEval,
                selectorEval,
                dxEval,
                dyEval,
                xEval,
                yEval,
                behaviorEval,
            }: {
                modeEval: 'by' | 'to' | 'top' | 'bottom' | 'left' | 'right';
                selectorEval?: string;
                dxEval: number;
                dyEval: number;
                xEval?: number;
                yEval?: number;
                behaviorEval: 'auto' | 'smooth';
            }) => {
                const getTarget = (): HTMLElement => {
                    if (selectorEval) {
                        const el: Element | null =
                            document.querySelector(selectorEval);
                        if (!el) {
                            throw new Error(
                                `Element with selector "${selectorEval}" not found`
                            );
                        }
                        return el as HTMLElement;
                    }

                    const scrolling: Element | null =
                        document.scrollingElement ||
                        document.documentElement ||
                        document.body;

                    if (!scrolling) {
                        throw new Error('No scrolling element available.');
                    }

                    return scrolling as HTMLElement;
                };

                const readMetrics = (el: HTMLElement) => {
                    return {
                        x: el.scrollLeft,
                        y: el.scrollTop,
                        scrollWidth: el.scrollWidth,
                        scrollHeight: el.scrollHeight,
                        clientWidth: el.clientWidth,
                        clientHeight: el.clientHeight,
                    };
                };

                const clamp = (v: number, min: number, max: number): number => {
                    if (v < min) {
                        return min;
                    }
                    if (v > max) {
                        return max;
                    }
                    return v;
                };

                const doScroll = (el: HTMLElement) => {
                    const maxX: number = Math.max(
                        0,
                        el.scrollWidth - el.clientWidth
                    );
                    const maxY: number = Math.max(
                        0,
                        el.scrollHeight - el.clientHeight
                    );

                    if (modeEval === 'by') {
                        const nextX: number = clamp(
                            el.scrollLeft + dxEval,
                            0,
                            maxX
                        );
                        const nextY: number = clamp(
                            el.scrollTop + dyEval,
                            0,
                            maxY
                        );
                        el.scrollTo({
                            left: nextX,
                            top: nextY,
                            behavior: behaviorEval,
                        });
                        return;
                    }

                    if (modeEval === 'to') {
                        const nextX: number =
                            typeof xEval === 'number'
                                ? clamp(xEval, 0, maxX)
                                : el.scrollLeft;
                        const nextY: number =
                            typeof yEval === 'number'
                                ? clamp(yEval, 0, maxY)
                                : el.scrollTop;
                        el.scrollTo({
                            left: nextX,
                            top: nextY,
                            behavior: behaviorEval,
                        });
                        return;
                    }

                    if (modeEval === 'top') {
                        el.scrollTo({
                            top: 0,
                            left: el.scrollLeft,
                            behavior: behaviorEval,
                        });
                        return;
                    }

                    if (modeEval === 'bottom') {
                        el.scrollTo({
                            top: maxY,
                            left: el.scrollLeft,
                            behavior: behaviorEval,
                        });
                        return;
                    }

                    if (modeEval === 'left') {
                        el.scrollTo({
                            left: 0,
                            top: el.scrollTop,
                            behavior: behaviorEval,
                        });
                        return;
                    }

                    if (modeEval === 'right') {
                        el.scrollTo({
                            left: maxX,
                            top: el.scrollTop,
                            behavior: behaviorEval,
                        });
                        return;
                    }
                };

                const target: HTMLElement = getTarget();

                const before: any = readMetrics(target);
                doScroll(target);
                const after: any = readMetrics(target);

                const maxScrollX: number = Math.max(
                    0,
                    after.scrollWidth - after.clientWidth
                );
                const maxScrollY: number = Math.max(
                    0,
                    after.scrollHeight - after.clientHeight
                );

                const canScrollX: boolean =
                    after.scrollWidth > after.clientWidth;
                const canScrollY: boolean =
                    after.scrollHeight > after.clientHeight;

                const eps: number = 1;

                const isAtLeft: boolean = after.x <= eps;
                const isAtRight: boolean = after.x >= maxScrollX - eps;
                const isAtTop: boolean = after.y <= eps;
                const isAtBottom: boolean = after.y >= maxScrollY - eps;

                return {
                    before,
                    after,
                    canScrollX,
                    canScrollY,
                    maxScrollX,
                    maxScrollY,
                    isAtLeft,
                    isAtRight,
                    isAtTop,
                    isAtBottom,
                };
            },
            {
                modeEval: mode,
                selectorEval: selector,
                dxEval: dx,
                dyEval: dy,
                xEval: x,
                yEval: y,
                behaviorEval: behavior,
            }
        );

        return {
            mode: mode,
            selector: selector ?? null,
            behavior: behavior,
            before: result.before,
            after: result.after,
            canScrollX: result.canScrollX,
            canScrollY: result.canScrollY,
            maxScrollX: result.maxScrollX,
            maxScrollY: result.maxScrollY,
            isAtLeft: result.isAtLeft,
            isAtRight: result.isAtRight,
            isAtTop: result.isAtTop,
            isAtBottom: result.isAtBottom,
        };
    }
}
