import { getBrowser, newBrowserContext, newPage } from './browser';
import { McpSessionContext } from './context';
import * as logger from './logger';
import {
    getServerInstructions,
    SERVER_NAME,
    SERVER_VERSION,
} from './server-info';
import { tools, Tool, ToolInput, ToolOutput, ToolExecutor } from './tools';

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

async function _createSessionContext(
    sessionIdProvider: () => string
): Promise<McpSessionContext> {
    const browser: Browser = await getBrowser();
    const browserContext: BrowserContext = await newBrowserContext(browser);
    const page: Page = await newPage(browserContext);
    return new McpSessionContext(
        sessionIdProvider,
        browser,
        browserContext,
        page
    );
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
    // TODO Add policies as prompts here
    /*
    messages.push({
        role: 'user',
        content: {
            type: 'text',
            text: <POLICY>,
        },
    });
    */

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
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(response, null, 2),
                        },
                    ],
                    structuredContent: response as any,
                    isError: false,
                };
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
