import { McpSessionContext } from '../../context';
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

export interface ReloadInput extends ToolInput {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

export interface ReloadOutput extends ToolOutput {
    url: string | undefined;
    status: number | undefined;
    statusText: string | undefined;
    ok: boolean | undefined;
}

export class Reload implements Tool {
    name(): string {
        return 'navigation_reload';
    }

    description(): string {
        return `
Reloads the current page.
In case of multiple redirects, the navigation resolves with the response of the last redirect.
If the reload does not produce a response, returns empty response.
        `;
    }

    inputSchema(): ToolInputSchema {
        return {
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
                .describe('Contains the URL of the reloaded page.')
                .optional(),
            status: z
                .number()
                .int()
                .positive()
                .describe(
                    'Contains the status code of the reloaded page (e.g., 200 for a success).'
                )
                .optional(),
            statusText: z
                .string()
                .describe(
                    'Contains the status text of the reloaded page (e.g. usually an "OK" for a success).'
                )
                .optional(),
            ok: z
                .boolean()
                .describe(
                    'Contains a boolean stating whether the reloaded page was successful (status in the range 200-299) or not.'
                )
                .optional(),
        };
    }

    async handle(
        context: McpSessionContext,
        args: ReloadInput
    ): Promise<ReloadOutput> {
        const response: Response | null = await context.page.reload({
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
