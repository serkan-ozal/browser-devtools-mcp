import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const MIN_WINDOW_WIDTH: number = 200;
const MIN_WINDOW_HEIGHT: number = 200;

type WindowState = 'normal' | 'maximized' | 'minimized' | 'fullscreen';

export interface ResizeWindowInput extends ToolInput {
    /**
     * Target window width (pixels). Required when state='normal'.
     */
    width?: number;

    /**
     * Target window height (pixels). Required when state='normal'.
     */
    height?: number;

    /**
     * Window state. If not 'normal', width/height may be ignored.
     */
    state?: WindowState;
}

export interface ResizeWindowOutput extends ToolOutput {
    requested: {
        width: number | null;
        height: number | null;
        state: WindowState;
    };

    before: {
        windowId: number;
        state: string | null;
        left: number | null;
        top: number | null;
        width: number | null;
        height: number | null;
    };

    after: {
        windowId: number;
        state: string | null;
        left: number | null;
        top: number | null;
        width: number | null;
        height: number | null;
    };

    viewport: {
        innerWidth: number;
        innerHeight: number;
        outerWidth: number;
        outerHeight: number;
        devicePixelRatio: number;
    };
}

export class ResizeWindow implements Tool {
    name(): string {
        return 'interaction_resize-window';
    }

    description(): string {
        return `
Resizes the REAL BROWSER WINDOW (OS-level window) for the current page using Chrome DevTools Protocol (CDP).

This tool works best on Chromium-based browsers (Chromium/Chrome/Edge).
It is especially useful in headful sessions when you run with viewport emulation disabled (viewport: null),
so the page layout follows the OS window size.

Important:
- If Playwright viewport emulation is enabled (viewport is NOT null), resizing the OS window may not change page layout.
- On non-Chromium browsers (Firefox/WebKit), CDP is not available and this tool will fail.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            width: z
                .number()
                .int()
                .min(MIN_WINDOW_WIDTH)
                .optional()
                .describe(
                    'Target window width in pixels (required when state="normal").'
                ),

            height: z
                .number()
                .int()
                .min(MIN_WINDOW_HEIGHT)
                .optional()
                .describe(
                    'Target window height in pixels (required when state="normal").'
                ),

            state: z
                .enum(['normal', 'maximized', 'minimized', 'fullscreen'])
                .optional()
                .default('normal')
                .describe(
                    'Target window state. If not "normal", width/height may be ignored by the browser.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            requested: z
                .object({
                    width: z
                        .number()
                        .int()
                        .nullable()
                        .describe(
                            'Requested window width (pixels). Null if not provided.'
                        ),
                    height: z
                        .number()
                        .int()
                        .nullable()
                        .describe(
                            'Requested window height (pixels). Null if not provided.'
                        ),
                    state: z
                        .enum([
                            'normal',
                            'maximized',
                            'minimized',
                            'fullscreen',
                        ])
                        .describe('Requested window state.'),
                })
                .describe('Requested window change parameters.'),

            before: z
                .object({
                    windowId: z
                        .number()
                        .int()
                        .describe('CDP window id for the current target.'),
                    state: z
                        .string()
                        .nullable()
                        .describe('Window state before resizing.'),
                    left: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window left position before resizing.'),
                    top: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window top position before resizing.'),
                    width: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window width before resizing.'),
                    height: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window height before resizing.'),
                })
                .describe('Window bounds before resizing.'),

            after: z
                .object({
                    windowId: z
                        .number()
                        .int()
                        .describe('CDP window id for the current target.'),
                    state: z
                        .string()
                        .nullable()
                        .describe('Window state after resizing.'),
                    left: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window left position after resizing.'),
                    top: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window top position after resizing.'),
                    width: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window width after resizing.'),
                    height: z
                        .number()
                        .int()
                        .nullable()
                        .describe('Window height after resizing.'),
                })
                .describe('Window bounds after resizing.'),

            viewport: z
                .object({
                    innerWidth: z
                        .number()
                        .int()
                        .describe(
                            'window.innerWidth after resizing (CSS pixels).'
                        ),
                    innerHeight: z
                        .number()
                        .int()
                        .describe(
                            'window.innerHeight after resizing (CSS pixels).'
                        ),
                    outerWidth: z
                        .number()
                        .int()
                        .describe(
                            'window.outerWidth after resizing (CSS pixels).'
                        ),
                    outerHeight: z
                        .number()
                        .int()
                        .describe(
                            'window.outerHeight after resizing (CSS pixels).'
                        ),
                    devicePixelRatio: z
                        .number()
                        .describe('window.devicePixelRatio after resizing.'),
                })
                .describe(
                    'Page viewport metrics after resizing (helps verify responsive behavior).'
                ),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: ResizeWindowInput
    ): Promise<ResizeWindowOutput> {
        const state: WindowState = args.state ?? 'normal';

        const width: number | undefined = args.width;
        const height: number | undefined = args.height;

        if (state === 'normal') {
            if (typeof width !== 'number' || typeof height !== 'number') {
                throw new Error(
                    'state="normal" requires both width and height.'
                );
            }
        }

        const page: any = context.page;
        const cdp: any = await page.context().newCDPSession(page);

        try {
            const info: any = await cdp.send('Browser.getWindowForTarget', {});
            const windowId: number = Number(info.windowId);

            const beforeBounds: any = info.bounds ?? {};
            const before: ResizeWindowOutput['before'] = {
                windowId: windowId,
                state:
                    typeof beforeBounds.windowState === 'string'
                        ? beforeBounds.windowState
                        : null,
                left:
                    typeof beforeBounds.left === 'number'
                        ? beforeBounds.left
                        : null,
                top:
                    typeof beforeBounds.top === 'number'
                        ? beforeBounds.top
                        : null,
                width:
                    typeof beforeBounds.width === 'number'
                        ? beforeBounds.width
                        : null,
                height:
                    typeof beforeBounds.height === 'number'
                        ? beforeBounds.height
                        : null,
            };

            const boundsToSet: Record<string, any> = {};

            if (state !== 'normal') {
                boundsToSet.windowState = state;
            } else {
                boundsToSet.windowState = 'normal';
                boundsToSet.width = width as number;
                boundsToSet.height = height as number;
            }

            await cdp.send('Browser.setWindowBounds', {
                windowId: windowId,
                bounds: boundsToSet,
            });

            const afterInfo: any = await cdp.send(
                'Browser.getWindowForTarget',
                {}
            );
            const afterBounds: any = afterInfo.bounds ?? {};
            const after: ResizeWindowOutput['after'] = {
                windowId: windowId,
                state:
                    typeof afterBounds.windowState === 'string'
                        ? afterBounds.windowState
                        : null,
                left:
                    typeof afterBounds.left === 'number'
                        ? afterBounds.left
                        : null,
                top:
                    typeof afterBounds.top === 'number'
                        ? afterBounds.top
                        : null,
                width:
                    typeof afterBounds.width === 'number'
                        ? afterBounds.width
                        : null,
                height:
                    typeof afterBounds.height === 'number'
                        ? afterBounds.height
                        : null,
            };

            const metrics: any = await page.evaluate((): any => {
                return {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    outerWidth: window.outerWidth,
                    outerHeight: window.outerHeight,
                    devicePixelRatio: window.devicePixelRatio,
                };
            });

            const viewport: ResizeWindowOutput['viewport'] = {
                innerWidth: Number(metrics.innerWidth),
                innerHeight: Number(metrics.innerHeight),
                outerWidth: Number(metrics.outerWidth),
                outerHeight: Number(metrics.outerHeight),
                devicePixelRatio: Number(metrics.devicePixelRatio),
            };

            return {
                requested: {
                    width: typeof width === 'number' ? width : null,
                    height: typeof height === 'number' ? height : null,
                    state: state,
                },
                before,
                after,
                viewport,
            };
        } catch (e: any) {
            const msg: string = String(e?.message ?? e);
            throw new Error(
                `Failed to resize real browser window via CDP. This tool works best on Chromium-based browsers. Original error: ${msg}`
            );
        } finally {
            await cdp.detach().catch((): void => {});
        }
    }
}
