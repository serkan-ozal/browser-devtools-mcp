import { BrowserContextInfo, newBrowserContext, newPage } from '../browser';
import { OTEL_ENABLE } from '../config';
import { ToolSessionContext } from '../context';
import * as logger from '../logger';
import { Tool, ToolInput, ToolOutput } from './types';

import type { Page } from 'playwright';

export class ToolExecutor {
    private readonly sessionIdProvider: () => string;
    private sessionContext?: ToolSessionContext;

    constructor(sessionIdProvider: () => string) {
        this.sessionIdProvider = sessionIdProvider;
    }

    private async _createSessionContext(): Promise<ToolSessionContext> {
        const browserContextInfo: BrowserContextInfo =
            await newBrowserContext();
        const page: Page = await newPage(browserContextInfo.browserContext);
        const sessionId: string = this.sessionIdProvider();

        const context: ToolSessionContext = new ToolSessionContext(
            sessionId,
            browserContextInfo.browserContext,
            page,
            {
                otelEnable: OTEL_ENABLE,
            }
        );

        await context.init();

        return context;
    }

    private async _sessionContext(): Promise<ToolSessionContext> {
        if (!this.sessionContext) {
            this.sessionContext = await this._createSessionContext();
            logger.debug(
                `Created session context on the first tool call for the session with id ${this.sessionContext.sessionId()}`
            );
        }
        return this.sessionContext;
    }

    async executeTool(tool: Tool, args: ToolInput): Promise<ToolOutput> {
        logger.debug(
            `Executing tool ${tool.name()} with input: ${logger.toJson(args)}`
        );
        try {
            const sessionContext: ToolSessionContext =
                await this._sessionContext();
            const result: ToolOutput = await tool.handle(sessionContext, args);
            logger.debug(
                `Executed tool ${tool.name()} and got output: ${logger.toJson(result)}`
            );
            return result;
        } catch (err: any) {
            logger.debug(
                `Error occurred while executing ${tool.name()}: ${err}`
            );
            throw err;
        }
    }
}
