import fs from 'fs';
import path from 'path';

import * as logger from '../logger';
import { OTELProxy } from './otel-proxy';

import type { BrowserContext, Frame, Page, Request } from 'playwright';
import {
    OTEL_ASSETS_DIR,
    OTEL_EXPORTER_HTTP_HEADERS,
    OTEL_EXPORTER_HTTP_URL,
    OTEL_EXPORTER_TYPE,
    OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS,
    OTEL_SERVICE_NAME,
    OTEL_SERVICE_VERSION,
} from '../config';

const OTEL_PROXY_LOCAL_PATH: string = '/__mcp_otel/';
const OTEL_BUNDLE_FILE_NAME: string = 'otel-initializer.bundle.js';

type OTELExporterConfig =
    | {
          type: 'otlp/http';

          /**
           * Browser-side URL (same-origin) that OTEL exporter will post to.
           * Example: "/__mcp_otel/"
           * OTEL signal specific paths/suffixes will be appended
           * by the "otel-initializer.ts" (for ex. for traces, "/v1/traces").
           */
          url: string;

          /**
           * Upstream *base* URL (collector base).
           * Example: "http://localhost:4318"
           *
           * The OTELProxy will append the suffix (e.g. "/v1/traces") to this base.
           */
          upstreamURL: string;

          headers?: Record<string, string>;
      }
    | {
          type: 'console';
      }
    | {
          type: 'none';
      };

type OTELInstrumentationConfig = {
    userInteractionEvents?: (keyof HTMLElementEventMap)[];
};

type OTELConfig = {
    serviceName: string;
    serviceVersion?: string;

    /**
     * IMPORTANT:
     * - We treat traceId as required at runtime (init options must provide it).
     * - Type remains optional because some config sources might omit it,
     *   but init() will enforce it.
     */
    traceId?: string;

    exporter: OTELExporterConfig;
    instrumentation: OTELInstrumentationConfig;
    debug?: boolean;
};

export type OTELInitOptions = {
    traceId: string;
};

function _getOTELExporterConfig(): OTELExporterConfig {
    if (OTEL_EXPORTER_TYPE === 'otlp/http' || OTEL_EXPORTER_HTTP_URL) {
        if (!OTEL_EXPORTER_HTTP_URL) {
            throw new Error(
                `OTEL exporter HTTP url must be set when OTEL exporter type is "otlp/http"`
            );
        }
        return {
            type: 'otlp/http',
            // IMPORTANT: OTEL_EXPORTER_HTTP_URL is a *base* URL, e.g. "http://localhost:4318"
            // Browser exporter points to same-origin proxy. We choose a default suffix for traces.
            // If you want to support metrics/logs too, you can configure initializer to use
            // "/__mcp_otel/v1/metrics" and "/__mcp_otel/v1/logs" similarly.
            url: OTEL_PROXY_LOCAL_PATH,
            upstreamURL: OTEL_EXPORTER_HTTP_URL,
            headers: OTEL_EXPORTER_HTTP_HEADERS,
        };
    } else if (OTEL_EXPORTER_TYPE === 'console') {
        return {
            type: 'console',
        };
    } else if (OTEL_EXPORTER_TYPE === 'none') {
        return {
            type: 'none',
        };
    } else {
        throw new Error(`Invalid OTEL exporter type ${OTEL_EXPORTER_TYPE}`);
    }
}

function _getOTELInstrumentationConfig(): OTELInstrumentationConfig {
    return {
        userInteractionEvents:
            OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS as (keyof HTMLElementEventMap)[],
    };
}

function _getOTELConfig(): OTELConfig {
    return {
        serviceName: OTEL_SERVICE_NAME,
        serviceVersion: OTEL_SERVICE_VERSION,
        exporter: _getOTELExporterConfig(),
        instrumentation: _getOTELInstrumentationConfig(),
        debug: false,
    };
}

function _readBundleContent(assetDir: string, bundleFileName: string): string {
    const assetDirAbs: string = path.isAbsolute(assetDir)
        ? assetDir
        : path.join(process.cwd(), assetDir);

    const filePath: string = path.join(assetDirAbs, bundleFileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`OTEL bundle not found at: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
}

async function _applyConfigToPage(page: Page, cfg: OTELConfig): Promise<void> {
    await page
        .evaluate((nextCfg: OTELConfig): void => {
            const g: any = globalThis as any;

            if (!g.__MCP_DEVTOOLS__) {
                g.__MCP_DEVTOOLS__ = {};
            }

            // Keep a stable fallback trace id for debugging & for pages
            // where controller isn't available yet.
            g.__MCP_TRACE_ID__ = nextCfg.traceId;

            if (g.__mcpOtel && typeof g.__mcpOtel.init === 'function') {
                g.__mcpOtel.init(nextCfg);
            } else {
                g.__MCP_DEVTOOLS__.otelInitialized = false;
                g.__MCP_DEVTOOLS__.otelInitError =
                    '__mcpOtel.init is not available while applying config';
            }
        }, cfg)
        .catch((e: unknown): void => {
            // NOTE:
            // We intentionally do not throw here because apply is best-effort and
            // should not break user sessions; however, swallowing errors makes debugging hard.
            const msg: string = e instanceof Error ? e.message : String(e);
            logger.debug(
                `[otel-controller] applyConfigToPage failed (ignored): ${msg}`
            );
        });
}

/**
 * Installs navigation sync so that after each main-frame navigation we re-apply
 * the latest config. This is important because:
 * - addInitScript config is a snapshot at install time
 * - traceId can change mid-session
 *
 * IMPORTANT:
 * We keep references to handlers so we can remove them on close().
 */
function _installAutoSync(
    browserContext: BrowserContext,
    getCfg: () => OTELConfig
): {
    detach: () => void;
} {
    const perPageHandlers: WeakMap<Page, (frame: Frame) => void> =
        new WeakMap();

    const attachToPage = (page: Page): void => {
        // Avoid double-attaching to the same Page instance.
        if (perPageHandlers.has(page)) {
            return;
        }

        const onFrameNavigated = async (frame: Frame): Promise<void> => {
            if (frame !== page.mainFrame()) {
                return;
            }
            await _applyConfigToPage(page, getCfg());
        };

        perPageHandlers.set(page, onFrameNavigated);
        page.on('framenavigated', onFrameNavigated);
    };

    // Attach to existing pages
    for (const p of browserContext.pages()) {
        attachToPage(p);
    }

    // Attach to future pages
    const onNewPage = (p: Page): void => {
        attachToPage(p);
    };
    browserContext.on('page', onNewPage);

    const detach = (): void => {
        // Remove context-level listener
        try {
            browserContext.off('page', onNewPage);
        } catch {
            // Some older Playwright builds may differ; ignore.
        }

        // Remove per-page listeners (best-effort)
        for (const p of browserContext.pages()) {
            const h = perPageHandlers.get(p);
            if (h) {
                try {
                    p.off('framenavigated', h);
                } catch {}
            }
        }

        // Note: We intentionally do not iterate WeakMap keys.
        // We best-effort remove from currently known pages.
    };

    logger.debug('[otel-controller] auto-sync installed (page+framenavigated)');
    return { detach };
}

export class OTELController {
    private readonly browserContext: BrowserContext;
    private readonly config: OTELConfig;

    private proxy?: OTELProxy;

    /**
     * We prevent multiple installs per OTELController instance.
     */
    private initialized: boolean = false;

    /**
     * Handler cleanup for auto-sync.
     */
    private autoSyncDetach?: () => void;

    constructor(browserContext: BrowserContext) {
        this.browserContext = browserContext;
        this.config = _getOTELConfig();
    }

    async init(options: OTELInitOptions): Promise<void> {
        if (this.initialized) {
            logger.debug(
                '[otel-controller] init skipped: BrowserContext already initialized'
            );
            return;
        }

        // Enforce traceId presence; while OTELConfig allows optional traceId,
        // runtime behavior expects it.
        if (!options.traceId || !options.traceId.trim()) {
            throw new Error(
                '[otel-controller] init requires a non-empty traceId'
            );
        }

        this.config.traceId = options.traceId;

        const assetDir: string = OTEL_ASSETS_DIR || __dirname;

        if (this.config.exporter.type === 'otlp/http') {
            this.proxy = new OTELProxy({
                localPath: OTEL_PROXY_LOCAL_PATH,
                upstreamUrl: this.config.exporter.upstreamURL,
                upstreamHeaders: { ...(this.config.exporter.headers ?? {}) },
            });

            await this.proxy.install(this.browserContext);
        }

        // Add extra debug breadcrumbs to quickly verify routing is working.
        // If you see 404s for /__mcp_otel/*, this tells you whether routing is installed.
        logger.debug(
            `[otel-controller] exporter=${this.config.exporter.type} localBase=${OTEL_PROXY_LOCAL_PATH}` +
                (this.config.exporter.type === 'otlp/http'
                    ? ` upstreamBase=${this.config.exporter.upstreamURL}`
                    : '')
        );

        const bundleContent: string = _readBundleContent(
            assetDir,
            OTEL_BUNDLE_FILE_NAME
        );

        // Install auto-sync (we pass a getter so it always uses latest config)
        const sync = _installAutoSync(
            this.browserContext,
            (): OTELConfig => this.config
        );
        this.autoSyncDetach = sync.detach;

        // 1) Install the initializer bundle as an init script (no network, no <script> tag)
        await this.browserContext.addInitScript({
            content: bundleContent,
        });

        // 2) Install a config init script that runs on every new document (snapshot config at install time)
        // Auto-sync will re-apply the latest config after navigations.
        await this.browserContext.addInitScript((cfg: OTELConfig): void => {
            const g: any = globalThis as any;

            if (!g.__MCP_DEVTOOLS__) {
                g.__MCP_DEVTOOLS__ = {};
            }

            g.__MCP_TRACE_ID__ = cfg.traceId;

            if (g.__mcpOtel && typeof g.__mcpOtel.init === 'function') {
                g.__mcpOtel.init(cfg);
            } else {
                g.__MCP_DEVTOOLS__.otelInitialized = false;
                g.__MCP_DEVTOOLS__.otelInitError =
                    '__mcpOtel.init is not available (initializer bundle did not install)';
            }
        }, this.config);

        this.initialized = true;

        logger.debug(
            '[otel-controller] init installed: bundle + config init scripts + auto-sync'
        );
    }

    isOTELRequest(request: Request): boolean {
        const path: string = new URL(request.url()).pathname;
        return path.startsWith(OTEL_PROXY_LOCAL_PATH);
    }

    async isInitialized(page: Page): Promise<boolean> {
        return await page.evaluate((): boolean => {
            const g: any = globalThis as any;
            return g.__MCP_DEVTOOLS__?.otelInitialized === true;
        });
    }

    async getInitError(page: Page): Promise<string | undefined> {
        return await page.evaluate((): string | undefined => {
            const g: any = globalThis as any;
            const v: unknown = g.__MCP_DEVTOOLS__?.otelInitError;
            if (typeof v === 'string' && v.trim()) {
                return v;
            }
            return undefined;
        });
    }

    async getTraceId(page: Page): Promise<string | undefined> {
        return await page.evaluate((): string | undefined => {
            const g: any = globalThis as any;

            if (g.__mcpOtel && typeof g.__mcpOtel.getTraceId === 'function') {
                const tid: unknown = g.__mcpOtel.getTraceId();
                if (typeof tid === 'string' && tid.trim()) {
                    return tid;
                }
            }

            const fallback: unknown = g.__MCP_TRACE_ID__;
            if (typeof fallback === 'string' && fallback.trim()) {
                return fallback;
            }

            return undefined;
        });
    }

    async setTraceId(page: Page, traceId: string): Promise<void> {
        // Persist in controller config so future navigations pick it up.
        this.config.traceId = traceId;

        await page.evaluate((tid: string): void => {
            const g: any = globalThis as any;

            if (g.__mcpOtel && typeof g.__mcpOtel.setTraceId === 'function') {
                g.__mcpOtel.setTraceId(tid);
            } else {
                g.__MCP_TRACE_ID__ = tid;
            }
        }, traceId);
    }

    async close(): Promise<void> {
        // Cleanup auto-sync listeners to avoid:
        // - leaking listeners across long sessions
        // - duplicate apply calls if controller is re-created/re-inited
        if (this.autoSyncDetach) {
            try {
                this.autoSyncDetach();
            } catch {}
            this.autoSyncDetach = undefined;
        }

        if (this.proxy) {
            await this.proxy.uninstall(this.browserContext);
            this.proxy = undefined;
        }
    }
}
