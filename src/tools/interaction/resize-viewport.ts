import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const MIN_VIEWPORT_WIDTH: number = 200;
const MIN_VIEWPORT_HEIGHT: number = 200;

export interface ResizeViewportInput extends ToolInput {
    /**
     * Target viewport width in CSS pixels.
     */
    width: number;

    /**
     * Target viewport height in CSS pixels.
     */
    height: number;
}

export interface ResizeViewportOutput extends ToolOutput {
    requested: {
        width: number;
        height: number;
    };

    viewport: {
        innerWidth: number;
        innerHeight: number;
        outerWidth: number;
        outerHeight: number;
        devicePixelRatio: number;
    };
}

export class ResizeViewport implements Tool {
    name(): string {
        return 'interaction_resize-viewport';
    }

    description(): string {
        return `
Resizes the PAGE VIEWPORT using Playwright viewport emulation (page.setViewportSize).

This affects:
- window.innerWidth / window.innerHeight
- CSS media queries (responsive layouts)
- Layout, rendering and screenshots

Notes:
- This does NOT resize the OS-level browser window.
- Runtime switching to viewport=null (binding to real window size) is not supported by Playwright.
  If you need real window-driven responsive behavior, start the BrowserContext with viewport: null
  and use the window resize tool instead.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            width: z
                .number()
                .int()
                .min(MIN_VIEWPORT_WIDTH)
                .describe('Target viewport width in CSS pixels.'),
            height: z
                .number()
                .int()
                .min(MIN_VIEWPORT_HEIGHT)
                .describe('Target viewport height in CSS pixels.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            requested: z
                .object({
                    width: z
                        .number()
                        .int()
                        .describe('Requested viewport width (CSS pixels).'),
                    height: z
                        .number()
                        .int()
                        .describe('Requested viewport height (CSS pixels).'),
                })
                .describe('Requested viewport configuration.'),
            viewport: z
                .object({
                    innerWidth: z
                        .number()
                        .int()
                        .describe(
                            'window.innerWidth after resize (CSS pixels).'
                        ),
                    innerHeight: z
                        .number()
                        .int()
                        .describe(
                            'window.innerHeight after resize (CSS pixels).'
                        ),
                    outerWidth: z
                        .number()
                        .int()
                        .describe(
                            'window.outerWidth after resize (CSS pixels).'
                        ),
                    outerHeight: z
                        .number()
                        .int()
                        .describe(
                            'window.outerHeight after resize (CSS pixels).'
                        ),
                    devicePixelRatio: z
                        .number()
                        .describe('window.devicePixelRatio after resize.'),
                })
                .describe(
                    'Viewport metrics observed inside the page after resizing.'
                ),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: ResizeViewportInput
    ): Promise<ResizeViewportOutput> {
        await context.page.setViewportSize({
            width: args.width,
            height: args.height,
        });

        const metrics: any = await context.page.evaluate((): any => {
            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight,
                devicePixelRatio: window.devicePixelRatio,
            };
        });

        return {
            requested: {
                width: args.width,
                height: args.height,
            },
            viewport: {
                innerWidth: Number(metrics.innerWidth),
                innerHeight: Number(metrics.innerHeight),
                outerWidth: Number(metrics.outerWidth),
                outerHeight: Number(metrics.outerHeight),
                devicePixelRatio: Number(metrics.devicePixelRatio),
            },
        };
    }
}
