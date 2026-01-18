import { McpSessionContext } from './context';
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type McpServerConfig = {};

export type McpServerSession<T extends Transport = Transport> = {
    transport: T;
    server: McpServer;
    context?: McpSessionContext;
    closed: boolean;
    lastActiveAt: number;
};

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

export function createServer(opts: {
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

export async function createAndConnectServer(
    transport: Transport,
    opts: {
        config?: McpServerConfig;
    }
): Promise<McpServer> {
    const server: McpServer = createServer({
        config: opts.config,
        sessionIdProvider: (): string => transport.sessionId as string,
    });

    await server.connect(transport);

    return server;
}

export function createSession<T extends Transport = Transport>(
    transport: T,
    server: McpServer
): McpServerSession<T> {
    return {
        transport,
        server,
        closed: false,
        lastActiveAt: Date.now(),
    };
}
