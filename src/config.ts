import path from 'path';

function _envStr(name: string): string | undefined {
    const v: string | undefined = process.env[name];
    if (!v) {
        return undefined;
    }
    const t: string = v.trim();
    return t ? t : undefined;
}

function _envInt(name: string): number | undefined {
    const v: string | undefined = _envStr(name);
    if (!v) {
        return undefined;
    }
    const n: number = Number(v);
    if (!Number.isFinite(n)) {
        return undefined;
    }
    return Math.floor(n);
}

function _envBool(name: string): boolean | undefined {
    const v: string | undefined = _envStr(name);
    if (!v) {
        return undefined;
    }
    return v === 'true';
}

function _parseKeyValueFromEnv(
    envValue: string | undefined
): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!envValue) {
        return headers;
    }

    const pairs: string[] = envValue.split(',');

    for (const pair of pairs) {
        const trimmed: string = pair.trim();
        if (!trimmed) {
            continue;
        }

        const eqIndex: number = trimmed.indexOf('=');
        if (eqIndex === -1) {
            // Invalid entry, skip
            continue;
        }

        const key: string = trimmed.slice(0, eqIndex).trim();
        const value: string = trimmed.slice(eqIndex + 1).trim();

        if (!key || !value) {
            continue;
        }

        headers[key] = value;
    }

    return headers;
}

export const PORT: number = _envInt('PORT') ?? 3000;
export const SESSION_IDLE_SECONDS: number =
    _envInt('SESSION_IDLE_SECONDS') ?? 300;
export const SESSION_IDLE_CHECK_SECONDS: number =
    _envInt('SESSION_IDLE_CHECK_SECONDS') ?? 30;
export const SESSION_CLOSE_ON_SOCKET_CLOSE: boolean =
    _envBool('SESSION_CLOSE_ON_SOCKET_CLOSE') ?? false;
export const CONSOLE_MESSAGES_BUFFER_SIZE: number =
    _envInt('CONSOLE_MESSAGES_BUFFER_SIZE') ?? 1_000;
export const HTTP_REQUESTS_BUFFER_SIZE: number =
    _envInt('HTTP_REQUESTS_BUFFER_SIZE') ?? 1_000;

// Browser Configs
export const BROWSER_HEADLESS_ENABLE: boolean =
    _envBool('BROWSER_HEADLESS_ENABLE') ?? true;
export const BROWSER_PERSISTENT_ENABLE: boolean =
    _envBool('BROWSER_PERSISTENT_ENABLE') ?? false;
export const BROWSER_PERSISTENT_USER_DATA_DIR: string =
    _envStr('BROWSER_PERSISTENT_USER_DATA_DIR') ??
    path.join(process.cwd(), 'browser-devtools-mcp');
export const BROWSER_USE_INSTALLED_ON_SYSTEM: boolean =
    _envBool('BROWSER_USE_INSTALLED_ON_SYSTEM') ?? false;
export const BROWSER_EXECUTABLE_PATH: string | undefined = _envStr(
    'BROWSER_EXECUTABLE_PATH'
);

// OpenTelemetry Configs
export const OTEL_ENABLE: boolean = _envBool('OTEL_ENABLE') ?? false;
export const OTEL_SERVICE_NAME: string =
    _envStr('OTEL_SERVICE_NAME') ?? 'frontend';
export const OTEL_SERVICE_VERSION: string | undefined = _envStr(
    'OTEL_SERVICE_VERSION'
);
export const OTEL_ASSETS_DIR: string | undefined = _envStr('OTEL_ASSETS_DIR');
export const OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS: string[] = _envStr(
    'OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS'
)?.split(',') ?? ['click'];
export const OTEL_EXPORTER_TYPE: string =
    _envStr('OTEL_EXPORTER_TYPE') ?? 'none';
export const OTEL_EXPORTER_HTTP_URL: string | undefined = _envStr(
    'OTEL_EXPORTER_HTTP_URL'
);
export const OTEL_EXPORTER_HTTP_HEADERS: Record<string, string> =
    _parseKeyValueFromEnv(_envStr('OTEL_EXPORTER_HTTP_HEADERS'));

// AWS Configs
export const AWS_REGION: string | undefined = _envStr('AWS_REGION');
export const AWS_PROFILE: string | undefined = _envStr('AWS_PROFILE');

// Amazon Bedrock Configs
export const AMAZON_BEDROCK_ENABLE: boolean =
    _envBool('AMAZON_BEDROCK_ENABLE') ?? false;
export const AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID: string | undefined = _envStr(
    'AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID'
);
export const AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID: string | undefined = _envStr(
    'AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID'
);
export const AMAZON_BEDROCK_VISION_MODEL_ID: string | undefined = _envStr(
    'AMAZON_BEDROCK_VISION_MODEL_ID'
);

// Figma Configs
export const FIGMA_ACCESS_TOKEN: string | undefined =
    _envStr('FIGMA_ACCESS_TOKEN') ?? '';
export const FIGMA_API_BASE_URL: string =
    _envStr('FIGMA_API_BASE_URL') ?? 'https://api.figma.com/v1';

// Daemon Configs
export const DAEMON_PORT: number = _envInt('DAEMON_PORT') ?? 2020;
export const DAEMON_SESSION_IDLE_SECONDS: number =
    _envInt('DAEMON_SESSION_IDLE_SECONDS') ?? 300;
export const DAEMON_SESSION_IDLE_CHECK_SECONDS: number =
    _envInt('DAEMON_SESSION_IDLE_CHECK_SECONDS') ?? 30;
