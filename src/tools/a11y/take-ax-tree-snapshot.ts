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
 * Default configuration
 * -------------------------
 * All constants are explicitly typed to keep TypeScript strict.
 */
const DEFAULT_INCLUDE_STYLES: boolean = true;
const DEFAULT_INCLUDE_RUNTIME_VISUAL: boolean = true;
const DEFAULT_CHECK_OCCLUSION: boolean = false;
const DEFAULT_ONLY_VISIBLE: boolean = false;
const DEFAULT_ONLY_IN_VIEWPORT: boolean = false;
const DEFAULT_TEXT_PREVIEW_MAX_LENGTH: number = 80;

/**
 * CSS properties that provide the highest signal for
 * visual understanding and UI debugging.
 */
const DEFAULT_STYLE_PROPERTIES: ReadonlyArray<string> = [
    'display',
    'visibility',
    'opacity',
    'pointer-events',
    'position',
    'z-index',
    'color',
    'background-color',
    'border-color',
    'border-width',
    'border-style',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-decoration-line',
    'white-space',
    'overflow',
    'overflow-x',
    'overflow-y',
    'transform',
    'cursor',
];

/**
 * A focused subset of AX roles that are meaningful for
 * interaction, verification and reasoning.
 */
const DEFAULT_INTERESTING_ROLES: ReadonlySet<string> = new Set<string>([
    'button',
    'link',
    'textbox',
    'checkbox',
    'radio',
    'combobox',
    'switch',
    'tab',
    'menuitem',
    'dialog',
    'heading',
    'listbox',
    'listitem',
    'option',
]);

/**
 * Internal safeguards to protect CDP and output size.
 * These are intentionally not user-configurable.
 */
const INTERNAL_CONCURRENCY: number = 12;
const INTERNAL_SAFETY_CAP: number = 2000;

/**
 * Converts Chromium's attribute array format into a key-value map.
 */
function attrsToObj(attrs?: any[]): Record<string, string> {
    const result: Record<string, string> = {};

    if (!attrs) {
        return result;
    }

    for (let i: number = 0; i < attrs.length; i += 2) {
        const key: string = String(attrs[i]);
        const value: string = String(attrs[i + 1] ?? '');
        result[key] = value;
    }

    return result;
}

/**
 * -------------------------
 * Input / Output types
 * -------------------------
 */
export interface TakeAxTreeSnapshotInput extends ToolInput {
    roles?: Array<
        | 'button'
        | 'link'
        | 'textbox'
        | 'checkbox'
        | 'radio'
        | 'combobox'
        | 'switch'
        | 'tab'
        | 'menuitem'
        | 'dialog'
        | 'heading'
        | 'listbox'
        | 'listitem'
        | 'option'
    >;

    includeStyles?: boolean;
    includeRuntimeVisual?: boolean;

    /**
     * If true, checks whether each element is visually occluded by another element
     * using elementFromPoint() sampled at multiple points (center + corners).
     *
     * Disabled by default because it adds extra runtime work and can be noisy.
     */
    checkOcclusion?: boolean;

    onlyVisible?: boolean;
    onlyInViewport?: boolean;

    textPreviewMaxLength?: number;
    styleProperties?: string[];
}

/**
 * Parent/children links are based on the full AX tree IDs, not on the filtered output list.
 */
type AxSnapshotNode = {
    axNodeId: string;
    parentAxNodeId: string | null;
    childAxNodeIds: Array<string>;

    role: string | null;
    name: string | null;
    ignored: boolean | null;

    backendDOMNodeId: number;
    domNodeId: number | null;
    frameId: string | null;

    localName: string | null;
    id: string | null;
    className: string | null;

    selectorHint: string | null;
    textPreview: string | null;

    value: any | null;
    description: any | null;
    properties: any[] | null;

    styles?: Record<string, string>;

    runtime?: {
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null;
        isVisible: boolean;
        isInViewport: boolean;

        /**
         * Optional occlusion check results. Only present when checkOcclusion=true.
         */
        occlusion?: {
            samplePoints: Array<{
                x: number;
                y: number;
                hit: boolean;
            }>;
            isOccluded: boolean;

            /**
             * Topmost element that occludes this element on at least one sampled point.
             * Null when not occluded (including when the top element is this element or its descendant).
             */
            topElement: {
                localName: string | null;
                id: string | null;
                className: string | null;
                selectorHint: string | null;
                boundingBox: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null;
            } | null;

            /**
             * Intersection box between this element's boundingBox and the topElement's boundingBox (if present).
             */
            intersection: {
                x: number;
                y: number;
                width: number;
                height: number;
                area: number;
            } | null;
        };
    };
};

export interface TakeAxTreeSnapshotOutput extends ToolOutput {
    url: string;
    title: string;

    axNodeCount: number;
    candidateCount: number;
    enrichedCount: number;
    truncatedBySafetyCap: boolean;

    nodes: Array<AxSnapshotNode>;
}

export class TakeAxTreeSnapshot implements Tool {
    name(): string {
        return 'accessibility_take-ax-tree-snapshot';
    }

    description(): string {
        return `
Captures a UI-focused snapshot by combining Chromium's Accessibility (AX) tree with runtime visual diagnostics.

Use this tool to detect UI issues like:
- Elements that exist semantically (AX role/name) but are visually hidden or off-screen
- Wrong layout/geometry (bounding box, viewport intersection)
- Styling issues (optional computed style subset)
- Overlap / stacking / occlusion issues (enable "checkOcclusion")

**UI Debugging Usage:**
- ALWAYS use "checkOcclusion:true" when investigating UI/layout problems
- Provides precise bounding boxes for overlap detection
- Use alongside "a11y_take-aria-snapshot" tool for complete UI analysis

Important notes for AI-driven UI debugging:
- "boundingBox" comes from "getBoundingClientRect()" (viewport coords). It represents the layout box, not every painted pixel
  (e.g. shadows/pseudo-elements may extend beyond it).
- If something looks visible but clicks fail, enable "checkOcclusion". This samples multiple points (center + corners)
  and uses "elementFromPoint()" to identify if another element is actually on top.
- When not occluded, "topElement" is null (even if "elementFromPoint" returns the element itself or its descendant).
- "selectorHint" is a best-effort locator (prefers "data-testid" / "data-selector" / "id"). It may not be unique.
- Use "onlyVisible" / "onlyInViewport" to reduce output when focusing on what the user currently sees.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            roles: z
                .array(
                    z.enum([
                        'button',
                        'link',
                        'textbox',
                        'checkbox',
                        'radio',
                        'combobox',
                        'switch',
                        'tab',
                        'menuitem',
                        'dialog',
                        'heading',
                        'listbox',
                        'listitem',
                        'option',
                    ])
                )
                .describe(
                    'Optional role allowlist. If omitted, a built-in set of interactive roles is used.'
                )
                .optional(),

            includeStyles: z
                .boolean()
                .describe(
                    'Whether to include computed CSS styles for each node. Styles are extracted via runtime getComputedStyle().'
                )
                .optional()
                .default(DEFAULT_INCLUDE_STYLES),

            includeRuntimeVisual: z
                .boolean()
                .describe(
                    'Whether to compute runtime visual information (bounding box, visibility, viewport).'
                )
                .optional()
                .default(DEFAULT_INCLUDE_RUNTIME_VISUAL),

            checkOcclusion: z
                .boolean()
                .describe(
                    'If true, checks whether each element is visually occluded by another element using elementFromPoint() sampled at multiple points. Disabled by default.'
                )
                .optional()
                .default(DEFAULT_CHECK_OCCLUSION),

            onlyVisible: z
                .boolean()
                .describe('If true, only visually visible nodes are returned.')
                .optional()
                .default(DEFAULT_ONLY_VISIBLE),

            onlyInViewport: z
                .boolean()
                .describe(
                    'If true, only nodes intersecting the viewport are returned.'
                )
                .optional()
                .default(DEFAULT_ONLY_IN_VIEWPORT),

            textPreviewMaxLength: z
                .number()
                .int()
                .positive()
                .describe(
                    'Maximum length of the text preview extracted from each element.'
                )
                .optional()
                .default(DEFAULT_TEXT_PREVIEW_MAX_LENGTH),

            styleProperties: z
                .array(z.string())
                .describe('List of CSS computed style properties to extract.')
                .optional()
                .default([...DEFAULT_STYLE_PROPERTIES]),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            url: z
                .string()
                .describe(
                    'The current page URL at the time the AX snapshot was captured.'
                ),

            title: z
                .string()
                .describe(
                    'The document title of the page at the time of the snapshot.'
                ),

            axNodeCount: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Total number of nodes returned by Chromium Accessibility.getFullAXTree before filtering.'
                ),

            candidateCount: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Number of DOM-backed AX nodes that passed role filtering before enrichment.'
                ),

            enrichedCount: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Number of nodes included in the final enriched snapshot output.'
                ),

            truncatedBySafetyCap: z
                .boolean()
                .describe(
                    'Indicates whether the result set was truncated by an internal safety cap to prevent excessive output size.'
                ),

            nodes: z
                .array(
                    z.object({
                        axNodeId: z
                            .string()
                            .describe(
                                'Unique identifier of the accessibility node within the AX tree.'
                            ),

                        parentAxNodeId: z
                            .string()
                            .nullable()
                            .describe(
                                'Parent AX node id in the full AX tree. Null if this node is a root.'
                            ),

                        childAxNodeIds: z
                            .array(z.string())
                            .describe(
                                'Child AX node ids in the full AX tree (may include nodes not present in the filtered output).'
                            ),

                        role: z
                            .string()
                            .nullable()
                            .describe(
                                'ARIA role of the accessibility node (e.g. button, link, textbox).'
                            ),

                        name: z
                            .string()
                            .nullable()
                            .describe(
                                'Accessible name computed by the browser accessibility engine.'
                            ),

                        ignored: z
                            .boolean()
                            .nullable()
                            .describe(
                                'Whether the accessibility node is marked as ignored.'
                            ),

                        backendDOMNodeId: z
                            .number()
                            .int()
                            .describe(
                                'Chromium backend DOM node identifier used to map AX nodes to DOM elements.'
                            ),

                        domNodeId: z
                            .number()
                            .int()
                            .nullable()
                            .describe(
                                'Resolved DOM nodeId from CDP if available; may be null because nodeId is not guaranteed to be stable/resolved.'
                            ),

                        frameId: z
                            .string()
                            .nullable()
                            .describe(
                                'Frame identifier if the node belongs to an iframe or subframe.'
                            ),

                        localName: z
                            .string()
                            .nullable()
                            .describe(
                                'Lowercased DOM tag name of the mapped element (e.g. div, button, input).'
                            ),

                        id: z
                            .string()
                            .nullable()
                            .describe(
                                'DOM id attribute of the mapped element.'
                            ),

                        className: z
                            .string()
                            .nullable()
                            .describe(
                                'DOM class attribute of the mapped element.'
                            ),

                        selectorHint: z
                            .string()
                            .nullable()
                            .describe(
                                'Best-effort selector hint for targeting this element (prefers data-testid/data-selector/id).'
                            ),

                        textPreview: z
                            .string()
                            .nullable()
                            .describe(
                                'Short preview of rendered text content or aria-label, truncated to the configured maximum length.'
                            ),

                        value: z
                            .any()
                            .nullable()
                            .describe(
                                'Raw AX value payload associated with the node, if present.'
                            ),

                        description: z
                            .any()
                            .nullable()
                            .describe(
                                'Raw AX description payload associated with the node, if present.'
                            ),

                        properties: z
                            .array(z.any())
                            .nullable()
                            .describe(
                                'Additional AX properties exposed by the accessibility tree.'
                            ),

                        styles: z
                            .record(z.string(), z.string())
                            .optional()
                            .describe(
                                'Subset of computed CSS styles for the element as string key-value pairs.'
                            ),

                        runtime: z
                            .object({
                                boundingBox: z
                                    .object({
                                        x: z
                                            .number()
                                            .describe(
                                                'X coordinate of the element relative to the viewport.'
                                            ),
                                        y: z
                                            .number()
                                            .describe(
                                                'Y coordinate of the element relative to the viewport.'
                                            ),
                                        width: z
                                            .number()
                                            .describe(
                                                'Width of the element in CSS pixels.'
                                            ),
                                        height: z
                                            .number()
                                            .describe(
                                                'Height of the element in CSS pixels.'
                                            ),
                                    })
                                    .nullable()
                                    .describe(
                                        'Bounding box computed at runtime using getBoundingClientRect.'
                                    ),

                                isVisible: z
                                    .boolean()
                                    .describe(
                                        'Whether the element is considered visually visible (display, visibility, opacity, and size).'
                                    ),

                                isInViewport: z
                                    .boolean()
                                    .describe(
                                        'Whether the element intersects the current viewport.'
                                    ),

                                occlusion: z
                                    .object({
                                        samplePoints: z
                                            .array(
                                                z.object({
                                                    x: z
                                                        .number()
                                                        .describe(
                                                            'Sample point X (viewport coordinates) used for occlusion testing.'
                                                        ),
                                                    y: z
                                                        .number()
                                                        .describe(
                                                            'Sample point Y (viewport coordinates) used for occlusion testing.'
                                                        ),
                                                    hit: z
                                                        .boolean()
                                                        .describe(
                                                            'True if elementFromPoint at this point returned a different element that is not a descendant.'
                                                        ),
                                                })
                                            )
                                            .describe(
                                                'Sample points used for occlusion detection (center + corners).'
                                            ),

                                        isOccluded: z
                                            .boolean()
                                            .describe(
                                                'True if at least one sample point is covered by another element.'
                                            ),

                                        topElement: z
                                            .object({
                                                localName: z
                                                    .string()
                                                    .nullable()
                                                    .describe(
                                                        'Tag name of the occluding element.'
                                                    ),
                                                id: z
                                                    .string()
                                                    .nullable()
                                                    .describe(
                                                        'DOM id of the occluding element (may be null if none).'
                                                    ),
                                                className: z
                                                    .string()
                                                    .nullable()
                                                    .describe(
                                                        'DOM class of the occluding element (may be null if none).'
                                                    ),
                                                selectorHint: z
                                                    .string()
                                                    .nullable()
                                                    .describe(
                                                        'Best-effort selector hint for the occluding element.'
                                                    ),
                                                boundingBox: z
                                                    .object({
                                                        x: z
                                                            .number()
                                                            .describe(
                                                                'X coordinate of the occluding element bounding box.'
                                                            ),
                                                        y: z
                                                            .number()
                                                            .describe(
                                                                'Y coordinate of the occluding element bounding box.'
                                                            ),
                                                        width: z
                                                            .number()
                                                            .describe(
                                                                'Width of the occluding element bounding box.'
                                                            ),
                                                        height: z
                                                            .number()
                                                            .describe(
                                                                'Height of the occluding element bounding box.'
                                                            ),
                                                    })
                                                    .nullable()
                                                    .describe(
                                                        'Bounding box of the occluding element (if available).'
                                                    ),
                                            })
                                            .nullable()
                                            .describe(
                                                'Identity and geometry of the occluding element. Null when not occluded.'
                                            ),

                                        intersection: z
                                            .object({
                                                x: z
                                                    .number()
                                                    .describe(
                                                        'Intersection rect X.'
                                                    ),
                                                y: z
                                                    .number()
                                                    .describe(
                                                        'Intersection rect Y.'
                                                    ),
                                                width: z
                                                    .number()
                                                    .describe(
                                                        'Intersection rect width.'
                                                    ),
                                                height: z
                                                    .number()
                                                    .describe(
                                                        'Intersection rect height.'
                                                    ),
                                                area: z
                                                    .number()
                                                    .describe(
                                                        'Intersection rect area in CSS pixels squared.'
                                                    ),
                                            })
                                            .nullable()
                                            .describe(
                                                'Intersection box between this element and the occluding element. Null if not occluded or cannot compute.'
                                            ),
                                    })
                                    .optional()
                                    .describe(
                                        'Occlusion detection results. Only present when checkOcclusion=true.'
                                    ),
                            })
                            .optional()
                            .describe(
                                'Runtime-derived visual information representing how the element is actually rendered.'
                            ),
                    })
                )
                .describe(
                    'List of enriched DOM-backed AX nodes combining accessibility metadata with visual diagnostics.'
                ),
        };
    }

    async handle(
        context: McpSessionContext,
        args: TakeAxTreeSnapshotInput
    ): Promise<TakeAxTreeSnapshotOutput> {
        const page: any = context.page;

        const includeRuntimeVisual: boolean =
            args.includeRuntimeVisual ?? DEFAULT_INCLUDE_RUNTIME_VISUAL;
        const includeStyles: boolean =
            args.includeStyles ?? DEFAULT_INCLUDE_STYLES;
        const checkOcclusion: boolean =
            args.checkOcclusion ?? DEFAULT_CHECK_OCCLUSION;

        const onlyVisible: boolean = args.onlyVisible ?? DEFAULT_ONLY_VISIBLE;
        const onlyInViewport: boolean =
            args.onlyInViewport ?? DEFAULT_ONLY_IN_VIEWPORT;

        if ((onlyVisible || onlyInViewport) && !includeRuntimeVisual) {
            throw new Error(
                'onlyVisible/onlyInViewport require includeRuntimeVisual=true.'
            );
        }

        if (checkOcclusion && !includeRuntimeVisual) {
            throw new Error(
                'checkOcclusion requires includeRuntimeVisual=true.'
            );
        }

        const textMax: number =
            args.textPreviewMaxLength ?? DEFAULT_TEXT_PREVIEW_MAX_LENGTH;

        const stylePropsRaw: ReadonlyArray<string> =
            args.styleProperties && args.styleProperties.length > 0
                ? args.styleProperties
                : DEFAULT_STYLE_PROPERTIES;

        const stylePropsLower: Array<string> = Array.from(stylePropsRaw).map(
            (p: string): string => p.toLowerCase()
        );

        const roleAllow: Set<string> =
            args.roles && args.roles.length > 0
                ? new Set<string>(args.roles)
                : new Set<string>(Array.from(DEFAULT_INTERESTING_ROLES));

        const cdp: any = await page.context().newCDPSession(page);

        try {
            await cdp.send('DOM.enable');
            await cdp.send('Accessibility.enable');

            if (includeRuntimeVisual) {
                await cdp.send('Runtime.enable');
            }

            const axResponse: any = await cdp.send(
                'Accessibility.getFullAXTree'
            );
            const axNodes: any[] = (axResponse.nodes ?? axResponse) as any[];

            /**
             * Build parent/child relationships from the FULL AX tree.
             */
            const parentByChildId: Map<string, string> = new Map<
                string,
                string
            >();
            const childIdsByNodeId: Map<string, Array<string>> = new Map<
                string,
                Array<string>
            >();

            for (const n of axNodes) {
                const nodeIdStr: string = String(n.nodeId);
                const rawChildIds: any[] = (n.childIds ?? []) as any[];
                const childIds: Array<string> = rawChildIds.map(
                    (cid: any): string => String(cid)
                );

                childIdsByNodeId.set(nodeIdStr, childIds);

                for (const childIdStr of childIds) {
                    parentByChildId.set(childIdStr, nodeIdStr);
                }
            }

            // Filter to DOM-backed nodes and role allowlist.
            let candidates: any[] = axNodes.filter((n: any): boolean => {
                if (typeof n.backendDOMNodeId !== 'number') {
                    return false;
                }

                const roleValue: unknown = n.role?.value ?? null;
                if (!roleValue) {
                    return false;
                }

                return roleAllow.has(String(roleValue));
            });

            const candidateCount: number = candidates.length;

            // Internal guardrail to prevent extremely large outputs.
            const truncatedBySafetyCap: boolean =
                candidates.length > INTERNAL_SAFETY_CAP;
            if (truncatedBySafetyCap) {
                candidates = candidates.slice(0, INTERNAL_SAFETY_CAP);
            }

            // Enrich nodes in parallel with bounded concurrency.
            const queue: any[] = [...candidates];
            const nodesOut: Array<AxSnapshotNode> = [];
            const objectIds: Array<string | null> = [];

            const worker = async (): Promise<void> => {
                while (queue.length > 0) {
                    const ax: any | undefined = queue.shift();
                    if (!ax) {
                        return;
                    }

                    const axNodeIdStr: string = String(ax.nodeId);
                    const parentAxNodeId: string | null =
                        parentByChildId.get(axNodeIdStr) ?? null;
                    const childAxNodeIds: Array<string> =
                        childIdsByNodeId.get(axNodeIdStr) ?? [];

                    const backendDOMNodeId: number =
                        ax.backendDOMNodeId as number;

                    let domNodeId: number | null = null;
                    let localName: string | null = null;
                    let id: string | null = null;
                    let className: string | null = null;

                    let objectId: string | null = null;

                    // DOM.describeNode is used ONLY for tag/id/class metadata.
                    try {
                        const desc: any = await cdp.send('DOM.describeNode', {
                            backendNodeId: backendDOMNodeId,
                        });

                        const node: any = desc?.node;
                        if (node) {
                            const nodeIdCandidate: unknown = node.nodeId;
                            if (
                                typeof nodeIdCandidate === 'number' &&
                                nodeIdCandidate > 0
                            ) {
                                domNodeId = nodeIdCandidate as number;
                            } else {
                                domNodeId = null;
                            }

                            localName =
                                (node.localName as string | undefined) ??
                                (node.nodeName
                                    ? String(node.nodeName).toLowerCase()
                                    : null);

                            const attrObj: Record<string, string> = attrsToObj(
                                node.attributes as any[] | undefined
                            );
                            id = attrObj.id ?? null;
                            className = attrObj.class ?? null;
                        }
                    } catch {
                        // Ignore per-node CDP failures
                    }

                    // DOM.resolveNode provides a Runtime objectId that reliably maps to a live Element.
                    if (includeRuntimeVisual) {
                        try {
                            const resolved: any = await cdp.send(
                                'DOM.resolveNode',
                                {
                                    backendNodeId: backendDOMNodeId,
                                }
                            );
                            objectId =
                                (resolved?.object?.objectId as
                                    | string
                                    | undefined) ?? null;
                        } catch {
                            // Ignore per-node resolve failures
                        }
                    }

                    const roleStr: string | null = ax.role?.value
                        ? String(ax.role.value)
                        : null;
                    const nameStr: string | null = ax.name?.value
                        ? String(ax.name.value)
                        : null;

                    const ignoredVal: boolean | null =
                        typeof ax.ignored === 'boolean'
                            ? (ax.ignored as boolean)
                            : null;

                    const item: AxSnapshotNode = {
                        axNodeId: axNodeIdStr,
                        parentAxNodeId: parentAxNodeId,
                        childAxNodeIds: childAxNodeIds,

                        role: roleStr,
                        name: nameStr,
                        ignored: ignoredVal,

                        backendDOMNodeId: backendDOMNodeId,
                        domNodeId: domNodeId,
                        frameId: (ax.frameId as string | undefined) ?? null,

                        localName: localName,
                        id: id,
                        className: className,

                        selectorHint: null,
                        textPreview: null,

                        value: ax.value ?? null,
                        description: ax.description ?? null,
                        properties: Array.isArray(ax.properties)
                            ? (ax.properties as any[])
                            : null,
                    };

                    const index: number = nodesOut.push(item) - 1;
                    objectIds[index] = objectId;
                }
            };

            const workers: Array<Promise<void>> = Array.from(
                { length: INTERNAL_CONCURRENCY },
                (): Promise<void> => worker()
            );
            await Promise.all(workers);

            // Single batched runtime call (visual truth + optional styles + optional occlusion)
            if (includeRuntimeVisual) {
                const globalEval: any = await cdp.send('Runtime.evaluate', {
                    expression: 'globalThis',
                    returnByValue: false,
                });

                const globalObjectId: string | undefined = globalEval?.result
                    ?.objectId as string | undefined;

                if (globalObjectId) {
                    const runtimeArgs: any[] = objectIds.map(
                        (oid: string | null): any => {
                            if (oid) {
                                return { objectId: oid };
                            } else {
                                return { value: null };
                            }
                        }
                    );

                    const runtimeResult: any = await cdp.send(
                        'Runtime.callFunctionOn',
                        {
                            objectId: globalObjectId,
                            returnByValue: true,
                            functionDeclaration: `
function(textMax, includeStyles, styleProps, checkOcclusion, ...els) {
    function selectorHintFor(el) {
        if (!(el instanceof Element)) { return null; }

        const dt = el.getAttribute('data-testid')
            || el.getAttribute('data-test-id')
            || el.getAttribute('data-test');

        if (dt && dt.trim()) { return '[data-testid="' + dt.replace(/"/g, '\\\\\\"') + '"]'; }

        const ds = el.getAttribute('data-selector');
        if (ds && ds.trim()) { return '[data-selector="' + ds.replace(/"/g, '\\\\\\"') + '"]'; }

        if (el.id) { return '#' + CSS.escape(el.id); }

        return el.tagName.toLowerCase();
    }

    function textPreviewFor(el) {
        if (!(el instanceof Element)) { return null; }

        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) { return aria.trim().slice(0, textMax); }

        const txt = (el.innerText || el.textContent || '').trim();
        if (!txt) { return null; }

        return txt.slice(0, textMax);
    }

    function pickStyles(el) {
        if (!includeStyles) { return undefined; }
        if (!(el instanceof Element)) { return undefined; }

        const s = getComputedStyle(el);
        const out = {};

        for (let i = 0; i < styleProps.length; i++) {
            const prop = styleProps[i];
            try { out[prop] = s.getPropertyValue(prop); } catch {}
        }

        return out;
    }

    function intersectRects(a, b) {
        const x1 = Math.max(a.left, b.left);
        const y1 = Math.max(a.top, b.top);
        const x2 = Math.min(a.right, b.right);
        const y2 = Math.min(a.bottom, b.bottom);

        const w = Math.max(0, x2 - x1);
        const h = Math.max(0, y2 - y1);

        return {
            x: x1,
            y: y1,
            width: w,
            height: h,
            area: w * h,
        };
    }

    function occlusionInfoFor(el) {
        if (!(el instanceof Element)) {
            return {
                samplePoints: [],
                isOccluded: false,
                topElement: null,
                intersection: null,
            };
        }

        const r = el.getBoundingClientRect();
        const hasBox = Number.isFinite(r.left) && Number.isFinite(r.top) && r.width > 0 && r.height > 0;

        if (!hasBox) {
            return {
                samplePoints: [],
                isOccluded: false,
                topElement: null,
                intersection: null,
            };
        }

        // Sample center + 4 corners (inset) to better detect partial occlusion / overlap.
        const inset = Math.max(1, Math.min(6, Math.floor(Math.min(r.width, r.height) / 4)));
        const points = [
            { x: r.left + r.width / 2, y: r.top + r.height / 2 },                 // center
            { x: r.left + inset, y: r.top + inset },                               // top-left
            { x: r.right - inset, y: r.top + inset },                              // top-right
            { x: r.left + inset, y: r.bottom - inset },                            // bottom-left
            { x: r.right - inset, y: r.bottom - inset },                           // bottom-right
        ];

        let chosenTop = null;
        let chosenTopRect = null;
        let chosenIntersection = null;
        let anyHit = false;

        const samples = [];

        for (const p of points) {
            const topEl = document.elementFromPoint(p.x, p.y);

            // Consider it "hit" only if topEl is not the element itself and not a descendant.
            const hit = !!(topEl && topEl !== el && !el.contains(topEl));

            samples.push({ x: p.x, y: p.y, hit });

            if (hit) {
                anyHit = true;

                // Prefer the top element with the largest intersection area with this element's rect.
                const topRect = topEl.getBoundingClientRect();
                const inter = intersectRects(r, topRect);

                if (!chosenTop || (chosenIntersection && inter.area > chosenIntersection.area)) {
                    chosenTop = topEl;
                    chosenTopRect = topRect;
                    chosenIntersection = inter;
                }
            }
        }

        // If not occluded, DO NOT return topElement at all (prevents "self occlusion" noise).
        if (!anyHit || !chosenTop) {
            return {
                samplePoints: samples,
                isOccluded: false,
                topElement: null,
                intersection: null,
            };
        }

        const id = chosenTop.id ? chosenTop.id : null;
        const className = chosenTop.getAttribute('class') ? chosenTop.getAttribute('class') : null;

        return {
            samplePoints: samples,
            isOccluded: true,
            topElement: {
                localName: chosenTop.tagName ? chosenTop.tagName.toLowerCase() : null,
                id: id,
                className: className,
                selectorHint: selectorHintFor(chosenTop),
                boundingBox: chosenTopRect ? {
                    x: chosenTopRect.x,
                    y: chosenTopRect.y,
                    width: chosenTopRect.width,
                    height: chosenTopRect.height,
                } : null,
            },
            intersection: chosenIntersection ? {
                x: chosenIntersection.x,
                y: chosenIntersection.y,
                width: chosenIntersection.width,
                height: chosenIntersection.height,
                area: chosenIntersection.area,
            } : null,
        };
    }

    const vw = innerWidth;
    const vh = innerHeight;

    return els.map((el) => {
        if (!(el instanceof Element)) {
            return {
                selectorHint: null,
                textPreview: null,
                styles: undefined,
                runtime: {
                    boundingBox: null,
                    isVisible: false,
                    isInViewport: false,
                    occlusion: checkOcclusion ? {
                        samplePoints: [],
                        isOccluded: false,
                        topElement: null,
                        intersection: null,
                    } : undefined,
                },
            };
        }

        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);

        const isVisible =
            s.display !== 'none'
            && s.visibility !== 'hidden'
            && parseFloat(s.opacity || '1') > 0
            && r.width > 0
            && r.height > 0;

        const isInViewport =
            r.right > 0
            && r.bottom > 0
            && r.left < vw
            && r.top < vh;

        const occlusion = checkOcclusion ? occlusionInfoFor(el) : undefined;

        return {
            selectorHint: selectorHintFor(el),
            textPreview: textPreviewFor(el),
            styles: pickStyles(el),
            runtime: {
                boundingBox: {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                },
                isVisible: isVisible,
                isInViewport: isInViewport,
                occlusion: occlusion,
            },
        };
    });
}
                        `,
                            arguments: [
                                { value: textMax },
                                { value: includeStyles },
                                { value: stylePropsLower },
                                { value: checkOcclusion },
                                ...runtimeArgs,
                            ],
                        }
                    );

                    const values: any[] = (runtimeResult?.result?.value ??
                        []) as any[];

                    for (let i: number = 0; i < nodesOut.length; i++) {
                        const v: any = values[i];
                        if (!v) {
                            continue;
                        }

                        nodesOut[i].selectorHint =
                            (v.selectorHint as string | undefined) ?? null;
                        nodesOut[i].textPreview =
                            (v.textPreview as string | undefined) ?? null;

                        if (v.styles) {
                            nodesOut[i].styles = v.styles as Record<
                                string,
                                string
                            >;
                        }

                        if (v.runtime) {
                            nodesOut[i].runtime =
                                v.runtime as AxSnapshotNode['runtime'];
                        }
                    }
                }
            }

            // Apply optional runtime filters.
            let finalNodes: Array<AxSnapshotNode> = nodesOut;

            if (onlyVisible || onlyInViewport) {
                finalNodes = finalNodes.filter((n: AxSnapshotNode): boolean => {
                    if (!n.runtime) {
                        return false;
                    }

                    if (onlyVisible && !n.runtime.isVisible) {
                        return false;
                    }

                    if (onlyInViewport && !n.runtime.isInViewport) {
                        return false;
                    }

                    return true;
                });
            }

            const output: TakeAxTreeSnapshotOutput = {
                url: String(page.url()),
                title: String(await page.title()),

                axNodeCount: axNodes.length,
                candidateCount: candidateCount,
                enrichedCount: finalNodes.length,
                truncatedBySafetyCap: truncatedBySafetyCap,

                nodes: finalNodes,
            };

            return output;
        } finally {
            await cdp.detach().catch((): void => {});
        }
    }
}
