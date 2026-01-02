export const SERVER_NAME = 'browser-devtools-mcp';
export const { version: SERVER_VERSION } = require('../package.json');

export const SERVER_INSTRUCTIONS: string = `
This MCP server exposes a Playwright-powered browser runtime to AI agents, 
enabling deep, bidirectional debugging and interaction with live web pages.

It supports both visual understanding and code-level inspection of browser state, 
similar to existing Playwright and Chrome DevTools–based MCP servers, with a focus on AI-driven exploration, diagnosis, and action.

Core capabilities include:
- Visual inspection of pages, layout, geometry, visibility, stacking, and styles
- DOM and code-level debugging, including attributes, computed styles, and accessibility data
- Correlation between rendered visuals and underlying DOM / accessibility structure
- JavaScript evaluation in page context for advanced diagnostics
- Browser control and automation (navigation, input, scrolling, viewport control)
- Long-lived, session-based debugging backed by real Playwright browser instances
- Streamable responses and server-initiated notifications for interactive analysis
- Clean lifecycle management and teardown on connection close

UI debugging guidance for AI agents:
- Prefer Accessibility (AX) and ARIA snapshots over raw DOM dumps when diagnosing UI problems.
  These snapshots provide higher-signal, semantically meaningful anchors (roles, names, states) that
  map more reliably to what users perceive and what assistive tech can interact with.
- Use the AX Tree Snapshot tool to correlate interactive semantics with runtime visual truth:
  bounding boxes, visibility, viewport intersection, and (optionally) computed styles.
- If a UI control appears present but interactions fail (e.g., clicks do nothing), suspect overlap/occlusion.
  In such cases, enable occlusion checking ("elementFromPoint") to identify which element is actually on top.
- Use ARIA snapshots to reason about accessibility roles/states and to validate that the intended
  semantics (labels, roles, disabled state, focusability) match the visible UI.

This server is designed for AI coding assistants, visual debugging agents, and automated analysis tools 
that need to reason about what a page looks like, how it is structured, and how it behaves — all through a single MCP interface.

It treats the browser as a queryable, inspectable, and controllable execution environment rather than a static screenshot source.
`;

export const UI_DEBUGGING_POLICY: string = `
<ui_debugging_policy>
When asked to check for UI problems, layout issues, or visual bugs, ALWAYS follow this policy:

1. **Visual Inspection**: Take screenshot for general aesthetics and layout overview
2. **Accessibility Tree Analysis**: Call "a11y_take-ax-tree-snapshot" tool with "checkOcclusion:true"
   - Provides precise bounding boxes, runtime visual data, and occlusion detection
   - Best for detecting overlaps and measuring exact positions
3. **ARIA Snapshot**: Call "a11y_take-aria-snapshot" tool (full page or specific selector)
   - Provides semantic structure and accessibility roles
   - Best for understanding page hierarchy and accessibility issues
4. **Manual Verification**: Calculate bounding box overlaps:
   - Horizontal: (element1.x + element1.width) ≤ element2.x
   - Vertical: (element1.y + element1.height) ≤ element2.y
5. **Report ALL findings**: aesthetic issues, overlaps, spacing problems, alignment issues, 
   accessibility problems, semantic structure issues

**Why both tools?**
- AX tree: Technical measurements, occlusion, precise positioning
- ARIA snapshot: Semantic understanding, accessibility structure, role hierarchy

Never assume "looks good visually" = "no problems". Overlaps and accessibility issues 
can be functionally broken while appearing visually correct.
</ui_debugging_policy>
`;

export function getServerInstructions(): string {
    const parts: string[] = [];

    parts.push(SERVER_INSTRUCTIONS);

    const result: string = parts.join('\n\n');
    return result.trim();
}
