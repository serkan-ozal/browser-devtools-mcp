import { ToolSessionContext } from '../../context';
import {
    addMockHttpResponseStub,
    ensureRoutingInstalled,
    normalizeAbortCode,
    normalizeBody,
    normalizeChance,
    normalizeDelayMs,
    normalizeHeaders,
    normalizeTimesPublic,
    StubKind,
    StubMockHttpResponse,
} from './stub-controller';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface MockHttpResponseInput extends ToolInput {
    pattern: string;

    response: {
        action?: 'fulfill' | 'abort';
        status?: number;
        headers?: Record<string, string>;
        body?: string | object;
        abortErrorCode?: string;
    };

    delayMs?: number;
    times?: number;
    chance?: number;
}

export interface MockHttpResponseOutput extends ToolOutput {
    stubId: string;
    kind: StubKind.MOCK_HTTP_RESPONSE;
    pattern: string;
    enabled: boolean;

    delayMs: number;
    times: number;
    chance?: number;

    action: 'fulfill' | 'abort';
    status?: number;
}

export class MockHttpResponse implements Tool {
    name(): string {
        return 'stub_mock-http-response';
    }

    description(): string {
        return `
Installs a response stub for matching requests using glob patterns (picomatch).

Use cases:
- Offline testing (return 200 with local JSON)
- Error scenarios (force 500/404 or abort with timedout)
- Edge cases (empty data / huge payload / special characters)
- Flaky API testing (chance < 1.0)
- Performance testing (delayMs)

Notes:
- pattern is a glob matched against the full request URL.
- stubs are evaluated in insertion order; first match wins.
- times limits how many times the stub applies (-1 means infinite).
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            pattern: z
                .string()
                .describe(
                    'Glob pattern matched against the full request URL (picomatch).'
                ),
            response: z
                .object({
                    action: z
                        .enum(['fulfill', 'abort'])
                        .optional()
                        .default('fulfill')
                        .describe(
                            'Fulfill with a mocked response or abort the request.'
                        ),
                    status: z
                        .number()
                        .int()
                        .min(100)
                        .max(599)
                        .optional()
                        .describe(
                            'HTTP status code (used when action=fulfill).'
                        ),
                    headers: z
                        .record(z.string(), z.string())
                        .optional()
                        .describe('HTTP headers for the mocked response.'),
                    body: z
                        .union([
                            z.string(),
                            z.record(z.string(), z.any()),
                            z.array(z.any()),
                        ])
                        .optional()
                        .describe(
                            'Response body. If object/array, it will be JSON-stringified.'
                        ),
                    abortErrorCode: z
                        .string()
                        .optional()
                        .describe(
                            'Playwright abort error code (used when action=abort), e.g. "timedout".'
                        ),
                })
                .describe('Mock response configuration.'),
            delayMs: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe(
                    'Artificial delay in milliseconds before applying the stub.'
                ),
            times: z
                .number()
                .int()
                .optional()
                .describe(
                    'Apply only N times, then let through. Omit for infinite.'
                ),
            chance: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe(
                    'Probability (0..1) to apply the stub per request (flaky testing).'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            stubId: z
                .string()
                .describe(
                    'Unique id of the installed stub (use it to clear later).'
                ),
            kind: z.literal(StubKind.MOCK_HTTP_RESPONSE).describe('Stub kind.'),
            pattern: z.string().describe('Glob pattern.'),
            enabled: z.boolean().describe('Whether the stub is enabled.'),
            delayMs: z
                .number()
                .int()
                .describe('Applied artificial delay in milliseconds.'),
            times: z
                .number()
                .int()
                .describe('Max applications (-1 means infinite).'),
            chance: z
                .number()
                .optional()
                .describe('Apply probability (omit means always).'),
            action: z.enum(['fulfill', 'abort']).describe('Applied action.'),
            status: z
                .number()
                .int()
                .optional()
                .describe('HTTP status (present when action=fulfill).'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: MockHttpResponseInput
    ): Promise<MockHttpResponseOutput> {
        await ensureRoutingInstalled(context.browserContext);

        const action: 'fulfill' | 'abort' = args.response.action ?? 'fulfill';

        const delayMs: number = normalizeDelayMs(args.delayMs);
        const times: number = normalizeTimesPublic(args.times);
        const chance: number | undefined = normalizeChance(args.chance);

        const status: number | undefined = args.response.status;
        const headers: Record<string, string> | undefined = normalizeHeaders(
            args.response.headers
        );
        const body: string | undefined = normalizeBody(args.response.body);
        const abortErrorCode: string | undefined = normalizeAbortCode(
            args.response.abortErrorCode
        );

        const stub: StubMockHttpResponse = addMockHttpResponseStub(
            context.browserContext,
            {
                enabled: true,
                pattern: args.pattern,
                action,
                status,
                headers,
                body,
                abortErrorCode,
                delayMs,
                times,
                chance,
            }
        );

        const out: MockHttpResponseOutput = {
            stubId: stub.id,
            kind: StubKind.MOCK_HTTP_RESPONSE,
            pattern: stub.pattern,
            enabled: stub.enabled,
            delayMs: stub.delayMs,
            times: stub.times,
            action: stub.action,
        };

        if (typeof stub.chance === 'number') {
            out.chance = stub.chance;
        }

        if (stub.action === 'fulfill') {
            out.status = typeof stub.status === 'number' ? stub.status : 200;
        }

        return out;
    }
}
