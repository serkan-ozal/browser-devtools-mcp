import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

export interface TakeSnapshotInput extends ToolInput {
    selector?: string;
}

export interface TakeSnapshotOutput extends ToolOutput {
    output: string;
}

export class TakeAriaSnapshot implements Tool {
    name(): string {
        return 'content_take-aria-snapshot';
    }

    description(): string {
        return `
Captures an ARIA (accessibility) snapshot of the current page or a specific element.
If a selector is provided, the snapshot is scoped to that element; otherwise, the entire page is captured.
The output includes the page URL, title, and a YAML-formatted accessibility tree.
        `;
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe('CSS selector for element to take snapshot.')
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            output: z
                .string()
                .describe(
                    'Includes the page URL, title, and a YAML-formatted accessibility tree.'
                ),
        };
    }

    async handle(
        context: McpSessionContext,
        args: TakeSnapshotInput
    ): Promise<TakeSnapshotOutput> {
        const snapshot: string = await context.page
            .locator(args.selector || 'body')
            .ariaSnapshot();
        const output: string = `
- Page URL: ${context.page.url()}
- Page Title: ${await context.page.title()}
- Page/Component Snapshot:
\`\`\`yaml
${snapshot}
\`\`\`
        `.trim();
        return {
            output,
        };
    }
}
