import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface GetTraceIdInput extends ToolInput {}

export interface GetTraceIdOutput extends ToolOutput {
    traceId?: string;
}

export class GetTraceId implements Tool {
    name(): string {
        return 'o11y_get-trace-id';
    }

    description(): string {
        return 'Gets the OpenTelemetry compatible trace id of the current session.';
    }

    inputSchema(): ToolInputSchema {
        return {};
    }

    outputSchema(): ToolOutputSchema {
        return {
            traceId: z
                .string()
                .describe(
                    'The OpenTelemetry compatible trace id of the current session if available.'
                )
                .optional(),
        };
    }

    async handle(
        context: McpSessionContext,
        args: GetTraceIdInput
    ): Promise<GetTraceIdOutput> {
        return {
            traceId: await context.getTraceId(),
        };
    }
}
