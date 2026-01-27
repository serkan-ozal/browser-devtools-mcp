import * as config from './config';
import { ToolSessionContext } from './context';
import * as logger from './logger';
import { tools, ToolInput, ToolOutput, Tool, ToolExecutor } from './tools';

import { serve } from '@hono/node-server';
import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodObject } from 'zod';

type DaemonServerSession = {
    id: string;
    toolExecutor: ToolExecutor;
    context?: ToolSessionContext;
    closed: boolean;
    createdAt: number;
    lastActiveAt: number;
};

type SessionInfo = {
    id: string;
    createdAt: number;
    lastActiveAt: number;
    idleSeconds: number;
};

type DaemonInfo = {
    version: string;
    uptime: number;
    sessionCount: number;
    port: number;
};

let daemonStartTime: number = 0;
let daemonPort: number = 0;

type ErrorResponse = {
    error: {
        code?: number;
        message?: string;
    };
};

type ToolCallRequest = {
    toolName: string;
    toolInput: ToolInput;
};

type ToolCallResponse = {
    toolOutput?: ToolOutput;
    toolError?: ErrorResponse['error'];
};

const app = new Hono<{}>();
const sessions: Map<string, DaemonServerSession> = new Map();

const DEFAULT_SESSION_ID = '#default';

const ERRORS = {
    get sessionNotFound(): ErrorResponse {
        return _buildErrorResponse(404, 'Session Not Found');
    },
    get toolNotFound(): ErrorResponse {
        return _buildErrorResponse(404, 'Tool Not Found');
    },
    get internalServerError(): ErrorResponse {
        return _buildErrorResponse(500, 'Internal Server Error');
    },
};

function _buildErrorResponse(code: number | undefined, message: string): any {
    return {
        error: {
            code: code,
            message: message,
        },
    };
}

async function _closeSession(session: DaemonServerSession): Promise<void> {
    session.closed = true;
    if (session.context) {
        try {
            await session.context.close();
            logger.debug('Closed MCP session context');
        } catch (err: any) {
            logger.error(
                'Error occurred while closing MCP session context',
                err
            );
        }
    }
    sessions.delete(session.id);
}

function _createSession(ctx: Context, sessionId: string): DaemonServerSession {
    const now: number = Date.now();
    const session: DaemonServerSession = {
        id: sessionId,
        toolExecutor: new ToolExecutor((): string => sessionId),
        closed: false,
        createdAt: now,
        lastActiveAt: now,
    };

    logger.debug(`Created session with id ${sessionId}`);

    return session;
}

function _getSessionInfo(session: DaemonServerSession): SessionInfo {
    const now: number = Date.now();
    return {
        id: session.id,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        idleSeconds: Math.floor((now - session.lastActiveAt) / 1000),
    };
}

async function _getSession(
    ctx: Context
): Promise<DaemonServerSession | undefined> {
    const sessionId: string =
        ctx.req.header('session-id') || DEFAULT_SESSION_ID;
    return sessions.get(sessionId);
}

async function _getOrCreateSession(ctx: Context): Promise<DaemonServerSession> {
    const sessionId: string =
        ctx.req.header('session-id') || DEFAULT_SESSION_ID;
    let session: DaemonServerSession | undefined = sessions.get(sessionId);
    if (session) {
        logger.debug(`Reusing session with id ${sessionId}`);
    } else {
        logger.debug(`No session could be found with id ${sessionId}`);
        session = _createSession(ctx, sessionId);
        sessions.set(sessionId, session);
    }
    return session;
}

function _scheduleIdleSessionCheck(): void {
    let noActiveSession: boolean = false;

    const sessionCheck: () => void = (): void => {
        const currentTime: number = Date.now();
        if (noActiveSession && sessions.size === 0) {
            // There is no active session from last check and still there is no active session
            logger.info(
                'No active session found, so terminating daemon server'
            );
            process.exit(0);
        }
        for (const [sessionId, session] of sessions) {
            logger.debug(
                `Checking whether session with id ${sessionId} is idle or not ...`
            );
            if (
                currentTime - session.lastActiveAt >
                config.DAEMON_SESSION_IDLE_SECONDS * 1000
            ) {
                logger.debug(
                    `Session with id ${sessionId} is idle, so it will be closing ...`
                );
                _closeSession(session)
                    .then((): void => {
                        logger.debug(
                            `Session with id ${sessionId} was idle, so it has been closed`
                        );
                    })
                    .catch((err: any): void => {
                        logger.error(
                            `Unable to delete idle session with id ${sessionId}`,
                            err
                        );
                    });
            }
        }

        noActiveSession = sessions.size === 0;
    };

    setInterval(sessionCheck, config.DAEMON_SESSION_IDLE_CHECK_SECONDS * 1000);
}

async function _logRequest(ctx: Context): Promise<void> {
    const reqClone: Request = ctx.req.raw.clone();
    logger.debug(`Got request: ${await reqClone.json()}`);
}

export async function startDaemonHTTPServer(port: number): Promise<void> {
    const toolMap: Record<string, Tool> = Object.fromEntries(
        tools.map((tool: Tool): [string, Tool] => [tool.name(), tool])
    );

    // Global CORS
    app.use(
        '*',
        cors({
            origin: '*',
            allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'session-id'],
        })
    );

    // Store daemon port and start time
    daemonPort = port;
    daemonStartTime = Date.now();

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string): Promise<void> => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);

        // Close all sessions
        const closePromises: Promise<void>[] = [];
        for (const session of sessions.values()) {
            closePromises.push(_closeSession(session));
        }
        await Promise.allSettled(closePromises);

        logger.info('All sessions closed, exiting...');
        process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors to prevent crashes
    process.on('uncaughtException', (err: Error) => {
        logger.error('Uncaught exception', err);
    });
    process.on('unhandledRejection', (reason: any) => {
        logger.error('Unhandled rejection', reason);
    });

    // MCP Health
    app.get('/health', (ctx: Context) => ctx.json({ status: 'ok' }));

    // Daemon info
    app.get('/info', (ctx: Context) => {
        const info: DaemonInfo = {
            version: require('../package.json').version,
            uptime: Math.floor((Date.now() - daemonStartTime) / 1000),
            sessionCount: sessions.size,
            port: daemonPort,
        };
        return ctx.json(info);
    });

    // List all sessions
    app.get('/sessions', (ctx: Context) => {
        const sessionList: SessionInfo[] = [];
        for (const session of sessions.values()) {
            sessionList.push(_getSessionInfo(session));
        }
        return ctx.json({ sessions: sessionList });
    });

    // Get session info
    app.get('/session', async (ctx: Context): Promise<any> => {
        const session: DaemonServerSession | undefined = await _getSession(ctx);
        if (!session) {
            return ctx.json(ERRORS.sessionNotFound, 404);
        }
        return ctx.json(_getSessionInfo(session));
    });

    // Shutdown daemon server
    app.post('/shutdown', async (ctx: Context): Promise<any> => {
        logger.info('Shutdown request received, closing all sessions...');

        // Close all sessions
        const closePromises: Promise<void>[] = [];
        for (const session of sessions.values()) {
            closePromises.push(_closeSession(session));
        }
        await Promise.allSettled(closePromises);

        logger.info('All sessions closed, shutting down daemon server...');

        // Schedule process exit after response is sent
        setTimeout(() => {
            process.exit(0);
        }, 500);

        return ctx.json({ status: 'shutting_down' }, 200);
    });

    // Call message
    app.post('/call', async (ctx: Context): Promise<any> => {
        try {
            if (logger.isDebugEnabled()) {
                await _logRequest(ctx);
            }

            const session: DaemonServerSession = await _getOrCreateSession(ctx);
            session.lastActiveAt = Date.now();

            const toolCallRequest: ToolCallRequest =
                (await ctx.req.json()) as ToolCallRequest;

            const tool: Tool | undefined = toolMap[toolCallRequest.toolName];
            if (!tool) {
                return ctx.json(ERRORS.toolNotFound, 404);
            }

            let toolInput: ToolInput;
            try {
                const schema: ZodObject<any> = z.object(tool.inputSchema());
                toolInput = schema.parse(toolCallRequest.toolInput);
            } catch (err: any) {
                // Return validation error with details
                const errorMessage: string =
                    err.errors && Array.isArray(err.errors)
                        ? err.errors
                              .map(
                                  (e: any) =>
                                      `${e.path?.join('.') || 'input'}: ${e.message}`
                              )
                              .join('; ')
                        : 'Invalid tool input';
                return ctx.json(
                    _buildErrorResponse(
                        400,
                        `Invalid Tool Request: ${errorMessage}`
                    ),
                    400
                );
            }

            try {
                const toolOutput: ToolOutput =
                    await session.toolExecutor.executeTool(tool, toolInput);
                const toolCallResponse: ToolCallResponse = {
                    toolOutput,
                } as ToolCallResponse;
                return ctx.json(toolCallResponse, 200);
            } catch (err: any) {
                const toolCallResponse: ToolCallResponse = {
                    toolError: {
                        code: err.code,
                        message: err.message,
                    },
                } as ToolCallResponse;
                return ctx.json(toolCallResponse, 500);
            }
        } catch (err: any) {
            logger.error(
                'Error occurred while handling tool call request',
                err
            );
            return ctx.json(ERRORS.internalServerError, 500);
        }
    });

    // Delete session
    app.delete('/session', async (ctx: Context): Promise<any> => {
        try {
            const session: DaemonServerSession | undefined =
                await _getSession(ctx);
            if (!session) {
                return ctx.json(ERRORS.sessionNotFound, 404);
            }
            await _closeSession(session);
            return ctx.json({ ok: true }, 200);
        } catch (err: any) {
            logger.error('Error occurred while deleting session', err);
            return ctx.json(ERRORS.internalServerError, 500);
        }
    });

    // Global error handler
    app.onError((err: Error, ctx: Context) => {
        logger.error('Unhandled error in request handler', err);
        return ctx.json(
            {
                error: {
                    code: 500,
                    message: 'Internal Server Error',
                },
            },
            500
        );
    });

    // 404
    app.notFound((ctx: Context) =>
        ctx.json({ error: 'Not Found', status: 404 }, 404)
    );

    // Listener for Node
    serve(
        {
            fetch: app.fetch,
            port,
        },
        (): void => logger.info(`Listening on port ${port}`)
    );

    // Schedule background task to check (and remove) idle sessions
    _scheduleIdleSessionCheck();
}

// Main entry point when run directly
if (require.main === module) {
    const {
        Command,
        InvalidOptionArgumentError,
        Option,
    } = require('commander');

    function parsePort(value: string): number {
        const n: number = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
            throw new InvalidOptionArgumentError(
                'port must be an integer between 1 and 65535'
            );
        }
        return n;
    }

    const program: InstanceType<typeof Command> = new Command()
        .addOption(
            new Option('--port <number>', 'port for daemon HTTP server')
                .argParser(parsePort)
                .default(config.DAEMON_PORT)
        )
        .allowUnknownOption()
        .parse(process.argv);

    const options: { port: number } = program.opts();

    logger.enable();
    logger.info('Starting daemon HTTP server...');

    startDaemonHTTPServer(options.port)
        .then(() => {
            logger.info('Daemon HTTP server started');
        })
        .catch((err: any) => {
            logger.error('Failed to start daemon HTTP server', err);
            process.exit(1);
        });
}
