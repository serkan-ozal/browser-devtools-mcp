import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface SetTraceIdInput extends ToolInput {
    traceId: string;
}

export interface SetTraceIdOutput extends ToolOutput {}

export class SetTraceId implements Tool {
    name(): string {
        return 'o11y_set-trace-id';
    }

    description(): string {
        return 'Sets the OpenTelemetry compatible trace id of the current session.';
    }

    inputSchema(): ToolInputSchema {
        return {
            traceId: z
                .string()
                .describe('The OpenTelemetry compatible trace id to be set.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {};
    }

    async handle(
        context: ToolSessionContext,
        args: SetTraceIdInput
    ): Promise<SetTraceIdOutput> {
        await context.setTraceId(args.traceId);

        return {};
    }
}
