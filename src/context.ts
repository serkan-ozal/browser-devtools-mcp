import {
    CONSOLE_MESSAGES_BUFFER_SIZE,
    HTTP_REQUESTS_BUFFER_SIZE,
} from './config';
import * as logger from './logger';
import {
    ConsoleMessage,
    ConsoleMessageLevel,
    ConsoleMessageLevelCode,
    ConsoleMessageLevelName,
    HttpMethod,
    HttpRequest,
    HttpResourceType,
} from './types';
import { makeTraceparent, newSpanId } from './utils';

import {
    Browser,
    BrowserContext,
    ConsoleMessage as PlaywrightConsoleMessage,
    Page,
    Route,
    Request,
    Response,
} from 'playwright';

export class McpSessionContext {
    private readonly consoleMessages: ConsoleMessage[] = [];
    private readonly httpRequests: HttpRequest[] = [];
    private readonly sessionIdProvider: () => string;
    private closed: boolean = false;
    private traceId?: string;
    readonly browser: Browser;
    readonly browserContext: BrowserContext;
    readonly page: Page;

    constructor(
        sessionIdProvider: () => string,
        browser: Browser,
        browserContext: BrowserContext,
        page: Page,
        traceId?: string
    ) {
        this.sessionIdProvider = sessionIdProvider;
        this.browser = browser;
        this.browserContext = browserContext;
        this.page = page;
        this.traceId = traceId;
    }

    async init(): Promise<void> {
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

        await this.browserContext.route(
            '**/*',
            async (route: Route, request: Request): Promise<void> => {
                const resourceType: string = request.resourceType();
                const isApi: boolean =
                    resourceType === HttpResourceType.XHR ||
                    resourceType === HttpResourceType.FETCH;
                const traceId: string | undefined = me.traceId;

                if (!isApi || !traceId) {
                    await route.continue();
                    return;
                }

                const reqHeaders: Record<string, string> = request.headers();
                const spanId: string = newSpanId();

                const nextHeaders: Record<string, string> = {
                    ...reqHeaders,
                    traceparent: makeTraceparent(traceId, spanId),
                };

                await route.continue({ headers: nextHeaders });
            }
        );
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

    private async _toHttpRequest(
        req: Request,
        sequenceNumber: number
    ): Promise<HttpRequest> {
        const res: Response | null = await req.response();
        const isRedirect: boolean = res
            ? res.status() >= 300 && res.status() < 400
            : false;
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
                      body: isRedirect
                          ? undefined
                          : (await res.body()).toString(),
                  }
                : undefined,
            ok: res ? res.ok() : false,
            timestamp: Math.floor(req.timing().startTime),
            sequenceNumber,
        };
    }

    sessionId(): string {
        return this.sessionIdProvider();
    }

    getTraceId(): string | undefined {
        return this.traceId;
    }

    setTraceId(traceId?: string): void {
        this.traceId = traceId;
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

        // Page(s) owned by browser context are already closed by the browser context itself

        try {
            logger.debug(
                `Closing browser context of the MCP session with id ${this.sessionIdProvider()} ...`
            );
            await this.browserContext.close();
        } catch (err: any) {
            logger.debug(
                `Error occurred while closing browser context of the MCP session with id ${this.sessionIdProvider()} ...`,
                err
            );
        }

        this.consoleMessages.length = 0;
        this.httpRequests.length = 0;

        // We are not closing browser here as it is shared between sessions, so it should be closed on MCP server close/shutdown

        this.closed = true;

        return true;
    }
}
