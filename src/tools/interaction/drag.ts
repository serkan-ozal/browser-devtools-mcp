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

export interface DragInput extends ToolInput {
    sourceSelector: string;
    targetSelector: string;
}

export interface DragOutput extends ToolOutput {}

export class Drag implements Tool {
    name(): string {
        return 'interaction_drag';
    }

    description(): string {
        return 'Drags an element to a target location.';
    }

    inputSchema(): ToolInputSchema {
        return {
            sourceSelector: z
                .string()
                .describe('CSS selector for the element to drag.'),
            targetSelector: z
                .string()
                .describe('CSS selector for the target location.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: DragInput
    ): Promise<DragOutput> {
        const sourceElement: ElementHandle = await context.page.waitForSelector(
            args.sourceSelector
        );
        const targetElement: ElementHandle = await context.page.waitForSelector(
            args.targetSelector
        );

        const sourceBound = await sourceElement.boundingBox();
        const targetBound = await targetElement.boundingBox();

        if (!sourceBound || !targetBound) {
            throw new Error(
                'Could not get element positions for drag operation'
            );
        }

        await context.page.mouse.move(
            sourceBound.x + sourceBound.width / 2,
            sourceBound.y + sourceBound.height / 2
        );
        await context.page.mouse.down();
        await context.page.mouse.move(
            targetBound.x + targetBound.width / 2,
            targetBound.y + targetBound.height / 2
        );
        await context.page.mouse.up();

        return {};
    }
}
