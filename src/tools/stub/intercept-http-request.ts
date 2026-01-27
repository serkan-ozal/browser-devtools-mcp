import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

import {
    addHttpInterceptRequestStub,
    ensureRoutingInstalled,
    normalizeBody,
    normalizeDelayMs,
    normalizeHeaders,
    normalizeMethod,
    normalizeTimesPublic,
    StubInterceptHttpRequest,
    StubKind,
} from './stub-controller';

export interface InterceptHttpRequestInput extends ToolInput {
    pattern: string;

    modifications?: {
        headers?: Record<string, string>;
        body?: string | object;
        method?: string;
    };

    delayMs?: number;
    times?: number;
}

export interface InterceptHttpRequestOutput extends ToolOutput {
    stubId: string;
    kind: StubKind.INTERCEPT_HTTP_REQUEST;
    pattern: string;
    enabled: boolean;

    delayMs: number;
    times: number;
}

export class InterceptHttpRequest implements Tool {
    name(): string {
        return 'stub_intercept-http-request';
    }

    description(): string {
        return `
Installs a request interceptor stub that can modify outgoing requests before they are sent.

Use cases:
- A/B testing / feature flags (inject headers)
- Security testing (inject malformed headers / payload)
- Edge cases (special characters, large payload)
- Auth simulation (add API keys / tokens in headers)

Notes:
- pattern is a glob matched against the full request URL (picomatch).
- This modifies requests; it does not change responses.
- times limits how many times the interceptor applies (-1 means infinite).
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            pattern: z
                .string()
                .describe(
                    'Glob pattern matched against the full request URL (picomatch).'
                ),
            modifications: z
                .object({
                    headers: z
                        .record(z.string(), z.string())
                        .optional()
                        .describe(
                            'Headers to merge into the outgoing request headers.'
                        ),
                    body: z
                        .union([
                            z.string(),
                            z.record(z.string(), z.any()),
                            z.array(z.any()),
                        ])
                        .optional()
                        .describe(
                            'Override request body. If object/array, it will be JSON-stringified.'
                        ),
                    method: z
                        .string()
                        .optional()
                        .describe('Override HTTP method (e.g., POST, PUT).'),
                })
                .optional()
                .describe('Request modifications to apply.'),
            delayMs: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe(
                    'Artificial delay in milliseconds before continuing the request.'
                ),
            times: z
                .number()
                .int()
                .optional()
                .describe(
                    'Apply only N times, then let through. Omit for infinite.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            stubId: z.string().describe('Unique id of the installed stub.'),
            kind: z
                .literal(StubKind.INTERCEPT_HTTP_REQUEST)
                .describe('Stub kind.'),
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
        };
    }

    async handle(
        context: ToolSessionContext,
        args: InterceptHttpRequestInput
    ): Promise<InterceptHttpRequestOutput> {
        await ensureRoutingInstalled(context.browserContext);

        const delayMs: number = normalizeDelayMs(args.delayMs);
        const times: number = normalizeTimesPublic(args.times);

        const headers: Record<string, string> | undefined = normalizeHeaders(
            args.modifications?.headers
        );
        const body: string | undefined = normalizeBody(
            args.modifications?.body
        );
        const method: string | undefined = normalizeMethod(
            args.modifications?.method
        );

        const stub: StubInterceptHttpRequest = addHttpInterceptRequestStub(
            context.browserContext,
            {
                enabled: true,
                pattern: args.pattern,
                modifications: {
                    headers,
                    body,
                    method,
                },
                delayMs,
                times,
            }
        );

        return {
            stubId: stub.id,
            kind: StubKind.INTERCEPT_HTTP_REQUEST,
            pattern: stub.pattern,
            enabled: stub.enabled,
            delayMs: stub.delayMs,
            times: stub.times,
        };
    }
}
