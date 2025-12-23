import * as logger from './logger';

import { Browser, Page } from 'playwright';

export class McpSessionContext {
    private readonly sessionIdProvider: () => string;
    readonly browser: Browser;
    readonly page: Page;

    constructor(sessionIdProvider: () => string, browser: Browser, page: Page) {
        this.sessionIdProvider = sessionIdProvider;
        this.browser = browser;
        this.page = page;
    }

    sessionId(): string {
        return this.sessionIdProvider();
    }

    async close(): Promise<void> {
        try {
            logger.debug(
                `Closing page of the MCP session with id ${this.sessionIdProvider()} ...`
            );
            await this.page.close();
        } catch (err: any) {
            logger.debug(
                `Error occurred while closing page of the MCP session with id ${this.sessionIdProvider()} ...`,
                err
            );
        }
        try {
            logger.debug(
                `Closing browser of the MCP session with id ${this.sessionIdProvider()} ...`
            );
            await this.browser.close();
        } catch (err: any) {
            logger.debug(
                `Error occurred while closing browser of the MCP session with id ${this.sessionIdProvider()} ...`,
                err
            );
        }
    }
}
