import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

/**
 * -----------------------------------------------------------------------------
 * Defaults
 * -----------------------------------------------------------------------------
 *
 * Notes:
 * - Keep defaults conservative to avoid huge outputs and runaway fiber traversals.
 * - All constants are explicitly typed to match your code style.
 */
const DEFAULT_MATCH_STRATEGY: 'exact' | 'contains' = 'contains';
const DEFAULT_MAX_ELEMENTS: number = 200;
const DEFAULT_ONLY_VISIBLE: boolean = true;
const DEFAULT_ONLY_IN_VIEWPORT: boolean = true;
const DEFAULT_TEXT_PREVIEW_MAX_LENGTH: number = 80;

// Search / output controls
const DEFAULT_MAX_MATCHES: number = 5;
const DEFAULT_STACK_LIMIT: number = 50;

// Internal safety caps (avoid runaway traversal / DOM scanning costs)
const INTERNAL_MAX_ROOTS_SCAN: number = 20;
const INTERNAL_MAX_FIBERS_VISITED: number = 250_000;

/**
 * -----------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------
 */

export interface GetElementForComponentInput extends ToolInput {
    /**
     * Anchor selector (DOM CSS selector) used to pick a concrete instance on the page.
     * This is NOT React-specific; it's a normal DOM selector used as a reference point.
     */
    anchorSelector?: string;

    /**
     * Anchor point in viewport coordinates. Used when selector is unavailable.
     */
    anchorX?: number;
    anchorY?: number;

    /**
     * Component name / displayName to search in Fiber graph.
     * Useful when you know the component from source code.
     */
    componentName?: string;

    /**
     * How to match componentName.
     */
    matchStrategy?: 'exact' | 'contains';

    /**
     * Best-effort debug source matching (mostly available in dev builds).
     * Typically endsWith matching works best (e.g., "UserCard.tsx").
     */
    fileNameHint?: string;

    /**
     * Optional line number hint to improve accuracy in dev builds.
     */
    lineNumber?: number;

    /**
     * Maximum number of DOM elements to return from the selected component subtree.
     */
    maxElements?: number;

    /**
     * If true, return only elements that are visually visible.
     */
    onlyVisible?: boolean;

    /**
     * If true, return only elements intersecting the viewport.
     */
    onlyInViewport?: boolean;

    /**
     * Max length for text preview extracted from each element.
     */
    textPreviewMaxLength?: number;

    /**
     * Maximum number of matching component fibers to consider.
     * The tool returns the "best" one as `component` and lists candidates in `candidates`.
     */
    maxMatches?: number;
}

type BoundingBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type ElementSummary = {
    tagName: string;
    id: string | null;
    className: string | null;

    selectorHint: string | null;
    textPreview: string | null;

    boundingBox: BoundingBox | null;
    isVisible: boolean;
    isInViewport: boolean;
};

type DebugSource = {
    fileName: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
};

type MatchedComponent = {
    name: string | null;
    displayName: string | null;

    /**
     * Best-effort debug source info (dev builds).
     *
     * IMPORTANT:
     * - React DevTools can sometimes show "Rendered by" source info even when fiber._debugSource is null.
     * - That DevTools UI can be derived from stack traces and sourcemaps, not necessarily fiber fields.
     */
    debugSource: DebugSource | null;

    /**
     * Chain from the matched fiber up to the root (best-effort).
     */
    componentStack: string[];

    /**
     * How we picked the target fiber.
     */
    selection: 'anchor' | 'query' | 'query+anchor' | 'unknown';

    /**
     * Extra hints to understand why this candidate was chosen.
     */
    scoring?: {
        score: number;
        nameMatched: boolean;
        debugSourceMatched: boolean;
        anchorRelated: boolean;
        proximityPx?: number | null;
    };
};

type CandidateComponent = MatchedComponent & {
    /**
     * Number of host DOM elements discovered under this component (after filters).
     */
    domFootprintCount: number;
};

export interface GetElementForComponentOutput extends ToolOutput {
    /**
     * Whether React DevTools hook was detected.
     * Note: even if false, the tool may still work (best-effort) via DOM-attached fiber pointers.
     */
    reactDetected: boolean;

    /**
     * True if the tool believes React Fiber pointers are present on DOM nodes.
     */
    fiberDetected: boolean;

    /**
     * How roots were discovered:
     * - devtools-hook: via __REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots
     * - dom-fiber-scan: via scanning DOM nodes for __reactFiber$ keys (best-effort)
     * - none: no roots found (tool can still work with anchor-only)
     */
    rootDiscovery: 'devtools-hook' | 'dom-fiber-scan' | 'none';

    /**
     * Details about which component fiber we ended up selecting.
     */
    component: MatchedComponent | null;

    /**
     * Other matching candidates (best-effort), ranked best-first.
     */
    candidates: CandidateComponent[];

    /**
     * DOM elements that belong to the selected component subtree (host fibers).
     */
    elements: ElementSummary[];

    /**
     * Human-readable notes about limitations / best-effort behavior.
     */
    notes: string[];
}

export class GetElementForComponent implements Tool {
    name(): string {
        return 'react_get-element-for-component';
    }

    description(): string {
        return `
Maps a React COMPONENT INSTANCE to the DOM elements it renders (its "DOM footprint") by traversing the React Fiber graph.

Selection strategy:
- Best: provide an anchor (anchorSelector OR anchorX/anchorY) to target the correct instance near that UI.
- Optionally provide a query (componentName and/or fileNameHint/lineNumber) to search the Fiber graph.
- If both anchor + query are provided, we rank candidates and pick the best match near the anchor.

Important behavior:
- The React DevTools hook is helpful but NOT strictly required.
  - If hook exists, roots are discovered reliably via getFiberRoots().
  - If hook doesn't exist, we fall back to scanning the DOM for __reactFiber$ pointers (best-effort).
- Query search returns multiple candidates (up to maxMatches) and ranks them.
- Debug source information is best-effort and may be missing even in dev builds depending on bundler/build flags.

Operational note for MCP users:
- If you are using a persistent/headful browser and want more reliable root discovery and component search,
  install the "React Developer Tools" Chrome extension in that browser profile (manual step by the user).
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            anchorSelector: z
                .string()
                .optional()
                .describe(
                    'DOM CSS selector used as an anchor to pick a concrete component instance near that element.'
                ),
            anchorX: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe('Anchor X coordinate (viewport pixels).'),
            anchorY: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe('Anchor Y coordinate (viewport pixels).'),
            componentName: z
                .string()
                .optional()
                .describe(
                    'React component name/displayName to search in the Fiber graph.'
                ),
            matchStrategy: z
                .enum(['exact', 'contains'])
                .optional()
                .default(DEFAULT_MATCH_STRATEGY)
                .describe(
                    'How to match componentName against Fiber type/displayName.'
                ),
            fileNameHint: z
                .string()
                .optional()
                .describe(
                    'Best-effort debug source file hint (usually endsWith match), e.g., "UserCard.tsx".'
                ),
            lineNumber: z
                .number()
                .int()
                .positive()
                .optional()
                .describe(
                    'Optional debug source line number hint (dev builds only).'
                ),
            maxElements: z
                .number()
                .int()
                .positive()
                .optional()
                .default(DEFAULT_MAX_ELEMENTS)
                .describe(
                    'Maximum number of DOM elements to return from the selected component subtree.'
                ),
            onlyVisible: z
                .boolean()
                .optional()
                .default(DEFAULT_ONLY_VISIBLE)
                .describe(
                    'If true, only visually visible elements are returned.'
                ),
            onlyInViewport: z
                .boolean()
                .optional()
                .default(DEFAULT_ONLY_IN_VIEWPORT)
                .describe(
                    'If true, only elements intersecting the viewport are returned.'
                ),
            textPreviewMaxLength: z
                .number()
                .int()
                .positive()
                .optional()
                .default(DEFAULT_TEXT_PREVIEW_MAX_LENGTH)
                .describe(
                    'Max length for per-element text preview (innerText/textContent/aria-label).'
                ),
            maxMatches: z
                .number()
                .int()
                .positive()
                .optional()
                .default(DEFAULT_MAX_MATCHES)
                .describe(
                    'Max number of matching component candidates to return/rank.'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            reactDetected: z
                .boolean()
                .describe(
                    'True if __REACT_DEVTOOLS_GLOBAL_HOOK__ looks available.'
                ),
            fiberDetected: z
                .boolean()
                .describe(
                    'True if DOM appears to contain React Fiber pointers (__reactFiber$...).'
                ),
            rootDiscovery: z
                .enum(['devtools-hook', 'dom-fiber-scan', 'none'])
                .describe('How roots were discovered.'),
            component: z
                .object({
                    name: z.string().nullable(),
                    displayName: z.string().nullable(),
                    debugSource: z
                        .object({
                            fileName: z.string().nullable(),
                            lineNumber: z.number().int().nullable(),
                            columnNumber: z.number().int().nullable(),
                        })
                        .nullable(),
                    componentStack: z.array(z.string()),
                    selection: z.enum([
                        'anchor',
                        'query',
                        'query+anchor',
                        'unknown',
                    ]),
                    scoring: z
                        .object({
                            score: z.number(),
                            nameMatched: z.boolean(),
                            debugSourceMatched: z.boolean(),
                            anchorRelated: z.boolean(),
                            proximityPx: z.number().nullable().optional(),
                        })
                        .optional(),
                })
                .nullable(),
            candidates: z
                .array(
                    z.object({
                        name: z.string().nullable(),
                        displayName: z.string().nullable(),
                        debugSource: z
                            .object({
                                fileName: z.string().nullable(),
                                lineNumber: z.number().int().nullable(),
                                columnNumber: z.number().int().nullable(),
                            })
                            .nullable(),
                        componentStack: z.array(z.string()),
                        selection: z.enum([
                            'anchor',
                            'query',
                            'query+anchor',
                            'unknown',
                        ]),
                        scoring: z
                            .object({
                                score: z.number(),
                                nameMatched: z.boolean(),
                                debugSourceMatched: z.boolean(),
                                anchorRelated: z.boolean(),
                                proximityPx: z.number().nullable().optional(),
                            })
                            .optional(),
                        domFootprintCount: z.number().int(),
                    })
                )
                .describe('Ranked candidate matches (best-first).'),
            elements: z.array(
                z.object({
                    tagName: z.string(),
                    id: z.string().nullable(),
                    className: z.string().nullable(),
                    selectorHint: z.string().nullable(),
                    textPreview: z.string().nullable(),
                    boundingBox: z
                        .object({
                            x: z.number(),
                            y: z.number(),
                            width: z.number(),
                            height: z.number(),
                        })
                        .nullable(),
                    isVisible: z.boolean(),
                    isInViewport: z.boolean(),
                })
            ),
            notes: z.array(z.string()),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: GetElementForComponentInput
    ): Promise<GetElementForComponentOutput> {
        const anchorSelector: string | undefined = args.anchorSelector;
        const anchorX: number | undefined = args.anchorX;
        const anchorY: number | undefined = args.anchorY;

        const componentName: string | undefined = args.componentName;
        const matchStrategy: 'exact' | 'contains' =
            args.matchStrategy ?? DEFAULT_MATCH_STRATEGY;

        const fileNameHint: string | undefined = args.fileNameHint;
        const lineNumber: number | undefined = args.lineNumber;

        const maxElements: number = args.maxElements ?? DEFAULT_MAX_ELEMENTS;
        const onlyVisible: boolean = args.onlyVisible ?? DEFAULT_ONLY_VISIBLE;
        const onlyInViewport: boolean =
            args.onlyInViewport ?? DEFAULT_ONLY_IN_VIEWPORT;

        const textPreviewMaxLength: number =
            args.textPreviewMaxLength ?? DEFAULT_TEXT_PREVIEW_MAX_LENGTH;

        const maxMatches: number = args.maxMatches ?? DEFAULT_MAX_MATCHES;

        const hasAnchorSelector: boolean =
            typeof anchorSelector === 'string' &&
            anchorSelector.trim().length > 0;

        const hasAnchorPoint: boolean =
            typeof anchorX === 'number' && typeof anchorY === 'number';

        const hasQuery: boolean =
            (typeof componentName === 'string' &&
                componentName.trim().length > 0) ||
            (typeof fileNameHint === 'string' &&
                fileNameHint.trim().length > 0) ||
            typeof lineNumber === 'number';

        if (!hasAnchorSelector && !hasAnchorPoint && !hasQuery) {
            throw new Error(
                'Provide at least one targeting method: anchorSelector, (anchorX+anchorY), or componentName/debugSource hints.'
            );
        }

        const result: GetElementForComponentOutput =
            await context.page.evaluate(
                ({
                    anchorSelectorEval,
                    anchorXEval,
                    anchorYEval,
                    componentNameEval,
                    matchStrategyEval,
                    fileNameHintEval,
                    lineNumberEval,
                    maxElementsEval,
                    onlyVisibleEval,
                    onlyInViewportEval,
                    textPreviewMaxLengthEval,
                    maxMatchesEval,
                    maxRootsScan,
                    maxFibersVisited,
                    stackLimit,
                }: {
                    anchorSelectorEval: string | undefined;
                    anchorXEval: number | undefined;
                    anchorYEval: number | undefined;
                    componentNameEval: string | undefined;
                    matchStrategyEval: 'exact' | 'contains';
                    fileNameHintEval: string | undefined;
                    lineNumberEval: number | undefined;
                    maxElementsEval: number;
                    onlyVisibleEval: boolean;
                    onlyInViewportEval: boolean;
                    textPreviewMaxLengthEval: number;
                    maxMatchesEval: number;
                    maxRootsScan: number;
                    maxFibersVisited: number;
                    stackLimit: number;
                }): GetElementForComponentOutput => {
                    /**
                     * -----------------------------------------------------------------
                     * Helpers (run in the browser page context)
                     * -----------------------------------------------------------------
                     */
                    const notes: string[] = [];
                    type AnyFiber = any;

                    function isElement(v: unknown): v is Element {
                        return (
                            typeof Element !== 'undefined' &&
                            v instanceof Element
                        );
                    }

                    function normalizeStr(v: unknown): string | null {
                        if (typeof v !== 'string') {
                            return null;
                        }

                        const t: string = v.trim();
                        if (!t) {
                            return null;
                        }

                        return t;
                    }

                    /**
                     * React attaches internal keys like:
                     * - __reactFiber$<random>
                     * - __reactInternalInstance$<random> (older)
                     */
                    function getFiberFromDomElement(
                        el: Element
                    ): AnyFiber | null {
                        const anyEl: any = el as any;
                        const keys: string[] = Object.keys(anyEl);

                        for (const k of keys) {
                            if (k.startsWith('__reactFiber$')) {
                                const f: AnyFiber = anyEl[k];
                                if (f) {
                                    return f;
                                }
                            }
                        }

                        for (const k of keys) {
                            if (k.startsWith('__reactInternalInstance$')) {
                                const f: AnyFiber = anyEl[k];
                                if (f) {
                                    return f;
                                }
                            }
                        }

                        return null;
                    }

                    /**
                     * DevTools hook provides reliable Fiber roots via getFiberRoots().
                     * If it's missing, we can still try to use DOM fiber pointers (best-effort),
                     * but component search becomes less reliable.
                     */
                    function getDevtoolsHook(): any | null {
                        const g: any = globalThis as any;
                        const hook: any = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                        if (!hook) {
                            return null;
                        }
                        if (typeof hook.getFiberRoots !== 'function') {
                            return null;
                        }
                        return hook;
                    }

                    function getAllRootsFromHook(hook: any): AnyFiber[] {
                        const roots: AnyFiber[] = [];
                        const renderers: any = hook.renderers;

                        if (
                            !renderers ||
                            typeof renderers.forEach !== 'function'
                        ) {
                            return roots;
                        }

                        renderers.forEach(
                            (_renderer: any, rendererId: any): void => {
                                try {
                                    const set: any =
                                        hook.getFiberRoots(rendererId);
                                    if (
                                        set &&
                                        typeof set.forEach === 'function'
                                    ) {
                                        set.forEach((root: AnyFiber): void => {
                                            if (root) {
                                                roots.push(root);
                                            }
                                        });
                                    }
                                } catch {
                                    // ignore
                                }
                            }
                        );

                        return roots.slice(0, maxRootsScan);
                    }

                    /**
                     * DOM-only fallback: find a few fiber pointers by scanning the DOM.
                     * This provides seed fibers even without the DevTools hook.
                     */
                    function getSeedFibersFromDomScan(
                        maxSeeds: number
                    ): AnyFiber[] {
                        const out: AnyFiber[] = [];
                        const els: Element[] = Array.from(
                            document.querySelectorAll('*')
                        );

                        const step: number =
                            els.length > 5000
                                ? Math.ceil(els.length / 5000)
                                : 1;

                        for (let i: number = 0; i < els.length; i += step) {
                            const el: Element = els[i];
                            const f: AnyFiber | null =
                                getFiberFromDomElement(el);
                            if (f) {
                                out.push(f);
                                if (out.length >= maxSeeds) {
                                    break;
                                }
                            }
                        }

                        return out;
                    }

                    function getFunctionDisplayName(
                        fn: unknown
                    ): string | null {
                        if (typeof fn !== 'function') {
                            return null;
                        }

                        const anyFn: any = fn as any;

                        const dn: string | null = normalizeStr(
                            anyFn.displayName
                        );
                        if (dn) {
                            return dn;
                        }

                        const nm: string | null = normalizeStr(anyFn.name);
                        if (nm) {
                            return nm;
                        }

                        return null;
                    }

                    function getFiberTypeName(fiber: AnyFiber): string | null {
                        if (!fiber) {
                            return null;
                        }

                        const t: any = fiber.type ?? fiber.elementType ?? null;
                        if (!t) {
                            return null;
                        }

                        if (typeof t === 'function') {
                            return getFunctionDisplayName(t);
                        }

                        if (typeof t === 'string') {
                            return t; // host component name
                        }

                        const dn: string | null = normalizeStr(
                            (t as any).displayName
                        );
                        if (dn) {
                            return dn;
                        }

                        return normalizeStr((t as any).name);
                    }

                    function getDisplayName(fiber: AnyFiber): string | null {
                        if (!fiber) {
                            return null;
                        }

                        const t: any = fiber.type ?? fiber.elementType ?? null;
                        if (!t) {
                            return null;
                        }

                        const dn: string | null = normalizeStr(
                            (t as any).displayName
                        );
                        if (dn) {
                            return dn;
                        }

                        return getFiberTypeName(fiber);
                    }

                    /**
                     * Best-effort debug source extraction.
                     *
                     * IMPORTANT:
                     * Even when React DevTools shows "Rendered by <file>:<line>",
                     * fiber._debugSource can still be null because DevTools may derive source
                     * via stack traces + sourcemaps and keep that mapping internally.
                     */
                    function getDebugSource(
                        fiber: AnyFiber
                    ): DebugSource | null {
                        const seen: Set<any> = new Set<any>();
                        const queue: any[] = [];

                        const push = (x: any): void => {
                            if (!x) {
                                return;
                            }
                            if (seen.has(x)) {
                                return;
                            }
                            seen.add(x);
                            queue.push(x);
                        };

                        push(fiber);
                        push(fiber?.alternate);

                        // Walk a few owners up (best-effort)
                        for (let i: number = 0; i < 8; i++) {
                            const f: any = queue[i];
                            if (!f) {
                                break;
                            }
                            push(f?._debugOwner);
                            push(f?._debugOwner?.alternate);
                        }

                        for (const f of queue) {
                            const src: any =
                                f?._debugSource ??
                                f?._debugOwner?._debugSource ??
                                f?.type?._debugSource ??
                                f?.elementType?._debugSource ??
                                null;

                            if (!src) {
                                continue;
                            }

                            const fileName: string | null =
                                normalizeStr(src.fileName) ?? null;

                            const lineNumber: number | null =
                                typeof src.lineNumber === 'number'
                                    ? (src.lineNumber as number)
                                    : null;

                            const columnNumber: number | null =
                                typeof src.columnNumber === 'number'
                                    ? (src.columnNumber as number)
                                    : null;

                            if (
                                fileName ||
                                lineNumber !== null ||
                                columnNumber !== null
                            ) {
                                return { fileName, lineNumber, columnNumber };
                            }
                        }

                        return null;
                    }

                    function isHostFiber(fiber: AnyFiber): boolean {
                        const sn: any = fiber?.stateNode;
                        return isElement(sn);
                    }

                    /**
                     * Build a best-effort component stack from selected fiber up to root.
                     * We prefer non-host fibers for readability, but fall back to include hosts if needed.
                     */
                    function buildComponentStack(
                        fiber: AnyFiber,
                        limit: number
                    ): string[] {
                        const out: string[] = [];
                        let cur: AnyFiber | null = fiber ?? null;

                        for (let i: number = 0; i < limit; i++) {
                            if (!cur) {
                                break;
                            }

                            const name: string | null = getDisplayName(cur);
                            const host: boolean = isHostFiber(cur);

                            if (name && !host) {
                                out.push(name);
                            }

                            cur = cur.return ?? null;
                        }

                        if (out.length === 0) {
                            cur = fiber ?? null;

                            for (let i: number = 0; i < limit; i++) {
                                if (!cur) {
                                    break;
                                }

                                const name: string | null = getDisplayName(cur);
                                if (name) {
                                    out.push(name);
                                }

                                cur = cur.return ?? null;
                            }
                        }

                        // De-dupe consecutive duplicates (wrappers can repeat)
                        const deduped: string[] = [];
                        for (const n of out) {
                            if (deduped.length === 0) {
                                deduped.push(n);
                            } else {
                                if (deduped[deduped.length - 1] !== n) {
                                    deduped.push(n);
                                }
                            }
                        }

                        return deduped;
                    }

                    function firstMeaningfulComponentAbove(
                        fiber: AnyFiber
                    ): AnyFiber | null {
                        let cur: AnyFiber | null = fiber ?? null;
                        const visited: Set<any> = new Set<any>();

                        while (cur) {
                            const key: any = cur.alternate ?? cur;
                            if (visited.has(key)) {
                                break;
                            }
                            visited.add(key);

                            if (!isHostFiber(cur)) {
                                return cur;
                            }

                            cur = cur.return ?? null;
                        }

                        return null;
                    }

                    function matchesName(
                        candidate: string | null,
                        query: string,
                        strategy: 'exact' | 'contains'
                    ): boolean {
                        if (!candidate) {
                            return false;
                        }

                        const a: string = candidate.trim();
                        const b: string = query.trim();

                        if (!a || !b) {
                            return false;
                        }

                        if (strategy === 'exact') {
                            return a === b;
                        }

                        return a.toLowerCase().includes(b.toLowerCase());
                    }

                    function matchesDebugSource(
                        fiber: AnyFiber,
                        fileNameHint: string | undefined,
                        lineNumber: number | undefined
                    ): boolean {
                        const src: DebugSource | null = getDebugSource(fiber);
                        if (!src) {
                            return false;
                        }

                        if (fileNameHint) {
                            const hint: string = fileNameHint.trim();
                            if (hint) {
                                const fn: string = (src.fileName ?? '').trim();
                                if (!fn) {
                                    return false;
                                }

                                const fnLower: string = fn.toLowerCase();
                                const hintLower: string = hint.toLowerCase();

                                const ok: boolean =
                                    fnLower.endsWith(hintLower) ||
                                    fnLower.includes(hintLower);

                                if (!ok) {
                                    return false;
                                }
                            }
                        }

                        if (typeof lineNumber === 'number') {
                            if (src.lineNumber === null) {
                                return false;
                            }

                            // Allow small drift due to transforms
                            const delta: number = Math.abs(
                                (src.lineNumber as number) - lineNumber
                            );

                            if (delta > 3) {
                                return false;
                            }
                        }

                        return true;
                    }

                    /**
                     * Roots can be either:
                     * - a "root object" containing .current
                     * - a fiber itself
                     *
                     * We start from root.current.child to avoid getting stuck at the HostRoot wrapper.
                     */
                    function toStartFiber(
                        rootOrFiber: AnyFiber
                    ): AnyFiber | null {
                        if (!rootOrFiber) {
                            return null;
                        }

                        const maybeCurrent: AnyFiber | undefined =
                            rootOrFiber.current;
                        if (maybeCurrent) {
                            return maybeCurrent.child ?? maybeCurrent;
                        }

                        return rootOrFiber;
                    }

                    function pickAnchorElement(
                        anchorSelector: string | undefined,
                        x: number | undefined,
                        y: number | undefined
                    ): Element | null {
                        if (anchorSelector && anchorSelector.trim()) {
                            const el: Element | null =
                                document.querySelector(anchorSelector);
                            if (!el) {
                                notes.push(
                                    `anchorSelector did not match any element: ${anchorSelector}`
                                );
                                return null;
                            }
                            return el;
                        }

                        if (typeof x === 'number' && typeof y === 'number') {
                            const el: Element | null =
                                document.elementFromPoint(x, y);
                            if (!el) {
                                notes.push(
                                    `anchorPoint did not hit any element: (${x}, ${y})`
                                );
                                return null;
                            }
                            return el;
                        }

                        return null;
                    }

                    function selectorHintFor(el: Element): string | null {
                        const dt: string | null =
                            normalizeStr(el.getAttribute('data-testid')) ??
                            normalizeStr(el.getAttribute('data-test-id')) ??
                            normalizeStr(el.getAttribute('data-test')) ??
                            null;

                        if (dt) {
                            return `[data-testid='${dt.replace(/'/g, "\\'")}']`;
                        }

                        const ds: string | null =
                            normalizeStr(el.getAttribute('data-selector')) ??
                            null;

                        if (ds) {
                            return `[data-selector='${ds.replace(/'/g, "\\'")}']`;
                        }

                        if (el.id) {
                            try {
                                return `#${CSS.escape(el.id)}`;
                            } catch {
                                return `#${el.id}`;
                            }
                        }

                        return el.tagName.toLowerCase();
                    }

                    function textPreviewFor(
                        el: Element,
                        maxLen: number
                    ): string | null {
                        const aria: string | null =
                            normalizeStr(el.getAttribute('aria-label')) ?? null;

                        if (aria) {
                            return aria.slice(0, maxLen);
                        }

                        const txt: string = String(
                            (el as any).innerText ?? el.textContent ?? ''
                        ).trim();

                        if (!txt) {
                            return null;
                        }

                        return txt.slice(0, maxLen);
                    }

                    function computeRuntime(el: Element): {
                        boundingBox: BoundingBox | null;
                        isVisible: boolean;
                        isInViewport: boolean;
                        centerX: number;
                        centerY: number;
                    } {
                        const r: DOMRect = el.getBoundingClientRect();
                        const s: CSSStyleDeclaration = getComputedStyle(el);

                        const isVisible: boolean =
                            s.display !== 'none' &&
                            s.visibility !== 'hidden' &&
                            parseFloat(s.opacity || '1') > 0 &&
                            r.width > 0 &&
                            r.height > 0;

                        const vw: number = window.innerWidth;
                        const vh: number = window.innerHeight;

                        const isInViewport: boolean =
                            r.right > 0 &&
                            r.bottom > 0 &&
                            r.left < vw &&
                            r.top < vh;

                        const boundingBox: BoundingBox | null =
                            Number.isFinite(r.x) &&
                            Number.isFinite(r.y) &&
                            Number.isFinite(r.width) &&
                            Number.isFinite(r.height)
                                ? {
                                      x: r.x,
                                      y: r.y,
                                      width: r.width,
                                      height: r.height,
                                  }
                                : null;

                        const centerX: number = r.left + r.width / 2;
                        const centerY: number = r.top + r.height / 2;

                        return {
                            boundingBox,
                            isVisible,
                            isInViewport,
                            centerX,
                            centerY,
                        };
                    }

                    function collectDomElementsFromFiberSubtree(
                        fiber: AnyFiber,
                        maxElements: number,
                        onlyVisible: boolean,
                        onlyInViewport: boolean,
                        textPreviewMaxLength: number
                    ): ElementSummary[] {
                        const out: ElementSummary[] = [];
                        const seen: Set<Element> = new Set<Element>();

                        const stack: AnyFiber[] = [];
                        if (fiber) {
                            stack.push(fiber);
                        }

                        const visited: Set<any> = new Set<any>();

                        while (stack.length > 0) {
                            if (out.length >= maxElements) {
                                break;
                            }

                            const f: AnyFiber | undefined = stack.pop();
                            if (!f) {
                                continue;
                            }

                            const key: any = f.alternate ?? f;
                            if (visited.has(key)) {
                                continue;
                            }
                            visited.add(key);

                            if (isHostFiber(f)) {
                                const el: Element = f.stateNode as Element;

                                if (!seen.has(el)) {
                                    seen.add(el);

                                    const rt: {
                                        boundingBox: BoundingBox | null;
                                        isVisible: boolean;
                                        isInViewport: boolean;
                                        centerX: number;
                                        centerY: number;
                                    } = computeRuntime(el);

                                    if (onlyVisible && !rt.isVisible) {
                                        // skip
                                    } else {
                                        if (
                                            onlyInViewport &&
                                            !rt.isInViewport
                                        ) {
                                            // skip
                                        } else {
                                            const tagName: string =
                                                el.tagName.toLowerCase();

                                            const id: string | null = el.id
                                                ? String(el.id)
                                                : null;

                                            const classNameRaw: unknown = (
                                                el as any
                                            ).className;
                                            const className: string | null =
                                                typeof classNameRaw === 'string'
                                                    ? classNameRaw.trim()
                                                        ? classNameRaw.trim()
                                                        : null
                                                    : null;

                                            out.push({
                                                tagName,
                                                id,
                                                className,
                                                selectorHint:
                                                    selectorHintFor(el),
                                                textPreview: textPreviewFor(
                                                    el,
                                                    textPreviewMaxLength
                                                ),
                                                boundingBox: rt.boundingBox,
                                                isVisible: rt.isVisible,
                                                isInViewport: rt.isInViewport,
                                            });
                                        }
                                    }
                                }
                            }

                            const child: AnyFiber | null = f.child ?? null;
                            const sibling: AnyFiber | null = f.sibling ?? null;

                            if (child) {
                                stack.push(child);
                            }
                            if (sibling) {
                                stack.push(sibling);
                            }
                        }

                        return out;
                    }

                    /**
                     * Search for matching fibers and return multiple candidates.
                     * Key fixes vs the old version:
                     * - Start traversal from root.current.child (if root object), not from root itself
                     * - Traverse a stable "current" graph; de-dupe using alternate/current pair
                     * - Collect multiple matches up to maxMatches
                     */
                    function findFibersByQuery(
                        roots: AnyFiber[],
                        query: {
                            componentName?: string;
                            matchStrategy: 'exact' | 'contains';
                            fileNameHint?: string;
                            lineNumber?: number;
                        },
                        maxMatches: number
                    ): AnyFiber[] {
                        const nameQ: string | undefined = query.componentName
                            ? query.componentName.trim()
                            : undefined;

                        const hasNameQ: boolean = Boolean(nameQ);

                        const fileQ: string | undefined = query.fileNameHint
                            ? query.fileNameHint.trim()
                            : undefined;

                        const hasFileQ: boolean = Boolean(fileQ);

                        const hasLineQ: boolean =
                            typeof query.lineNumber === 'number';

                        const wantsAnything: boolean =
                            hasNameQ || hasFileQ || hasLineQ;
                        if (!wantsAnything) {
                            return [];
                        }

                        const stack: AnyFiber[] = [];
                        for (const r of roots) {
                            const start: AnyFiber | null = toStartFiber(r);
                            if (start) {
                                stack.push(start);
                            }
                        }

                        const visited: Set<any> = new Set<any>();
                        const matches: AnyFiber[] = [];

                        let visitedCount: number = 0;

                        while (stack.length > 0) {
                            if (matches.length >= maxMatches) {
                                break;
                            }

                            const f: AnyFiber | undefined = stack.pop();
                            if (!f) {
                                continue;
                            }

                            const key: any = f.alternate ?? f;
                            if (visited.has(key)) {
                                continue;
                            }

                            visited.add(key);

                            visitedCount++;
                            if (visitedCount > maxFibersVisited) {
                                notes.push(
                                    `Fiber traversal safety cap reached (${maxFibersVisited}). Results may be incomplete.`
                                );
                                break;
                            }

                            const dn: string | null = getDisplayName(f);
                            const tn: string | null = getFiberTypeName(f);

                            const nameMatches: boolean = hasNameQ
                                ? matchesName(
                                      dn,
                                      nameQ as string,
                                      query.matchStrategy
                                  ) ||
                                  matchesName(
                                      tn,
                                      nameQ as string,
                                      query.matchStrategy
                                  )
                                : true;

                            const srcMatches: boolean =
                                hasFileQ || hasLineQ
                                    ? matchesDebugSource(
                                          f,
                                          fileQ,
                                          query.lineNumber
                                      )
                                    : true;

                            if (nameMatches && srcMatches) {
                                matches.push(f);
                            }

                            const child: AnyFiber | null = f.child ?? null;
                            const sibling: AnyFiber | null = f.sibling ?? null;

                            if (child) {
                                stack.push(child);
                            }

                            if (sibling) {
                                stack.push(sibling);
                            }
                        }

                        return matches;
                    }

                    /**
                     * Score a candidate fiber using a heuristic:
                     * - Prefer explicit name matches and debugSource matches (if provided)
                     * - Prefer candidates related to the anchor (same subtree / overlapping area)
                     * - Prefer candidates with some DOM footprint (host nodes)
                     * - Prefer candidates near anchor point (if provided)
                     */
                    function scoreCandidate(
                        fiber: AnyFiber,
                        anchorEl: Element | null,
                        anchorX: number | undefined,
                        anchorY: number | undefined,
                        q: {
                            componentName?: string;
                            matchStrategy: 'exact' | 'contains';
                            fileNameHint?: string;
                            lineNumber?: number;
                        },
                        maxElements: number,
                        onlyVisible: boolean,
                        onlyInViewport: boolean,
                        textPreviewMaxLength: number
                    ): {
                        score: number;
                        nameMatched: boolean;
                        debugSourceMatched: boolean;
                        anchorRelated: boolean;
                        proximityPx: number | null;
                        dom: ElementSummary[];
                    } {
                        const nameQ: string | undefined = q.componentName
                            ? q.componentName.trim()
                            : undefined;

                        const hasNameQ: boolean = Boolean(nameQ);

                        const dn: string | null = getDisplayName(fiber);
                        const tn: string | null = getFiberTypeName(fiber);

                        const nameMatched: boolean = hasNameQ
                            ? matchesName(
                                  dn,
                                  nameQ as string,
                                  q.matchStrategy
                              ) ||
                              matchesName(tn, nameQ as string, q.matchStrategy)
                            : false;

                        const debugSourceMatched: boolean =
                            Boolean(normalizeStr(q.fileNameHint)) ||
                            typeof q.lineNumber === 'number'
                                ? matchesDebugSource(
                                      fiber,
                                      normalizeStr(q.fileNameHint) ?? undefined,
                                      typeof q.lineNumber === 'number'
                                          ? (q.lineNumber as number)
                                          : undefined
                                  )
                                : false;

                        const dom: ElementSummary[] =
                            collectDomElementsFromFiberSubtree(
                                fiber,
                                maxElements,
                                onlyVisible,
                                onlyInViewport,
                                textPreviewMaxLength
                            );

                        let anchorRelated: boolean = false;
                        let proximityPx: number | null = null;

                        if (anchorEl) {
                            const anchorSel: string | null =
                                selectorHintFor(anchorEl);

                            anchorRelated =
                                dom.some((d: ElementSummary): boolean => {
                                    if (!d.selectorHint || !anchorSel) {
                                        return false;
                                    }
                                    return d.selectorHint === anchorSel;
                                }) ||
                                dom.some((d: ElementSummary): boolean => {
                                    if (!d.boundingBox) {
                                        return false;
                                    }

                                    const r: DOMRect =
                                        anchorEl.getBoundingClientRect();
                                    const bb: BoundingBox = d.boundingBox;

                                    // Overlap heuristic
                                    const overlaps: boolean =
                                        r.left < bb.x + bb.width &&
                                        r.left + r.width > bb.x &&
                                        r.top < bb.y + bb.height &&
                                        r.top + r.height > bb.y;

                                    return overlaps;
                                });

                            if (
                                typeof anchorX === 'number' &&
                                typeof anchorY === 'number' &&
                                dom.length > 0
                            ) {
                                let best: number | null = null;

                                for (const item of dom) {
                                    if (!item.boundingBox) {
                                        continue;
                                    }

                                    const cx: number =
                                        item.boundingBox.x +
                                        item.boundingBox.width / 2;

                                    const cy: number =
                                        item.boundingBox.y +
                                        item.boundingBox.height / 2;

                                    const dx: number = cx - anchorX;
                                    const dy: number = cy - anchorY;

                                    const dist: number = Math.sqrt(
                                        dx * dx + dy * dy
                                    );

                                    if (best === null) {
                                        best = dist;
                                    } else {
                                        if (dist < best) {
                                            best = dist;
                                        }
                                    }
                                }

                                proximityPx = best;
                            }
                        }

                        let score: number = 0;

                        score += nameMatched ? 3.0 : 0;
                        score += debugSourceMatched ? 3.0 : 0;
                        score += anchorRelated ? 2.0 : 0;

                        // Favor some DOM footprint (but cap influence)
                        score += Math.min(1.5, dom.length / 25);

                        if (
                            typeof proximityPx === 'number' &&
                            Number.isFinite(proximityPx)
                        ) {
                            // 0px => +1.5, 300px => ~+0.3, 1000px => tiny
                            const p: number = Math.max(
                                0,
                                Math.min(1, 1 - proximityPx / 1000)
                            );
                            score += 1.5 * p;
                        }

                        return {
                            score,
                            nameMatched,
                            debugSourceMatched,
                            anchorRelated,
                            proximityPx,
                            dom,
                        };
                    }

                    /**
                     * -----------------------------------------------------------------------------
                     * Main logic
                     * -----------------------------------------------------------------------------
                     */

                    const hook: any | null = getDevtoolsHook();
                    const reactDetected: boolean = Boolean(hook);

                    // Tell the user explicitly how to make this better
                    if (!reactDetected) {
                        notes.push(
                            'React DevTools hook was not detected (__REACT_DEVTOOLS_GLOBAL_HOOK__).'
                        );
                        notes.push(
                            'If you are using a persistent/headful browser profile, install the "React Developer Tools" Chrome extension in that profile (manual step by the user) to enable reliable root discovery and component search.'
                        );
                    } else {
                        notes.push(
                            'React DevTools hook detected. Root discovery will use getFiberRoots() (more reliable).'
                        );
                    }

                    const fiberDetected: boolean = (() => {
                        const body: Element | null = document.body;

                        if (!body) {
                            return false;
                        }

                        const f: AnyFiber | null = getFiberFromDomElement(body);
                        if (f) {
                            return true;
                        }

                        const seeds: AnyFiber[] = getSeedFibersFromDomScan(1);
                        if (seeds.length > 0) {
                            return true;
                        }

                        return false;
                    })();

                    if (!fiberDetected) {
                        notes.push(
                            'No React Fiber pointers were detected on DOM nodes (__reactFiber$...). This can happen if the page is not React, React has not rendered yet, or internals are unavailable.'
                        );
                    } else {
                        notes.push(
                            'React Fiber pointers detected on DOM nodes. Anchor-based mapping may still work without the DevTools hook (best-effort).'
                        );
                    }

                    const anchorEl: Element | null = pickAnchorElement(
                        anchorSelectorEval,
                        anchorXEval,
                        anchorYEval
                    );

                    // 1) Anchor-based selection (works without hook if DOM fiber exists)
                    let anchorSelected: AnyFiber | null = null;

                    if (anchorEl) {
                        const anchorFiber: AnyFiber | null =
                            getFiberFromDomElement(anchorEl);

                        if (anchorFiber) {
                            const candidateA: AnyFiber = anchorFiber;
                            const candidateB: AnyFiber | null =
                                anchorFiber.alternate ?? null;

                            // Prefer the side that appears more "connected"
                            let chosen: AnyFiber = candidateA;

                            if (candidateB) {
                                if (
                                    (candidateB.child || candidateB.sibling) &&
                                    !(candidateA.child || candidateA.sibling)
                                ) {
                                    chosen = candidateB;
                                }
                            }

                            const nearestComponent: AnyFiber | null =
                                firstMeaningfulComponentAbove(chosen);

                            if (nearestComponent) {
                                anchorSelected = nearestComponent;
                            } else {
                                notes.push(
                                    'Anchor fiber found but no meaningful component fiber was found above it.'
                                );
                            }
                        } else {
                            notes.push(
                                'Anchor element found but React fiber was not found on it.'
                            );
                        }
                    }

                    // 2) Discover roots (hook or DOM scan)
                    let roots: AnyFiber[] = [];
                    let rootDiscovery:
                        | 'devtools-hook'
                        | 'dom-fiber-scan'
                        | 'none' = 'none';

                    if (hook) {
                        const r: AnyFiber[] = getAllRootsFromHook(hook);
                        if (r.length > 0) {
                            roots = r;
                            rootDiscovery = 'devtools-hook';
                        }
                    }

                    if (roots.length === 0) {
                        if (fiberDetected) {
                            const seeds: AnyFiber[] =
                                getSeedFibersFromDomScan(10);

                            if (seeds.length > 0) {
                                roots = seeds;
                                rootDiscovery = 'dom-fiber-scan';
                                notes.push(
                                    'Using DOM fiber scan as fallback root discovery (best-effort).'
                                );
                            }
                        }
                    }

                    // 3) Query search (optional)
                    const hasQuery: boolean =
                        Boolean(normalizeStr(componentNameEval)) ||
                        Boolean(normalizeStr(fileNameHintEval)) ||
                        typeof lineNumberEval === 'number';

                    const query: {
                        componentName?: string;
                        matchStrategy: 'exact' | 'contains';
                        fileNameHint?: string;
                        lineNumber?: number;
                    } = {
                        componentName:
                            normalizeStr(componentNameEval) ?? undefined,
                        matchStrategy: matchStrategyEval,
                        fileNameHint:
                            normalizeStr(fileNameHintEval) ?? undefined,
                        lineNumber:
                            typeof lineNumberEval === 'number'
                                ? (lineNumberEval as number)
                                : undefined,
                    };

                    let queryMatches: AnyFiber[] = [];

                    if (hasQuery) {
                        if (roots.length > 0) {
                            queryMatches = findFibersByQuery(
                                roots,
                                query,
                                Math.max(1, Math.floor(maxMatchesEval))
                            );
                        } else {
                            notes.push(
                                'Query was provided but no roots could be discovered. Provide an anchorSelector/anchorX+anchorY so we can map via DOM fiber pointers.'
                            );
                        }
                    }

                    // 4) Candidate pool
                    const candidates: AnyFiber[] = [];

                    if (anchorSelected) {
                        candidates.push(anchorSelected);
                    }

                    for (const f of queryMatches) {
                        candidates.push(f);
                    }

                    // De-dupe candidate pool by alternate key
                    const uniq: AnyFiber[] = [];
                    const seenCand: Set<any> = new Set<any>();

                    for (const f of candidates) {
                        const key: any = f?.alternate ?? f;

                        if (f && !seenCand.has(key)) {
                            seenCand.add(key);
                            uniq.push(f);
                        }
                    }

                    if (uniq.length === 0) {
                        // Hook missing should be explicit in the notes (user action)
                        if (!reactDetected) {
                            notes.push(
                                'No candidates found. Without the DevTools hook, component search may be unreliable unless you provide a strong anchor.'
                            );
                        }

                        return {
                            reactDetected,
                            fiberDetected,
                            rootDiscovery,
                            component: null,
                            candidates: [],
                            elements: [],
                            notes: [
                                ...notes,
                                'Failed to select a target component fiber. Provide a better anchor, or ensure React is present and render has happened.',
                            ],
                        };
                    }

                    // 5) Score candidates and pick the best
                    const scored: Array<{
                        fiber: AnyFiber;
                        meta: MatchedComponent;
                        dom: ElementSummary[];
                        domFootprintCount: number;
                    }> = [];

                    for (const f of uniq) {
                        const s = scoreCandidate(
                            f,
                            anchorEl,
                            anchorXEval,
                            anchorYEval,
                            query,
                            maxElementsEval,
                            onlyVisibleEval,
                            onlyInViewportEval,
                            textPreviewMaxLengthEval
                        );

                        let selection:
                            | 'anchor'
                            | 'query'
                            | 'query+anchor'
                            | 'unknown' = 'unknown';

                        const isAnchor: boolean = anchorSelected
                            ? (anchorSelected.alternate ?? anchorSelected) ===
                              (f.alternate ?? f)
                            : false;

                        const isQuery: boolean = queryMatches.some(
                            (qf: AnyFiber): boolean =>
                                (qf.alternate ?? qf) === (f.alternate ?? f)
                        );

                        if (isAnchor && isQuery) {
                            selection = 'query+anchor';
                        } else {
                            if (isAnchor) {
                                selection = 'anchor';
                            } else {
                                if (isQuery) {
                                    selection = 'query';
                                } else {
                                    selection = 'unknown';
                                }
                            }
                        }

                        const name: string | null = getFiberTypeName(f);
                        const displayName: string | null = getDisplayName(f);
                        const debugSource: DebugSource | null =
                            getDebugSource(f);
                        const componentStack: string[] = buildComponentStack(
                            f,
                            stackLimit
                        );

                        const meta: MatchedComponent = {
                            name,
                            displayName,
                            debugSource,
                            componentStack,
                            selection,
                            scoring: {
                                score: s.score,
                                nameMatched: s.nameMatched,
                                debugSourceMatched: s.debugSourceMatched,
                                anchorRelated: s.anchorRelated,
                                proximityPx: s.proximityPx,
                            },
                        };

                        scored.push({
                            fiber: f,
                            meta,
                            dom: s.dom,
                            domFootprintCount: s.dom.length,
                        });
                    }

                    scored.sort(
                        (a, b): number =>
                            (b.meta.scoring?.score ?? 0) -
                            (a.meta.scoring?.score ?? 0)
                    );

                    const best = scored[0];

                    const outCandidates: CandidateComponent[] = scored
                        .slice(0, Math.max(1, Math.floor(maxMatchesEval)))
                        .map((c): CandidateComponent => {
                            return {
                                ...c.meta,
                                domFootprintCount: c.domFootprintCount,
                            };
                        });

                    const elements: ElementSummary[] = best.dom;

                    // Notes about debug source / missing info
                    if (
                        hasQuery &&
                        (query.fileNameHint ||
                            typeof query.lineNumber === 'number')
                    ) {
                        const anyHasDebug: boolean = outCandidates.some(
                            (c: CandidateComponent): boolean => {
                                if (c.debugSource?.fileName) {
                                    return true;
                                }
                                if (c.debugSource?.lineNumber !== null) {
                                    return true;
                                }
                                return false;
                            }
                        );

                        if (!anyHasDebug) {
                            notes.push(
                                'debugSource hints were provided, but no _debugSource information was found on matched fibers. This is common in production builds and some dev toolchains.'
                            );
                            notes.push(
                                'React DevTools may still display "Rendered by <file>:<line>" using sourcemaps/stack traces even when fiber._debugSource is null.'
                            );
                        }
                    }

                    if (elements.length >= maxElementsEval) {
                        notes.push(
                            `Element list was truncated at maxElements=${maxElementsEval}. Increase maxElements if needed.`
                        );
                    }

                    if (elements.length === 0) {
                        notes.push(
                            'No DOM elements were returned for the selected component. It may render no host elements, or filtering (onlyVisible/onlyInViewport) removed them.'
                        );
                    }

                    // Explain hook vs fallback
                    if (!reactDetected && fiberDetected) {
                        notes.push(
                            'React DevTools hook was not detected, but DOM fiber pointers were found. Using DOM-fiber scanning and anchor-based mapping (best-effort).'
                        );
                    } else {
                        if (!reactDetected && !fiberDetected) {
                            notes.push(
                                'React DevTools hook was not detected and no DOM fiber pointers were found. Component-to-DOM mapping is unavailable on this page.'
                            );
                        }
                    }

                    return {
                        reactDetected,
                        fiberDetected,
                        rootDiscovery,
                        component: best.meta,
                        candidates: outCandidates,
                        elements,
                        notes: [
                            ...notes,
                            'Component metadata is best-effort. Wrappers (memo/forwardRef/HOCs), Suspense/Offscreen, and portals may make names/stacks noisy.',
                        ],
                    };
                },
                {
                    anchorSelectorEval:
                        typeof anchorSelector === 'string' &&
                        anchorSelector.trim()
                            ? anchorSelector.trim()
                            : undefined,
                    anchorXEval:
                        typeof anchorX === 'number' && Number.isFinite(anchorX)
                            ? Math.floor(anchorX)
                            : undefined,
                    anchorYEval:
                        typeof anchorY === 'number' && Number.isFinite(anchorY)
                            ? Math.floor(anchorY)
                            : undefined,
                    componentNameEval:
                        typeof componentName === 'string' &&
                        componentName.trim()
                            ? componentName.trim()
                            : undefined,
                    matchStrategyEval: matchStrategy,
                    fileNameHintEval:
                        typeof fileNameHint === 'string' && fileNameHint.trim()
                            ? fileNameHint.trim()
                            : undefined,
                    lineNumberEval:
                        typeof lineNumber === 'number' &&
                        Number.isFinite(lineNumber)
                            ? Math.floor(lineNumber)
                            : undefined,
                    maxElementsEval: Math.max(1, Math.floor(maxElements)),
                    onlyVisibleEval: Boolean(onlyVisible),
                    onlyInViewportEval: Boolean(onlyInViewport),
                    textPreviewMaxLengthEval: Math.max(
                        1,
                        Math.floor(textPreviewMaxLength)
                    ),
                    maxMatchesEval: Math.max(1, Math.floor(maxMatches)),
                    maxRootsScan: INTERNAL_MAX_ROOTS_SCAN,
                    maxFibersVisited: INTERNAL_MAX_FIBERS_VISITED,
                    stackLimit: DEFAULT_STACK_LIMIT,
                }
            );

        return result;
    }
}
