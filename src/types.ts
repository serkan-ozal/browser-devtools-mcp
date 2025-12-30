export enum ConsoleMessageLevelName {
    ALL = 'all',
    DEBUG = 'debug',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

export enum ConsoleMessageLevelCode {
    ALL = -1,
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
}

export const ConsoleMessageLevel: Record<
    ConsoleMessageLevelName,
    { code: ConsoleMessageLevelCode }
> = {
    [ConsoleMessageLevelName.ALL]: { code: ConsoleMessageLevelCode.ALL },
    [ConsoleMessageLevelName.DEBUG]: { code: ConsoleMessageLevelCode.DEBUG },
    [ConsoleMessageLevelName.INFO]: { code: ConsoleMessageLevelCode.INFO },
    [ConsoleMessageLevelName.WARNING]: {
        code: ConsoleMessageLevelCode.WARNING,
    },
    [ConsoleMessageLevelName.ERROR]: { code: ConsoleMessageLevelCode.ERROR },
} as const;

export type ConsoleMessage = {
    type: string;
    text: string;
    level: {
        name: ConsoleMessageLevelName;
        code: ConsoleMessageLevelCode;
    };
    location?: {
        url: string;
        lineNumber: number;
        columnNumber: number;
    };
    timestamp: number;
    sequenceNumber: number;
};

export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
    HEAD = 'HEAD',
    OPTIONS = 'OPTIONS',
}

export enum HttpResourceType {
    DOCUMENT = 'document',
    STYLESHEET = 'stylesheet',
    IMAGE = 'image',
    MEDIA = 'media',
    FONT = 'font',
    SCRIPT = 'script',
    TEXTTRACK = 'texttrack',
    XHR = 'xhr',
    FETCH = 'fetch',
    EVENTSOURCE = 'eventsource',
    WEBSOCKET = 'websocket',
    MANIFEST = 'manifest',
    OTHER = 'other',
}

export type HttpRequest = {
    url: string;
    method: HttpMethod;
    headers: { [key: string]: string };
    body?: string;
    resourceType: HttpResourceType;
    failure?: string;
    duration?: number;
    response?: {
        status: number;
        statusText: string;
        headers: { [key: string]: string };
        body: string;
    };
    ok: boolean;
    timestamp: number;
    sequenceNumber: number;
};
