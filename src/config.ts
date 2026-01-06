export const PORT: number = Number(process.env.PORT) || 3000;
export const SESSION_IDLE_SECONDS: number =
    Number(process.env.SESSION_IDLE_SECONDS) || 300;
export const SESSION_IDLE_CHECK_SECONDS: number =
    Number(process.env.SESSION_IDLE_CHECK_SECONDS) || 30;
export const SESSION_CLOSE_ON_SOCKET_CLOSE: boolean =
    process.env.SESSION_CLOSE_ON_SOCKET_CLOSE === 'true';
export const CONSOLE_MESSAGES_BUFFER_SIZE: number =
    Number(process.env.CONSOLE_MESSAGES_BUFFER_SIZE) || 1_000;
export const HTTP_REQUESTS_BUFFER_SIZE: number =
    Number(process.env.HTTP_REQUESTS_BUFFER_SIZE) || 1_000;
export const BROWSER_EXECUTABLE_PATH: string | undefined =
    process.env.BROWSER_EXECUTABLE_PATH;
export const OTEL_ENABLE: boolean = process.env.OTEL_ENABLE === 'true';
export const OTEL_SERVICE_NAME: string =
    process.env.OTEL_SERVICE_NAME || 'frontend';
export const OTEL_SERVICE_VERSION: string | undefined =
    process.env.OTEL_SERVICE_VERSION;
export const OTEL_ASSETS_DIR: string | undefined = process.env.OTEL_ASSETS_DIR;
export const OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS: string[] = process
    .env.OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS
    ? process.env.OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS.split(',')
    : ['click'];
export const OTEL_EXPORTER_TYPE: string =
    process.env.OTEL_EXPORTER_TYPE || 'none';
export const OTEL_EXPORTER_HTTP_URL: string | undefined =
    process.env.OTEL_EXPORTER_HTTP_URL;
export const OTEL_EXPORTER_HTTP_HEADERS: Record<string, string> =
    _parseKeyValueFromEnv(process.env.OTEL_EXPORTER_HTTP_HEADERS);

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
