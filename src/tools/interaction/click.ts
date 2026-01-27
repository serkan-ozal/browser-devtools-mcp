import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';
import type { ElementHandle } from 'playwright';

export interface ClickInput extends ToolInput {
    selector: string;
}

export interface ClickOutput extends ToolOutput {}

export class Click implements Tool {
    name(): string {
        return 'interaction_click';
    }

    description(): string {
        return 'Clicks an element on the page.';
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe('CSS selector for the element to click.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: ToolSessionContext,
        args: ClickInput
    ): Promise<ClickOutput> {
        const element: ElementHandle = await context.page.waitForSelector(
            args.selector
        );
        await element.click();
        return {};
    }
}
