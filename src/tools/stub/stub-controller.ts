import picomatch from 'picomatch';

import type { BrowserContext, Route, Request as PwRequest } from 'playwright';

export type StubId = string;

export enum StubKind {
    MOCK_HTTP_RESPONSE = 'mock_http_response',
    INTERCEPT_HTTP_REQUEST = 'intercept_http_request',
}

export type Matcher = (input: string) => boolean;

export type StubMockHttpResponse = {
    kind: StubKind.MOCK_HTTP_RESPONSE;
    id: StubId;
    enabled: boolean;

    pattern: string;
    matcher: Matcher;

    action: 'fulfill' | 'abort';

    status?: number;
    headers?: Record<string, string>;
    body?: string;

    /**
     * If action='abort', Playwright errorCode.
     * Common values: 'failed', 'aborted', 'timedout', 'accessdenied'
     */
    abortErrorCode?: string;

    delayMs: number;
    times: number; // -1 => infinite
    usedCount: number;

    /**
     * If set, 0..1 chance to apply. Undefined means always apply.
     */
    chance?: number;
};

export type StubInterceptHttpRequest = {
    kind: StubKind.INTERCEPT_HTTP_REQUEST;
    id: StubId;
    enabled: boolean;

    pattern: string;
    matcher: Matcher;

    modifications: {
        headers?: Record<string, string>;
        body?: string;
        method?: string;
    };

    delayMs: number;
    times: number; // -1 => infinite
    usedCount: number;
};

export type AnyStub = StubMockHttpResponse | StubInterceptHttpRequest;

type ContextStore = {
    stubs: Array<AnyStub>;
    installed: boolean;
};

const STORE_BY_CONTEXT: WeakMap<BrowserContext, ContextStore> = new WeakMap<
    BrowserContext,
    ContextStore
>();

function _ensureStore(ctx: BrowserContext): ContextStore {
    const existing: ContextStore | undefined = STORE_BY_CONTEXT.get(ctx);
    if (existing) {
        return existing;
    }

    const created: ContextStore = { stubs: [], installed: false };
    STORE_BY_CONTEXT.set(ctx, created);
    return created;
}

function _nowId(): string {
    const t: number = Date.now();
    const r: number = Math.floor(Math.random() * 1_000_000);
    return `${t.toString(36)}-${r.toString(36)}`;
}

async function _sleep(ms: number): Promise<void> {
    if (ms <= 0) {
        return;
    }

    await new Promise((resolve: (value: void) => void): void => {
        setTimeout((): void => resolve(), ms);
    });
}

function _normalizeTimes(times?: number): number {
    if (typeof times !== 'number') {
        return -1;
    }
    if (!Number.isFinite(times)) {
        return -1;
    }
    if (times <= 0) {
        return -1;
    }
    return Math.floor(times);
}

function _isTimesRemaining(times: number, usedCount: number): boolean {
    if (times === -1) {
        return true;
    }
    return usedCount < times;
}

function _normalizeChance(chance?: number): number | undefined {
    if (typeof chance !== 'number') {
        return undefined;
    }
    if (!Number.isFinite(chance)) {
        return undefined;
    }
    return Math.max(0, Math.min(1, chance));
}

function _shouldApplyChance(chance?: number): boolean {
    if (chance === undefined) {
        return true;
    }
    if (chance <= 0) {
        return false;
    }
    if (chance >= 1) {
        return true;
    }
    return Math.random() < chance;
}

function _compileMatcher(pattern: string): Matcher {
    const p: string = pattern.trim();
    if (!p) {
        return (): boolean => false;
    }

    return picomatch(p, {
        dot: true,
        nocase: false,
    });
}

function _pickStub(stubs: Array<AnyStub>, url: string): AnyStub | undefined {
    for (const s of stubs) {
        if (!s.enabled) {
            continue;
        }
        if (!_isTimesRemaining(s.times, s.usedCount)) {
            continue;
        }
        if (!s.matcher(url)) {
            continue;
        }
        if (s.kind === StubKind.MOCK_HTTP_RESPONSE) {
            if (!_shouldApplyChance(s.chance)) {
                continue;
            }
        }
        return s;
    }
    return undefined;
}

async function _applyStub(route: Route, stub: AnyStub): Promise<void> {
    const req: PwRequest = route.request();

    stub.usedCount++;

    if (stub.delayMs > 0) {
        await _sleep(stub.delayMs);
    }

    if (stub.kind === StubKind.MOCK_HTTP_RESPONSE) {
        if (stub.action === 'abort') {
            const code: string = stub.abortErrorCode ?? 'failed';
            await route.abort(code as any);
            return;
        }

        const status: number =
            typeof stub.status === 'number' ? stub.status : 200;
        const headers: Record<string, string> = stub.headers ?? {};
        const body: string = typeof stub.body === 'string' ? stub.body : '';

        await route.fulfill({
            status,
            headers,
            body,
        });
        return;
    } else if (stub.kind === StubKind.INTERCEPT_HTTP_REQUEST) {
        const headers: Record<string, string> = {
            ...req.headers(),
            ...(stub.modifications.headers ?? {}),
        };

        const overrides: Record<string, any> = {
            headers,
        };

        if (
            typeof stub.modifications.method === 'string' &&
            stub.modifications.method.trim()
        ) {
            overrides.method = stub.modifications.method.trim().toUpperCase();
        }

        if (typeof stub.modifications.body === 'string') {
            overrides.postData = stub.modifications.body;
        }

        await route.continue(overrides);
        return;
    }

    await route.continue();
}

export async function ensureRoutingInstalled(
    ctx: BrowserContext
): Promise<void> {
    const store: ContextStore = _ensureStore(ctx);
    if (store.installed) {
        return;
    }

    await ctx.route('**/*', async (route: Route): Promise<void> => {
        const url: string = route.request().url();
        const innerStore: ContextStore = _ensureStore(ctx);

        const stub: AnyStub | undefined = _pickStub(innerStore.stubs, url);
        if (!stub) {
            await route.continue();
            return;
        }

        try {
            await _applyStub(route, stub);
        } finally {
            if (!_isTimesRemaining(stub.times, stub.usedCount)) {
                innerStore.stubs = innerStore.stubs.filter(
                    (x: AnyStub): boolean => x.id !== stub.id
                );
            }
        }
    });

    store.installed = true;
}

export function addMockHttpResponseStub(
    ctx: BrowserContext,
    input: Omit<StubMockHttpResponse, 'kind' | 'id' | 'usedCount' | 'matcher'>
): StubMockHttpResponse {
    const store: ContextStore = _ensureStore(ctx);

    const stub: StubMockHttpResponse = {
        ...input,
        kind: StubKind.MOCK_HTTP_RESPONSE,
        id: _nowId(),
        usedCount: 0,
        matcher: _compileMatcher(input.pattern),
        times: _normalizeTimes(input.times),
        delayMs: Math.max(0, Math.floor(input.delayMs)),
        chance: _normalizeChance(input.chance),
    };

    store.stubs.push(stub);
    return stub;
}

export function addHttpInterceptRequestStub(
    ctx: BrowserContext,
    input: Omit<
        StubInterceptHttpRequest,
        'kind' | 'id' | 'usedCount' | 'matcher'
    >
): StubInterceptHttpRequest {
    const store: ContextStore = _ensureStore(ctx);

    const stub: StubInterceptHttpRequest = {
        ...input,
        kind: StubKind.INTERCEPT_HTTP_REQUEST,
        id: _nowId(),
        usedCount: 0,
        matcher: _compileMatcher(input.pattern),
        times: _normalizeTimes(input.times),
        delayMs: Math.max(0, Math.floor(input.delayMs)),
    };

    store.stubs.push(stub);
    return stub;
}

export function clearStub(ctx: BrowserContext, id?: string): number {
    const store: ContextStore = _ensureStore(ctx);

    if (!id) {
        const n: number = store.stubs.length;
        store.stubs = [];
        return n;
    }

    const before: number = store.stubs.length;
    store.stubs = store.stubs.filter((s: AnyStub): boolean => s.id !== id);
    return before - store.stubs.length;
}

export function listStubs(ctx: BrowserContext): Array<AnyStub> {
    const store: ContextStore = _ensureStore(ctx);
    return [...store.stubs];
}

export function normalizeDelayMs(delayMs?: number): number {
    if (typeof delayMs !== 'number') {
        return 0;
    }
    if (!Number.isFinite(delayMs)) {
        return 0;
    }
    if (delayMs <= 0) {
        return 0;
    }
    return Math.floor(delayMs);
}

export function normalizeTimesPublic(times?: number): number {
    return _normalizeTimes(times);
}

export function normalizeHeaders(
    headers?: Record<string, string>
): Record<string, string> | undefined {
    if (!headers) {
        return undefined;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        out[String(k)] = String(v);
    }
    return out;
}

export function normalizeBody(body?: string | object): string | undefined {
    if (typeof body === 'string') {
        return body;
    }
    if (body && typeof body === 'object') {
        return JSON.stringify(body);
    }
    return undefined;
}

export function normalizeAbortCode(code?: string): string | undefined {
    if (typeof code !== 'string') {
        return undefined;
    }
    const v: string = code.trim();
    if (!v) {
        return undefined;
    }
    return v;
}

export function normalizeMethod(method?: string): string | undefined {
    if (typeof method !== 'string') {
        return undefined;
    }
    const v: string = method.trim();
    if (!v) {
        return undefined;
    }
    return v.toUpperCase();
}

export function normalizeChance(chance?: number): number | undefined {
    return _normalizeChance(chance);
}
