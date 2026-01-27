import { ToolSessionContext } from '../../context';
import { clearStub } from './stub-controller';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface ClearInput extends ToolInput {
    stubId?: string;
}

export interface ClearOutput extends ToolOutput {
    clearedCount: number;
}

export class Clear implements Tool {
    name(): string {
        return 'stub_clear';
    }

    description(): string {
        return `
Clears stubs installed.

- If stubId is provided, clears only that stub.
- If stubId is omitted, clears all stubs for the current session/context.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            stubId: z
                .string()
                .optional()
                .describe('Stub id to remove. Omit to remove all stubs.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            clearedCount: z
                .number()
                .int()
                .nonnegative()
                .describe('Number of stubs removed.'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: ClearInput
    ): Promise<ClearOutput> {
        const clearedCount: number = clearStub(
            context.browserContext,
            args.stubId
        );
        return { clearedCount };
    }
}
