/**
 * -----------------------------------------------------------------------------
 * WHY THIS OTEL PROXY EXISTS
 * -----------------------------------------------------------------------------
 *
 * Problem:
 * --------
 * When OpenTelemetry Web SDK runs inside a real browser page, it exports traces
 * via OTLP/HTTP using `fetch` or `XMLHttpRequest`.
 *
 * In Playwright-driven debugging sessions this causes multiple issues:
 *
 * 1) CORS restrictions
 *    -----------------
 *    Browsers enforce CORS. If the page origin (e.g. https://remote-site.com)
 *    tries to POST traces to a collector like:
 *
 *        http://localhost:4318/v1/traces
 *
 *    the request is blocked unless the collector explicitly enables
 *    Access-Control-Allow-Origin for that site.
 *
 *    We often do NOT control the collector configuration (Jaeger, Tempo, etc),
 *    especially in local or remote debugging setups.
 *
 * 2) Remote pages + local tools
 *    ---------------------------
 *    A very common setup is:
 *      - Playwright + MCP server running locally
 *      - A remote production/staging website loaded in the browser
 *
 *    That remote website has no way to directly talk to a local OTLP endpoint
 *    due to browser security rules.
 *
 * 3) Collector incompatibilities
 *    -----------------------------
 *    Different collectors behave differently:
 *      - Some support CORS, some don’t
 *      - Some only support OTLP/gRPC
 *      - Some reject preflight OPTIONS requests
 *
 * Solution:
 * ---------
 * We introduce a SAME-ORIGIN OTEL PROXY using Playwright's `context.route`.
 *
 * Instead of exporting directly to the real collector, the browser sends OTLP to:
 *
 *     https://<page-origin>/__mcp_otel/v1/traces
 *
 * From the browser perspective this is SAME-ORIGIN → no CORS issues.
 *
 * Playwright intercepts that request *outside* the browser via `context.route`
 * and forwards the payload to the real upstream collector.
 *
 * Why `context.route` (and not a local HTTP server)?
 * --------------------------------------------------
 * - Zero CORS by construction (browser thinks it's same-origin)
 * - Works for ANY remote site origin
 * - No port exposure / firewall issues
 * - Lifecycle tied to BrowserContext (session-friendly)
 *
 * Path-based fan-out:
 * -------------------
 * Browser sends:
 *   /__mcp_otel/v1/traces
 *   /__mcp_otel/v1/metrics
 *   /__mcp_otel/v1/logs
 *
 * Proxy strips base path and forwards:
 *   <upstreamBase>/v1/traces
 *   <upstreamBase>/v1/metrics
 *   <upstreamBase>/v1/logs
 *
 * Performance considerations:
 * ---------------------------
 * - Browser is ACKed immediately (204/200)
 * - Forwarding happens asynchronously in a bounded queue
 * - Slow/failing collectors do NOT block the page
 * -----------------------------------------------------------------------------
 */

import * as logger from '../logger';

import type { BrowserContext, Route, Request as PwRequest } from 'playwright';

export type OTELProxyConfig = {
    /**
     * Same-origin base path that the browser will send OTLP/HTTP requests to.
     * Example: '/__mcp_otel/' (recommended) or '/__mcp_otel' (normalized to have a trailing slash).
     */
    localPath: string;

    /**
     * Upstream OTLP/HTTP base URL (no path suffix).
     * Example: 'http://localhost:4318' or 'https://collector.company.com:4318'
     *
     * The intercepted request suffix path (e.g. '/v1/traces') is appended to this base.
     */
    upstreamUrl: string;

    /**
     * Optional extra headers to add when forwarding to upstream (e.g., API key).
     */
    upstreamHeaders?: Record<string, string>;

    /**
     * Max queued batches. When exceeded, the new batch will be dropped.
     */
    maxQueueSize?: number;

    /**
     * Max concurrent upstream requests.
     */
    concurrency?: number;

    /**
     * If true, respond 204 to the browser; otherwise respond 200.
     */
    respondNoContent?: boolean;

    /**
     * Optional request matcher to skip forwarding certain payloads.
     * Return false to drop (still ACK to the browser).
     */
    shouldForward?: (req: PwRequest) => boolean;
};

type QueueItem = {
    body: Buffer;
    contentType: string;
    createdAtMs: number;

    upstreamUrl: string;
    method: string;
    headers: Record<string, string>;
};

export type OTelProxyMetrics = {
    routedRequests: number;
    acceptedBatches: number;
    droppedBatches: number;
    forwardedBatches: number;
    failedBatches: number;
    inFlight: number;
    queueSize: number;
    lastError: string | null;
};

function _normalizeBasePath(input: string): string {
    let p: string = input.trim();

    if (!p.startsWith('/')) {
        p = '/' + p;
    }

    if (!p.endsWith('/')) {
        p = p + '/';
    }

    return p;
}

function _normalizeUpstreamBaseUrl(input: string): string {
    const u: string = input.trim();

    if (!u) {
        return u;
    }

    // Remove trailing slash to avoid double slashes when appending suffix
    if (u.endsWith('/')) {
        return u.slice(0, -1);
    }

    return u;
}

/**
 * Extracts the pathname suffix after basePath.
 *
 * basePath is normalized to always end with '/', so for:
 *   basePath = '/__mcp_otel/'
 *   pathname = '/__mcp_otel/v1/traces'
 *
 * we return '/v1/traces'.
 */
function _computeSuffixPath(fullUrl: string, basePath: string): string | null {
    try {
        const u: URL = new URL(fullUrl);
        const pathname: string = u.pathname;

        if (!pathname.startsWith(basePath)) {
            return null;
        }

        const raw: string = pathname.slice(basePath.length); // e.g. 'v1/traces'
        if (!raw) {
            // If someone POSTs directly to '/__mcp_otel/' without suffix,
            // treat as invalid (we don't know where to fan-out).
            return null;
        }

        return raw.startsWith('/') ? raw : '/' + raw;
    } catch {
        return null;
    }
}

function _appendSuffixToUpstream(
    upstreamBaseUrl: string,
    suffixPath: string,
    originalUrl: string
): string {
    try {
        const u: URL = new URL(originalUrl);
        const qs: string = u.search ?? '';
        return upstreamBaseUrl + suffixPath + qs;
    } catch {
        return upstreamBaseUrl + suffixPath;
    }
}

export class OTELProxy {
    private readonly config: Required<
        Pick<
            OTELProxyConfig,
            | 'localPath'
            | 'upstreamUrl'
            | 'maxQueueSize'
            | 'concurrency'
            | 'respondNoContent'
        >
    > &
        OTELProxyConfig;

    private readonly queue: Array<QueueItem>;
    private readonly workers: Array<Promise<void>>;
    private isRunning: boolean;
    private isInstalled: boolean;

    private metrics: OTelProxyMetrics;

    constructor(config: OTELProxyConfig) {
        const maxQueueSize: number = config.maxQueueSize ?? 200;
        const concurrency: number = config.concurrency ?? 2;
        const respondNoContent: boolean = config.respondNoContent ?? true;

        const normalizedLocalPath: string = _normalizeBasePath(
            config.localPath
        );
        const normalizedUpstreamUrl: string = _normalizeUpstreamBaseUrl(
            config.upstreamUrl
        );

        this.config = {
            ...config,
            localPath: normalizedLocalPath,
            upstreamUrl: normalizedUpstreamUrl,
            maxQueueSize,
            concurrency,
            respondNoContent,
        };

        this.queue = [];
        this.workers = [];
        this.isRunning = false;
        this.isInstalled = false;

        this.metrics = {
            routedRequests: 0,
            acceptedBatches: 0,
            droppedBatches: 0,
            forwardedBatches: 0,
            failedBatches: 0,
            inFlight: 0,
            queueSize: 0,
            lastError: null,
        };
    }

    getMetrics(): OTelProxyMetrics {
        return { ...this.metrics, queueSize: this.queue.length };
    }

    /**
     * Install the route handler and start background workers.
     * Call this once per BrowserContext.
     */
    async install(context: BrowserContext): Promise<void> {
        if (this.isInstalled) {
            return;
        }

        const basePath: string = this.config.localPath;

        if (!basePath.startsWith('/')) {
            throw new Error(
                'localPath must start with "/" (e.g. "/__mcp_otel/").'
            );
        }

        // Match any origin that contains the base path in the pathname.
        const pattern: string = `**${basePath}**`;

        await context.route(pattern, async (route: Route): Promise<void> => {
            await this._handleRoute(route);
        });

        this.isInstalled = true;

        if (!this.isRunning) {
            await this.start();
        }

        logger.debug(
            `[otel-proxy] installed route pattern: ${pattern} (basePath=${basePath}, upstreamBase=${this.config.upstreamUrl})`
        );
    }

    /**
     * Uninstall route handler and stop workers.
     */
    async uninstall(context: BrowserContext): Promise<void> {
        if (!this.isInstalled) {
            return;
        }

        const pattern: string = `**${this.config.localPath}**`;

        try {
            await context.unroute(pattern);
        } catch {
            // Ignore if not supported or already removed.
        }

        this.isInstalled = false;

        await this.stop();
    }

    /**
     * Start worker loop(s) that flush the queue to upstream.
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        const workerCount: number = Math.max(1, this.config.concurrency);

        for (let i: number = 0; i < workerCount; i++) {
            const w: Promise<void> = this._workerLoop(i);
            this.workers.push(w);
        }

        logger.debug(
            `[otel-proxy] started with concurrency=${workerCount}, maxQueueSize=${this.config.maxQueueSize}`
        );
    }

    /**
     * Stop workers. Any queued items will be dropped.
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Drop queue immediately to avoid memory growth on shutdown.
        this.queue.length = 0;

        try {
            await Promise.allSettled(this.workers);
        } finally {
            this.workers.length = 0;
        }

        logger.debug('[otel-proxy] stopped');
    }

    private async _handleRoute(route: Route): Promise<void> {
        const req: PwRequest = route.request();
        this.metrics.routedRequests++;

        // ACK preflight quickly (do not forward).
        // Some setups / collectors choke on OPTIONS anyway.
        if (req.method().toUpperCase() === 'OPTIONS') {
            await this._fulfillFast(route);
            return;
        }

        if (this.config.shouldForward) {
            const should: boolean = this.config.shouldForward(req);
            if (!should) {
                await this._fulfillFast(route);
                return;
            }
        }

        const requestUrl: string = req.url();
        const basePath: string = this.config.localPath;

        const suffixPath: string | null = _computeSuffixPath(
            requestUrl,
            basePath
        );
        if (!suffixPath) {
            // Pattern matched but URL parsing/path extraction failed; fallback so we don't break the page.
            await route.fallback();
            return;
        }

        const upstreamFullUrl: string = _appendSuffixToUpstream(
            this.config.upstreamUrl,
            suffixPath,
            requestUrl
        );

        const buf: Buffer | null = await req.postDataBuffer();
        const body: Buffer = buf ?? Buffer.alloc(0);

        const contentTypeHeader: string | undefined =
            req.headers()['content-type'];
        const contentType: string =
            contentTypeHeader ?? 'application/x-protobuf';

        const method: string = req.method();

        const headers: Record<string, string> = {
            'content-type': contentType,
        };

        if (this.config.upstreamHeaders) {
            for (const [k, v] of Object.entries(this.config.upstreamHeaders)) {
                headers[k] = v;
            }
        }

        if (this.queue.length >= this.config.maxQueueSize) {
            this.metrics.droppedBatches++;
            await this._fulfillFast(route);

            logger.warn(
                `[otel-proxy] dropped batch (queue full: ${this.queue.length}/${this.config.maxQueueSize}) suffix=${suffixPath}`
            );
            return;
        }

        const item: QueueItem = {
            body,
            contentType,
            createdAtMs: Date.now(),
            upstreamUrl: upstreamFullUrl,
            method,
            headers,
        };

        this.queue.push(item);
        this.metrics.acceptedBatches++;

        await this._fulfillFast(route);
    }

    private async _fulfillFast(route: Route): Promise<void> {
        const status: number = this.config.respondNoContent ? 204 : 200;

        if (status === 204) {
            await route.fulfill({ status });
            return;
        }

        await route.fulfill({
            status,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            body: '',
        });
    }

    private async _workerLoop(workerIndex: number): Promise<void> {
        while (this.isRunning) {
            const item: QueueItem | undefined = this.queue.shift();

            if (!item) {
                await this._sleep(25);
                continue;
            }

            this.metrics.inFlight++;
            try {
                await this._forwardUpstream(item);
                this.metrics.forwardedBatches++;
            } catch (e: unknown) {
                this.metrics.failedBatches++;
                const msg: string = e instanceof Error ? e.message : String(e);
                this.metrics.lastError = msg;

                logger.warn(
                    `[otel-proxy] worker=${workerIndex} forward failed: ${msg}`
                );
            } finally {
                this.metrics.inFlight--;
            }
        }
    }

    private async _forwardUpstream(item: QueueItem): Promise<void> {
        const res: Response = await fetch(item.upstreamUrl, {
            method: item.method,
            headers: item.headers,
            body: new Uint8Array(item.body),
        });

        if (res.status < 200 || res.status >= 300) {
            const text: string = await this._safeReadText(res);
            throw new Error(
                `upstream returned ${res.status} for ${item.upstreamUrl}: ${text}`
            );
        }
    }

    private async _safeReadText(res: Response): Promise<string> {
        try {
            const t: string = await res.text();
            return t.slice(0, 500);
        } catch {
            return '';
        }
    }

    private async _sleep(ms: number): Promise<void> {
        await new Promise((resolve: (value: void) => void): void => {
            setTimeout((): void => resolve(), ms);
        });
    }
}
