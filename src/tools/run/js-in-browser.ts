import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface JsInBrowserInput extends ToolInput {
    script: string;
}

export interface JsInBrowserOutput extends ToolOutput {}

export class JsInBrowser implements Tool {
    name(): string {
        return 'run_js-in-browser';
    }

    description(): string {
        return `
Runs custom JavaScript INSIDE the active browser page using Playwright's "page.evaluate()".

This code executes in the PAGE CONTEXT (real browser environment):
- Has access to window, document, DOM, Web APIs
- Can read/modify the page state
- Runs with the same permissions as the loaded web page

Typical use cases:
- Inspect or mutate DOM state
- Read client-side variables or framework internals
- Trigger browser-side logic
- Extract computed values directly from the page

Notes:
- The code runs in an isolated execution context, but within the page
- No direct access to Node.js APIs
- Return value must be serializable
        `;
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
        args: JsInBrowserInput
    ): Promise<JsInBrowserOutput> {
        const result: any = await context.page.evaluate(args.script);
        return {
            result,
        };
    }
}
