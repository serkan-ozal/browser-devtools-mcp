import crypto from 'crypto';
import { Socket } from 'net';

import * as config from './config';
import { ToolSessionContext } from './context';
import * as logger from './logger';
import {
    getServerInstructions,
    SERVER_NAME,
    SERVER_VERSION,
    UI_DEBUGGING_POLICY,
} from './server-info';
import {
    tools,
    Tool,
    ToolInput,
    ToolOutput,
    ToolExecutor,
    ToolOutputWithImage,
} from './tools';

import { StreamableHTTPTransport } from '@hono/mcp';
import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';

type McpServerConfig = {};

type McpServerSession<T extends Transport = Transport> = {
    transport: T;
    server: McpServer;
    context?: ToolSessionContext;
    closed: boolean;
    lastActiveAt: number;
};

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

const sessions: Map<string, McpServerSession> = new Map();

function _buildMCPErrorResponse(code: number, message: string): any {
    const result = { ...MCP_TEMPLATE };
    result.error.code = code;
    result.error.message = message;
    return result;
}

function _getImage(
    response: ToolOutput
): ToolOutputWithImage['image'] | undefined {
    if (
        'image' in response &&
        response.image !== null &&
        typeof response.image === 'object' &&
        'data' in response.image &&
        'mimeType' in response.image &&
        Buffer.isBuffer(response.image.data) &&
        typeof response.image.mimeType === 'string'
    ) {
        const image: ToolOutputWithImage['image'] = (
            response as ToolOutputWithImage
        ).image;
        delete (response as any).image;
        return image;
    }
}

function _toResponse(response: ToolOutput): CallToolResult {
    const image: ToolOutputWithImage['image'] | undefined = _getImage(response);
    const contents: any[] = [];
    contents.push({
        type: 'text',
        text: JSON.stringify(response, null, 2),
    });
    if (image) {
        if (image.mimeType === 'image/svg+xml') {
            contents.push({
                type: 'text',
                text: image.data.toString(),
                mimeType: image.mimeType,
            });
        } else {
            contents.push({
                type: 'image',
                data: image.data.toString('base64'),
                mimeType: image.mimeType,
            });
        }
    }
    return {
        content: contents,
        structuredContent: response as any,
        isError: false,
    };
}

function _createServer(opts: {
    config?: McpServerConfig;
    sessionIdProvider?: () => string;
}): McpServer {
    const server: McpServer = new McpServer(
        {
            name: SERVER_NAME,
            version: SERVER_VERSION,
        },
        {
            capabilities: {
                resources: {},
                tools: {},
            },
            instructions: getServerInstructions(),
        }
    );

    const messages: any[] = [];
    messages.push({
        role: 'user',
        content: {
            type: 'text',
            text: UI_DEBUGGING_POLICY,
        },
    });

    server.registerPrompt(
        'default_system',
        {
            title: 'Default System Prompt',
            description: 'General behavior for the AI assistant',
        },
        async () => ({
            description:
                "Defines the assistant's general reasoning and tool usage rules.",
            messages,
        })
    );

    const toolExecutor: ToolExecutor = new ToolExecutor((): string =>
        opts.sessionIdProvider ? opts.sessionIdProvider() : ''
    );

    const createToolCallback = (tool: Tool) => {
        return async (args: ToolInput): Promise<CallToolResult> => {
            try {
                const response: ToolOutput = await toolExecutor.executeTool(
                    tool,
                    args
                );
                return _toResponse(response);
            } catch (error: any) {
                return {
                    content: [
                        { type: 'text', text: `Error: ${error.message}` },
                    ],
                    isError: true,
                };
            }
        };
    };

    tools.forEach((t: Tool): void => {
        logger.debug(`Registering tool ${t.name()} ...`);
        server.registerTool(
            t.name(),
            {
                description: t.description(),
                inputSchema: t.inputSchema(),
                outputSchema: t.outputSchema(),
            } as any,
            createToolCallback(t) as any
        );
    });

    return server;
}

async function _createAndConnectServer(
    transport: Transport,
    opts: {
        config?: McpServerConfig;
    }
): Promise<McpServer> {
    const server: McpServer = _createServer({
        config: opts.config,
        sessionIdProvider: (): string => transport.sessionId as string,
    });

    await server.connect(transport);

    return server;
}

function _getConfig(): McpServerConfig {
    return {};
}

function _createSession(
    ctx: Context,
    transport: StreamableHTTPTransport,
    server: McpServer
): McpServerSession<StreamableHTTPTransport> {
    // Create MCP session with MCP server
    const session: McpServerSession<StreamableHTTPTransport> = {
        transport,
        server,
        closed: false,
        lastActiveAt: Date.now(),
    };

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

    return session as McpServerSession<StreamableHTTPTransport>;
}

async function _createTransport(
    ctx: Context
): Promise<StreamableHTTPTransport> {
    // Get MCP server config
    const serverConfig: McpServerConfig = _getConfig();
    const holder: {
        server?: McpServer;
    } = {};

    // Create new instances of MCP Server and Transport for each incoming request
    const transport = new StreamableHTTPTransport({
        // Change to `false` if you want to enable SSE in responses.
        enableJsonResponse: true,
        sessionIdGenerator: (): string => crypto.randomUUID(),
        onsessioninitialized: async (sessionId: string): Promise<void> => {
            const session: McpServerSession<StreamableHTTPTransport> =
                _createSession(ctx, transport, holder.server!);
            sessions.set(sessionId, session);
            logger.debug(`MCP session initialized with id ${sessionId}`);
        },
        onsessionclosed: async (sessionId: string): Promise<void> => {
            logger.debug(`Closing MCP session closed with id ${sessionId} ...`);
            await transport.close();
            logger.debug(`MCP session closed with id ${sessionId}`);
        },
    });

    holder.server = await _createAndConnectServer(transport, {
        config: serverConfig,
    });

    return transport;
}

async function _getTransport(
    ctx: Context
): Promise<StreamableHTTPTransport | undefined> {
    const sessionId: string | undefined = ctx.req.header('mcp-session-id');
    if (sessionId) {
        const session: McpServerSession | undefined = sessions.get(sessionId);
        if (session) {
            logger.debug(`Reusing MCP session with id ${sessionId}`);
            return (session as McpServerSession<StreamableHTTPTransport>)
                .transport;
        }
    }
    return undefined;
}

async function _getOrCreateTransport(
    ctx: Context
): Promise<StreamableHTTPTransport | undefined> {
    const sessionId: string | undefined = ctx.req.header('mcp-session-id');
    if (sessionId) {
        const session: McpServerSession | undefined = sessions.get(sessionId);
        if (session) {
            logger.debug(`Reusing MCP session with id ${sessionId}`);
            return (session as McpServerSession<StreamableHTTPTransport>)
                .transport;
        } else {
            logger.debug(`No MCP session could be found with id ${sessionId}`);
            return undefined;
        }
    }
    return await _createTransport(ctx);
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
            const session: McpServerSession | undefined = sessions.get(
                transport.sessionId
            );
            if (session) {
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
            }
            sessions.delete(transport.sessionId);
        }
        logger.debug(`Closing MCP session with id ${transport.sessionId} ...`);
    };
}

function _scheduleIdleSessionCheck(): void {
    const sessionCheck: () => void = (): void => {
        const currentTime: number = Date.now();
        for (const [sessionId, session] of sessions) {
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

async function _logRequest(ctx: Context): Promise<void> {
    const reqClone: Request = ctx.req.raw.clone();
    logger.debug(`Got request: ${await reqClone.json()}`);
}

function _markSessionAsActive(ctx: Context): void {
    const sessionId: string | undefined = ctx.req.header('mcp-session-id');
    if (sessionId) {
        const session: McpServerSession | undefined = sessions.get(sessionId);
        if (session) {
            session.lastActiveAt = Date.now();
        }
    }
}

export async function startStdioServer(): Promise<void> {
    const transport: StdioServerTransport = new StdioServerTransport();
    await _createAndConnectServer(transport, {
        config: _getConfig(),
    });
}

const app = new Hono<{ Bindings: Env }>();

export async function startStreamableHTTPServer(port: number): Promise<void> {
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
            if (logger.isDebugEnabled()) {
                await _logRequest(ctx);
            }

            const transport: StreamableHTTPTransport | undefined =
                await _getOrCreateTransport(ctx);
            if (!transport) {
                return ctx.json(MCP_ERRORS.sessionNotFound, 400);
            }

            _markSessionAsActive(ctx);

            return await transport.handleRequest(ctx);
        } catch (err: any) {
            logger.error('Error occurred while handling MCP request', err);
            return ctx.json(MCP_ERRORS.internalServerError, 500);
        }
    });

    // MCP Delete session
    app.delete('/mcp', async (ctx: Context): Promise<any> => {
        try {
            const transport: StreamableHTTPTransport | undefined =
                await _getTransport(ctx);
            if (!transport) {
                return ctx.json(MCP_ERRORS.sessionNotFound, 400);
            }
            await transport.close();
            return ctx.json({ ok: true }, 200);
        } catch (err: any) {
            logger.error('Error occurred while deleting MCP session', err);
            return ctx.json(MCP_ERRORS.internalServerError, 500);
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
