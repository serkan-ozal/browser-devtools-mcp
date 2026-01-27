import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import type { ElementHandle } from 'playwright';
import { z } from 'zod';

export interface HoverInput extends ToolInput {
    selector: string;
}

export interface HoverOutput extends ToolOutput {}

export class Hover implements Tool {
    name(): string {
        return 'interaction_hover';
    }

    description(): string {
        return 'Hovers an element on the page.';
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe('CSS selector for the element to hover.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: ToolSessionContext,
        args: HoverInput
    ): Promise<HoverOutput> {
        const element: ElementHandle = await context.page.waitForSelector(
            args.selector
        );
        await element.hover();
        return {};
    }
}
