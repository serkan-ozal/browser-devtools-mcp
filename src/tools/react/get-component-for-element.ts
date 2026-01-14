import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

/**
 * -------------------------
 * Defaults / limits
 * -------------------------
 */
const DEFAULT_MAX_STACK_DEPTH: number = 30;
const DEFAULT_MAX_PROPS_PREVIEW_CHARS: number = 2000;
const DEFAULT_INCLUDE_PROPS_PREVIEW: boolean = true;
const DEFAULT_MAX_ELEMENT_PATH_DEPTH: number = 25;

/**
 * Fiber subtree search can be large on big pages.
 * Keep a conservative cap to avoid freezing the page.
 */
const DEFAULT_MAX_FIBER_SUBTREE_NODES_TO_SCAN: number = 50_000;

/**
 * -------------------------
 * Input / Output types
 * -------------------------
 */
export interface GetComponentForElementInput extends ToolInput {
    selector?: string;

    x?: number;

    y?: number;

    maxStackDepth?: number;

    includePropsPreview?: boolean;

    maxPropsPreviewChars?: number;
}

export type ReactComponentFrame = {
    name: string | null;
    displayName: string | null;
    kind: 'function' | 'class' | 'unknown';
    debugSource?: {
        fileName?: string;
        lineNumber?: number;
        columnNumber?: number;
    };
};

export type ReactNearestComponent = ReactComponentFrame & {
    propsPreview?: string;
};

export type ReactHostMapping = {
    /**
     * Whether the initial fiber pointer was found directly on the target element.
     */
    fiberOnTargetElement: boolean;

    /**
     * DOM element where we found the fiber pointer (target or ancestor).
     */
    anchorDomHint: string | null;

    /**
     * A short DOM hint for the target element.
     */
    targetDomHint: string | null;

    /**
     * Whether we successfully mapped the target DOM element to a host fiber
     * by scanning the ancestor fiber subtree for fiber.stateNode === targetEl.
     */
    hostFiberMatchedTarget: boolean;

    /**
     * How many fiber nodes were scanned while searching for the host fiber.
     */
    subtreeScanNodesScanned: number;

    /**
     * Hard cap used for subtree scan.
     */
    subtreeScanMaxNodes: number;

    /**
     * Strategy summary string.
     */
    strategy:
        | 'direct-on-target'
        | 'ancestor-subtree-scan'
        | 'ancestor-fallback';
};

export type WrapperFrameHit = {
    /**
     * Wrapper label (normalized)
     */
    wrapper: string;

    /**
     * Index in componentStack array (0 = nearest component frame)
     */
    frameIndex: number;

    /**
     * Human-readable label for the frame at that index
     */
    frameLabel: string;
};

export interface GetComponentForElementOutput extends ToolOutput {
    target: {
        selector: string | null;
        point: { x: number | null; y: number | null };
        found: boolean;
        domHint: string | null;
        elementPath: string | null;
    };

    react: {
        detected: boolean;
        detectionReason: string;
        fiberKey: string | null;

        hostMapping: ReactHostMapping;

        nearestComponent: ReactNearestComponent | null;
        componentStack: ReactComponentFrame[];
        componentStackText: string;

        wrappersDetected: string[];
        wrapperFrames: WrapperFrameHit[];

        notes: string[];
    };
}

export class GetComponentForElement implements Tool {
    name(): string {
        return 'react_get-component-for-element';
    }

    description(): string {
        return `
Finds the React component(s) associated with a DOM element using React Fiber (best-effort).

How it works:
- Resolve a DOM element by CSS selector OR by (x,y) using elementFromPoint()
- Attempt to locate React Fiber pointers on that element (e.g. __reactFiber$*)
- If not present, walk up ancestor elements to find the nearest React-owned host node

Key correctness fix:
- If fiber is found on an ANCESTOR element, we scan that fiber subtree to locate the EXACT host fiber
  where fiber.stateNode === target DOM element, then build the component stack from that host fiber.
  This reduces unrelated components appearing in the returned stack.

What to expect (important for AI debugging):
- React Fiber is not a public API; results are best-effort and can differ by build (dev/prod).
- Component names may come from displayName, wrappers, third-party libraries, or minified production builds.
- wrappersDetected/wrapperFrames help interpret memo/forwardRef/context boundaries that can otherwise look confusing.
- If hostMapping.strategy is "ancestor-fallback", the stack may include unrelated frames; try a more specific selector
  or target a deeper DOM node to improve mapping accuracy.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .optional()
                .describe(
                    'CSS selector for the target element. If provided, takes precedence over x/y.'
                ),
            x: z
                .number()
                .int()
                .optional()
                .describe(
                    'Viewport X coordinate in CSS pixels. Used when selector is not provided.'
                ),
            y: z
                .number()
                .int()
                .optional()
                .describe(
                    'Viewport Y coordinate in CSS pixels. Used when selector is not provided.'
                ),
            maxStackDepth: z
                .number()
                .int()
                .positive()
                .optional()
                .default(DEFAULT_MAX_STACK_DEPTH)
                .describe(
                    'Maximum number of component frames to return in the component stack.'
                ),
            includePropsPreview: z
                .boolean()
                .optional()
                .default(DEFAULT_INCLUDE_PROPS_PREVIEW)
                .describe(
                    'If true, includes a best-effort, truncated props preview for the nearest component.'
                ),
            maxPropsPreviewChars: z
                .number()
                .int()
                .positive()
                .optional()
                .default(DEFAULT_MAX_PROPS_PREVIEW_CHARS)
                .describe(
                    'Maximum characters for props preview (after safe stringification).'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            target: z.object({
                selector: z.string().nullable(),
                point: z.object({
                    x: z.number().int().nullable(),
                    y: z.number().int().nullable(),
                }),
                found: z.boolean(),
                domHint: z.string().nullable(),
                elementPath: z.string().nullable(),
            }),
            react: z.object({
                detected: z.boolean(),
                detectionReason: z.string(),
                fiberKey: z.string().nullable(),
                hostMapping: z.object({
                    fiberOnTargetElement: z
                        .boolean()
                        .describe(
                            'Whether the initial fiber pointer was found directly on the target element.'
                        ),
                    anchorDomHint: z
                        .string()
                        .nullable()
                        .describe(
                            'DOM hint of the element where fiber pointer was found (target or ancestor).'
                        ),
                    targetDomHint: z
                        .string()
                        .nullable()
                        .describe('DOM hint of the actual target element.'),
                    hostFiberMatchedTarget: z
                        .boolean()
                        .describe(
                            'Whether we found the exact host fiber for target element (fiber.stateNode === targetEl) via subtree scan.'
                        ),
                    subtreeScanNodesScanned: z
                        .number()
                        .int()
                        .describe(
                            'Number of fiber nodes scanned during subtree search.'
                        ),
                    subtreeScanMaxNodes: z
                        .number()
                        .int()
                        .describe(
                            'Maximum fiber nodes allowed to scan (safety cap).'
                        ),
                    strategy: z
                        .enum([
                            'direct-on-target',
                            'ancestor-subtree-scan',
                            'ancestor-fallback',
                        ])
                        .describe(
                            'Mapping strategy used to produce the final stack.'
                        ),
                }),
                nearestComponent: z
                    .object({
                        name: z.string().nullable(),
                        displayName: z.string().nullable(),
                        kind: z.enum(['function', 'class', 'unknown']),
                        debugSource: z
                            .object({
                                fileName: z.string().optional(),
                                lineNumber: z.number().int().optional(),
                                columnNumber: z.number().int().optional(),
                            })
                            .optional(),
                        propsPreview: z.string().optional(),
                    })
                    .nullable(),
                componentStack: z.array(
                    z.object({
                        name: z.string().nullable(),
                        displayName: z.string().nullable(),
                        kind: z.enum(['function', 'class', 'unknown']),
                        debugSource: z
                            .object({
                                fileName: z.string().optional(),
                                lineNumber: z.number().int().optional(),
                                columnNumber: z.number().int().optional(),
                            })
                            .optional(),
                    })
                ),
                componentStackText: z.string(),
                wrappersDetected: z.array(z.string()),
                wrapperFrames: z.array(
                    z.object({
                        wrapper: z.string(),
                        frameIndex: z.number().int(),
                        frameLabel: z.string(),
                    })
                ),
                notes: z.array(z.string()),
            }),
        };
    }

    async handle(
        context: McpSessionContext,
        args: GetComponentForElementInput
    ): Promise<GetComponentForElementOutput> {
        const selector: string | undefined =
            typeof args.selector === 'string' && args.selector.trim()
                ? args.selector.trim()
                : undefined;

        const x: number | undefined =
            typeof args.x === 'number' && Number.isFinite(args.x)
                ? Math.floor(args.x)
                : undefined;

        const y: number | undefined =
            typeof args.y === 'number' && Number.isFinite(args.y)
                ? Math.floor(args.y)
                : undefined;

        if (!selector) {
            if (typeof x !== 'number' || typeof y !== 'number') {
                throw new Error(
                    'Provide either selector, or both x and y for elementFromPoint.'
                );
            }
        }

        const maxStackDepth: number =
            typeof args.maxStackDepth === 'number' && args.maxStackDepth > 0
                ? Math.floor(args.maxStackDepth)
                : DEFAULT_MAX_STACK_DEPTH;

        const includePropsPreview: boolean =
            args.includePropsPreview === undefined
                ? DEFAULT_INCLUDE_PROPS_PREVIEW
                : args.includePropsPreview === true;

        const maxPropsPreviewChars: number =
            typeof args.maxPropsPreviewChars === 'number' &&
            Number.isFinite(args.maxPropsPreviewChars) &&
            args.maxPropsPreviewChars > 0
                ? Math.floor(args.maxPropsPreviewChars)
                : DEFAULT_MAX_PROPS_PREVIEW_CHARS;

        const result: any = await context.page.evaluate(
            ({
                selectorEval,
                xEval,
                yEval,
                maxStackDepthEval,
                includePropsPreviewEval,
                maxPropsPreviewCharsEval,
                maxElementPathDepthEval,
                maxFiberNodesToScanEval,
            }: {
                selectorEval: string | null;
                xEval: number | null;
                yEval: number | null;
                maxStackDepthEval: number;
                includePropsPreviewEval: boolean;
                maxPropsPreviewCharsEval: number;
                maxElementPathDepthEval: number;
                maxFiberNodesToScanEval: number;
            }): any => {
                const notes: string[] = [];

                function domHint(el: Element | null): string | null {
                    if (!el) {
                        return null;
                    }
                    const tag: string = el.tagName.toLowerCase();
                    const idVal: string =
                        (el as HTMLElement).id && (el as HTMLElement).id.trim()
                            ? '#' + (el as HTMLElement).id.trim()
                            : '';
                    const clsRaw: string =
                        typeof (el as HTMLElement).className === 'string'
                            ? (el as HTMLElement).className
                            : '';
                    const cls: string = clsRaw
                        ? '.' + clsRaw.trim().split(/\s+/).slice(0, 4).join('.')
                        : '';
                    return tag + idVal + cls;
                }

                function buildElementPath(
                    el: Element | null,
                    maxDepth: number
                ): string | null {
                    if (!el) {
                        return null;
                    }

                    const parts: string[] = [];
                    let cur: Element | null = el;
                    let depth: number = 0;

                    while (cur && depth < maxDepth) {
                        const tag: string = cur.tagName
                            ? cur.tagName.toLowerCase()
                            : 'unknown';

                        const idVal: string =
                            (cur as HTMLElement).id &&
                            (cur as HTMLElement).id.trim()
                                ? '#' + (cur as HTMLElement).id.trim()
                                : '';

                        const clsRaw: string =
                            typeof (cur as HTMLElement).className === 'string'
                                ? (cur as HTMLElement).className
                                : '';
                        const clsList: string[] = clsRaw
                            ? clsRaw
                                  .trim()
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 3)
                            : [];
                        const cls: string =
                            clsList.length > 0 ? '.' + clsList.join('.') : '';

                        let nth: string = '';
                        try {
                            const parent: Element | null = cur.parentElement;
                            if (parent) {
                                const siblings: Element[] = Array.from(
                                    parent.children
                                ).filter((c: Element): boolean => {
                                    return c.tagName === cur!.tagName;
                                });
                                if (siblings.length > 1) {
                                    const idx: number =
                                        siblings.indexOf(cur) + 1;
                                    if (idx > 0) {
                                        nth = `:nth-of-type(${idx})`;
                                    }
                                }
                            }
                        } catch {
                            // ignore
                        }

                        parts.push(`${tag}${idVal}${cls}${nth}`);
                        cur = cur.parentElement;
                        depth++;
                    }

                    parts.reverse();
                    return parts.join(' > ');
                }

                function findFiberKeyOn(el: any): string | null {
                    if (!el) {
                        return null;
                    }

                    const keys: string[] = Object.getOwnPropertyNames(el);
                    for (const k of keys) {
                        if (k.startsWith('__reactFiber$')) {
                            return k;
                        }
                        if (k.startsWith('__reactInternalInstance$')) {
                            return k;
                        }
                    }
                    return null;
                }

                function findFiberForElement(start: Element | null): {
                    fiber: any;
                    fiberKey: string | null;
                    onTarget: boolean;
                    anchorEl: Element;
                } | null {
                    if (!start) {
                        return null;
                    }

                    const directKey: string | null = findFiberKeyOn(
                        start as any
                    );
                    if (directKey) {
                        const fiber: any = (start as any)[directKey];
                        if (fiber) {
                            return {
                                fiber,
                                fiberKey: directKey,
                                onTarget: true,
                                anchorEl: start,
                            };
                        }
                    }

                    let cur: Element | null = start;
                    while (cur) {
                        const k: string | null = findFiberKeyOn(cur as any);
                        if (k) {
                            const fiber: any = (cur as any)[k];
                            if (fiber) {
                                return {
                                    fiber,
                                    fiberKey: k,
                                    onTarget: false,
                                    anchorEl: cur,
                                };
                            }
                        }
                        cur = cur.parentElement;
                    }

                    return null;
                }

                /**
                 * If fiber was found on an ancestor element, scan that fiber subtree
                 * to locate the exact host fiber where fiber.stateNode === targetEl.
                 *
                 * This improves stack correctness and avoids unrelated frames.
                 */
                function findHostFiberForDomElement(
                    subtreeRootFiber: any,
                    targetEl: Element | null,
                    maxNodesToScan: number
                ): { hostFiber: any | null; scanned: number; found: boolean } {
                    if (!subtreeRootFiber) {
                        return { hostFiber: null, scanned: 0, found: false };
                    }

                    if (subtreeRootFiber.stateNode === targetEl) {
                        return {
                            hostFiber: subtreeRootFiber,
                            scanned: 1,
                            found: true,
                        };
                    }

                    const queue: any[] = [];
                    const visited: Set<any> = new Set<any>();

                    queue.push(subtreeRootFiber);
                    visited.add(subtreeRootFiber);

                    let scanned: number = 0;

                    while (queue.length > 0) {
                        const f: any = queue.shift();
                        scanned++;

                        if (f && f.stateNode === targetEl) {
                            return { hostFiber: f, scanned, found: true };
                        }

                        if (scanned >= maxNodesToScan) {
                            return { hostFiber: null, scanned, found: false };
                        }

                        const child: any = f ? f.child : null;
                        if (child && !visited.has(child)) {
                            visited.add(child);
                            queue.push(child);
                        }

                        const sibling: any = f ? f.sibling : null;
                        if (sibling && !visited.has(sibling)) {
                            visited.add(sibling);
                            queue.push(sibling);
                        }
                    }

                    return { hostFiber: null, scanned, found: false };
                }

                function isClassComponentType(t: any): boolean {
                    if (!t) {
                        return false;
                    }
                    const proto: any = t.prototype;
                    return Boolean(proto && proto.isReactComponent);
                }

                function typeDisplayName(t: any): string | null {
                    if (!t) {
                        return null;
                    }
                    if (typeof t === 'function') {
                        const dn: any = (t as any).displayName;
                        if (typeof dn === 'string' && dn.trim()) {
                            return dn.trim();
                        }
                        if (typeof t.name === 'string' && t.name.trim()) {
                            return t.name.trim();
                        }
                        return 'Anonymous';
                    }

                    if (typeof t === 'object') {
                        const dn: any = (t as any).displayName;
                        if (typeof dn === 'string' && dn.trim()) {
                            return dn.trim();
                        }
                        const render: any = (t as any).render;
                        if (typeof render === 'function') {
                            const rdn: any = (render as any).displayName;
                            if (typeof rdn === 'string' && rdn.trim()) {
                                return rdn.trim();
                            }
                            if (
                                typeof render.name === 'string' &&
                                render.name.trim()
                            ) {
                                return render.name.trim();
                            }
                            return 'Anonymous';
                        }
                    }

                    return null;
                }

                function typeName(t: any): string | null {
                    if (!t) {
                        return null;
                    }
                    if (typeof t === 'function') {
                        if (typeof t.name === 'string' && t.name.trim()) {
                            return t.name.trim();
                        }
                        return null;
                    }
                    if (typeof t === 'object') {
                        const render: any = (t as any).render;
                        if (typeof render === 'function') {
                            if (
                                typeof render.name === 'string' &&
                                render.name.trim()
                            ) {
                                return render.name.trim();
                            }
                        }
                        return null;
                    }
                    return null;
                }

                function unwrapType(t: any): any {
                    if (!t) {
                        return t;
                    }
                    if (typeof t === 'object') {
                        const render: any = (t as any).render;
                        if (typeof render === 'function') {
                            return render;
                        }
                    }
                    return t;
                }

                function isMeaningfulComponentFiber(f: any): boolean {
                    if (!f) {
                        return false;
                    }
                    const t: any = unwrapType(f.type ?? f.elementType);
                    if (typeof t === 'function') {
                        return true;
                    }
                    return false;
                }

                function inferKind(f: any): 'function' | 'class' | 'unknown' {
                    if (!f) {
                        return 'unknown';
                    }
                    const t: any = unwrapType(f.type ?? f.elementType);
                    if (typeof t === 'function') {
                        if (isClassComponentType(t)) {
                            return 'class';
                        }
                        return 'function';
                    }
                    return 'unknown';
                }

                function getDebugSource(f: any): any | undefined {
                    const ds: any = f ? (f as any)._debugSource : undefined;
                    if (!ds || typeof ds !== 'object') {
                        return undefined;
                    }
                    const out: any = {};
                    if (typeof ds.fileName === 'string') {
                        out.fileName = ds.fileName;
                    }
                    if (typeof ds.lineNumber === 'number') {
                        out.lineNumber = ds.lineNumber;
                    }
                    if (typeof ds.columnNumber === 'number') {
                        out.columnNumber = ds.columnNumber;
                    }
                    return Object.keys(out).length > 0 ? out : undefined;
                }

                function safeStringify(v: any, maxChars: number): string {
                    const seen: WeakSet<object> = new WeakSet<object>();

                    function helper(x: any, depth: number): any {
                        if (x === null) {
                            return null;
                        }
                        const t: string = typeof x;

                        if (t === 'string') {
                            return x.length > 500 ? x.slice(0, 500) + '…' : x;
                        }
                        if (t === 'number' || t === 'boolean') {
                            return x;
                        }
                        if (t === 'bigint') {
                            return String(x);
                        }
                        if (t === 'undefined') {
                            return undefined;
                        }
                        if (t === 'function') {
                            return '[function]';
                        }
                        if (t === 'symbol') {
                            return String(x);
                        }

                        if (t === 'object') {
                            if (x instanceof Element) {
                                return (
                                    '[Element ' +
                                    (x.tagName ? x.tagName.toLowerCase() : '') +
                                    ']'
                                );
                            }
                            if (x instanceof Window) {
                                return '[Window]';
                            }
                            if (x instanceof Document) {
                                return '[Document]';
                            }
                            if (x instanceof Date) {
                                return x.toISOString();
                            }

                            if (seen.has(x)) {
                                return '[circular]';
                            }
                            seen.add(x);

                            if (Array.isArray(x)) {
                                if (depth <= 0) {
                                    return '[array len=' + x.length + ']';
                                }
                                return x.slice(0, 20).map((it: any): any => {
                                    return helper(it, depth - 1);
                                });
                            }

                            if (depth <= 0) {
                                return '[object]';
                            }

                            const out: Record<string, any> = {};
                            const keys: string[] = Object.keys(x).slice(0, 40);
                            for (const k of keys) {
                                try {
                                    out[k] = helper((x as any)[k], depth - 1);
                                } catch {
                                    out[k] = '[unreadable]';
                                }
                            }
                            return out;
                        }

                        return String(x);
                    }

                    let s: string = '';
                    try {
                        s = JSON.stringify(helper(v, 2));
                    } catch {
                        try {
                            s = String(v);
                        } catch {
                            s = '[unserializable]';
                        }
                    }

                    if (s.length > maxChars) {
                        return s.slice(0, maxChars) + '…(truncated)';
                    }
                    return s;
                }

                function stackTextFromFrames(frames: any[]): string {
                    const names: string[] = frames
                        .map((f: any): string => {
                            const dn: unknown = f?.displayName;
                            const nm: unknown = f?.name;
                            if (typeof dn === 'string' && dn.trim()) {
                                return dn.trim();
                            }
                            if (typeof nm === 'string' && nm.trim()) {
                                return nm.trim();
                            }
                            return 'Anonymous';
                        })
                        .filter((x: string): boolean => {
                            return Boolean(x);
                        });

                    return names.reverse().join(' > ');
                }

                function frameFromFiber(f: any): ReactComponentFrame {
                    const t: any = unwrapType(f.type ?? f.elementType);
                    const name: string | null = typeName(t);
                    const displayName: string | null = typeDisplayName(t);
                    const kind: 'function' | 'class' | 'unknown' = inferKind(f);
                    const debugSource: any | undefined = getDebugSource(f);

                    const frame: any = { name, displayName, kind };

                    if (debugSource) {
                        frame.debugSource = debugSource;
                    }

                    return frame as ReactComponentFrame;
                }

                function makeFrameKey(frame: ReactComponentFrame): string {
                    const dn: string = frame.displayName
                        ? frame.displayName
                        : '';
                    const nm: string = frame.name ? frame.name : '';
                    const src: any = frame.debugSource;
                    const srcKey: string =
                        src && typeof src === 'object'
                            ? `${String(src.fileName ?? '')}:${String(
                                  src.lineNumber ?? ''
                              )}:${String(src.columnNumber ?? '')}`
                            : '';
                    return `${dn}|${nm}|${frame.kind}|${srcKey}`;
                }

                function collapseConsecutiveDuplicates(
                    frames: ReactComponentFrame[]
                ): ReactComponentFrame[] {
                    const out: ReactComponentFrame[] = [];
                    let lastKey: string | null = null;

                    for (const f of frames) {
                        const k: string = makeFrameKey(f);
                        if (lastKey && k === lastKey) {
                            continue;
                        }
                        out.push(f);
                        lastKey = k;
                    }

                    return out;
                }

                function detectWrappers(
                    frames: ReactComponentFrame[]
                ): string[] {
                    const found: Set<string> = new Set<string>();

                    function canonicalAdd(key: string): void {
                        const v: string = key.trim().toLowerCase();
                        if (v) {
                            found.add(v);
                        }
                    }

                    for (const f of frames) {
                        const label: string =
                            typeof f.displayName === 'string' &&
                            f.displayName.trim()
                                ? f.displayName.trim()
                                : typeof f.name === 'string' && f.name.trim()
                                  ? f.name.trim()
                                  : '';

                        if (!label) {
                            continue;
                        }

                        const l: string = label.toLowerCase();

                        if (/^memo(\(|$)/i.test(label)) {
                            canonicalAdd('memo');
                        }
                        if (l.includes('forwardref')) {
                            canonicalAdd('forwardref');
                        }
                        if (l.includes('.provider')) {
                            canonicalAdd('context-provider');
                        }
                        if (l.includes('.consumer')) {
                            canonicalAdd('context-consumer');
                        }
                        if (l.includes('suspense')) {
                            canonicalAdd('suspense');
                        }
                        if (l.includes('fragment')) {
                            canonicalAdd('fragment');
                        }
                        if (l.includes('strictmode')) {
                            canonicalAdd('strictmode');
                        }
                        if (l.includes('profiler')) {
                            canonicalAdd('profiler');
                        }
                    }

                    const out: string[] = Array.from(found);
                    out.sort((a: string, b: string): number => {
                        if (a < b) {
                            return -1;
                        }
                        if (a > b) {
                            return 1;
                        }
                        return 0;
                    });
                    return out;
                }

                function findWrapperFrames(
                    frames: ReactComponentFrame[],
                    wrappersDetected: string[]
                ): WrapperFrameHit[] {
                    const out: WrapperFrameHit[] = [];
                    const wrappers: Set<string> = new Set<string>(
                        wrappersDetected.map((w: string): string =>
                            w.toLowerCase()
                        )
                    );

                    for (let i: number = 0; i < frames.length; i++) {
                        const f: ReactComponentFrame = frames[i];
                        const label: string =
                            f.displayName && f.displayName.trim()
                                ? f.displayName.trim()
                                : f.name && f.name.trim()
                                  ? f.name.trim()
                                  : 'Anonymous';

                        const l: string = label.toLowerCase();

                        for (const w of wrappers) {
                            let hit: boolean = false;

                            if (w === 'memo') {
                                hit = /^memo(\(|$)/i.test(label);
                            } else if (w === 'forwardref') {
                                hit = l.includes('forwardref');
                            } else if (w === 'context-provider') {
                                hit = l.includes('.provider');
                            } else if (w === 'context-consumer') {
                                hit = l.includes('.consumer');
                            } else if (w === 'suspense') {
                                hit = l.includes('suspense');
                            } else if (w === 'fragment') {
                                hit = l.includes('fragment');
                            } else if (w === 'strictmode') {
                                hit = l.includes('strictmode');
                            } else if (w === 'profiler') {
                                hit = l.includes('profiler');
                            }

                            if (hit) {
                                out.push({
                                    wrapper: w,
                                    frameIndex: i,
                                    frameLabel: label,
                                });
                            }
                        }
                    }

                    return out;
                }

                // Resolve target element
                let targetEl: Element | null = null;
                if (selectorEval && selectorEval.trim()) {
                    try {
                        targetEl = document.querySelector(selectorEval);
                    } catch {
                        targetEl = null;
                    }
                } else if (
                    typeof xEval === 'number' &&
                    typeof yEval === 'number'
                ) {
                    targetEl = document.elementFromPoint(xEval, yEval);
                }

                const foundEl: boolean = Boolean(targetEl);
                const targetHint: string | null = domHint(targetEl);
                const elementPath: string | null = buildElementPath(
                    targetEl,
                    maxElementPathDepthEval
                );

                if (!foundEl) {
                    const hostMapping: ReactHostMapping = {
                        fiberOnTargetElement: false,
                        anchorDomHint: null,
                        targetDomHint: null,
                        hostFiberMatchedTarget: false,
                        subtreeScanNodesScanned: 0,
                        subtreeScanMaxNodes: maxFiberNodesToScanEval,
                        strategy: 'ancestor-fallback',
                    };

                    return {
                        target: {
                            selector: selectorEval ?? null,
                            point: {
                                x: typeof xEval === 'number' ? xEval : null,
                                y: typeof yEval === 'number' ? yEval : null,
                            },
                            found: false,
                            domHint: null,
                            elementPath: null,
                        },
                        react: {
                            detected: false,
                            detectionReason: 'Target element not found.',
                            fiberKey: null,
                            hostMapping,
                            nearestComponent: null,
                            componentStack: [],
                            componentStackText: '',
                            wrappersDetected: [],
                            wrapperFrames: [],
                            notes: [
                                'No DOM element could be resolved; cannot inspect React.',
                            ],
                        },
                    };
                }

                // Find a fiber pointer (maybe on target, maybe on ancestor)
                const fiberHit: {
                    fiber: any;
                    fiberKey: string | null;
                    onTarget: boolean;
                    anchorEl: Element;
                } | null = findFiberForElement(targetEl);

                if (!fiberHit) {
                    notes.push(
                        'No React fiber pointer found on the element or its ancestors.'
                    );
                    notes.push(
                        'This can happen if the page is not React, uses a different renderer, or runs with hardened/minified internals.'
                    );

                    const hostMapping: ReactHostMapping = {
                        fiberOnTargetElement: false,
                        anchorDomHint: null,
                        targetDomHint: targetHint,
                        hostFiberMatchedTarget: false,
                        subtreeScanNodesScanned: 0,
                        subtreeScanMaxNodes: maxFiberNodesToScanEval,
                        strategy: 'ancestor-fallback',
                    };

                    return {
                        target: {
                            selector: selectorEval ?? null,
                            point: {
                                x: typeof xEval === 'number' ? xEval : null,
                                y: typeof yEval === 'number' ? yEval : null,
                            },
                            found: true,
                            domHint: targetHint,
                            elementPath,
                        },
                        react: {
                            detected: false,
                            detectionReason:
                                'React fiber not found on element/ancestors.',
                            fiberKey: null,
                            hostMapping,
                            nearestComponent: null,
                            componentStack: [],
                            componentStackText: '',
                            wrappersDetected: [],
                            wrapperFrames: [],
                            notes,
                        },
                    };
                }

                // Determine the best "host fiber" to build the stack from.
                let hostFiber: any = fiberHit.fiber;
                let hostMatch: boolean = fiberHit.onTarget;
                let subtreeScanned: number = 0;

                const anchorHint: string | null = domHint(fiberHit.anchorEl);

                let strategy: ReactHostMapping['strategy'] = 'direct-on-target';

                if (!fiberHit.onTarget) {
                    strategy = 'ancestor-fallback';

                    const scanRes: {
                        hostFiber: any | null;
                        scanned: number;
                        found: boolean;
                    } = findHostFiberForDomElement(
                        fiberHit.fiber,
                        targetEl,
                        maxFiberNodesToScanEval
                    );

                    subtreeScanned = scanRes.scanned;

                    if (scanRes.found && scanRes.hostFiber) {
                        hostFiber = scanRes.hostFiber;
                        hostMatch = true;
                        strategy = 'ancestor-subtree-scan';
                        notes.push(
                            `Mapped target DOM element to host fiber by scanning fiber subtree (scanned=${subtreeScanned}).`
                        );
                    } else {
                        hostMatch = false;
                        notes.push(
                            `Could not find exact host fiber for the target element in the ancestor fiber subtree (scanned=${subtreeScanned}). Falling back to ancestor fiber stack; some frames may be unrelated.`
                        );
                    }
                }

                const hostMapping: ReactHostMapping = {
                    fiberOnTargetElement: fiberHit.onTarget,
                    anchorDomHint: anchorHint,
                    targetDomHint: targetHint,
                    hostFiberMatchedTarget: hostMatch,
                    subtreeScanNodesScanned: subtreeScanned,
                    subtreeScanMaxNodes: maxFiberNodesToScanEval,
                    strategy,
                };

                // Find nearest meaningful component above the host fiber.
                let nearest: any | null = null;
                let cur: any | null = hostFiber;

                while (cur) {
                    if (isMeaningfulComponentFiber(cur)) {
                        nearest = cur;
                        break;
                    }
                    cur = cur.return ?? null;
                }

                if (!nearest) {
                    notes.push(
                        'Fiber was found, but no meaningful function/class component was detected in the return chain.'
                    );
                }

                // Build stack (from nearest up) using return chain
                const stack: ReactComponentFrame[] = [];
                const seenFibers: Set<any> = new Set<any>();
                let stackCur: any | null = nearest;

                while (stackCur && stack.length < maxStackDepthEval) {
                    if (seenFibers.has(stackCur)) {
                        notes.push(
                            'Detected a cycle in fiber.return chain; stopping stack traversal.'
                        );
                        break;
                    }
                    seenFibers.add(stackCur);

                    if (isMeaningfulComponentFiber(stackCur)) {
                        stack.push(frameFromFiber(stackCur));
                    }

                    stackCur = stackCur.return ?? null;
                }

                const collapsedStack: ReactComponentFrame[] =
                    stack.length > 0
                        ? collapseConsecutiveDuplicates(stack)
                        : [];

                const componentStackText: string =
                    stackTextFromFrames(collapsedStack);
                const wrappersDetected: string[] =
                    detectWrappers(collapsedStack);
                const wrapperFrames: WrapperFrameHit[] = findWrapperFrames(
                    collapsedStack,
                    wrappersDetected
                );

                if (wrappersDetected.length >= 3) {
                    notes.push(
                        `Wrapper-heavy stack detected (${wrappersDetected.join(
                            ', '
                        )}). Interpreting nearestComponent may require skipping wrappers.`
                    );
                }

                // Props preview (best-effort)
                let nearestOut: any | null = null;
                if (nearest) {
                    nearestOut = frameFromFiber(nearest);
                    if (includePropsPreviewEval) {
                        try {
                            const props: any = (nearest as any).memoizedProps;
                            if (props !== undefined) {
                                nearestOut.propsPreview = safeStringify(
                                    props,
                                    maxPropsPreviewCharsEval
                                );
                            } else {
                                notes.push(
                                    'memoizedProps not available on nearest component fiber.'
                                );
                            }
                        } catch {
                            notes.push(
                                'Failed to read memoizedProps for nearest component (best-effort).'
                            );
                        }
                    }
                }

                notes.push(
                    'React Fiber inspection uses non-public internals; fields are best-effort.'
                );
                notes.push(
                    'Component names may come from displayName, wrappers, third-party libraries, or minified production builds.'
                );

                if (strategy === 'ancestor-fallback') {
                    notes.push(
                        'Host mapping fallback was used; consider selecting a deeper/more specific DOM element for a more accurate component stack.'
                    );
                }

                const detectionReason: string =
                    strategy === 'direct-on-target'
                        ? 'React fiber found on the target element.'
                        : strategy === 'ancestor-subtree-scan'
                          ? 'React fiber found on an ancestor; exact host fiber located via subtree scan.'
                          : 'React fiber found on an ancestor; exact host fiber not found, stack may include unrelated frames.';

                return {
                    target: {
                        selector: selectorEval ?? null,
                        point: {
                            x: typeof xEval === 'number' ? xEval : null,
                            y: typeof yEval === 'number' ? yEval : null,
                        },
                        found: true,
                        domHint: targetHint,
                        elementPath,
                    },
                    react: {
                        detected: true,
                        detectionReason,
                        fiberKey: fiberHit.fiberKey,
                        hostMapping,
                        nearestComponent: nearestOut,
                        componentStack: collapsedStack,
                        componentStackText,
                        wrappersDetected,
                        wrapperFrames,
                        notes,
                    },
                };
            },
            {
                selectorEval: selector ?? null,
                xEval: typeof x === 'number' ? x : null,
                yEval: typeof y === 'number' ? y : null,
                maxStackDepthEval: maxStackDepth,
                includePropsPreviewEval: includePropsPreview,
                maxPropsPreviewCharsEval: maxPropsPreviewChars,
                maxElementPathDepthEval: DEFAULT_MAX_ELEMENT_PATH_DEPTH,
                maxFiberNodesToScanEval:
                    DEFAULT_MAX_FIBER_SUBTREE_NODES_TO_SCAN,
            }
        );

        return result as GetComponentForElementOutput;
    }
}
