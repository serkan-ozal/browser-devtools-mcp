export const SERVER_NAME = 'browser-devtools-mcp';
export const { version: SERVER_VERSION } = require('../package.json');

const SERVER_INSTRUCTIONS: string = `
This MCP server exposes a Playwright-powered browser runtime to AI agents, enabling deep, bidirectional debugging and interaction with live web pages.

It supports both visual understanding and code-level inspection of browser state, similar to existing Playwright and Chrome DevTools–based MCP servers, with a focus on AI-driven exploration, diagnosis, and action.

Core capabilities include:

- Visual inspection of pages, layout, geometry, visibility, and styles
- DOM and code-level debugging, including attributes, computed styles, and accessibility data
- Correlation between rendered visuals and underlying DOM structure
- JavaScript evaluation in page context
- Browser control and automation (navigation, input, scrolling, viewport control)
- Long-lived, session-based debugging backed by real Playwright browser instances
- Streamable responses and server-initiated notifications for interactive analysis
- Clean lifecycle management and teardown on connection close

This server is designed for AI coding assistants, visual debugging agents, and automated analysis tools that need to reason about what a page looks like, how it is structured, and how it behaves — all through a single MCP interface.

It treats the browser as a queryable, inspectable, and controllable execution environment rather than a static screenshot source.
`;

export function getServerInstructions(): string {
    const parts: string[] = [];

    parts.push(SERVER_INSTRUCTIONS);

    const result: string = parts.join('\n\n');
    return result.trim();
}
