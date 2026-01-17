import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import type { ElementHandle } from 'playwright';
import { z } from 'zod';

const DEFAULT_REPEAT_INTERVAL_MS: number = 50;
const MIN_REPEAT_INTERVAL_MS: number = 10;

export interface PressKeyInput extends ToolInput {
    /**
     * Keyboard key identifier.
     *
     * Examples:
     * - "Enter"
     * - "ArrowDown"
     * - "PageDown"
     * - "a"
     *
     * Uses Playwright's key definitions:
     * https://playwright.dev/docs/api/class-keyboard#keyboard-press
     */
    key: string;

    /**
     * Optional CSS selector to focus before sending the key events.
     *
     * Use this when:
     * - The page requires an input/textarea/contenteditable element to be focused
     * - Multiple focusable elements exist and you want deterministic behavior
     *
     * If omitted, the key event is sent to the currently focused element (or the page).
     */
    selector?: string;

    /**
     * Duration (in milliseconds) to keep the key logically "held".
     *
     * Important:
     * - Playwright's keyboard.press({ delay }) DOES NOT generate OS-level key-repeat events.
     * - It only delays keyup after keydown.
     *
     * If you need scrolling or continuous behavior, combine holdMs with repeat=true.
     */
    holdMs?: number;

    /**
     * If true, simulates keyboard auto-repeat by repeatedly pressing the key
     * while holdMs has not elapsed.
     *
     * This is required for some pages that:
     * - Scroll only when repeated keydown events occur
     * - Rely on native keyboard auto-repeat behavior
     *
     * Example use cases:
     * - ArrowDown scrolling
     * - Holding Space to scroll
     */
    repeat?: boolean;

    /**
     * Interval (in milliseconds) between repeated key presses
     * when repeat=true.
     *
     * Lower values:
     * - Feel more like native key-repeat
     * - Generate more events and higher load
     *
     * Minimum enforced to avoid event storms.
     */
    repeatIntervalMs?: number;
}

export interface PressKeyOutput extends ToolOutput {}

export class PressKey implements Tool {
    name(): string {
        return 'interaction_press-key';
    }

    description(): string {
        return `
Presses a keyboard key with optional "hold" and auto-repeat behavior.

Key facts:
- keyboard.press(key, { delay }) does NOT trigger OS-style auto-repeat.
- Some UI behaviors (especially scrolling) require repeated keydown events.
- Use repeat=true + holdMs to approximate real keyboard holding.

Execution logic:
- If selector is provided, the element is focused first.
- If holdMs is omitted or repeat=false:
  → a single keyboard.press() is executed.
- If holdMs is provided AND repeat=true:
  → keyboard.press() is called repeatedly until holdMs elapses.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            key: z
                .string()
                .describe(
                    'Keyboard key to press (e.g. "Enter", "ArrowDown", "a").'
                ),
            selector: z
                .string()
                .describe(
                    'Optional CSS selector to focus before sending the key.'
                )
                .optional(),
            holdMs: z
                .number()
                .int()
                .min(0)
                .describe(
                    'Optional duration in milliseconds to hold the key. With repeat=true, this is the total repeat duration.'
                )
                .optional(),
            repeat: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                    'If true, simulates key auto-repeat by pressing the key repeatedly (useful for scrolling).'
                ),
            repeatIntervalMs: z
                .number()
                .int()
                .min(MIN_REPEAT_INTERVAL_MS)
                .optional()
                .default(DEFAULT_REPEAT_INTERVAL_MS)
                .describe(
                    `Interval between repeated key presses in ms (only when repeat=true).`
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: PressKeyInput
    ): Promise<PressKeyOutput> {
        /**
         * Focus target element if selector is provided.
         * Otherwise, key events go to the currently focused element or page.
         */
        if (args.selector) {
            const element: ElementHandle = await context.page.waitForSelector(
                args.selector
            );
            await element.focus();
        }

        const holdMs: number = args.holdMs ?? 0;
        const repeat: boolean = args.repeat === true;

        /**
         * Simple case:
         * - No hold requested OR repeat disabled
         * - Single press with optional delay
         */
        if (holdMs <= 0 || repeat === false) {
            await context.page.keyboard.press(
                args.key,
                holdMs > 0 ? { delay: holdMs } : undefined
            );
            return {};
        }

        /**
         * Auto-repeat simulation:
         * - Repeated key presses until holdMs elapses
         * - Approximates native keyboard repeat behavior
         */
        const repeatIntervalMs: number =
            typeof args.repeatIntervalMs === 'number' &&
            Number.isFinite(args.repeatIntervalMs) &&
            args.repeatIntervalMs >= MIN_REPEAT_INTERVAL_MS
                ? Math.floor(args.repeatIntervalMs)
                : DEFAULT_REPEAT_INTERVAL_MS;

        const startMs: number = Date.now();

        while (Date.now() - startMs < holdMs) {
            await context.page.keyboard.press(args.key);
            await context.page.waitForTimeout(repeatIntervalMs);
        }

        return {};
    }
}
