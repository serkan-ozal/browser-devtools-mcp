import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';
import { listStubs, type AnyStub } from './stub-controller';

import { z } from 'zod';

export interface ListInput extends ToolInput {}

export interface ListOutput extends ToolOutput {
    stubs: Array<{
        id: string;
        kind: string;
        enabled: boolean;

        pattern: string;

        delayMs: number;
        times: number;
        usedCount: number;

        action?: string;
        status?: number;
    }>;
}

export class List implements Tool {
    name(): string {
        return 'stub_list';
    }

    description(): string {
        return `
Lists currently installed stubs for the active browser context/session.
Useful to debug why certain calls are being mocked/intercepted.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {};
    }

    outputSchema(): ToolOutputSchema {
        return {
            stubs: z.array(
                z.object({
                    id: z.string().describe('Stub id.'),
                    kind: z.string().describe('Stub kind.'),
                    enabled: z.boolean().describe('Whether stub is enabled.'),
                    pattern: z.string().describe('Glob pattern (picomatch).'),
                    delayMs: z
                        .number()
                        .int()
                        .describe('Artificial delay in ms.'),
                    times: z
                        .number()
                        .int()
                        .describe('Max applications (-1 means infinite).'),
                    usedCount: z
                        .number()
                        .int()
                        .describe('How many times it has been applied.'),
                    action: z
                        .string()
                        .optional()
                        .describe('For mock_response: fulfill/abort.'),
                    status: z
                        .number()
                        .int()
                        .optional()
                        .describe('For mock_response: HTTP status (if set).'),
                })
            ),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: ListInput
    ): Promise<ListOutput> {
        const stubs: Array<AnyStub> = listStubs(context.browserContext);

        return {
            stubs: stubs.map((s: AnyStub) => {
                const base: any = {
                    id: s.id,
                    kind: s.kind,
                    enabled: s.enabled,
                    pattern: s.pattern,
                    delayMs: s.delayMs,
                    times: s.times,
                    usedCount: s.usedCount,
                };

                if (s.kind === 'mock_http_response') {
                    base.action = s.action;
                    if (typeof s.status === 'number') {
                        base.status = s.status;
                    }
                }

                return base;
            }),
        };
    }
}
