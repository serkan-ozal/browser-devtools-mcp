import { getBrowser, newBrowserContext, newPage } from './browser';
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
import { newTraceId } from './utils';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Browser, BrowserContext, Page } from 'playwright';

export type McpServerConfig = {};

export type McpServerSession<T extends Transport = Transport> = {
    transport: T;
    server: McpServer;
    context: McpSessionContext;
    initialized: boolean;
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

async function _createSessionContext(
    sessionIdProvider: () => string
): Promise<McpSessionContext> {
    const browser: Browser = await getBrowser();
    const browserContext: BrowserContext = await newBrowserContext(browser);
    const page: Page = await newPage(browserContext);
    const traceId: string = newTraceId();

    const context: McpSessionContext = new McpSessionContext(
        sessionIdProvider,
        browser,
        browserContext,
        page,
        traceId
    );

    await context.init();

    return context;
}

export async function createServer(opts: {
    config?: McpServerConfig;
    context: McpSessionContext;
}): Promise<McpServer> {
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

    const toolExecutor: ToolExecutor = new ToolExecutor(opts.context);

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
            },
            createToolCallback(t)
        );
    });

    return server;
}

export async function createSession<T extends Transport = Transport>(
    config: McpServerConfig | undefined,
    transport: T
): Promise<McpServerSession<T>> {
    const sessionContext: McpSessionContext = await _createSessionContext(
        (): string => transport.sessionId as string
    );

    const server: McpServer = await createServer({
        config,
        context: sessionContext,
    });

    await server.connect(transport);

    return {
        transport,
        server,
        context: sessionContext,
        initialized: false,
        closed: false,
        lastActiveAt: Date.now(),
    };
}
