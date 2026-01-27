import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import type { Response } from 'playwright';
import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 0;
const DEFAULT_WAIT_UNTIL = 'load';

export interface GoToInput extends ToolInput {
    url: string;
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

export interface GoToOutput extends ToolOutput {
    url: string | undefined;
    status: number | undefined;
    statusText: string | undefined;
    ok: boolean | undefined;
}

export class GoTo implements Tool {
    name(): string {
        return 'navigation_go-to';
    }

    description(): string {
        return `
Navigates to the given URL.
**NOTE**: The tool either throws an error or returns a main resource response. 
The only exceptions are navigation to \`about:blank\` or navigation to the same URL with a different hash, 
which would succeed and return empty response.
        `;
    }

    inputSchema(): ToolInputSchema {
        return {
            url: z
                .string()
                .describe(
                    'URL to navigate page to. The url should include scheme, e.g. `http://`, `https://`.'
                ),
            timeout: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Maximum operation time in milliseconds. Defaults to `0` - no timeout.'
                )
                .optional()
                .default(DEFAULT_TIMEOUT_MS),
            waitUntil: z
                .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
                .describe(
                    `
When to consider operation succeeded, defaults to \`load\`. Events can be either:
- \`domcontentloaded\`: Consider operation to be finished when the \`DOMContentLoaded\` event is fired.
- \`load\`: Consider operation to be finished when the \`load\` event is fired.
- \`networkidle\`: **DISCOURAGED** consider operation to be finished when there are no network connections for
                   at least \`500\` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
- \`commit\`: Consider operation to be finished when network response is received and the document started loading.`
                )
                .optional()
                .default(DEFAULT_WAIT_UNTIL),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            url: z
                .string()
                .describe('Contains the URL of the navigated page.')
                .optional(),
            status: z
                .number()
                .int()
                .positive()
                .describe(
                    'Contains the status code of the navigated page (e.g., 200 for a success).'
                )
                .optional(),
            statusText: z
                .string()
                .describe(
                    'Contains the status text of the navigated page (e.g. usually an "OK" for a success).'
                )
                .optional(),
            ok: z
                .boolean()
                .describe(
                    'Contains a boolean stating whether the navigated page was successful (status in the range 200-299) or not.'
                )
                .optional(),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: GoToInput
    ): Promise<GoToOutput> {
        const response: Response | null = await context.page.goto(args.url, {
            timeout: args.timeout,
            waitUntil: args.waitUntil,
        });
        return {
            url: response?.url(),
            status: response?.status(),
            statusText: response?.statusText(),
            ok: response?.ok(),
        };
    }
}
