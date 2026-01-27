import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';
import { newTraceId } from '../../utils';

import { z } from 'zod';

export interface NewTraceIdInput extends ToolInput {}

export interface NewTraceIdOutput extends ToolOutput {
    traceId: string;
}

export class NewTraceId implements Tool {
    name(): string {
        return 'o11y_new-trace-id';
    }

    description(): string {
        return 'Generates new OpenTelemetry compatible trace id and sets it to the current session.';
    }

    inputSchema(): ToolInputSchema {
        return {};
    }

    outputSchema(): ToolOutputSchema {
        return {
            traceId: z
                .string()
                .describe(
                    'The generated new OpenTelemetry compatible trace id.'
                ),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: NewTraceIdInput
    ): Promise<NewTraceIdOutput> {
        const traceId: string = newTraceId();

        await context.setTraceId(traceId);

        return {
            traceId,
        };
    }
}
