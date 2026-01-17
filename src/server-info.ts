export const SERVER_NAME = 'browser-devtools-mcp';
export const { version: SERVER_VERSION } = require('../package.json');

export const SERVER_INSTRUCTIONS: string = `
This MCP server exposes a Playwright-powered browser runtime to AI agents, 
enabling deep, bidirectional debugging and interaction with live web pages.

It supports both visual understanding and code-level inspection of browser state, 
similar to existing Playwright and Chrome DevTools–based MCP servers, with a focus on AI-driven exploration, diagnosis, and action.

Core capabilities include:

**Content & Visual Inspection:**
- Screenshots (full page or specific elements)
- HTML and text content extraction with filtering options
- PDF generation with customizable formats
- Design comparison: Compare live page UI against Figma designs with similarity scoring
- Accessibility snapshots (ARIA and AX tree) with visual diagnostics
- Viewport and window resizing for responsive testing

**Browser Control & Interaction:**
- Navigation (go to URL, back, forward)
- Element interaction (click, fill, hover, select, drag)
- Keyboard simulation (press-key)
- Scrolling (viewport or container-based with multiple modes)
- Viewport emulation and real window resizing

**JavaScript Execution:**
- Run JavaScript in browser page context (access to window, document, DOM, Web APIs)
- Run JavaScript in Node.js VM sandbox on the server (with Playwright Page access and safe built-ins)

**Observability & Monitoring:**
- Console message capture with filtering
- HTTP request/response monitoring with detailed filtering
- Web Vitals performance metrics (LCP, INP, CLS, TTFB, FCP) with recommendations
- OpenTelemetry trace ID management for distributed tracing correlation

**Network Stubbing & Mocking:**
- HTTP request interception and modification (headers, body, method) using glob patterns
- HTTP response mocking (fulfill with custom status/headers/body or abort) with configurable delay, times limit, and probability
- Stub management (list all installed stubs, clear specific or all stubs)
- Supports A/B testing, security testing, offline testing, error scenarios, and flaky API testing

**Synchronization:**
- Network idle waiting for async operations
- Configurable timeouts and polling intervals

**Design Comparison:**
- Figma design comparison: Compare live page UI against Figma design snapshots
- Multi-signal similarity scoring (MSSIM, image embedding, text embedding)
- Configurable weights and comparison modes (raw vs semantic)

**React Component Inspection:**
- Get component for element: Find React component(s) associated with a DOM element using React Fiber
- Get element for component: Map a React component instance to the DOM elements it renders
- Requires persistent browser context (BROWSER_PERSISTENT_ENABLE=true) for optimal operation
- React DevTools extension must be manually installed in the browser profile (MCP server does NOT auto-install)
- Without extension, tools fall back to best-effort DOM scanning for __reactFiber$ pointers (less reliable)

**Advanced Features:**
- OpenTelemetry integration: Automatic UI trace collection and backend trace correlation
- Session-based architecture with long-lived browser contexts
- Persistent browser contexts for stateful sessions (required for React tools)
- Headless and headful mode support
- System-installed browser usage option
- Streamable responses and server-initiated notifications
- Clean lifecycle management and teardown

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
- Before taking screenshots or snapshots, wait for network idle to ensure page stability.
- Use Web Vitals tool to assess performance and identify optimization opportunities.
- For design validation, use "figma_compare-page-with-design" to compare live page UI against Figma designs:
  - Use "semantic" MSSIM mode for comparing real data vs design data (less sensitive to text/value differences)
  - Use "raw" MSSIM mode only when expecting near pixel-identical output
  - If layout mismatch is suspected, run with fullPage=true first, then retry with a selector for the problematic region
  - Notes explain which signals were used or skipped; skipped signals usually mean missing cloud configuration
- For React component inspection, use "react_get-component-for-element" and "react_get-element-for-component":
  - These tools work best with persistent browser context enabled (BROWSER_PERSISTENT_ENABLE=true)
  - React DevTools extension must be manually installed in the browser profile (MCP server does NOT auto-install)
  - Chrome Web Store: https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi
  - Without extension, tools use best-effort DOM scanning (less reliable than using DevTools hook)
  - Component names and debug source info are best-effort and may vary by build (dev/prod)
- For distributed tracing, set trace IDs before navigation to correlate frontend and backend traces.
- For testing and debugging scenarios, use stub tools to intercept/modify requests or mock responses:
  - Use "stub_intercept-http-request" to modify outgoing requests (inject headers, change body/method)
  - Use "stub_mock-http-response" to mock responses for offline testing, error scenarios, or flaky API simulation
  - Use "stub_list" to check what stubs are active and "stub_clear" to remove them when done

This server is designed for AI coding assistants, visual debugging agents, and automated analysis tools 
that need to reason about what a page looks like, how it is structured, and how it behaves — all through a single MCP interface.

It treats the browser as a queryable, inspectable, and controllable execution environment rather than a static screenshot source.
`;

export const UI_DEBUGGING_POLICY: string = `
<ui_debugging_policy>
When asked to check for UI problems, layout issues, or visual bugs, ALWAYS follow this policy:

1. **Synchronization**: If the page loads content asynchronously, call "sync_wait-for-network-idle" first
   to ensure the page is stable before inspection.

2. **Visual Inspection**: Call "content_take-screenshot" for general aesthetics and layout overview.

3. **Accessibility Tree Analysis**: Call "a11y_take-ax-tree-snapshot" tool with "checkOcclusion:true"
   - Provides precise bounding boxes, runtime visual data, and occlusion detection
   - Best for detecting overlaps and measuring exact positions
   - Use "onlyVisible:true" or "onlyInViewport:true" to filter results
   - Set "includeStyles:true" to analyze computed CSS properties

4. **ARIA Snapshot**: Call "a11y_take-aria-snapshot" tool (full page or specific selector)
   - Provides semantic structure and accessibility roles
   - Best for understanding page hierarchy and accessibility issues
   - Use in combination with AX tree snapshot for comprehensive analysis

5. **Design Comparison** (if Figma design is available): Call "figma_compare-page-with-design" tool
   - Compares live page UI against Figma design snapshot
   - Returns combined similarity score using multiple signals (MSSIM, image embedding, text embedding)
   - Use "semantic" mode for real data vs design data comparisons
   - Use "raw" mode only when expecting pixel-identical output
   - Notes explain which signals were used or skipped

6. **React Component Inspection** (if page uses React): Use React tools to understand component structure
   - Call "react_get-component-for-element" with selector or (x,y) to find React component for a DOM element
   - Call "react_get-element-for-component" to find DOM elements rendered by a React component
   - **Important:** These tools require persistent browser context (BROWSER_PERSISTENT_ENABLE=true)
   - React DevTools extension must be manually installed in the browser profile for optimal reliability
   - Without extension, tools use best-effort DOM scanning (less reliable)
   - Component names and debug source info are best-effort and may vary by build (dev/prod)

7. **Performance Check** (optional but recommended): Call "o11y_get-web-vitals" to assess page performance
   - Identifies performance issues that may affect user experience
   - Provides actionable recommendations based on Google's thresholds

8. **Console & Network Inspection**: Check for errors and failed requests
   - Call "o11y_get-console-messages" with "type:ERROR" to find JavaScript errors
   - Call "o11y_get-http-requests" with "ok:false" to find failed network requests
   - If network issues are suspected or testing error scenarios, use stub tools:
     - Use "stub_mock-http-response" to simulate error responses (e.g., 500, 404, timeout) to test UI error handling
     - Use "stub_intercept-http-request" to modify requests (e.g., inject headers) to test different scenarios
     - Use "stub_list" to verify active stubs and "stub_clear" to remove them after testing

9. **Manual Verification**: Calculate bounding box overlaps:
   - Horizontal: (element1.x + element1.width) ≤ element2.x
   - Vertical: (element1.y + element1.height) ≤ element2.y

10. **Report ALL findings**: aesthetic issues, overlaps, spacing problems, alignment issues, 
   accessibility problems, semantic structure issues, design parity issues (if compared with Figma),
   React component structure issues (if inspected), performance problems, console errors, failed requests

11. **JavaScript Execution** (when needed for advanced debugging):
   - Use "run_js-in-browser" to inspect or mutate DOM state, read client-side variables, or extract computed values directly from the page
   - Use "run_js-in-sandbox" for server-side automation logic that needs access to Playwright Page object or safe built-ins

**Tool Usage Notes:**
- AX tree: Technical measurements, occlusion, precise positioning, visual diagnostics
- ARIA snapshot: Semantic understanding, accessibility structure, role hierarchy
- Screenshot: Quick visual reference, but not sufficient alone
- Network idle: Essential for SPAs and async content
- Web Vitals: Performance context for UI issues

**Important:**
- Never assume "looks good visually" = "no problems". Overlaps and accessibility issues 
  can be functionally broken while appearing visually correct.
- Always check occlusion when interactions fail or elements appear misaligned.
- Use scroll tool if elements are below the fold before inspection.
- For responsive issues, use resize-viewport or resize-window tools to test different sizes.
</ui_debugging_policy>
`;

export function getServerInstructions(): string {
    const parts: string[] = [];

    parts.push(SERVER_INSTRUCTIONS);

    const result: string = parts.join('\n\n');
    return result.trim();
}
