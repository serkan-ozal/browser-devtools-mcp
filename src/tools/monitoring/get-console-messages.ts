import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';
import {
    ConsoleMessage,
    ConsoleMessageLevel,
    ConsoleMessageLevelCode,
    ConsoleMessageLevelName,
} from '../../types';
import { createEnumTransformer, getEnumKeyTuples } from '../../utils';

import { z } from 'zod';

export interface GetConsoleMessagesInput extends ToolInput {
    type?: ConsoleMessageLevelName;
    search?: string;
    timestamp?: number;
    sequenceNumber?: number;
    limit?: {
        count: number;
        from: 'start' | 'end';
    };
}

export interface GetConsoleMessagesOutput extends ToolOutput {
    messages: Array<{
        type: string;
        text: string;
        location?: {
            url: string;
            lineNumber: number;
            columnNumber: number;
        };
        timestamp: number;
        sequenceNumber: number;
    }>;
}

export class GetConsoleMessages implements Tool {
    name(): string {
        return 'monitoring_get-console-messages';
    }

    description(): string {
        return 'Retrieves console messages/logs from the browser with filtering options.';
    }

    inputSchema(): ToolInputSchema {
        return {
            type: z
                .enum(getEnumKeyTuples(ConsoleMessageLevelName))
                .transform(createEnumTransformer(ConsoleMessageLevelName))
                .describe(
                    `
Type of console messages to retrieve. 
When specified, console messages with equal or higher levels are retrieved.
Valid values are (in ascending order according to their levels): ${getEnumKeyTuples(ConsoleMessageLevelName)}.`
                )
                .optional(),
            search: z
                .string()
                .describe('Text to search for in console messages.')
                .optional(),
            timestamp: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    `
Start time filter as a Unix epoch timestamp in milliseconds. 
If provided, only console messages recorded at or after this timestamp will be returned.`
                )
                .optional(),
            sequenceNumber: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    `
Sequence number for incremental retrieval. 
If provided, only console messages with a sequence number greater than this value will be returned. 
This allows clients to fetch console messages incrementally by passing the last received sequence number on subsequent requests.`
                )
                .optional(),
            limit: z
                .object({
                    count: z.number().int().nonnegative().default(0).describe(`
Count of the maximum number of console messages to return. 
If the result exceeds this limit, it will be truncated.
"0" means no count limit.`),
                    from: z.enum(['start', 'end']).default('end').describe(`
Controls which side is kept when truncation is applied. 
"start" keeps the first N items (trims from the end).
"end" keeps the last N items (trims from the start).`),
                })
                .describe('Maximum number of console messages to return.')
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            messages: z
                .array(
                    z
                        .object({
                            type: z
                                .string()
                                .describe('Type of the console message.'),
                            text: z
                                .string()
                                .describe('Text of the console message.'),
                            location: z
                                .object({
                                    url: z
                                        .string()
                                        .describe('URL of the resource.'),
                                    lineNumber: z
                                        .number()
                                        .nonnegative()
                                        .describe(
                                            '0-based line number in the resource.'
                                        ),
                                    columnNumber: z
                                        .number()
                                        .nonnegative()
                                        .describe(
                                            '0-based column number in the resource.'
                                        ),
                                })
                                .describe(
                                    'Location of the console message in the resource.'
                                )
                                .optional(),
                            timestamp: z
                                .number()
                                .int()
                                .nonnegative()
                                .describe(
                                    'Unix epoch timestamp (in milliseconds) of the console message.'
                                ),
                            sequenceNumber: z.number().int().nonnegative()
                                .describe(`
A monotonically increasing sequence number assigned to each console message.
It reflects the order in which messages were captured and can be used by clients
to retrieve messages incrementally by requesting only those with a higher sequence
number than the last one received.`),
                        })
                        .describe('Console message item.')
                )
                .describe('Retrieved console messages.'),
        };
    }

    async handle(
        context: McpSessionContext,
        args: GetConsoleMessagesInput
    ): Promise<GetConsoleMessagesOutput> {
        const consoleMessageLevelCodeThreshold:
            | ConsoleMessageLevelCode
            | undefined = args.type
            ? ConsoleMessageLevel[args.type]?.code
            : undefined;

        const filteredConsoleMessages: ConsoleMessage[] = context
            .getConsoleMessages()
            .filter((msg: ConsoleMessage): boolean => {
                let filter: boolean = true;
                if (consoleMessageLevelCodeThreshold !== undefined) {
                    filter = msg.level.code >= consoleMessageLevelCodeThreshold;
                }
                if (filter && args.timestamp) {
                    filter = msg.timestamp >= args.timestamp;
                }
                if (filter && args.sequenceNumber) {
                    filter = msg.sequenceNumber > args.sequenceNumber;
                }
                if (filter && args.search) {
                    filter = msg.text.includes(args.search);
                }
                return filter;
            });

        const trimmedConsoleMessages: ConsoleMessage[] = args.limit?.count
            ? args.limit.from === 'start'
                ? filteredConsoleMessages.slice(0, args.limit.count)
                : filteredConsoleMessages.slice(-args.limit.count)
            : filteredConsoleMessages;

        const consoleMessagesToReturn: GetConsoleMessagesOutput['messages'] =
            trimmedConsoleMessages.map(
                (
                    msg: ConsoleMessage
                ): GetConsoleMessagesOutput['messages'][number] => {
                    return {
                        type: msg.type,
                        text: msg.text,
                        location: msg.location
                            ? {
                                  url: msg.location.url,
                                  lineNumber: msg.location.lineNumber,
                                  columnNumber: msg.location.columnNumber,
                              }
                            : undefined,
                        timestamp: msg.timestamp,
                        sequenceNumber: msg.sequenceNumber,
                    };
                }
            );

        return {
            messages: consoleMessagesToReturn,
        };
    }
}
