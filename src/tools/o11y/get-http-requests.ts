import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';
import { HttpMethod, HttpRequest, HttpResourceType } from '../../types';

import { z } from 'zod';
import { createEnumTransformer, getEnumKeyTuples } from '../../utils';

export interface GetHttpRequestsInput extends ToolInput {
    resourceType?: HttpResourceType;
    status?: {
        min?: number;
        max?: number;
    };
    ok?: boolean;
    timestamp?: number;
    sequenceNumber?: number;
    limit?: {
        count: number;
        from: 'start' | 'end';
    };
}

export interface GetHttpRequestsOutput extends ToolOutput {
    requests: Array<{
        url: string;
        method: HttpMethod;
        headers: { [key: string]: string };
        body?: string;
        resourceType: HttpResourceType;
        failure?: string;
        duration?: number;
        response?: {
            status: number;
            statusText: string;
            headers: { [key: string]: string };
            body?: string;
        };
        ok: boolean;
        timestamp: number;
        sequenceNumber: number;
    }>;
}

export class GetHttpRequests implements Tool {
    name(): string {
        return 'o11y_get-http-requests';
    }

    description(): string {
        return 'Retrieves HTTP requests from the browser with filtering options.';
    }

    inputSchema(): ToolInputSchema {
        return {
            resourceType: z
                .enum(getEnumKeyTuples(HttpResourceType))
                .transform(createEnumTransformer(HttpResourceType))
                .describe(
                    `
Resource type of the HTTP requests to retrieve. 
Valid values are: ${getEnumKeyTuples(HttpResourceType)}.`
                )
                .optional(),
            status: z
                .object({
                    min: z
                        .number()
                        .int()
                        .positive()
                        .describe(
                            'Minimum status code of the HTTP requests to retrieve.'
                        )
                        .optional(),
                    max: z
                        .number()
                        .int()
                        .positive()
                        .describe(
                            'Maximum status code of the HTTP requests to retrieve.'
                        )
                        .optional(),
                })
                .describe('Status code of the HTTP requests to retrieve.')
                .optional(),
            ok: z
                .boolean()
                .describe(
                    `
Whether to retrieve successful or failed HTTP requests. 
An HTTP request is considered successful only if its status code is 2XX.
Otherwise (non-2XX status code or no response at all because of timeout, network failure, etc ...) it is considered as failed.
When this flag is not set, all (successful and failed HTTP requests) are retrieved.`
                )
                .optional(),
            timestamp: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    `
Start time filter as a Unix epoch timestamp in milliseconds. 
If provided, only HTTP requests recorded at or after this timestamp will be returned.
                `
                )
                .optional(),
            sequenceNumber: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    `
Sequence number for incremental retrieval. 
If provided, only HTTP requests with a sequence number greater than this value will be returned. 
This allows clients to fetch HTTP requests incrementally by passing the last received sequence number on subsequent requests.
                `
                )
                .optional(),
            limit: z
                .object({
                    count: z.number().int().nonnegative().default(0).describe(`
Count of the maximum number of HTTP requests to return. 
If the result exceeds this limit, it will be truncated.
"0" means no count limit.`),
                    from: z.enum(['start', 'end']).default('end').describe(`
Controls which side is kept when truncation is applied. 
"start" keeps the first N items (trims from the end).
"end" keeps the last N items (trims from the start).`),
                })
                .describe('Maximum number of HTTP requests to return.')
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            requests: z
                .array(
                    z
                        .object({
                            url: z.string().describe('HTTP request url.'),
                            method: z
                                .enum(getEnumKeyTuples(HttpMethod))
                                .describe(
                                    `HTTP request method. Valid values are: ${getEnumKeyTuples(HttpMethod)}`
                                ),
                            headers: z
                                .record(z.string(), z.string())
                                .describe(
                                    'HTTP request headers as key-value pairs.'
                                ),
                            body: z
                                .string()
                                .describe('HTTP request body if available.')
                                .optional(),
                            resourceType: z.enum(
                                getEnumKeyTuples(HttpResourceType)
                            ).describe(`
HTTP request resource type as it was perceived by the rendering engine. 
Valid values are: ${getEnumKeyTuples(HttpResourceType)}`),
                            failure: z
                                .string()
                                .describe(
                                    'Error message of the HTTP request if failed.'
                                )
                                .optional(),
                            duration: z
                                .number()
                                .describe(
                                    'HTTP request duration in milliseconds. "-1" if not available (no response).'
                                )
                                .optional(),
                            response: z
                                .object({
                                    status: z
                                        .number()
                                        .int()
                                        .positive()
                                        .describe('HTTP response status code.'),
                                    statusText: z
                                        .string()
                                        .describe('HTTP response status text.'),
                                    headers: z
                                        .record(z.string(), z.string())
                                        .describe(
                                            'HTTP response headers as key-value pairs.'
                                        ),
                                    body: z
                                        .string()
                                        .describe(
                                            'HTTP response body if available.'
                                        )
                                        .optional(),
                                })
                                .describe('HTTP response.')
                                .optional(),
                            ok: z
                                .boolean()
                                .describe(
                                    `
Flag to represent whether the HTTP request successful or failed. 
An HTTP request is considered successful only if its status code is 2XX.
Otherwise (non-2XX status code or no response at all because of timeout, network failure, etc ...) it is considered as failed.`
                                )
                                .optional(),
                            timestamp: z
                                .number()
                                .int()
                                .nonnegative()
                                .describe(
                                    'Unix epoch timestamp (in milliseconds) of the HTTP request.'
                                ),
                            sequenceNumber: z.number().int().nonnegative()
                                .describe(`
A monotonically increasing sequence number assigned to each HTTP request.
It reflects the order in which requests were captured and can be used by clients
to retrieve requests incrementally by requesting only those with a higher sequence
number than the last one received.`),
                        })
                        .describe('HTTP request item.')
                )
                .describe('Retrieved HTTP requests.'),
        };
    }

    async handle(
        context: McpSessionContext,
        args: GetHttpRequestsInput
    ): Promise<GetHttpRequestsOutput> {
        const filteredHttpRequests: HttpRequest[] = context
            .getHttpRequests()
            .filter((req: HttpRequest): boolean => {
                let filter: boolean = true;
                if (filter && args.resourceType) {
                    filter = req.resourceType === args.resourceType;
                }
                if (filter && args.status) {
                    if (filter && args.status.min) {
                        filter = req.response
                            ? req.response.status >= args.status.min
                            : false;
                    }
                    if (filter && args.status.max) {
                        filter = req.response
                            ? req.response.status <= args.status.max
                            : false;
                    }
                }
                if (filter && args.ok !== undefined) {
                    filter = req.ok;
                }
                if (filter && args.timestamp) {
                    filter = req.timestamp >= args.timestamp;
                }
                if (filter && args.sequenceNumber) {
                    filter = req.sequenceNumber > args.sequenceNumber;
                }
                return filter;
            });

        const trimmedHttpRequests: HttpRequest[] = args.limit?.count
            ? args.limit.from === 'start'
                ? filteredHttpRequests.slice(0, args.limit.count)
                : filteredHttpRequests.slice(-args.limit.count)
            : filteredHttpRequests;

        const httpRequestsToReturn: GetHttpRequestsOutput['requests'] =
            trimmedHttpRequests.map(
                (
                    req: HttpRequest
                ): GetHttpRequestsOutput['requests'][number] => {
                    return {
                        url: req.url,
                        method: req.method,
                        headers: req.headers,
                        body: req.body,
                        resourceType: req.resourceType,
                        failure: req.failure,
                        duration: req.duration,
                        response: req.response
                            ? {
                                  status: req.response.status,
                                  statusText: req.response.statusText,
                                  headers: req.response.headers,
                                  body: req.response.body,
                              }
                            : undefined,
                        ok: req.ok,
                        timestamp: req.timestamp,
                        sequenceNumber: req.sequenceNumber,
                    };
                }
            );

        return {
            requests: httpRequestsToReturn,
        };
    }
}
