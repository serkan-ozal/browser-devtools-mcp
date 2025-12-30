import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface EvaluateInput extends ToolInput {
    script: string;
}

export interface EvaluateOutput extends ToolOutput {}

export class Evaluate implements Tool {
    name(): string {
        return 'interaction_evaluate';
    }

    description(): string {
        return 'Executes JavaScript in the browser console.';
    }

    inputSchema(): ToolInputSchema {
        return {
            script: z.string().describe('JavaScript code to execute.'),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            result: z.any().describe(`
The result of the evaluation. This value can be of any type, including primitives, arrays, or objects.
It represents the direct return value of the JavaScript expression executed in the page context.
The structure and type of this value are not constrained and depend entirely on the evaluated code.`),
        };
    }

    async handle(
        context: McpSessionContext,
        args: EvaluateInput
    ): Promise<EvaluateOutput> {
        const result: any = await context.page.evaluate(args.script);
        return {
            result,
        };
    }
}
