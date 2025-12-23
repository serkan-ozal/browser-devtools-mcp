#!/usr/bin/env node

import * as config from './config';
import * as logger from './logger';
import { createSession, McpServerConfig, McpServerSession } from './server';

import crypto from 'crypto';
import { Socket } from 'net';

import { StreamableHTTPTransport } from '@hono/mcp';
import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command, Option, InvalidOptionArgumentError } from 'commander';
import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';

type McpErrorResponse = {
    jsonrpc: string;
    error: {
        code: number;
        message: string;
    };
    id?: string | null;
};

type Env = {
    TRANSPORT_TYPE: string;
};

const MCP_TEMPLATE: McpErrorResponse = {
    jsonrpc: '2.0',
    error: {
        code: 0,
        message: 'N/A',
    },
    id: null,
};

type Options = {
    transport: 'stdio' | 'streamable-http';
    port: number;
};

const MCP_ERRORS = {
    get sessionNotFound(): McpErrorResponse {
        return _buildMCPErrorResponse(-32001, 'Session Not Found');
    },
    get unauthorized(): McpErrorResponse {
        return _buildMCPErrorResponse(-32001, 'Unauthorized');
    },
    get internalServerError(): McpErrorResponse {
        return _buildMCPErrorResponse(-32603, 'Internal Server Error');
    },
};

const SESSIONS: Map<string, McpServerSession> = new Map();

function _buildMCPErrorResponse(code: number, message: string): any {
    const result = { ...MCP_TEMPLATE };
    result.error.code = code;
    result.error.message = message;
    return result;
}

function _parsePort(value: string): number {
    const n: number = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new InvalidOptionArgumentError(
            'port must be an integer between 1 and 65535'
        );
    }
    return n;
}

function _getOptions(): Options {
    const program: Command = new Command()
        .addOption(
            new Option('--transport <type>', 'transport type')
                .choices(['stdio', 'streamable-http'])
                .default('stdio')
        )
        .addOption(
            new Option('--port <number>', 'port for Streamable HTTP transport')
                .argParser(_parsePort)
                .default(config.PORT)
        )
        .allowUnknownOption()
        .parse(process.argv);

    return program.opts<Options>();
}

function _getConfig(): McpServerConfig {
    return {};
}

async function _startStdioServer(): Promise<void> {
    await createSession(_getConfig(), new StdioServerTransport());
}

async function _createMCPServerSession(
    ctx: Context
): Promise<McpServerSession<StreamableHTTPTransport>> {
    let session: McpServerSession<StreamableHTTPTransport>;

    // Get MCP server config
    const serverConfig: McpServerConfig = _getConfig();

    // Create new instances of MCP Server and Transport for each incoming request
    const transport = new StreamableHTTPTransport({
        // Change to `false` if you want to enable SSE in responses.
        enableJsonResponse: true,
        sessionIdGenerator: (): string => crypto.randomUUID(),
        onsessioninitialized: async (sessionId: string): Promise<void> => {
            SESSIONS.set(sessionId, session);
            session.initialized = true;
            logger.debug(`MCP session initialized with id ${sessionId}`);
        },
        onsessionclosed: async (sessionId: string): Promise<void> => {
            logger.debug(`Closing MCP session closed with id ${sessionId} ...`);
            await transport.close();
            logger.debug(`MCP session closed with id ${sessionId}`);
        },
    });

    // Create MCP session with MCP server
    session = await createSession(serverConfig, transport);

    // Register hook to close the associated MCP session on socket close
    const socket: Socket = ctx.env.incoming.socket as Socket;
    if (!(socket as any)._mcpRegistered) {
        (socket as any)._mcpRegistered = true;
        socket.on('close', async (): Promise<void> => {
            logger.debug(
                `Socket, which is for MCP session with id ${transport.sessionId}, has been closed`
            );
            if (config.SESSION_CLOSE_ON_SOCKET_CLOSE) {
                await transport.close();
            }
        });
    }

    // Register MCP session close hook to gracefully close it
    _registerMCPSessionClose(transport, session.server);

    logger.debug(`Created MCP server session with id ${transport.sessionId}`);

    return session;
}

async function _getMCPServerSession(
    sessionId: string
): Promise<McpServerSession<StreamableHTTPTransport> | undefined> {
    return SESSIONS.get(sessionId) as McpServerSession<StreamableHTTPTransport>;
}

async function _getOrCreateMCPServerSession(
    ctx: Context
): Promise<McpServerSession<StreamableHTTPTransport> | undefined> {
    const sessionId: string | undefined = ctx.req.header('mcp-session-id');
    if (sessionId) {
        const session: McpServerSession | undefined = SESSIONS.get(sessionId);
        if (session) {
            logger.debug(`Reusing MCP session with id ${sessionId}`);
        } else {
            logger.debug(`No MCP session could be found with id ${sessionId}`);
        }
        return session as McpServerSession<StreamableHTTPTransport>;
    }
    return await _createMCPServerSession(ctx);
}

function _registerMCPSessionClose(
    transport: StreamableHTTPTransport,
    mcpServer: McpServer
): void {
    let closed: boolean = false;
    transport.onclose = async (): Promise<void> => {
        logger.debug(`Closing MCP session with id ${transport.sessionId} ...`);
        if (closed) {
            logger.debug(
                `MCP session with id ${transport.sessionId} has already been closed`
            );
            return;
        }
        closed = true;
        try {
            await mcpServer.close();
            logger.debug('Closed MCP server');
        } catch (err: any) {
            logger.error('Error occurred while closing MCP server', err);
        }
        if (transport.sessionId) {
            const session: McpServerSession | undefined = SESSIONS.get(
                transport.sessionId
            );
            if (session) {
                session.closed = true;
                try {
                    await session.context.close();
                } catch (err: any) {
                    logger.error(
                        'Error occurred while closing MCP session context',
                        err
                    );
                }
            }
            SESSIONS.delete(transport.sessionId);
        }
        logger.debug(`Closing MCP session with id ${transport.sessionId} ...`);
    };
}

function _scheduleIdleSessionCheck(): void {
    const sessionCheck: () => void = (): void => {
        const currentTime: number = Date.now();
        for (const [sessionId, session] of SESSIONS) {
            logger.debug(
                `Checking whether session with id ${sessionId} is idle or not ...`
            );
            if (
                currentTime - session.lastActiveAt >
                config.SESSION_IDLE_SECONDS * 1000
            ) {
                logger.debug(
                    `Session with id ${sessionId} is idle, so it will be closing ...`
                );
                session.transport
                    .close()
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
    };

    setInterval(sessionCheck, config.SESSION_IDLE_CHECK_SECONDS * 1000);
}

const app = new Hono<{ Bindings: Env }>();

async function _startStreamableHTTPServer(port: number): Promise<void> {
    // Global CORS
    app.use(
        '*',
        cors({
            origin: '*',
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            allowHeaders: [
                'Content-Type',
                'Authorization',
                'MCP-Protocol-Version',
            ],
        })
    );

    // MCP Health
    app.get('/health', (ctx: Context) => ctx.json({ status: 'ok' }));

    // MCP Ping
    app.get('/ping', (ctx: Context) =>
        ctx.json({ status: 'ok', message: 'pong' })
    );

    // MCP Get info
    app.get('/mcp', (ctx: any): any =>
        ctx.json({
            status: 'ok',
            protocol: 'model-context-protocol',
            version: '1.0',
        })
    );

    // MCP Post message
    app.post('/mcp', async (ctx: Context): Promise<any> => {
        try {
            const mcpSession:
                | McpServerSession<StreamableHTTPTransport>
                | undefined = await _getOrCreateMCPServerSession(ctx);
            if (!mcpSession) {
                return ctx.json(MCP_ERRORS.sessionNotFound);
            }
            mcpSession.lastActiveAt = Date.now();
            return await mcpSession.transport.handleRequest(ctx);
        } catch (err: any) {
            logger.error('Error occurred while handling MCP request', err);
            return ctx.json(MCP_ERRORS.internalServerError);
        }
    });

    // MCP Delete session
    app.delete('/mcp', async (ctx: Context): Promise<any> => {
        try {
            const sessionId: string | undefined =
                ctx.req.header('mcp-session-id');
            if (!sessionId) {
                return ctx.json(MCP_ERRORS.sessionNotFound);
            }
            const mcpSession:
                | McpServerSession<StreamableHTTPTransport>
                | undefined = await _getMCPServerSession(sessionId);
            if (!mcpSession) {
                return ctx.json(MCP_ERRORS.sessionNotFound);
            }
            await mcpSession.transport.close();
            return ctx.json({ ok: true }, 200);
        } catch (err: any) {
            logger.error('Error occurred while deleting MCP session', err);
            return ctx.json(MCP_ERRORS.internalServerError);
        }
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

async function main(): Promise<void> {
    const options: Options = _getOptions();
    if (options.transport === 'stdio') {
        logger.disable();
        await _startStdioServer();
    } else if (options.transport === 'streamable-http') {
        logger.info('Starting MCP server...');
        await _startStreamableHTTPServer(options.port);
        logger.info('Started MCP Server');
    } else {
        logger.error(`Invalid transport: ${options.transport}`);
        process.exit(1);
    }
}

main().catch((err: any): never => {
    logger.enable();
    logger.error('MCP server error', err);
    process.exit(1);
});
