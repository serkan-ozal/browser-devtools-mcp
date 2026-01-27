import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import vm from 'node:vm';
import crypto from 'node:crypto';

import { z } from 'zod';

const DEFAULT_TIMEOUT_MS: number = 5_000;
const MAX_TIMEOUT_MS: number = 30_000;

type SandboxConsoleLog = {
    level: 'log' | 'warn' | 'error';
    message: string;
};

export interface JsInSandboxInput extends ToolInput {
    /**
     * JavaScript code to run on the MCP server in a VM sandbox.
     * Runs on Node.js (NOT inside the browser).
     *
     * The code is wrapped in an async IIFE, so `await` is allowed.
     * Use `return ...` to return a value.
     */
    code: string;

    /**
     * Max VM CPU time for synchronous execution.
     * NOTE: This does not automatically time out awaited Promises.
     */
    timeoutMs?: number;
}

export interface JsInSandboxOutput extends ToolOutput {
    /**
     * Either:
     * - the returned value of the user code (best-effort JSON-safe), or
     * - { logs } if user returned undefined but produced console output, or
     * - { error, logs } if execution failed
     */
    result: any;
}

function toJsonSafe(value: unknown): any {
    if (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return String(value);
    }
}

export class JsInSandbox implements Tool {
    name(): string {
        return 'run_js-in-sandbox';
    }

    description(): string {
        return `
Runs custom JavaScript inside a Node.js VM sandbox.

This runs on the MCP SERVER (not in the browser).

Available bindings:
- page: Playwright Page (main interaction surface)
- console: captured logs (log/warn/error)
- sleep(ms): async helper

Safe built-ins:
- Math, JSON, Number, String, Boolean, Array, Object, Date, RegExp
- isFinite, isNaN, parseInt, parseFloat
- URL, URLSearchParams
- TextEncoder, TextDecoder
- structuredClone
- crypto.randomUUID()
- AbortController
- setTimeout / clearTimeout

NOT available:
- require, process, fs, Buffer
- globalThis

This is NOT a security boundary. Intended for trusted automation logic.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            code: z.string().describe('JavaScript code (async allowed).'),
            timeoutMs: z
                .number()
                .int()
                .min(0)
                .max(MAX_TIMEOUT_MS)
                .optional()
                .default(DEFAULT_TIMEOUT_MS)
                .describe(
                    'Max VM CPU time for synchronous execution in milliseconds.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            result: z.any().describe(`
Return value of the sandboxed code (best-effort JSON-safe). 
If user returns undefined but logs exist, returns { logs }. 
If error occurs, returns { error, logs }.`),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: JsInSandboxInput
    ): Promise<JsInSandboxOutput> {
        const logs: Array<SandboxConsoleLog> = [];

        const sandboxConsole: Console = {
            log: (...items: Array<any>): void => {
                logs.push({
                    level: 'log',
                    message: items.map((x: any): string => String(x)).join(' '),
                });
            },
            warn: (...items: Array<any>): void => {
                logs.push({
                    level: 'warn',
                    message: items.map((x: any): string => String(x)).join(' '),
                });
            },
            error: (...items: Array<any>): void => {
                logs.push({
                    level: 'error',
                    message: items.map((x: any): string => String(x)).join(' '),
                });
            },
        } as unknown as Console;

        const sleep: (ms: number) => Promise<void> = async (
            ms: number
        ): Promise<void> => {
            const d: number = Math.max(0, Math.floor(ms));
            await new Promise((resolve: (value: void) => void): void => {
                setTimeout((): void => resolve(), d);
            });
        };

        const sandbox: Record<string, unknown> = {
            // Playwright
            page: context.page,

            // Logging / helpers
            console: sandboxConsole,
            sleep: sleep,

            // Safe built-ins
            Math,
            JSON,
            Number,
            String,
            Boolean,
            Array,
            Object,
            Date,
            RegExp,
            isFinite,
            isNaN,
            parseInt,
            parseFloat,

            // Useful helpers
            URL,
            URLSearchParams,
            TextEncoder,
            TextDecoder,
            structuredClone,

            // Controlled crypto
            crypto: {
                randomUUID: crypto.randomUUID,
            },

            // Async control
            AbortController,
            setTimeout,
            clearTimeout,
        };

        const vmContext: vm.Context = vm.createContext(sandbox);

        const wrappedSource: string = `
'use strict';
(async () => {
${String(args.code ?? '')}
})()
        `.trim();

        try {
            const script: vm.Script = new vm.Script(wrappedSource, {
                filename: 'mcp-sandbox.js',
            });

            const value: unknown = script.runInContext(vmContext, {
                timeout: args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            });

            const awaited: unknown = await Promise.resolve(value);

            if (awaited === undefined && logs.length > 0) {
                return { result: { logs } };
            }

            return { result: toJsonSafe(awaited) };
        } catch (e: unknown) {
            const msg: string =
                e instanceof Error ? (e.stack ?? e.message) : String(e);

            return {
                result: {
                    error: msg,
                    logs,
                },
            };
        }
    }
}
