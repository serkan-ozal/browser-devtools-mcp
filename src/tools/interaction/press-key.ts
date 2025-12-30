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

export interface PressKeyInput extends ToolInput {
    key: string;
    selector?: string;
}

export interface PressKeyOutput extends ToolOutput {}

export class PressKey implements Tool {
    name(): string {
        return 'interaction_press-key';
    }

    description(): string {
        return 'Presses a keyboard key.';
    }

    inputSchema(): ToolInputSchema {
        return {
            key: z
                .string()
                .describe('Key to press (e.g. "Enter", "ArrowDown", "a").'),
            selector: z
                .string()
                .describe('Optional CSS selector to focus before pressing key.')
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: PressKeyInput
    ): Promise<PressKeyOutput> {
        if (args.selector) {
            const element: ElementHandle = await context.page.waitForSelector(
                args.selector
            );
            await element.focus();
        }
        await context.page.keyboard.press(args.key);
        return {};
    }
}
