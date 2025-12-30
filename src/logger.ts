const BANNER_TEXT = '[BROWSER-DEVTOOLS]';

let enabled: boolean = true;
let debugEnabled: boolean = process.env.DEBUG_ENABLE === 'true';

function _timeAsString(): string {
    const date: Date = new Date();
    return `${date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZoneName: 'short',
    })}`;
}

function _normalizeArgs(...args: any[]): any[] {
    if (isDebugEnabled()) {
        return args;
    } else {
        return (args || []).map((arg) => {
            if (!arg) {
                return '';
            }
            if (
                arg instanceof Error ||
                (arg.name && arg.message && arg.stack)
            ) {
                return `${arg.name}: ${arg.message}`;
            } else {
                return arg;
            }
        });
    }
}

export function enable(): void {
    enabled = true;
}

export function disable(): void {
    enabled = false;
}

export function isDebugEnabled(): boolean {
    return debugEnabled;
}

export function setDebugEnabled(enabled: boolean): void {
    debugEnabled = enabled;
}

export function debug(...args: any[]): void {
    if (!enabled) {
        return;
    }
    if (isDebugEnabled()) {
        console.debug(
            BANNER_TEXT,
            _timeAsString(),
            '|',
            'DEBUG',
            '-',
            ..._normalizeArgs(...args)
        );
    }
}

export function info(...args: any[]): void {
    if (!enabled) {
        return;
    }
    console.info(
        BANNER_TEXT,
        _timeAsString(),
        '|',
        'INFO ',
        '-',
        ..._normalizeArgs(...args)
    );
}

export function warn(...args: any[]): void {
    if (!enabled) {
        return;
    }
    console.warn(
        BANNER_TEXT,
        _timeAsString(),
        '|',
        'WARN ',
        '-',
        ..._normalizeArgs(...args)
    );
}

export function error(...args: any[]): void {
    if (!enabled) {
        return;
    }
    console.error(
        BANNER_TEXT,
        _timeAsString(),
        '|',
        'ERROR',
        '-',
        ..._normalizeArgs(...args)
    );
}

function _getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
}

export function toJson(obj: any): string {
    return JSON.stringify(obj, _getCircularReplacer());
}
