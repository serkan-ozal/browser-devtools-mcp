import {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
    trace,
} from '@opentelemetry/api';

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import type { IdGenerator } from '@opentelemetry/sdk-trace-base';
import {
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

import { resourceFromAttributes } from '@opentelemetry/resources';
import {
    SEMRESATTRS_SERVICE_NAME,
    SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * -------------------------
 * Types (mirrors MCP-side config)
 * -------------------------
 */
export type OTELExporterConfig =
    | {
          type: 'otlp/http';
          url: string;
          headers?: Record<string, string>;
      }
    | {
          type: 'console';
      }
    | {
          type: 'none';
      };

export type OTELInstrumentationConfig = {
    userInteractionEvents?: (keyof HTMLElementEventMap)[];
};

export type OTELConfig = {
    serviceName: string;
    serviceVersion?: string;
    traceId: string;
    exporter: OTELExporterConfig;
    instrumentation: OTELInstrumentationConfig;
    debug?: boolean;
};

const OTEL_TRACE_EXPORT_PATH: string = 'v1/traces';

/**
 * -------------------------
 * Helpers
 * -------------------------
 */
function isValidTraceIdHex(traceId: string): boolean {
    const v: string = traceId.trim().toLowerCase();
    return /^[0-9a-f]{32}$/.test(v) && v !== '00000000000000000000000000000000';
}

function randomHex(byteLen: number): string {
    const bytes: Uint8Array = new Uint8Array(byteLen);
    crypto.getRandomValues(bytes);

    let out: string = '';
    for (let i: number = 0; i < bytes.length; i++) {
        const b: number = bytes[i];
        out += b.toString(16).padStart(2, '0');
    }
    return out;
}

function normalizeTraceId(traceId: string): string {
    const v: string = traceId.trim().toLowerCase();
    if (isValidTraceIdHex(v)) {
        return v;
    }
    // Fallback: generate a random trace id if invalid
    return randomHex(16);
}

class McpIdGenerator implements IdGenerator {
    private traceId: string;

    public constructor(traceId: string) {
        this.traceId = normalizeTraceId(traceId);
    }

    public setTraceId(traceId: string): void {
        this.traceId = normalizeTraceId(traceId);
    }

    public getTraceId(): string {
        return this.traceId;
    }

    public generateTraceId(): string {
        // Ensure all new traces use the MCP-controlled trace id
        return this.traceId;
    }

    public generateSpanId(): string {
        // 8 bytes => 16 hex chars (padStart guarantees 0-padding)
        return randomHex(8);
    }
}

/**
 * -------------------------
 * Global controller exposed by the bundle
 * -------------------------
 */
type McpOtelController = {
    init: (cfg: OTELConfig) => void;
    setTraceId: (traceId: string) => void;
    getTraceId: () => string;
    isInitialized: () => boolean;
    getInitError: () => string | undefined;
};

declare global {
    interface Window {
        __mcpOtel?: McpOtelController;
        __MCP_DEVTOOLS__?: Record<string, any>;
        __MCP_TRACE_ID__?: string;
    }
}

(function installMcpOtelController(): void {
    const g: any = globalThis as any;

    if (!g.__MCP_DEVTOOLS__) {
        g.__MCP_DEVTOOLS__ = {};
    }

    const ns: any = g.__MCP_DEVTOOLS__;

    // Do not overwrite an existing controller (bundle may run more than once in edge cases).
    if (g.__mcpOtel) {
        return;
    }

    let idGen: McpIdGenerator | null = null;
    let initialized: boolean = false;
    let initError: string | undefined = undefined;

    function ensureDiag(debug: boolean | undefined): void {
        if (debug === true) {
            diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
        }
    }

    function buildSpanProcessors(cfg: OTELConfig): Array<any> {
        const procs: Array<any> = [];

        if (cfg.exporter.type === 'none') {
            return procs;
        } else if (cfg.exporter.type === 'console') {
            const exp: ConsoleSpanExporter = new ConsoleSpanExporter();
            const proc: SimpleSpanProcessor = new SimpleSpanProcessor(exp);
            procs.push(proc);
            return procs;
        } else if (cfg.exporter.type === 'otlp/http') {
            const traceExportURL: string = cfg.exporter.url.endsWith('/')
                ? `${cfg.exporter.url}${OTEL_TRACE_EXPORT_PATH}`
                : `${cfg.exporter.url}/${OTEL_TRACE_EXPORT_PATH}`;
            const exporter: OTLPTraceExporter = new OTLPTraceExporter({
                url: traceExportURL,
                headers: cfg.exporter.headers,
            });

            const bsp: BatchSpanProcessor = new BatchSpanProcessor(exporter);
            procs.push(bsp);
            return procs;
        }

        throw new Error(
            `Not supported exporter type: ${(cfg.exporter as any).type}`
        );
    }

    function buildIgnoreUrlsForBasePath(
        basePath: string
    ): Array<string | RegExp> {
        const p: string = basePath.trim();

        if (!p) {
            return [];
        }

        // normalize: "/__mcp_otel/" guarantee
        const normalized: string = p.startsWith('/') ? p : '/' + p;

        const withSlash: string = normalized.endsWith('/')
            ? normalized
            : normalized + '/';

        /**
         * To handle both absolute URL and path-only:
         *  - /__mcp_otel/...
         *  - https://site.com/__mcp_otel/...
         */
        return [
            new RegExp(`^${withSlash.replace(/\//g, '\\/')}`),
            new RegExp(`${withSlash.replace(/\//g, '\\/')}`),
        ];
    }

    function installInstrumentations(
        tracerProvider: WebTracerProvider,
        instrumentationConfig: OTELInstrumentationConfig,
        otelProxyBasePath?: string
    ): void {
        const ignoreUrls: (RegExp | string)[] = otelProxyBasePath
            ? buildIgnoreUrlsForBasePath(otelProxyBasePath)
            : [];

        const cfg: OTELInstrumentationConfig = instrumentationConfig ?? {};

        const fetchInst: FetchInstrumentation = new FetchInstrumentation({
            ignoreUrls,
        });
        const xhrInst: XMLHttpRequestInstrumentation =
            new XMLHttpRequestInstrumentation({
                ignoreUrls,
            });
        const docLoadInst: DocumentLoadInstrumentation =
            new DocumentLoadInstrumentation();
        const uiInst: UserInteractionInstrumentation =
            new UserInteractionInstrumentation({
                eventNames: cfg.userInteractionEvents || ['click'],
            });

        /**
         * The most robust way across versions:
         * registerInstrumentations ensures patching is applied correctly.
         */
        registerInstrumentations({
            tracerProvider: tracerProvider,
            instrumentations: [fetchInst, xhrInst, docLoadInst, uiInst],
        });

        // Optional defensive enabling (some builds expose enable()).
        try {
            (fetchInst as any).enable?.();
        } catch {}
        try {
            (xhrInst as any).enable?.();
        } catch {}
        try {
            (docLoadInst as any).enable?.();
        } catch {}
        try {
            (uiInst as any).enable?.();
        } catch {}
    }

    function doInit(cfg: OTELConfig): void {
        try {
            if (!g.__MCP_DEVTOOLS__) {
                g.__MCP_DEVTOOLS__ = {};
            }

            /**
             * IMPORTANT:
             * We initialize OTel only once per document.
             * If already initialized, we only update the trace id (MCP-controlled).
             * Exporter/serviceName changes are intentionally ignored in-document.
             * For full changes, navigate/reload into a fresh document.
             */
            if (ns.otelInitialized === true) {
                if (idGen) {
                    idGen.setTraceId(cfg.traceId);
                }
                g.__MCP_TRACE_ID__ = normalizeTraceId(cfg.traceId);
                initialized = true;
                initError = undefined;
                return;
            }

            ensureDiag(cfg.debug);

            const traceIdNorm: string = normalizeTraceId(cfg.traceId);
            idGen = new McpIdGenerator(traceIdNorm);

            const resource: unknown = resourceFromAttributes({
                [SEMRESATTRS_SERVICE_NAME]: cfg.serviceName,
                ...(cfg.serviceVersion
                    ? { [SEMRESATTRS_SERVICE_VERSION]: cfg.serviceVersion }
                    : {}),
            });

            const spanProcessors: Array<any> = buildSpanProcessors(cfg);

            const provider: WebTracerProvider = new WebTracerProvider({
                resource: resource as any,
                idGenerator: idGen,
                spanProcessors: spanProcessors,
            });

            provider.register();

            installInstrumentations(
                provider,
                cfg.instrumentation ?? {},
                (cfg.exporter as any).url
            );

            // Optional: named tracer (doesn't affect auto-instrumentation)
            trace.getTracer(cfg.serviceName);

            ns.otelInitialized = true;
            ns.otelInitError = undefined;

            g.__MCP_TRACE_ID__ = traceIdNorm;

            initialized = true;
            initError = undefined;
        } catch (e: any) {
            const msg: string = String(e?.message ?? e);

            ns.otelInitialized = false;
            ns.otelInitError = msg;

            initialized = false;
            initError = msg;
        }
    }

    function doSetTraceId(traceId: string): void {
        const tid: string = normalizeTraceId(traceId);

        if (idGen) {
            idGen.setTraceId(tid);
        }

        g.__MCP_TRACE_ID__ = tid;
    }

    function doGetTraceId(): string {
        if (idGen) {
            return idGen.getTraceId();
        }
        if (typeof g.__MCP_TRACE_ID__ === 'string' && g.__MCP_TRACE_ID__) {
            return String(g.__MCP_TRACE_ID__).toLowerCase();
        }
        return normalizeTraceId(randomHex(16));
    }

    function doIsInitialized(): boolean {
        return ns.otelInitialized === true && initialized === true;
    }

    function doGetInitError(): string | undefined {
        const v: unknown = ns.otelInitError ?? initError;
        if (typeof v === 'string' && v.trim()) {
            return v;
        }
        return undefined;
    }

    const controller: McpOtelController = {
        init: (cfg: OTELConfig): void => {
            doInit(cfg);
        },
        setTraceId: (traceId: string): void => {
            doSetTraceId(traceId);
        },
        getTraceId: (): string => {
            return doGetTraceId();
        },
        isInitialized: (): boolean => {
            return doIsInitialized();
        },
        getInitError: (): string | undefined => {
            return doGetInitError();
        },
    };

    g.__mcpOtel = controller;
})();
