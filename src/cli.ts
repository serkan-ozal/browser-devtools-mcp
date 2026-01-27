#!/usr/bin/env node

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

import { Command, Option } from 'commander';
import { ZodTypeAny } from 'zod';

import * as config from './config';
import * as logger from './logger';
import { tools, Tool, ToolInput, ToolOutput } from './tools';
import { registerToolCommands } from './utils/cli-utils';

type GlobalOptions = {
    port: number;
    sessionId?: string;
    json?: boolean;
    quiet?: boolean;
    verbose?: boolean;
    timeout?: number;
    // Browser options
    headless?: boolean;
    persistent?: boolean;
    userDataDir?: string;
    useSystemBrowser?: boolean;
    browserPath?: string;
};

type ToolCallRequest = {
    toolName: string;
    toolInput: ToolInput;
};

type ToolCallResponse = {
    toolOutput?: ToolOutput;
    toolError?: {
        code?: number;
        message?: string;
    };
};

type SessionInfo = {
    id: string;
    createdAt: number;
    lastActiveAt: number;
    idleSeconds: number;
};

type SessionListResponse = {
    sessions: SessionInfo[];
};

type DaemonInfo = {
    version: string;
    uptime: number;
    sessionCount: number;
    port: number;
};

const DEFAULT_TIMEOUT: number = 30000;

let verboseEnabled: boolean = false;

function _verbose(message: string, data?: any): void {
    if (verboseEnabled) {
        const timestamp: string = new Date().toISOString();
        if (data !== undefined) {
            console.error(`[${timestamp}] [DEBUG] ${message}`, data);
        } else {
            console.error(`[${timestamp}] [DEBUG] ${message}`);
        }
    }
}

async function _isDaemonRunning(port: number): Promise<boolean> {
    _verbose(`Checking if daemon is running on port ${port}`);
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/health`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            }
        );
        if (response.ok) {
            const data: any = await response.json();
            const isRunning: boolean = data.status === 'ok';
            _verbose(
                `Daemon health check result: ${isRunning ? 'running' : 'not running'}`
            );
            return isRunning;
        }
        _verbose(`Daemon health check failed: HTTP ${response.status}`);
        return false;
    } catch (err: any) {
        _verbose(`Daemon health check error: ${err.message}`);
        return false;
    }
}

function _buildDaemonEnv(opts: GlobalOptions): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };

    // Set browser options as environment variables
    if (opts.headless !== undefined) {
        env['BROWSER_HEADLESS_ENABLE'] = String(opts.headless);
    }
    if (opts.persistent !== undefined) {
        env['BROWSER_PERSISTENT_ENABLE'] = String(opts.persistent);
    }
    if (opts.userDataDir !== undefined) {
        env['BROWSER_PERSISTENT_USER_DATA_DIR'] = opts.userDataDir;
    }
    if (opts.useSystemBrowser !== undefined) {
        env['BROWSER_USE_INSTALLED_ON_SYSTEM'] = String(opts.useSystemBrowser);
    }
    if (opts.browserPath !== undefined) {
        env['BROWSER_EXECUTABLE_PATH'] = opts.browserPath;
    }

    return env;
}

function _startDaemonDetached(opts: GlobalOptions): void {
    const daemonServerPath: string = path.join(__dirname, 'daemon-server.js');
    const env: NodeJS.ProcessEnv = _buildDaemonEnv(opts);

    _verbose(`Starting daemon server from: ${daemonServerPath}`);
    _verbose(`Daemon port: ${opts.port}`);
    _verbose(`Environment variables:`, {
        BROWSER_HEADLESS_ENABLE: env['BROWSER_HEADLESS_ENABLE'],
        BROWSER_PERSISTENT_ENABLE: env['BROWSER_PERSISTENT_ENABLE'],
        BROWSER_USE_INSTALLED_ON_SYSTEM: env['BROWSER_USE_INSTALLED_ON_SYSTEM'],
    });

    const child: ChildProcess = spawn(
        process.execPath,
        [daemonServerPath, '--port', String(opts.port)],
        {
            detached: true,
            stdio: 'ignore',
            env,
        }
    );

    child.unref();

    _verbose(`Daemon process spawned with PID: ${child.pid}`);

    if (!opts.quiet) {
        logger.info(
            `Started daemon server as detached process (PID: ${child.pid})`
        );
    }
}

async function _ensureDaemonRunning(opts: GlobalOptions): Promise<void> {
    const isRunning: boolean = await _isDaemonRunning(opts.port);

    if (!isRunning) {
        if (!opts.quiet) {
            logger.info(
                `Daemon server is not running on port ${opts.port}, starting...`
            );
        }
        _startDaemonDetached(opts);

        // Wait for daemon to be ready
        const maxRetries: number = 10;
        const retryDelay: number = 500;

        _verbose(
            `Waiting for daemon to be ready (max ${maxRetries} retries, ${retryDelay}ms delay)`
        );

        for (let i: number = 0; i < maxRetries; i++) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            _verbose(`Retry ${i + 1}/${maxRetries}: checking daemon status...`);
            if (await _isDaemonRunning(opts.port)) {
                _verbose('Daemon is now ready');
                if (!opts.quiet) {
                    logger.info('Daemon server is ready');
                }
                return;
            }
        }

        throw new Error(
            `Daemon server failed to start within ${(maxRetries * retryDelay) / 1000} seconds`
        );
    } else {
        _verbose('Daemon is already running');
    }
}

async function _stopDaemon(port: number, timeout: number): Promise<boolean> {
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/shutdown`,
            {
                method: 'POST',
                signal: AbortSignal.timeout(timeout),
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}

async function _callTool(
    port: number,
    toolName: string,
    toolInput: ToolInput,
    sessionId?: string,
    timeout?: number
): Promise<ToolCallResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (sessionId) {
        headers['session-id'] = sessionId;
    }

    const request: ToolCallRequest = {
        toolName,
        toolInput,
    };

    _verbose(`Calling tool: ${toolName}`);
    _verbose(`Tool input:`, toolInput);
    _verbose(`Session ID: ${sessionId || '(default)'}`);
    _verbose(`Timeout: ${timeout || 'none'}`);

    const startTime: number = Date.now();

    const response: Response = await fetch(`http://localhost:${port}/call`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    });

    const duration: number = Date.now() - startTime;
    _verbose(
        `Tool call completed in ${duration}ms, status: ${response.status}`
    );

    if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        _verbose(`Tool call error:`, errorBody);
        throw new Error(
            errorBody?.error?.message ||
                `HTTP ${response.status}: ${response.statusText}`
        );
    }

    const result: ToolCallResponse =
        (await response.json()) as ToolCallResponse;
    _verbose(
        `Tool call result:`,
        result.toolError ? { error: result.toolError } : { success: true }
    );

    return result;
}

async function _deleteSession(
    port: number,
    sessionId: string,
    timeout: number
): Promise<boolean> {
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/session`,
            {
                method: 'DELETE',
                headers: {
                    'session-id': sessionId,
                },
                signal: AbortSignal.timeout(timeout),
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}

async function _getDaemonInfo(
    port: number,
    timeout: number
): Promise<DaemonInfo | null> {
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/info`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(timeout),
            }
        );
        if (response.ok) {
            return (await response.json()) as DaemonInfo;
        }
        return null;
    } catch {
        return null;
    }
}

async function _listSessions(
    port: number,
    timeout: number
): Promise<SessionListResponse | null> {
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/sessions`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(timeout),
            }
        );
        if (response.ok) {
            return (await response.json()) as SessionListResponse;
        }
        return null;
    } catch {
        return null;
    }
}

async function _getSessionInfo(
    port: number,
    sessionId: string,
    timeout: number
): Promise<SessionInfo | null> {
    try {
        const response: Response = await fetch(
            `http://localhost:${port}/session`,
            {
                method: 'GET',
                headers: {
                    'session-id': sessionId,
                },
                signal: AbortSignal.timeout(timeout),
            }
        );
        if (response.ok) {
            return (await response.json()) as SessionInfo;
        }
        return null;
    } catch {
        return null;
    }
}

function _formatUptime(seconds: number): string {
    const days: number = Math.floor(seconds / 86400);
    const hours: number = Math.floor((seconds % 86400) / 3600);
    const minutes: number = Math.floor((seconds % 3600) / 60);
    const secs: number = seconds % 60;

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    parts.push(`${secs}s`);

    return parts.join(' ');
}

function _formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

function _getZodTypeName(schema: ZodTypeAny): string {
    const typeName: string = schema._def.typeName;

    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
        return _getZodTypeName(schema._def.innerType);
    }

    if (typeName === 'ZodDefault') {
        return _getZodTypeName(schema._def.innerType);
    }

    if (typeName === 'ZodArray') {
        return `${_getZodTypeName(schema._def.type)}[]`;
    }

    if (typeName === 'ZodEnum') {
        return schema._def.values.join(' | ');
    }

    if (typeName === 'ZodLiteral') {
        return JSON.stringify(schema._def.value);
    }

    if (typeName === 'ZodUnion') {
        return schema._def.options
            .map((opt: ZodTypeAny) => _getZodTypeName(opt))
            .join(' | ');
    }

    const typeMap: Record<string, string> = {
        ZodString: 'string',
        ZodNumber: 'number',
        ZodBoolean: 'boolean',
        ZodObject: 'object',
        ZodRecord: 'Record<string, any>',
        ZodAny: 'any',
    };

    return typeMap[typeName] || typeName.replace('Zod', '').toLowerCase();
}

function _getZodDescription(schema: ZodTypeAny): string | undefined {
    if (schema._def.description) {
        return schema._def.description;
    }

    if (
        schema._def.typeName === 'ZodOptional' ||
        schema._def.typeName === 'ZodNullable' ||
        schema._def.typeName === 'ZodDefault'
    ) {
        return _getZodDescription(schema._def.innerType);
    }

    return undefined;
}

function _isZodOptional(schema: ZodTypeAny): boolean {
    const typeName: string = schema._def.typeName;
    return typeName === 'ZodOptional' || typeName === 'ZodNullable';
}

function _hasZodDefault(schema: ZodTypeAny): boolean {
    if (schema._def.typeName === 'ZodDefault') {
        return true;
    }
    if (
        schema._def.typeName === 'ZodOptional' ||
        schema._def.typeName === 'ZodNullable'
    ) {
        return _hasZodDefault(schema._def.innerType);
    }
    return false;
}

function _getZodDefault(schema: ZodTypeAny): any {
    if (schema._def.typeName === 'ZodDefault') {
        return schema._def.defaultValue();
    }
    if (
        schema._def.typeName === 'ZodOptional' ||
        schema._def.typeName === 'ZodNullable'
    ) {
        return _getZodDefault(schema._def.innerType);
    }
    return undefined;
}

function _formatOutput(output: any, indent: number = 0): string {
    const prefix: string = '  '.repeat(indent);

    if (output === null || output === undefined) {
        return `${prefix}(empty)`;
    }

    if (typeof output === 'string') {
        return output
            .split('\n')
            .map((line: string) => `${prefix}${line}`)
            .join('\n');
    }

    if (typeof output === 'number' || typeof output === 'boolean') {
        return `${prefix}${output}`;
    }

    if (Array.isArray(output)) {
        if (output.length === 0) {
            return `${prefix}[]`;
        }
        return output
            .map((item: any) => _formatOutput(item, indent))
            .join('\n');
    }

    if (typeof output === 'object') {
        const lines: string[] = [];
        for (const [key, value] of Object.entries(output)) {
            if (value === undefined) {
                continue;
            }

            if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
            ) {
                lines.push(`${prefix}${key}:`);
                lines.push(_formatOutput(value, indent + 1));
            } else if (Array.isArray(value)) {
                lines.push(`${prefix}${key}:`);
                lines.push(_formatOutput(value, indent + 1));
            } else {
                lines.push(`${prefix}${key}: ${value}`);
            }
        }
        return lines.join('\n');
    }

    return `${prefix}${String(output)}`;
}

function _printOutput(
    data: any,
    json: boolean,
    isError: boolean = false
): void {
    const output: string = json ? JSON.stringify(data, null, 2) : String(data);
    if (isError) {
        console.error(output);
    } else {
        console.log(output);
    }
}

// Helper function to add global options to a Command
function _addGlobalOptions(cmd: Command): Command {
    return (
        cmd
            .addOption(
                new Option('--port <number>', 'Daemon server port')
                    .argParser((value: string): number => {
                        const n: number = Number(value);
                        if (!Number.isInteger(n) || n < 1 || n > 65535) {
                            throw new Error(
                                'Port must be an integer between 1 and 65535'
                            );
                        }
                        return n;
                    })
                    .default(config.DAEMON_PORT)
            )
            .addOption(
                new Option(
                    '--session-id <string>',
                    'Session ID for maintaining browser state across commands'
                )
            )
            .addOption(new Option('--json', 'Output results as JSON'))
            .addOption(
                new Option('--quiet', 'Suppress log messages, only show output')
            )
            .addOption(new Option('--verbose', 'Enable verbose/debug output'))
            .addOption(
                new Option(
                    '--timeout <ms>',
                    'Timeout for operations in milliseconds'
                )
                    .argParser((value: string): number => {
                        const n: number = Number(value);
                        if (!Number.isFinite(n) || n < 0) {
                            throw new Error(
                                'Timeout must be a positive number'
                            );
                        }
                        return n;
                    })
                    .default(DEFAULT_TIMEOUT)
            )
            // Browser options
            .addOption(
                new Option(
                    '--headless',
                    'Run browser in headless mode (no visible window)'
                ).default(config.BROWSER_HEADLESS_ENABLE)
            )
            .addOption(
                new Option(
                    '--no-headless',
                    'Run browser in headful mode (visible window)'
                )
            )
            .addOption(
                new Option(
                    '--persistent',
                    'Use persistent browser context (preserves cookies, localStorage)'
                ).default(config.BROWSER_PERSISTENT_ENABLE)
            )
            .addOption(
                new Option(
                    '--no-persistent',
                    'Use ephemeral browser context (cleared on session end)'
                )
            )
            .addOption(
                new Option(
                    '--user-data-dir <path>',
                    'Directory for persistent browser context user data'
                ).default(config.BROWSER_PERSISTENT_USER_DATA_DIR)
            )
            .addOption(
                new Option(
                    '--use-system-browser',
                    'Use system-installed Chrome instead of bundled browser'
                ).default(config.BROWSER_USE_INSTALLED_ON_SYSTEM)
            )
            .addOption(
                new Option(
                    '--browser-path <path>',
                    'Custom browser executable path'
                )
            )
    );
}

async function main(): Promise<void> {
    const program: Command = _addGlobalOptions(
        new Command('browser-devtools-cli')
            .description('Browser DevTools MCP CLI')
            .version(require('../package.json').version)
    );

    // Enable verbose mode if flag is set
    program.hook('preAction', (thisCommand: Command) => {
        const opts: GlobalOptions = thisCommand.opts() as GlobalOptions;
        if (opts.verbose) {
            verboseEnabled = true;
            _verbose('Verbose mode enabled');
            _verbose('CLI version:', require('../package.json').version);
            _verbose('Node version:', process.version);
            _verbose('Platform:', process.platform);
        }
    });

    // ==================== daemon subcommand ====================
    const daemonCmd: Command = new Command('daemon').description(
        'Manage the daemon server'
    );

    daemonCmd
        .command('start')
        .description('Start the daemon server')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const isRunning: boolean = await _isDaemonRunning(opts.port);

            if (isRunning) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'already_running',
                            port: opts.port,
                        },
                        true
                    );
                } else if (!opts.quiet) {
                    console.log(
                        `Daemon server is already running on port ${opts.port}`
                    );
                }
                return;
            }

            _startDaemonDetached(opts);

            // Wait for daemon to be ready
            const maxRetries: number = 10;
            const retryDelay: number = 500;

            for (let i: number = 0; i < maxRetries; i++) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                if (await _isDaemonRunning(opts.port)) {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'started',
                                port: opts.port,
                            },
                            true
                        );
                    } else if (!opts.quiet) {
                        console.log(
                            `Daemon server started on port ${opts.port}`
                        );
                    }
                    return;
                }
            }

            if (opts.json) {
                _printOutput(
                    {
                        status: 'failed',
                        error: 'Daemon server failed to start',
                    },
                    true,
                    true
                );
            } else {
                console.error('Failed to start daemon server');
            }
            process.exit(1);
        });

    daemonCmd
        .command('stop')
        .description('Stop the daemon server')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const isRunning: boolean = await _isDaemonRunning(opts.port);

            if (!isRunning) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'not_running',
                            port: opts.port,
                        },
                        true
                    );
                } else if (!opts.quiet) {
                    console.log(
                        `Daemon server is not running on port ${opts.port}`
                    );
                }
                return;
            }

            const stopped: boolean = await _stopDaemon(
                opts.port,
                opts.timeout ?? DEFAULT_TIMEOUT
            );

            if (stopped) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'stopped',
                            port: opts.port,
                        },
                        true
                    );
                } else if (!opts.quiet) {
                    console.log(`Daemon server stopped on port ${opts.port}`);
                }
            } else {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'failed',
                            error: 'Failed to stop daemon server',
                        },
                        true,
                        true
                    );
                } else {
                    console.error('Failed to stop daemon server');
                }
                process.exit(1);
            }
        });

    daemonCmd
        .command('restart')
        .description('Restart the daemon server (stop + start)')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const wasRunning: boolean = await _isDaemonRunning(opts.port);

            // Stop if running
            if (wasRunning) {
                _verbose('Stopping daemon server...');
                const stopped: boolean = await _stopDaemon(
                    opts.port,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );

                if (!stopped) {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'failed',
                                error: 'Failed to stop daemon server',
                            },
                            true,
                            true
                        );
                    } else {
                        console.error('Failed to stop daemon server');
                    }
                    process.exit(1);
                }

                // Wait a moment for the port to be released
                _verbose('Waiting for port to be released...');
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            // Start daemon
            _verbose('Starting daemon server...');
            _startDaemonDetached(opts);

            // Wait for daemon to be ready
            const maxRetries: number = 10;
            const retryDelay: number = 500;

            for (let i: number = 0; i < maxRetries; i++) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                if (await _isDaemonRunning(opts.port)) {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'restarted',
                                port: opts.port,
                            },
                            true
                        );
                    } else if (!opts.quiet) {
                        console.log(
                            `Daemon server ${wasRunning ? 'restarted' : 'started'} on port ${opts.port}`
                        );
                    }
                    return;
                }
            }

            if (opts.json) {
                _printOutput(
                    {
                        status: 'failed',
                        error: 'Daemon server failed to start',
                    },
                    true,
                    true
                );
            } else {
                console.error('Failed to start daemon server');
            }
            process.exit(1);
        });

    daemonCmd
        .command('status')
        .description('Check daemon server status')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const isRunning: boolean = await _isDaemonRunning(opts.port);

            if (opts.json) {
                _printOutput(
                    {
                        status: isRunning ? 'running' : 'stopped',
                        port: opts.port,
                    },
                    true
                );
            } else {
                if (isRunning) {
                    console.log(
                        `Daemon server is running on port ${opts.port}`
                    );
                } else {
                    console.log(
                        `Daemon server is not running on port ${opts.port}`
                    );
                }
            }
        });

    daemonCmd
        .command('info')
        .description('Get detailed daemon server information')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const isRunning: boolean = await _isDaemonRunning(opts.port);

            if (!isRunning) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'not_running',
                            port: opts.port,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(
                        `Daemon server is not running on port ${opts.port}`
                    );
                }
                process.exit(1);
            }

            const info: DaemonInfo | null = await _getDaemonInfo(
                opts.port,
                opts.timeout ?? DEFAULT_TIMEOUT
            );

            if (info) {
                if (opts.json) {
                    _printOutput(info, true);
                } else {
                    console.log(`Daemon Server Information:`);
                    console.log(`  Version:       ${info.version}`);
                    console.log(`  Port:          ${info.port}`);
                    console.log(
                        `  Uptime:        ${_formatUptime(info.uptime)}`
                    );
                    console.log(`  Sessions:      ${info.sessionCount}`);
                }
            } else {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'error',
                            error: 'Failed to get daemon info',
                        },
                        true,
                        true
                    );
                } else {
                    console.error('Failed to get daemon info');
                }
                process.exit(1);
            }
        });

    program.addCommand(daemonCmd);

    // ==================== session subcommand ====================
    const sessionCmd: Command = new Command('session').description(
        'Manage browser sessions'
    );

    sessionCmd
        .command('list')
        .description('List all active sessions')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            try {
                await _ensureDaemonRunning(opts);

                const result: SessionListResponse | null = await _listSessions(
                    opts.port,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );

                if (result) {
                    if (opts.json) {
                        _printOutput(result, true);
                    } else {
                        if (result.sessions.length === 0) {
                            console.log('No active sessions');
                        } else {
                            console.log(
                                `Active Sessions (${result.sessions.length}):`
                            );
                            for (const session of result.sessions) {
                                console.log(`  ${session.id}`);
                                console.log(
                                    `    Created:     ${_formatTimestamp(session.createdAt)}`
                                );
                                console.log(
                                    `    Last Active: ${_formatTimestamp(session.lastActiveAt)}`
                                );
                                console.log(
                                    `    Idle:        ${_formatUptime(session.idleSeconds)}`
                                );
                            }
                        }
                    }
                } else {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'error',
                                error: 'Failed to list sessions',
                            },
                            true,
                            true
                        );
                    } else {
                        console.error('Failed to list sessions');
                    }
                    process.exit(1);
                }
            } catch (err: any) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'error',
                            error: err.message,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(`Error: ${err.message}`);
                }
                process.exit(1);
            }
        });

    sessionCmd
        .command('info <session-id>')
        .description('Get information about a specific session')
        .action(async (sessionId: string) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            try {
                await _ensureDaemonRunning(opts);

                const info: SessionInfo | null = await _getSessionInfo(
                    opts.port,
                    sessionId,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );

                if (info) {
                    if (opts.json) {
                        _printOutput(info, true);
                    } else {
                        console.log(`Session: ${info.id}`);
                        console.log(
                            `  Created:     ${_formatTimestamp(info.createdAt)}`
                        );
                        console.log(
                            `  Last Active: ${_formatTimestamp(info.lastActiveAt)}`
                        );
                        console.log(
                            `  Idle:        ${_formatUptime(info.idleSeconds)}`
                        );
                    }
                } else {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'not_found',
                                sessionId: sessionId,
                            },
                            true,
                            true
                        );
                    } else {
                        console.error(`Session '${sessionId}' not found`);
                    }
                    process.exit(1);
                }
            } catch (err: any) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'error',
                            error: err.message,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(`Error: ${err.message}`);
                }
                process.exit(1);
            }
        });

    sessionCmd
        .command('delete <session-id>')
        .description('Delete a specific session')
        .action(async (sessionId: string) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            try {
                await _ensureDaemonRunning(opts);

                const deleted: boolean = await _deleteSession(
                    opts.port,
                    sessionId,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );

                if (deleted) {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'deleted',
                                sessionId: sessionId,
                            },
                            true
                        );
                    } else if (!opts.quiet) {
                        console.log(`Session '${sessionId}' deleted`);
                    }
                } else {
                    if (opts.json) {
                        _printOutput(
                            {
                                status: 'not_found',
                                sessionId: sessionId,
                            },
                            true,
                            true
                        );
                    } else {
                        console.error(
                            `Session '${sessionId}' not found or already deleted`
                        );
                    }
                    process.exit(1);
                }
            } catch (err: any) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'error',
                            error: err.message,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(`Error: ${err.message}`);
                }
                process.exit(1);
            }
        });

    program.addCommand(sessionCmd);

    // ==================== tools subcommand ====================
    const toolsCmd: Command = new Command('tools').description(
        'List and inspect available tools'
    );

    toolsCmd
        .command('list')
        .description('List all available tools')
        .option(
            '--domain <domain>',
            'Filter by domain (e.g., navigation, content)'
        )
        .action((cmdOpts: { domain?: string }) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            // Group tools by domain
            const toolsByDomain: Map<string, Tool[]> = new Map();
            for (const tool of tools) {
                const parts: string[] = tool.name().split('_');
                const domain: string = parts[0];

                if (cmdOpts.domain && domain !== cmdOpts.domain) {
                    continue;
                }

                if (!toolsByDomain.has(domain)) {
                    toolsByDomain.set(domain, []);
                }
                toolsByDomain.get(domain)!.push(tool);
            }

            if (opts.json) {
                const result: {
                    domain: string;
                    tools: { name: string; description: string }[];
                }[] = [];
                for (const [domain, domainTools] of toolsByDomain) {
                    result.push({
                        domain,
                        tools: domainTools.map((t: Tool) => ({
                            name: t.name(),
                            description: t.description().trim().split('\n')[0],
                        })),
                    });
                }
                _printOutput(result, true);
            } else {
                if (toolsByDomain.size === 0) {
                    console.log('No tools found');
                    return;
                }

                console.log(`Available Tools (${tools.length} total):\n`);

                for (const [domain, domainTools] of toolsByDomain) {
                    console.log(`  ${domain}:`);
                    for (const tool of domainTools) {
                        const name: string =
                            tool.name().split('_')[1] || tool.name();
                        const desc: string = tool
                            .description()
                            .trim()
                            .split('\n')[0];
                        console.log(`    ${name.padEnd(30)} ${desc}`);
                    }
                    console.log();
                }
            }
        });

    toolsCmd
        .command('info <tool-name>')
        .description('Get detailed information about a specific tool')
        .action((toolName: string) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            // Find tool by name (support both full name and short name)
            let tool: Tool | undefined = tools.find(
                (t: Tool) => t.name() === toolName
            );

            // Try to find by partial name (e.g., "go-to" -> "navigation_go-to")
            if (!tool) {
                tool = tools.find((t: Tool) => {
                    const parts: string[] = t.name().split('_');
                    return parts[1] === toolName;
                });
            }

            if (!tool) {
                if (opts.json) {
                    _printOutput(
                        {
                            status: 'not_found',
                            toolName: toolName,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(`Tool '${toolName}' not found`);
                }
                process.exit(1);
            }

            const inputSchema: Record<string, ZodTypeAny> = tool.inputSchema();
            const params: {
                name: string;
                type: string;
                required: boolean;
                description?: string;
                default?: any;
            }[] = [];

            for (const [key, schema] of Object.entries(inputSchema)) {
                params.push({
                    name: key,
                    type: _getZodTypeName(schema),
                    required: !_isZodOptional(schema),
                    description: _getZodDescription(schema),
                    default: _hasZodDefault(schema)
                        ? _getZodDefault(schema)
                        : undefined,
                });
            }

            if (opts.json) {
                _printOutput(
                    {
                        name: tool.name(),
                        description: tool.description().trim(),
                        parameters: params,
                    },
                    true
                );
            } else {
                const nameParts: string[] = tool.name().split('_');
                console.log(`Tool: ${tool.name()}`);
                console.log(`Domain: ${nameParts[0]}`);
                console.log(`\nDescription:`);
                console.log(
                    tool
                        .description()
                        .trim()
                        .split('\n')
                        .map((line: string) => `  ${line}`)
                        .join('\n')
                );
                console.log(`\nParameters:`);

                if (params.length === 0) {
                    console.log('  (none)');
                } else {
                    for (const param of params) {
                        const reqStr: string = param.required
                            ? '(required)'
                            : '(optional)';
                        console.log(
                            `  --${param.name} <${param.type}> ${reqStr}`
                        );
                        if (param.description) {
                            console.log(`      ${param.description}`);
                        }
                        if (param.default !== undefined) {
                            console.log(
                                `      Default: ${JSON.stringify(param.default)}`
                            );
                        }
                    }
                }

                console.log(`\nUsage:`);
                console.log(
                    `  browser-devtools-cli ${nameParts[0]} ${nameParts[1] || tool.name()} [options]`
                );
            }
        });

    toolsCmd
        .command('search <query>')
        .description('Search tools by name or description')
        .action((query: string) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const lowerQuery: string = query.toLowerCase();

            // Search tools by name and description
            const matchingTools: Tool[] = tools.filter((tool: Tool) => {
                const name: string = tool.name().toLowerCase();
                const description: string = tool.description().toLowerCase();
                return (
                    name.includes(lowerQuery) ||
                    description.includes(lowerQuery)
                );
            });

            if (opts.json) {
                const result: {
                    name: string;
                    domain: string;
                    description: string;
                }[] = matchingTools.map((t: Tool) => {
                    const parts: string[] = t.name().split('_');
                    return {
                        name: t.name(),
                        domain: parts[0],
                        description: t.description().trim().split('\n')[0],
                    };
                });
                _printOutput(result, true);
            } else {
                if (matchingTools.length === 0) {
                    console.log(`No tools found matching "${query}"`);
                    return;
                }

                console.log(
                    `Tools matching "${query}" (${matchingTools.length} found):\n`
                );

                for (const tool of matchingTools) {
                    const parts: string[] = tool.name().split('_');
                    const domain: string = parts[0];
                    const name: string = parts[1] || tool.name();
                    const desc: string = tool
                        .description()
                        .trim()
                        .split('\n')[0];
                    console.log(`  ${domain}/${name}`);
                    console.log(`    ${desc}\n`);
                }
            }
        });

    program.addCommand(toolsCmd);

    // ==================== config subcommand ====================
    const configCmd: Command = new Command('config')
        .description('Show current configuration')
        .action(() => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            const configValues: Record<string, any> = {
                // Daemon
                daemon: {
                    port: config.DAEMON_PORT,
                    sessionIdleSeconds: config.DAEMON_SESSION_IDLE_SECONDS,
                    sessionIdleCheckSeconds:
                        config.DAEMON_SESSION_IDLE_CHECK_SECONDS,
                },
                // Browser
                browser: {
                    headless: config.BROWSER_HEADLESS_ENABLE,
                    persistent: config.BROWSER_PERSISTENT_ENABLE,
                    userDataDir: config.BROWSER_PERSISTENT_USER_DATA_DIR,
                    useSystemBrowser: config.BROWSER_USE_INSTALLED_ON_SYSTEM,
                    executablePath: config.BROWSER_EXECUTABLE_PATH,
                },
                // OpenTelemetry
                otel: {
                    enabled: config.OTEL_ENABLE,
                    serviceName: config.OTEL_SERVICE_NAME,
                    serviceVersion: config.OTEL_SERVICE_VERSION,
                    exporterType: config.OTEL_EXPORTER_TYPE,
                    exporterHttpUrl: config.OTEL_EXPORTER_HTTP_URL,
                },
                // AWS
                aws: {
                    region: config.AWS_REGION,
                    profile: config.AWS_PROFILE,
                },
                // Bedrock
                bedrock: {
                    enabled: config.AMAZON_BEDROCK_ENABLE,
                    imageEmbedModelId:
                        config.AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID,
                    textEmbedModelId: config.AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID,
                    visionModelId: config.AMAZON_BEDROCK_VISION_MODEL_ID,
                },
                // Figma
                figma: {
                    accessToken: config.FIGMA_ACCESS_TOKEN ? '***' : undefined,
                    apiBaseUrl: config.FIGMA_API_BASE_URL,
                },
            };

            if (opts.json) {
                _printOutput(configValues, true);
            } else {
                console.log('Current Configuration:\n');

                console.log('  Daemon:');
                console.log(
                    `    Port:                    ${configValues.daemon.port}`
                );
                console.log(
                    `    Session Idle (sec):      ${configValues.daemon.sessionIdleSeconds}`
                );
                console.log(
                    `    Idle Check Interval:     ${configValues.daemon.sessionIdleCheckSeconds}`
                );

                console.log('\n  Browser:');
                console.log(
                    `    Headless:                ${configValues.browser.headless}`
                );
                console.log(
                    `    Persistent:              ${configValues.browser.persistent}`
                );
                console.log(
                    `    User Data Dir:           ${configValues.browser.userDataDir || '(default)'}`
                );
                console.log(
                    `    Use System Browser:      ${configValues.browser.useSystemBrowser}`
                );
                console.log(
                    `    Executable Path:         ${configValues.browser.executablePath || '(bundled)'}`
                );

                console.log('\n  OpenTelemetry:');
                console.log(
                    `    Enabled:                 ${configValues.otel.enabled}`
                );
                console.log(
                    `    Service Name:            ${configValues.otel.serviceName}`
                );
                console.log(
                    `    Service Version:         ${configValues.otel.serviceVersion || '(not set)'}`
                );
                console.log(
                    `    Exporter Type:           ${configValues.otel.exporterType}`
                );
                console.log(
                    `    Exporter HTTP URL:       ${configValues.otel.exporterHttpUrl || '(not set)'}`
                );

                console.log('\n  AWS:');
                console.log(
                    `    Region:                  ${configValues.aws.region || '(not set)'}`
                );
                console.log(
                    `    Profile:                 ${configValues.aws.profile || '(not set)'}`
                );

                console.log('\n  Bedrock:');
                console.log(
                    `    Enabled:                 ${configValues.bedrock.enabled}`
                );
                console.log(
                    `    Image Embed Model ID:    ${configValues.bedrock.imageEmbedModelId || '(not set)'}`
                );
                console.log(
                    `    Text Embed Model ID:     ${configValues.bedrock.textEmbedModelId || '(not set)'}`
                );
                console.log(
                    `    Vision Model ID:         ${configValues.bedrock.visionModelId || '(not set)'}`
                );

                console.log('\n  Figma:');
                console.log(
                    `    Access Token:            ${configValues.figma.accessToken || '(not set)'}`
                );
                console.log(
                    `    API Base URL:            ${configValues.figma.apiBaseUrl}`
                );
            }
        });

    program.addCommand(configCmd);

    // ==================== completion subcommand ====================
    const completionCmd: Command = new Command('completion').description(
        'Generate shell completion scripts'
    );

    completionCmd
        .command('bash')
        .description('Generate bash completion script')
        .action(() => {
            const script: string = `
# Browser DevTools CLI bash completion
_browser_devtools_cli_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    local commands="daemon session tools config completion interactive navigation content interaction a11y accessibility o11y react run stub sync figma"
    
    # Daemon subcommands
    local daemon_cmds="start stop restart status info"
    
    # Session subcommands
    local session_cmds="list info delete"
    
    # Tools subcommands
    local tools_cmds="list info search"
    
    case "\${prev}" in
        browser-devtools-cli)
            COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
            return 0
            ;;
        daemon)
            COMPREPLY=( \$(compgen -W "\${daemon_cmds}" -- "\${cur}") )
            return 0
            ;;
        session)
            COMPREPLY=( \$(compgen -W "\${session_cmds}" -- "\${cur}") )
            return 0
            ;;
        tools)
            COMPREPLY=( \$(compgen -W "\${tools_cmds}" -- "\${cur}") )
            return 0
            ;;
    esac
    
    # Global options
    if [[ "\${cur}" == -* ]]; then
        local opts="--port --session-id --json --quiet --verbose --timeout --headless --no-headless --persistent --no-persistent --user-data-dir --use-system-browser --browser-path --help --version"
        COMPREPLY=( \$(compgen -W "\${opts}" -- "\${cur}") )
        return 0
    fi
}

complete -F _browser_devtools_cli_completions browser-devtools-cli
`;
            console.log(script);
            console.error('\n# To enable, add to your ~/.bashrc:');
            console.error('# eval "$(browser-devtools-cli completion bash)"');
        });

    completionCmd
        .command('zsh')
        .description('Generate zsh completion script')
        .action(() => {
            const script: string = `
#compdef browser-devtools-cli

_browser_devtools_cli() {
    local -a commands
    commands=(
        'daemon:Manage the daemon server'
        'session:Manage browser sessions'
        'tools:List and inspect available tools'
        'config:Show current configuration'
        'completion:Generate shell completion scripts'
        'interactive:Start interactive REPL mode'
        'navigation:Navigation commands'
        'content:Content extraction commands'
        'interaction:Interaction commands'
        'a11y:Accessibility commands'
        'accessibility:Extended accessibility commands'
        'o11y:Observability commands'
        'react:React debugging commands'
        'run:Script execution commands'
        'stub:HTTP stubbing commands'
        'sync:Synchronization commands'
        'figma:Figma integration commands'
    )

    local -a daemon_cmds
    daemon_cmds=(
        'start:Start the daemon server'
        'stop:Stop the daemon server'
        'restart:Restart the daemon server'
        'status:Check daemon server status'
        'info:Get detailed daemon info'
    )

    local -a session_cmds
    session_cmds=(
        'list:List all active sessions'
        'info:Get information about a session'
        'delete:Delete a specific session'
    )

    local -a tools_cmds
    tools_cmds=(
        'list:List all available tools'
        'info:Get detailed tool information'
        'search:Search tools by keyword'
    )

    _arguments -C \\
        '--port[Daemon server port]:port' \\
        '--session-id[Session ID]:session_id' \\
        '--json[Output as JSON]' \\
        '--quiet[Suppress log messages]' \\
        '--verbose[Enable verbose output]' \\
        '--timeout[Operation timeout]:ms' \\
        '--headless[Run in headless mode]' \\
        '--no-headless[Run in headful mode]' \\
        '--persistent[Use persistent context]' \\
        '--no-persistent[Use ephemeral context]' \\
        '--user-data-dir[User data directory]:path:_files -/' \\
        '--use-system-browser[Use system browser]' \\
        '--browser-path[Browser executable path]:path:_files' \\
        '--help[Show help]' \\
        '--version[Show version]' \\
        '1: :->cmd' \\
        '*:: :->args'

    case "\$state" in
        cmd)
            _describe 'command' commands
            ;;
        args)
            case "\$words[1]" in
                daemon)
                    _describe 'subcommand' daemon_cmds
                    ;;
                session)
                    _describe 'subcommand' session_cmds
                    ;;
                tools)
                    _describe 'subcommand' tools_cmds
                    ;;
            esac
            ;;
    esac
}

_browser_devtools_cli
`;
            console.log(script);
            console.error('\n# To enable, add to your ~/.zshrc:');
            console.error('# eval "$(browser-devtools-cli completion zsh)"');
        });

    program.addCommand(completionCmd);

    // ==================== interactive subcommand ====================
    // Create a reusable REPL program that shares the same subcommands
    function _createReplProgram(parentOpts: GlobalOptions): Command {
        const replProgram: Command = new Command('repl')
            .exitOverride() // Prevent process.exit()
            .configureOutput({
                writeOut: (str: string) => console.log(str.trimEnd()),
                writeErr: (str: string) => console.error(str.trimEnd()),
            });

        // Add daemon subcommand
        const replDaemonCmd: Command = new Command('daemon')
            .description('Manage daemon server')
            .exitOverride();

        replDaemonCmd
            .command('start')
            .description('Start the daemon server')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const running: boolean = await _isDaemonRunning(opts.port);
                if (running) {
                    console.log(
                        `Daemon server is already running on port ${opts.port}`
                    );
                } else {
                    _startDaemonDetached(opts);
                    await _ensureDaemonRunning(opts);
                    console.log(`Daemon server started on port ${opts.port}`);
                }
            });

        replDaemonCmd
            .command('stop')
            .description('Stop the daemon server')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const running: boolean = await _isDaemonRunning(opts.port);
                if (!running) {
                    console.log('Daemon server is not running');
                } else {
                    const stopped: boolean = await _stopDaemon(
                        opts.port,
                        opts.timeout ?? DEFAULT_TIMEOUT
                    );
                    if (stopped) {
                        console.log('Daemon server stopped');
                    } else {
                        console.error('Failed to stop daemon server');
                    }
                }
            });

        replDaemonCmd
            .command('restart')
            .description('Restart the daemon server')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const wasRunning: boolean = await _isDaemonRunning(opts.port);
                if (wasRunning) {
                    await _stopDaemon(
                        opts.port,
                        opts.timeout ?? DEFAULT_TIMEOUT
                    );
                    await new Promise((r) => setTimeout(r, 1000));
                }
                _startDaemonDetached(opts);
                await _ensureDaemonRunning(opts);
                console.log(`Daemon server restarted on port ${opts.port}`);
            });

        replDaemonCmd
            .command('status')
            .description('Check daemon server status')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const running: boolean = await _isDaemonRunning(opts.port);
                if (running) {
                    console.log(
                        `Daemon server is running on port ${opts.port}`
                    );
                } else {
                    console.log('Daemon server is not running');
                }
            });

        replDaemonCmd
            .command('info')
            .description('Show daemon server information')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const info: DaemonInfo | null = await _getDaemonInfo(
                    opts.port,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );
                if (info) {
                    console.log(`Version: ${info.version}`);
                    console.log(`Uptime: ${_formatUptime(info.uptime)}`);
                    console.log(`Sessions: ${info.sessionCount}`);
                    console.log(`Port: ${info.port}`);
                } else {
                    console.log('Daemon server is not running');
                }
            });

        replProgram.addCommand(replDaemonCmd);

        // Add session subcommand
        const replSessionCmd: Command = new Command('session')
            .description('Manage browser sessions')
            .exitOverride();

        replSessionCmd
            .command('list')
            .description('List active sessions')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const result: SessionListResponse | null = await _listSessions(
                    opts.port,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );
                if (result && result.sessions.length > 0) {
                    console.log(`Active sessions: ${result.sessions.length}`);
                    for (const session of result.sessions) {
                        console.log(
                            `  ${session.id} (idle: ${_formatUptime(session.idleSeconds)})`
                        );
                    }
                } else {
                    console.log('No active sessions');
                }
            });

        replSessionCmd
            .command('info <session-id>')
            .description('Show session information')
            .action(async (sessionId: string) => {
                const opts: GlobalOptions = parentOpts;
                try {
                    const response: Response = await fetch(
                        `http://localhost:${opts.port}/session`,
                        {
                            method: 'GET',
                            headers: { 'session-id': sessionId },
                            signal: AbortSignal.timeout(
                                opts.timeout ?? DEFAULT_TIMEOUT
                            ),
                        }
                    );
                    if (response.ok) {
                        const info: SessionInfo = await response.json();
                        console.log(`Session: ${info.id}`);
                        console.log(
                            `Created: ${new Date(info.createdAt).toISOString()}`
                        );
                        console.log(
                            `Last Active: ${new Date(info.lastActiveAt).toISOString()}`
                        );
                        console.log(`Idle: ${_formatUptime(info.idleSeconds)}`);
                    } else {
                        console.log(`Session not found: ${sessionId}`);
                    }
                } catch (err: any) {
                    console.error(`Error: ${err.message}`);
                }
            });

        replSessionCmd
            .command('delete <session-id>')
            .description('Delete a session')
            .action(async (sessionId: string) => {
                const opts: GlobalOptions = parentOpts;
                try {
                    const response: Response = await fetch(
                        `http://localhost:${opts.port}/session`,
                        {
                            method: 'DELETE',
                            headers: { 'session-id': sessionId },
                            signal: AbortSignal.timeout(
                                opts.timeout ?? DEFAULT_TIMEOUT
                            ),
                        }
                    );
                    if (response.ok) {
                        console.log(`Session deleted: ${sessionId}`);
                    } else {
                        console.log(`Session not found: ${sessionId}`);
                    }
                } catch (err: any) {
                    console.error(`Error: ${err.message}`);
                }
            });

        replProgram.addCommand(replSessionCmd);

        // Add tools subcommand
        const replToolsCmd: Command = new Command('tools')
            .description('Discover and inspect available tools')
            .exitOverride();

        replToolsCmd
            .command('list')
            .description('List all available tools')
            .action(() => {
                const domains: Set<string> = new Set();
                for (const tool of tools) {
                    domains.add(tool.name().split('_')[0]);
                }
                console.log(
                    `Available domains: ${Array.from(domains).join(', ')}`
                );
                console.log(`Total tools: ${tools.length}`);
            });

        replToolsCmd
            .command('search <query>')
            .description('Search tools by name or description')
            .action((query: string) => {
                const lowerQuery: string = query.toLowerCase();
                const matchingTools: Tool[] = tools.filter(
                    (t: Tool) =>
                        t.name().toLowerCase().includes(lowerQuery) ||
                        t.description().toLowerCase().includes(lowerQuery)
                );
                if (matchingTools.length > 0) {
                    console.log(`Found ${matchingTools.length} tools:`);
                    for (const t of matchingTools) {
                        console.log(`  ${t.name()} - ${t.description()}`);
                    }
                } else {
                    console.log(`No tools found matching "${query}"`);
                }
            });

        replToolsCmd
            .command('info <tool-name>')
            .description('Show detailed information about a tool')
            .action((toolName: string) => {
                const tool: Tool | undefined = tools.find(
                    (t: Tool) => t.name() === toolName
                );
                if (tool) {
                    console.log(`\nTool: ${tool.name()}`);
                    console.log(`Description: ${tool.description()}`);
                    console.log('Input Schema:');
                    const schema: Record<string, ZodTypeAny> =
                        tool.inputSchema();
                    for (const [key, value] of Object.entries(schema)) {
                        const typeName: string = _getZodTypeName(value);
                        const desc: string = _getZodDescription(value) || '';
                        const optional: boolean = value.isOptional();
                        console.log(
                            `  --${key} <${typeName}>${optional ? ' (optional)' : ''} ${desc}`
                        );
                    }
                } else {
                    console.log(`Tool not found: ${toolName}`);
                }
            });

        replProgram.addCommand(replToolsCmd);

        // Add config command
        replProgram
            .command('config')
            .description('Show current configuration')
            .action(() => {
                const opts: GlobalOptions = parentOpts;
                console.log('\nCurrent Configuration:');
                console.log(`  port = ${opts.port}`);
                console.log(`  session-id = ${opts.sessionId || '(auto)'}`);
                console.log(
                    `  headless = ${opts.headless ?? config.BROWSER_HEADLESS_ENABLE}`
                );
                console.log(
                    `  persistent = ${opts.persistent ?? config.BROWSER_PERSISTENT_ENABLE}`
                );
                console.log(
                    `  user-data-dir = ${opts.userDataDir || config.BROWSER_PERSISTENT_USER_DATA_DIR || '(default)'}`
                );
                console.log(
                    `  use-system-browser = ${opts.useSystemBrowser ?? config.BROWSER_USE_INSTALLED_ON_SYSTEM}`
                );
                console.log(`  browser-path = ${opts.browserPath || '(auto)'}`);
                console.log(`  timeout = ${opts.timeout ?? DEFAULT_TIMEOUT}`);
                console.log(`  json = ${opts.json ?? false}`);
                console.log(`  quiet = ${opts.quiet ?? false}`);
                console.log(`  verbose = ${opts.verbose ?? false}`);
                console.log('\nTip: Start interactive mode with options:');
                console.log('  browser-devtools-cli --no-headless interactive');
            });

        // Add update command
        replProgram
            .command('update')
            .description('Check for updates')
            .option('--check', 'Only check for updates without installing')
            .action(async (cmdOpts: { check?: boolean }) => {
                const currentVersion: string =
                    require('../package.json').version;
                const packageName: string = 'browser-devtools-mcp';

                console.log('Checking for updates...\n');

                try {
                    const response: Response = await fetch(
                        `https://registry.npmjs.org/${packageName}/latest`,
                        { signal: AbortSignal.timeout(10000) }
                    );

                    if (!response.ok) {
                        console.error('Failed to check for updates');
                        return;
                    }

                    const data: any = await response.json();
                    const latestVersion: string = data.version;

                    console.log(`Current version: ${currentVersion}`);
                    console.log(`Latest version:  ${latestVersion}`);

                    if (currentVersion === latestVersion) {
                        console.log('\nYou are using the latest version!');
                    } else {
                        console.log('\nA new version is available!');
                        if (!cmdOpts.check) {
                            console.log(
                                `Run: npm install -g ${packageName}@latest`
                            );
                        }
                    }
                } catch (err: any) {
                    console.error(`Error checking for updates: ${err.message}`);
                }
            });

        // Add status command (quick daemon status)
        replProgram
            .command('status')
            .description('Show daemon status summary')
            .action(async () => {
                const opts: GlobalOptions = parentOpts;
                const info: DaemonInfo | null = await _getDaemonInfo(
                    opts.port,
                    opts.timeout ?? DEFAULT_TIMEOUT
                );
                if (info) {
                    console.log(
                        `Daemon: running (v${info.version}, uptime: ${_formatUptime(info.uptime)}, sessions: ${info.sessionCount})`
                    );
                } else {
                    console.log('Daemon: not running');
                }
            });

        // Register tool commands for REPL
        registerToolCommands(
            replProgram,
            tools,
            async (
                toolName: string,
                toolInput: Record<string, any>,
                _globalOptions: Record<string, any>
            ): Promise<void> => {
                const opts: GlobalOptions = parentOpts;
                try {
                    const response: ToolCallResponse = await _callTool(
                        opts.port,
                        toolName,
                        toolInput as ToolInput,
                        opts.sessionId,
                        opts.timeout
                    );

                    if (response.toolError) {
                        console.error(`Error: ${response.toolError.message}`);
                    } else if (response.toolOutput) {
                        if (opts.json) {
                            console.log(
                                JSON.stringify(response.toolOutput, null, 2)
                            );
                        } else {
                            console.log(_formatOutput(response.toolOutput));
                        }
                    }
                } catch (err: any) {
                    console.error(`Error: ${err.message}`);
                }
            }
        );

        return replProgram;
    }

    // Parse input for REPL, handling quoted strings
    function _parseReplInput(input: string): string[] {
        const args: string[] = [];
        let current: string = '';
        let inQuote: boolean = false;
        let quoteChar: string = '';

        for (let i: number = 0; i < input.length; i++) {
            const char: string = input[i];

            if (inQuote) {
                if (char === quoteChar) {
                    inQuote = false;
                    args.push(current);
                    current = '';
                } else {
                    current += char;
                }
            } else if (char === '"' || char === "'") {
                inQuote = true;
                quoteChar = char;
            } else if (char === ' ' || char === '\t') {
                if (current) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) {
            args.push(current);
        }

        return args;
    }

    const interactiveCmd: Command = new Command('interactive')
        .alias('repl')
        .description('Start interactive REPL mode')
        .action(async () => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;

            console.log('Browser DevTools CLI - Interactive Mode');
            console.log('Type "help" for available commands, "exit" to quit\n');

            // Ensure daemon is running
            try {
                await _ensureDaemonRunning(opts);
            } catch (err: any) {
                console.error(`Error: ${err.message}`);
                process.exit(1);
            }

            // Create REPL program with shared options
            const replProgram: Command = _createReplProgram(opts);

            const rl: readline.Interface = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: 'browser> ',
            });

            rl.prompt();

            rl.on('line', async (line: string) => {
                const input: string = line.trim();

                if (!input) {
                    rl.prompt();
                    return;
                }

                // Handle special REPL commands
                if (input === 'exit' || input === 'quit') {
                    console.log('Goodbye!');
                    rl.close();
                    process.exit(0);
                }

                if (input === 'help') {
                    // Show REPL help
                    console.log('\nREPL Commands:');
                    console.log('  help              Show this help');
                    console.log('  exit, quit        Exit interactive mode');
                    console.log('\nAvailable Commands:');
                    console.log(
                        '  status            Show daemon status summary'
                    );
                    console.log(
                        '  config            Show current configuration'
                    );
                    console.log('  update            Check for CLI updates');
                    console.log(
                        '  daemon <cmd>      Daemon management (start, stop, restart, status, info)'
                    );
                    console.log(
                        '  session <cmd>     Session management (list, info, delete)'
                    );
                    console.log(
                        '  tools <cmd>       Tool discovery (list, search, info)'
                    );
                    console.log(
                        '  <domain> <tool>   Execute a tool (e.g., navigation go-to --url ...)'
                    );
                    console.log('\nExamples:');
                    console.log('  # Daemon & Session');
                    console.log('  daemon status');
                    console.log('  daemon info');
                    console.log('  session list');
                    console.log('  session delete my-session');
                    console.log('');
                    console.log('  # Tool Discovery');
                    console.log('  tools list');
                    console.log('  tools search screenshot');
                    console.log('  tools info navigation_go-to');
                    console.log('');
                    console.log('  # Navigation');
                    console.log(
                        '  navigation go-to --url "https://example.com"'
                    );
                    console.log('  navigation go-back');
                    console.log('  navigation reload');
                    console.log('');
                    console.log('  # Content');
                    console.log('  content take-screenshot --name "test"');
                    console.log('  content get-as-text');
                    console.log('  content get-as-html --selector "#main"');
                    console.log('');
                    console.log('  # Interaction');
                    console.log('  interaction click --ref "Submit"');
                    console.log(
                        '  interaction fill --ref "Email" --value "test@example.com"'
                    );
                    console.log('  interaction hover --ref "Menu"');
                    console.log('');
                    console.log('  # Accessibility');
                    console.log('  a11y get-snapshot');
                    console.log('  a11y get-ax-tree-snapshot');
                    console.log(
                        '\nTip: Use global options when starting interactive mode:'
                    );
                    console.log(
                        '  browser-devtools-cli --no-headless interactive'
                    );
                    console.log(
                        '  browser-devtools-cli --persistent --no-headless interactive'
                    );
                    console.log();
                    rl.prompt();
                    return;
                }

                // Parse input and pass to Commander
                try {
                    const args: string[] = _parseReplInput(input);
                    await replProgram.parseAsync(['node', 'repl', ...args]);
                } catch (err: any) {
                    // Commander throws on exitOverride, handle gracefully
                    if (err.code === 'commander.help') {
                        // Help was shown, do nothing
                    } else if (err.code === 'commander.unknownCommand') {
                        console.log(`Unknown command: ${input}`);
                        console.log('Type "help" for available commands');
                    } else if (err.code === 'commander.missingArgument') {
                        console.error(`Missing argument: ${err.message}`);
                    } else if (err.code === 'commander.invalidArgument') {
                        console.error(`Invalid argument: ${err.message}`);
                    } else if (err.code && err.code.startsWith('commander.')) {
                        // Other Commander errors, message already shown
                    } else {
                        console.error(`Error: ${err.message}`);
                    }
                }

                rl.prompt();
            });

            rl.on('close', () => {
                process.exit(0);
            });
        });

    program.addCommand(interactiveCmd);

    // ==================== update subcommand ====================
    const updateCmd: Command = new Command('update')
        .description('Check for updates and optionally install them')
        .option('--check', 'Only check for updates without installing')
        .action(async (cmdOpts: { check?: boolean }) => {
            const opts: GlobalOptions = program.opts() as GlobalOptions;
            const currentVersion: string = require('../package.json').version;
            const packageName: string = 'browser-devtools-mcp';

            console.log('Checking for updates...\n');

            try {
                // Fetch latest version from npm registry
                const response: Response = await fetch(
                    `https://registry.npmjs.org/${packageName}/latest`,
                    {
                        method: 'GET',
                        signal: AbortSignal.timeout(10000),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to check npm registry: HTTP ${response.status}`
                    );
                }

                const data: any = await response.json();
                const latestVersion: string = data.version;

                if (opts.json) {
                    _printOutput(
                        {
                            currentVersion,
                            latestVersion,
                            updateAvailable: latestVersion !== currentVersion,
                        },
                        true
                    );
                    return;
                }

                console.log(`  Current version:  ${currentVersion}`);
                console.log(`  Latest version:   ${latestVersion}`);
                console.log();

                if (latestVersion === currentVersion) {
                    console.log(
                        '\x1b[32m✓ You are using the latest version!\x1b[0m'
                    );
                    return;
                }

                // Compare versions
                const currentParts: number[] = currentVersion
                    .split('.')
                    .map(Number);
                const latestParts: number[] = latestVersion
                    .split('.')
                    .map(Number);
                let isNewer: boolean = false;

                for (let i: number = 0; i < 3; i++) {
                    if (latestParts[i] > currentParts[i]) {
                        isNewer = true;
                        break;
                    } else if (latestParts[i] < currentParts[i]) {
                        break;
                    }
                }

                if (!isNewer) {
                    console.log(
                        '\x1b[32m✓ You are using a newer version than published!\x1b[0m'
                    );
                    return;
                }

                console.log(
                    `\x1b[33m⚠ Update available: ${currentVersion} → ${latestVersion}\x1b[0m\n`
                );

                if (cmdOpts.check) {
                    console.log('To update, run:');
                    console.log(`  npm install -g ${packageName}@latest`);
                    console.log('or');
                    console.log(`  npx ${packageName}@latest`);
                    return;
                }

                // Ask for confirmation
                const readline = require('readline');
                const rl: readline.Interface = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                const answer: string = await new Promise((resolve) => {
                    rl.question(
                        'Do you want to update now? (y/N) ',
                        (ans: string) => {
                            rl.close();
                            resolve(ans.toLowerCase());
                        }
                    );
                });

                if (answer !== 'y' && answer !== 'yes') {
                    console.log('\nUpdate cancelled.');
                    return;
                }

                console.log('\nUpdating...\n');

                // Run npm install
                const { execSync } = require('child_process');
                try {
                    execSync(`npm install -g ${packageName}@latest`, {
                        stdio: 'inherit',
                    });
                    console.log('\n\x1b[32m✓ Update complete!\x1b[0m');
                    console.log(
                        'Please restart your terminal or run a new command to use the updated version.'
                    );
                } catch (installErr: any) {
                    console.error('\n\x1b[31m✗ Update failed.\x1b[0m');
                    console.error('Try running manually with sudo:');
                    console.error(
                        `  sudo npm install -g ${packageName}@latest`
                    );
                    process.exit(1);
                }
            } catch (err: any) {
                if (opts.json) {
                    _printOutput(
                        {
                            error: err.message,
                            currentVersion,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(
                        `\x1b[31m✗ Failed to check for updates: ${err.message}\x1b[0m`
                    );
                    console.error('\nYou can manually check at:');
                    console.error(
                        `  https://www.npmjs.com/package/${packageName}`
                    );
                }
                process.exit(1);
            }
        });

    program.addCommand(updateCmd);

    // ==================== tool subcommands ====================
    registerToolCommands(
        program,
        tools,
        async (
            toolName: string,
            toolInput: Record<string, any>,
            globalOptions: Record<string, any>
        ): Promise<void> => {
            const opts: GlobalOptions = globalOptions as GlobalOptions;

            try {
                // Ensure daemon is running
                await _ensureDaemonRunning(opts);

                // Call the tool via daemon
                const response: ToolCallResponse = await _callTool(
                    opts.port,
                    toolName,
                    toolInput as ToolInput,
                    opts.sessionId,
                    opts.timeout
                );

                // Handle response
                if (response.toolError) {
                    if (opts.json) {
                        _printOutput(
                            {
                                error: response.toolError,
                            },
                            true,
                            true
                        );
                    } else {
                        console.error(
                            `Error: ${response.toolError.message || 'Unknown error'}`
                        );
                    }
                    process.exit(1);
                }

                if (response.toolOutput) {
                    if (opts.json) {
                        _printOutput(response.toolOutput, true);
                    } else {
                        console.log(_formatOutput(response.toolOutput));
                    }
                }
            } catch (err: any) {
                if (opts.json) {
                    _printOutput(
                        {
                            error: err.message,
                        },
                        true,
                        true
                    );
                } else {
                    console.error(`Error: ${err.message}`);
                }
                process.exit(1);
            }
        }
    );

    // Parse and execute
    await program.parseAsync(process.argv);
}

main().catch((err: any): never => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
});
