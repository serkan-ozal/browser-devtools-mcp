import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface SetTraceIdInput extends ToolInput {
    traceId?: string;
}

export interface SetTraceIdOutput extends ToolOutput {}

export class SetTraceId implements Tool {
    name(): string {
        return 'monitoring_set-trace-id';
    }

    description(): string {
        return `
Sets the OpenTelemetry compatible trace id of the current session.
Leave it empty to clear the trace id of the current session, 
so no OpenTelemetry trace header will be propagated from browser throughout the API calls.
        `;
    }

    inputSchema(): ToolInputSchema {
        return {
            traceId: z
                .string()
                .describe(
                    `
The OpenTelemetry compatible trace id to be set. 
Leave it empty to clear the session trace id.`
                )
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: McpSessionContext,
        args: SetTraceIdInput
    ): Promise<SetTraceIdOutput> {
        context.setTraceId(args.traceId);

        return {};
    }
}
