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
