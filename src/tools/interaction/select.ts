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

export interface SelectInput extends ToolInput {
    selector: string;
    value: string;
}

export interface SelectOutput extends ToolOutput {}

export class Select implements Tool {
    name(): string {
        return 'interaction_select';
    }

    description(): string {
        return 'Select an element on the page with the given value';
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe('CSS selector for element to select.'),
            value: z.string().describe('Value to select.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: SelectInput
    ): Promise<SelectOutput> {
        const element: ElementHandle = await context.page.waitForSelector(
            args.selector
        );
        await element.selectOption(args.value);
        return {};
    }
}
