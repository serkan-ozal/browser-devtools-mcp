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

export interface FillInput extends ToolInput {
    selector: string;
    value: string;
}

export interface FillOutput extends ToolOutput {}

export class Fill implements Tool {
    name(): string {
        return 'interaction_fill';
    }

    description(): string {
        return 'Fills out an input field.';
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z.string().describe('CSS selector for the input field.'),
            value: z.string().describe('Value to fill.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: FillInput
    ): Promise<FillOutput> {
        const element: ElementHandle = await context.page.waitForSelector(
            args.selector
        );
        await element.fill(args.value);
        return {};
    }
}
