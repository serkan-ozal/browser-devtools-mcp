import {
    CONSOLE_MESSAGES_BUFFER_SIZE,
    HTTP_REQUESTS_BUFFER_SIZE,
} from './config';
import * as logger from './logger';
import { OTELController } from './otel/otel-controller';
import {
    ConsoleMessage,
    ConsoleMessageLevel,
    ConsoleMessageLevelCode,
    ConsoleMessageLevelName,
    HttpMethod,
    HttpRequest,
    HttpResourceType,
} from './types';
import { newTraceId } from './utils';

import {
    BrowserContext,
    ConsoleMessage as PlaywrightConsoleMessage,
    Page,
    Request,
    Response,
} from 'playwright';

export type McpSessionContextOptions = {
    closeBrowserContextOnClose: boolean;
    otelEnable: boolean;
};

export class McpSessionContext {
    private readonly _sessionId: string;
    private readonly options: McpSessionContextOptions;
    private readonly otelController: OTELController;
    private readonly consoleMessages: ConsoleMessage[] = [];
    private readonly httpRequests: HttpRequest[] = [];
    private initialized: boolean = false;
    private closed: boolean = false;
    private traceId?: string;
    readonly browserContext: BrowserContext;
    readonly page: Page;

    constructor(
        sessionId: string,
        browserContext: BrowserContext,
        page: Page,
        options: McpSessionContextOptions
    ) {
        this._sessionId = sessionId;
        this.browserContext = browserContext;
        this.page = page;
        this.options = options;
        this.otelController = new OTELController(this.browserContext);
    }

    async init(): Promise<void> {
        if (this.closed) {
            throw new Error('Session context is already closed');
        }

        if (this.initialized) {
            throw new Error('Session context is already initialized');
        }

        const me: McpSessionContext = this;

        let consoleMessageSequenceNumber: number = 0;
        this.page.on('console', (msg: PlaywrightConsoleMessage): void => {
            me.consoleMessages.push(
                me._toConsoleMessage(msg, ++consoleMessageSequenceNumber)
            );
            if (me.consoleMessages.length > CONSOLE_MESSAGES_BUFFER_SIZE) {
                me.consoleMessages.splice(
                    0,
                    me.consoleMessages.length - CONSOLE_MESSAGES_BUFFER_SIZE
                );
            }
        });
        this.page.on('pageerror', (err: Error): void => {
            me.consoleMessages.push(
                me._errorToConsoleMessage(err, ++consoleMessageSequenceNumber)
            );
            if (me.consoleMessages.length > CONSOLE_MESSAGES_BUFFER_SIZE) {
                me.consoleMessages.splice(
                    0,
                    me.consoleMessages.length - CONSOLE_MESSAGES_BUFFER_SIZE
                );
            }
        });

        let httpRequestSequenceNumber: number = 0;
        this.page.on('requestfinished', async (req: Request): Promise<void> => {
            me.httpRequests.push(
                await me._toHttpRequest(req, ++httpRequestSequenceNumber)
            );
            if (me.httpRequests.length > HTTP_REQUESTS_BUFFER_SIZE) {
                me.httpRequests.splice(
                    0,
                    me.httpRequests.length - HTTP_REQUESTS_BUFFER_SIZE
                );
            }
        });
        this.page.on('requestfailed', async (req: Request): Promise<void> => {
            me.httpRequests.push(
                await me._toHttpRequest(req, ++httpRequestSequenceNumber)
            );
            if (me.httpRequests.length > HTTP_REQUESTS_BUFFER_SIZE) {
                me.httpRequests.splice(
                    0,
                    me.httpRequests.length - HTTP_REQUESTS_BUFFER_SIZE
                );
            }
        });

        if (this.options.otelEnable) {
            this.traceId = newTraceId();
            await this.otelController.init({
                traceId: this.traceId,
            });
        }

        this.initialized = true;
    }

    private _toConsoleMessageLevelName(type: string): ConsoleMessageLevelName {
        switch (type) {
            case 'assert':
            case 'error':
                return ConsoleMessageLevelName.ERROR;
            case 'warning':
                return ConsoleMessageLevelName.WARNING;
            case 'count':
            case 'dir':
            case 'dirxml':
            case 'info':
            case 'log':
            case 'table':
            case 'time':
            case 'timeEnd':
                return ConsoleMessageLevelName.INFO;
            case 'clear':
            case 'debug':
            case 'endGroup':
            case 'profile':
            case 'profileEnd':
            case 'startGroup':
            case 'startGroupCollapsed':
            case 'trace':
                return ConsoleMessageLevelName.DEBUG;
            default:
                return ConsoleMessageLevelName.INFO;
        }
    }

    private _toConsoleMessage(
        message: PlaywrightConsoleMessage,
        sequenceNumber: number
    ): ConsoleMessage {
        const timestamp: number = Date.now();
        const levelName: ConsoleMessageLevelName =
            this._toConsoleMessageLevelName(message.type());
        const levelCode: ConsoleMessageLevelCode =
            ConsoleMessageLevel[levelName]!.code;
        return {
            type: message.type(),
            text: message.text(),
            level: {
                name: levelName,
                code: levelCode,
            },
            location: {
                url: message.location().url,
                lineNumber: message.location().lineNumber,
                columnNumber: message.location().columnNumber,
            },
            timestamp,
            sequenceNumber,
        };
    }

    private _errorToConsoleMessage(
        error: Error | any,
        sequenceNumber: number
    ): ConsoleMessage {
        const timestamp: number = Date.now();
        if (error instanceof Error) {
            return {
                type: 'error',
                text: error.message,
                level: {
                    name: ConsoleMessageLevelName.ERROR,
                    code: ConsoleMessageLevelCode.ERROR,
                },
                timestamp,
                sequenceNumber,
            };
        }
        return {
            type: 'error',
            text: String(error),
            level: {
                name: ConsoleMessageLevelName.ERROR,
                code: ConsoleMessageLevelCode.ERROR,
            },
            timestamp,
            sequenceNumber,
        };
    }

    private _isBodyLikelyPresent(status: number, method: string): boolean {
        if (method === 'HEAD' || method === 'OPTIONS') {
            return false;
        }
        if (status === 204 || status === 304) {
            return false;
        }
        if (status >= 300 && status < 400) {
            // redirects
            return false;
        }
        return true;
    }

    private async _safeReadResponseBody(
        res: Response
    ): Promise<string | undefined> {
        try {
            const req: Request = res.request();
            const method: string = req.method();
            const status: number = res.status();

            if (!this._isBodyLikelyPresent(status, method)) {
                return undefined;
            }

            const buf: Buffer = await res.body(); // may throw
            return buf.toString('utf-8');
        } catch {
            // This is the important part: CDP can't always provide body.
            return undefined;
        }
    }

    private async _toHttpRequest(
        req: Request,
        sequenceNumber: number
    ): Promise<HttpRequest> {
        const res: Response | null = await req.response();
        return {
            url: req.url(),
            method: req.method() as HttpMethod,
            headers: req.headers(),
            body: req.postData() || undefined,
            resourceType: req.resourceType() as HttpResourceType,
            failure: req.failure()?.errorText,
            duration: req.timing().responseEnd,
            response: res
                ? {
                      status: res.status(),
                      statusText: res.statusText(),
                      headers: res.headers(),
                      body: await this._safeReadResponseBody(res),
                  }
                : undefined,
            ok: res ? res.ok() : false,
            timestamp: Math.floor(req.timing().startTime),
            sequenceNumber,
        };
    }

    sessionId(): string {
        return this._sessionId;
    }

    async getTraceId(): Promise<string | undefined> {
        return this.traceId;
    }

    async setTraceId(traceId: string): Promise<void> {
        if (!this.options.otelEnable) {
            throw new Error('OTEL is not enabled');
        }
        this.traceId = traceId;
        await this.otelController.setTraceId(this.page, traceId);
    }

    getConsoleMessages(): ConsoleMessage[] {
        return this.consoleMessages;
    }

    getHttpRequests(): HttpRequest[] {
        return this.httpRequests;
    }

    async close(): Promise<boolean> {
        if (this.closed) {
            return false;
        }

        logger.debug(
            `Closing OTEL controller of the MCP session with id ${this._sessionId} ...`
        );
        await this.otelController.close();

        // Page(s) owned by browser context are already closed by the browser context itself

        if (this.options.closeBrowserContextOnClose) {
            try {
                logger.debug(
                    `Closing browser context of the MCP session with id ${this._sessionId} ...`
                );
                await this.browserContext.close();
            } catch (err: any) {
                logger.debug(
                    `Error occurred while closing browser context of the MCP session with id ${this._sessionId} ...`,
                    err
                );
            }
        } else {
            try {
                logger.debug(
                    `Closing page of the MCP session with id ${this._sessionId} ...`
                );
                await this.page.close();
            } catch (err: any) {
                logger.debug(
                    `Error occurred while closing page of the MCP session with id ${this._sessionId} ...`,
                    err
                );
            }
        }

        this.consoleMessages.length = 0;
        this.httpRequests.length = 0;

        // We are not closing browser here as it is shared between sessions, so it should be closed on MCP server close/shutdown

        this.closed = true;

        return true;
    }
}
