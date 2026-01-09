# Browser DevTools MCP

![Build Status](https://github.com/serkan-ozal/browser-devtools-mcp/actions/workflows/build.yml/badge.svg)
![NPM Version](https://badge.fury.io/js/browser-devtools-mcp.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

A powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides AI coding assistants with comprehensive browser automation and debugging capabilities using Playwright. This server enables both **execution-level debugging** (logs, network requests) and **visual debugging** (screenshots, ARIA snapshots) to help AI assistants understand and interact with web pages effectively.

## Overview

Browser DevTools MCP exposes a Playwright-powered browser runtime to AI agents, enabling deep, bidirectional debugging and interaction with live web pages. It supports both visual understanding and code-level inspection of browser state, making it ideal for AI-driven exploration, diagnosis, and automation.

### Key Capabilities

- **Visual Inspection**: Screenshots, ARIA snapshots, HTML/text extraction, PDF generation
- **DOM & Code-Level Debugging**: Element inspection, computed styles, accessibility data
- **Browser Automation**: Navigation, input, clicking, scrolling, viewport control
- **Execution Monitoring**: Console message capture, HTTP request/response tracking
- **OpenTelemetry Integration**: Automatic trace injection into web pages, UI trace collection, and backend trace correlation via trace context propagation
- **JavaScript Evaluation**: Execute code in page context
- **Session Management**: Long-lived, session-based debugging with automatic cleanup
- **Multiple Transport Modes**: Supports both stdio and HTTP transports

## Features

### Content Tools
- **Screenshots**: Capture full page or specific elements (PNG/JPEG) with image data
- **HTML/Text Extraction**: Get page content with filtering, cleaning, and minification options
- **PDF Export**: Save pages as PDF documents with customizable format and margins

### Interaction Tools
- **Click**: Click elements by CSS selector
- **Fill**: Fill form inputs
- **Hover**: Hover over elements
- **Press Key**: Simulate keyboard input
- **Select**: Select dropdown options
- **Drag**: Drag and drop operations
- **Evaluate**: Execute JavaScript in page context

### Navigation Tools
- **Go To**: Navigate to URLs with configurable wait strategies
- **Go Back**: Navigate backward in history
- **Go Forward**: Navigate forward in history

### Monitoring Tools
- **Console Messages**: Capture and filter browser console logs with advanced filtering (level, search, timestamp, sequence number)
- **HTTP Requests**: Monitor network traffic with detailed request/response data, filtering by resource type, status code, and more
- **OpenTelemetry Tracing**: Automatic trace injection into web pages, UI trace collection (document load, fetch, XMLHttpRequest, user interactions), and trace context propagation for backend correlation
- **Trace ID Management**: Get, set, and generate OpenTelemetry compatible trace IDs for distributed tracing across API calls

### Accessibility (A11Y) Tools
- **ARIA Snapshots**: Capture semantic structure and accessibility roles in YAML format
- **AX Tree Snapshots**: Combine Chromium's Accessibility tree with runtime visual diagnostics (bounding boxes, visibility, occlusion detection, computed styles)

## Prerequisites

- Node.js 18+
- An AI assistant (with MCP client) like Cursor, Claude (Desktop or Code), VS Code, Windsurf, etc.

## Quick Start

This MCP server (using `STDIO` or `Streamable HTTP` transport) can be added to any MCP Client 
like VS Code, Claude, Cursor, Windsurf, GitHub Copilot via the `browser-devtools-mcp` NPM package.

No manual installation required! The server can be run directly using `npx`, which automatically downloads and runs the package.

### CLI Arguments

Browser DevTools MCP server supports the following CLI arguments for configuration:
- `--transport <stdio|streamable-http>` - Configures the transport protocol (defaults to `stdio`).
- `--port <number>` – Configures the port number to listen on when using `streamable-http` transport (defaults to `3000`).

## MCP Client Configuration

### Claude Desktop

#### Local Server
Add the following configuration into the `claude_desktop_config.json` file.
See the [Claude Desktop MCP docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers) for more info.

```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp"]
    }
  }
}
```

#### Remote Server (HTTP Transport)
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then, go to `Settings` > `Connectors` > `Add Custom Connector` in Claude Desktop and add the MCP server with:
- Name: `Browser DevTools`
- Remote MCP server URL: Point to where your server is hosted (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely)

### Claude Code

Run the following command.
See [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp) for more info.

#### Local Server
```bash
claude mcp add browser-devtools -- npx -y browser-devtools-mcp
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the MCP server:
```bash
claude mcp add --transport http browser-devtools <SERVER_URL>
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### Cursor

Add the following configuration into the `~/.cursor/mcp.json` file (or `.cursor/mcp.json` in your project folder).
See the [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more info.

#### Local Server
```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp"]
    }
  }
}
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the configuration:
```json
{
  "mcpServers": {
    "browser-devtools": {
      "url": "<SERVER_URL>"
    }
  }
}
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### VS Code

Add the following configuration into the `.vscode/mcp.json` file.
See the [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

#### Local Server
```json
{
  "mcp": {
    "servers": {
      "browser-devtools": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "browser-devtools-mcp"]
      }
    }
  }
}
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the configuration:
```json
{
  "mcp": {
    "servers": {
      "browser-devtools": {
        "type": "http",
        "url": "<SERVER_URL>"
      }
    }
  }
}
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### Windsurf

Add the following configuration into the `~/.codeium/windsurf/mcp_config.json` file. 
See the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) for more info.

#### Local Server
```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp"]
    }
  }
}
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the configuration:
```json
{
  "mcpServers": {
    "browser-devtools": {
      "serverUrl": "<SERVER_URL>"
    }
  }
}
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### Copilot Coding Agent

Add the following configuration to the `mcpServers` section of your Copilot Coding Agent configuration through 
`Repository` > `Settings` > `Copilot` > `Coding agent` > `MCP configuration`.
See the [Copilot Coding Agent MCP docs](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp) for more info.

#### Local Server
```json
{
  "mcpServers": {
    "browser-devtools": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp"]
    }
  }
}
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the configuration:
```json
{
  "mcpServers": {
    "browser-devtools": {
      "type": "http",
      "url": "<SERVER_URL>"
    }
  }
}
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### Gemini CLI

Add the following configuration into the `~/.gemini/settings.json` file.
See the [Gemini CLI MCP docs](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for more info.

#### Local Server
```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp"]
    }
  }
}
```

#### Remote Server
First, start the server with HTTP transport:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

Then add the configuration:
```json
{
  "mcpServers": {
    "browser-devtools": {
      "httpUrl": "<SERVER_URL>"
    }
  }
}
```

Replace `<SERVER_URL>` with your server URL (e.g., `http://localhost:3000/mcp` if running locally, or `https://your-server.com/mcp` if hosted remotely).

### Smithery

Run the following command.
You can find your Smithery API key [here](https://smithery.ai/account/api-keys).
See the [Smithery CLI docs](https://smithery.ai/docs/concepts/cli) for more info.

```bash
npx -y @smithery/cli install serkan-ozal/browser-devtools-mcp --client <SMITHERY-CLIENT-NAME> --key <SMITHERY-API-KEY>
```

## HTTP Transport

To use HTTP transport, start the server with:
```bash
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
```

The server exposes the following endpoints:

- `GET /health` - Health check
- `GET /ping` - Ping endpoint
- `GET /mcp` - MCP protocol info
- `POST /mcp` - MCP protocol messages
- `DELETE /mcp` - Delete session

**Important**: When configuring remote MCP servers, use the actual URL where your server is hosted:
- If running locally: `http://localhost:3000/mcp` (or `http://127.0.0.1:3000/mcp`)
- If hosted remotely: `https://your-server.com/mcp` (replace with your actual server URL)

## MCP Inspector

Test the server using the MCP Inspector:

```bash
# For stdio transport
npx -y @modelcontextprotocol/inspector npx -y browser-devtools-mcp

# For HTTP transport (start server first)
npx -y browser-devtools-mcp --transport=streamable-http --port=3000
# Then in another terminal:
npx -y @modelcontextprotocol/inspector http://localhost:3000/mcp --transport http
```

## Configuration

The server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for HTTP transport | `3000` |
| `SESSION_IDLE_SECONDS` | Idle session timeout (seconds) | `300` |
| `SESSION_IDLE_CHECK_SECONDS` | Interval for checking idle sessions (seconds) | `30` |
| `SESSION_CLOSE_ON_SOCKET_CLOSE` | Close session when socket closes | `false` |
| `CONSOLE_MESSAGES_BUFFER_SIZE` | Maximum console messages to buffer | `1000` |
| `HTTP_REQUESTS_BUFFER_SIZE` | Maximum HTTP requests to buffer | `1000` |
| `BROWSER_HEADLESS_ENABLE` | Run browser in headless mode | `true` |
| `BROWSER_PERSISTENT_ENABLE` | Use persistent browser context (preserves cookies, localStorage, etc.) | `false` |
| `BROWSER_PERSISTENT_USER_DATA_DIR` | Directory for persistent browser context user data | `./browser-devtools-mcp` |
| `BROWSER_USE_INSTALLED_ON_SYSTEM` | Use system-installed Chrome browser instead of Playwright's bundled browser | `false` |
| `BROWSER_EXECUTABLE_PATH` | Custom browser executable path | (uses Playwright default) |
| `OTEL_ENABLE` | Enable OpenTelemetry integration | `false` |
| `OTEL_SERVICE_NAME` | OpenTelemetry service name | `frontend` |
| `OTEL_SERVICE_VERSION` | OpenTelemetry service version | (none) |
| `OTEL_ASSETS_DIR` | Directory containing OpenTelemetry bundle files | (uses default) |
| `OTEL_EXPORTER_TYPE` | OpenTelemetry exporter type: "otlp/http", "console", or "none" | `none` |
| `OTEL_EXPORTER_HTTP_URL` | OpenTelemetry collector base URL (e.g., "http://localhost:4318") | (none) |
| `OTEL_EXPORTER_HTTP_HEADERS` | OpenTelemetry exporter HTTP headers (comma-separated key=value pairs) | (none) |
| `OTEL_INSTRUMENTATION_USER_INTERACTION_EVENTS` | User interaction events to instrument (comma-separated, e.g., "click,submit") | `click` |

## Available Tools

### Content Tools

#### `content_take-screenshot`
Takes a screenshot of the current page or a specific element.

**Parameters:**
- `outputPath` (string, optional): Directory path where screenshot will be saved (default: OS temp directory)
- `name` (string, optional): Screenshot name (default: "screenshot")
- `selector` (string, optional): CSS selector for element to capture
- `fullPage` (boolean, optional): Capture full scrollable page (default: false)
- `type` (enum, optional): Image format - "png" or "jpeg" (default: "png")

**Returns:**
- `filePath` (string): Full path of the saved screenshot file
- `image` (object): Screenshot image data with mimeType

#### `content_get-as-html`
Retrieves the HTML content of the current page or a specific element.

**Parameters:**
- `selector` (string, optional): CSS selector to limit the HTML content to a specific container
- `removeScripts` (boolean, optional): Remove all script tags from the HTML (default: true)
- `removeComments` (boolean, optional): Remove all HTML comments (default: false)
- `removeStyles` (boolean, optional): Remove all style tags from the HTML (default: false)
- `removeMeta` (boolean, optional): Remove all meta tags from the HTML (default: false)
- `cleanHtml` (boolean, optional): Perform comprehensive HTML cleaning (default: false)
- `minify` (boolean, optional): Minify the HTML output (default: false)
- `maxLength` (number, optional): Maximum number of characters to return (default: 50000)

**Returns:**
- `output` (string): The requested HTML content of the page

#### `content_get-as-text`
Retrieves the visible text content of the current page or a specific element.

**Parameters:**
- `selector` (string, optional): CSS selector to limit the text content to a specific container
- `maxLength` (number, optional): Maximum number of characters to return (default: 50000)

**Returns:**
- `output` (string): The requested text content of the page

#### `content_save-as-pdf`
Saves the current page as a PDF document.

**Parameters:**
- `outputPath` (string, optional): Directory path where PDF will be saved (default: OS temp directory)
- `name` (string, optional): PDF name (default: "page")
- `format` (enum, optional): Page format - "Letter", "Legal", "Tabloid", "Ledger", "A0" through "A6" (default: "A4")
- `printBackground` (boolean, optional): Whether to print background graphics (default: false)
- `margin` (object, optional): Page margins with top, right, bottom, left (default: "1cm" for each)

**Returns:**
- `filePath` (string): Full path of the saved PDF file

### Interaction Tools

#### `interaction_click`
Clicks an element on the page.

**Parameters:**
- `selector` (string, required): CSS selector for the element to click

#### `interaction_fill`
Fills a form input field.

**Parameters:**
- `selector` (string, required): CSS selector for the input field
- `value` (string, required): Value to fill

#### `interaction_hover`
Hovers over an element.

**Parameters:**
- `selector` (string, required): CSS selector for the element to hover

#### `interaction_press-key`
Simulates keyboard input.

**Parameters:**
- `key` (string, required): Key to press (e.g., "Enter", "Escape", "Tab")

#### `interaction_select`
Selects an option from a dropdown.

**Parameters:**
- `selector` (string, required): CSS selector for the select element
- `value` (string, required): Value to select

#### `interaction_drag`
Performs drag and drop operation.

**Parameters:**
- `sourceSelector` (string, required): CSS selector for the source element
- `targetSelector` (string, required): CSS selector for the target element

#### `interaction_evaluate`
Executes JavaScript in the browser console.

**Parameters:**
- `script` (string, required): JavaScript code to execute

**Returns:**
- `result` (any): Result of the JavaScript evaluation

### Navigation Tools

#### `navigation_go-to`
Navigates to a URL.

**Parameters:**
- `url` (string, required): URL to navigate to (must include scheme)
- `timeout` (number, optional): Maximum operation time in milliseconds (default: 0 - no timeout)
- `waitUntil` (enum, optional): When to consider navigation succeeded - "load", "domcontentloaded", "networkidle", or "commit" (default: "load")

**Returns:**
- `url` (string): Final URL after navigation
- `status` (number): HTTP status code
- `statusText` (string): HTTP status text
- `ok` (boolean): Whether navigation was successful (2xx status)

#### `navigation_go-back`
Navigates backward in browser history.

#### `navigation_go-forward`
Navigates forward in browser history.

### Monitoring Tools

#### `monitoring_get-console-messages`
Retrieves console messages/logs from the browser with advanced filtering.

**Parameters:**
- `type` (enum, optional): Filter by message level - "ERROR", "WARNING", "INFO", "DEBUG"
- `search` (string, optional): Text to search for in messages
- `timestamp` (number, optional): Start time filter (Unix epoch milliseconds)
- `sequenceNumber` (number, optional): Only return messages after this sequence number
- `limit` (object, optional): Limit results
  - `count` (number): Maximum number of messages
  - `from` (enum): "start" or "end" (default: "end")

**Returns:**
- `messages` (array): Array of console messages with type, text, location, timestamp, and sequence number

#### `monitoring_get-http-requests`
Retrieves HTTP requests from the browser with detailed filtering.

**Parameters:**
- `resourceType` (enum, optional): Filter by resource type (e.g., "document", "script", "stylesheet")
- `status` (object, optional): Filter by status code range
  - `min` (number): Minimum status code
  - `max` (number): Maximum status code
- `ok` (boolean, optional): Filter by success/failure (2xx = success)
- `timestamp` (number, optional): Start time filter (Unix epoch milliseconds)
- `sequenceNumber` (number, optional): Only return requests after this sequence number
- `limit` (object, optional): Limit results
  - `count` (number): Maximum number of requests
  - `from` (enum): "start" or "end" (default: "end")

**Returns:**
- `requests` (array): Array of HTTP requests with URL, method, headers, body, response, timing, and metadata

#### `monitoring_get-trace-id`
Gets the OpenTelemetry compatible trace id of the current session.

**Parameters:**
- No input parameters

**Returns:**
- `traceId` (string, optional): The OpenTelemetry compatible trace id of the current session if available

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`).

#### `monitoring_new-trace-id`
Generates a new OpenTelemetry compatible trace id and sets it to the current session.

**Parameters:**
- No input parameters

**Returns:**
- `traceId` (string): The generated new OpenTelemetry compatible trace id

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`). The new trace ID is automatically set and will be used for all subsequent traces in the session.

#### `monitoring_set-trace-id`
Sets the OpenTelemetry compatible trace id of the current session.

**Parameters:**
- `traceId` (string, optional): The OpenTelemetry compatible trace id to be set. Leave it empty to clear the session trace id, so no OpenTelemetry trace header will be propagated from browser throughout the API calls

**Returns:**
- No return value

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`). When a trace ID is set, it will be propagated in HTTP headers (traceparent) for all API calls, enabling correlation with backend traces.

### Accessibility (A11Y) Tools

#### `a11y_take-aria-snapshot`
Captures an ARIA (accessibility) snapshot of the current page or a specific element.

**Parameters:**
- `selector` (string, optional): CSS selector for element to snapshot

**Returns:**
- `output` (string): Includes the page URL, title, and a YAML-formatted accessibility tree

**Usage:**
- Use in combination with `accessibility_take-ax-tree-snapshot` for comprehensive UI analysis
- Provides semantic structure and accessibility roles
- Helps identify accessibility issues and page hierarchy problems

#### `accessibility_take-ax-tree-snapshot`
Captures a UI-focused snapshot by combining Chromium's Accessibility (AX) tree with runtime visual diagnostics.

**Parameters:**
- `roles` (array, optional): Optional role allowlist (button, link, textbox, checkbox, radio, combobox, switch, tab, menuitem, dialog, heading, listbox, listitem, option). If omitted, a built-in set of interactive roles is used
- `includeStyles` (boolean, optional): Whether to include computed CSS styles for each node (default: true)
- `includeRuntimeVisual` (boolean, optional): Whether to compute runtime visual information (bounding box, visibility, viewport) (default: true)
- `checkOcclusion` (boolean, optional): If true, checks whether each element is visually occluded by another element using elementFromPoint() sampled at multiple points (default: false)
- `onlyVisible` (boolean, optional): If true, only visually visible nodes are returned (default: false)
- `onlyInViewport` (boolean, optional): If true, only nodes intersecting the viewport are returned (default: false)
- `textPreviewMaxLength` (number, optional): Maximum length of the text preview extracted from each element (default: 80)
- `styleProperties` (array, optional): List of CSS computed style properties to extract (default: includes display, visibility, opacity, position, z-index, colors, fonts, etc.)

**Returns:**
- `url` (string): The current page URL at the time the AX snapshot was captured
- `title` (string): The document title of the page at the time of the snapshot
- `axNodeCount` (number): Total number of nodes returned by Chromium Accessibility.getFullAXTree before filtering
- `candidateCount` (number): Number of DOM-backed AX nodes that passed role filtering before enrichment
- `enrichedCount` (number): Number of nodes included in the final enriched snapshot output
- `truncatedBySafetyCap` (boolean): Indicates whether the result set was truncated by an internal safety cap
- `nodes` (array): List of enriched DOM-backed AX nodes combining accessibility metadata with visual diagnostics, including:
  - `axNodeId`, `parentAxNodeId`, `childAxNodeIds`: Tree structure
  - `role`, `name`, `ignored`: Accessibility properties
  - `backendDOMNodeId`, `domNodeId`, `frameId`: DOM references
  - `localName`, `id`, `className`, `selectorHint`: Element identification
  - `textPreview`: Short preview of rendered text content
  - `styles`: Computed CSS styles (if includeStyles is true)
  - `runtime`: Visual diagnostics including boundingBox, isVisible, isInViewport, and optional occlusion data

**Usage:**
- Use to detect UI issues like elements that exist semantically but are visually hidden or off-screen
- Identify wrong layout/geometry, styling issues, and overlap/stacking/occlusion problems
- ALWAYS use `checkOcclusion: true` when investigating UI/layout problems
- Use alongside `a11y_take-aria-snapshot` tool for complete UI analysis

## Architecture

### Session Management

The server uses session-based architecture where each MCP client connection gets its own browser context and page. Sessions are automatically cleaned up when:

- The client disconnects
- The session becomes idle (configurable timeout)
- The session is explicitly closed

### Browser Support

The server supports multiple browser engines:
- **Chromium** (default)
- **Firefox**
- **WebKit**

**Browser Configuration:**
- **Headless Mode**: By default, browsers run in headless mode (`BROWSER_HEADLESS_ENABLE=true`). Set to `false` to see the browser window.
- **Persistent Context**: When enabled (`BROWSER_PERSISTENT_ENABLE=true`), browser contexts persist across sessions, preserving:
  - Cookies and session data
  - LocalStorage and IndexedDB
  - Browser extensions and settings
  - User preferences
  
  Persistent contexts are shared across sessions and are not automatically closed when sessions end.
  
- **System Browser**: When enabled (`BROWSER_USE_INSTALLED_ON_SYSTEM=true`), the server uses the system-installed Chrome browser instead of Playwright's bundled browser. This is useful for:
  - Testing with the exact browser version users have
  - Using browser extensions installed on the system
  - Better compatibility with certain web applications
  
  **Note:** System browser support is currently only available for Chromium/Chrome.

Browser instances are shared across sessions for efficiency. Each session gets its own isolated browser context, unless persistent context is enabled (in which case contexts are shared).

### Buffering & Filtering

Console messages and HTTP requests are buffered in memory with configurable buffer sizes. Both tools support advanced filtering:

- **Level-based filtering**: Filter by severity/type
- **Text search**: Search within message/request content
- **Time-based filtering**: Filter by timestamp
- **Incremental retrieval**: Use sequence numbers to fetch only new items
- **Pagination**: Limit results with start/end trimming

### OpenTelemetry Integration

When enabled (`OTEL_ENABLE=true`), the server automatically injects OpenTelemetry instrumentation into all web pages navigated by the browser. This enables:

- **Automatic Trace Collection**: UI traces are automatically collected for:
  - Document load events
  - Fetch/XHR requests
  - User interactions (clicks, form submissions, etc.)
  
- **Trace Context Propagation**: Trace IDs are automatically propagated in HTTP headers (traceparent) for all API calls, enabling:
  - Correlation between frontend and backend traces
  - End-to-end distributed tracing across the entire application stack
  
- **Trace ID Management**: Tools allow you to:
  - Get the current session's trace ID
  - Generate new trace IDs
  - Set custom trace IDs (e.g., from backend trace context)
  
- **Exporter Configuration**: Traces can be exported to:
  - **OTLP/HTTP**: Send to OpenTelemetry collector (configure via `OTEL_EXPORTER_HTTP_URL`)
  - **Console**: Log traces to browser console (for debugging)
  - **None**: Collect traces but don't export (for testing)

The OpenTelemetry integration uses a proxy mechanism (`/__mcp_otel/`) to forward traces from the browser to the configured collector, ensuring proper CORS handling and trace context propagation.

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/serkan-ozal/browser-devtools-mcp.git
cd browser-devtools-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start server with stdio transport
- `npm run start:http` - Start server with HTTP transport
- `npm run watch` - Watch mode for development
- `npm run inspector` - Run MCP Inspector (stdio)
- `npm run inspector:http` - Run MCP Inspector (HTTP)
- `npm run lint:check` - Check code formatting
- `npm run lint:format` - Format code

## Use Cases

### For AI Coding Assistants

This server enables AI assistants to:

1. **Debug Web Applications**: Capture screenshots, inspect DOM, check console errors
2. **Monitor Network Activity**: Track API calls, analyze request/response patterns
3. **Distributed Tracing**: Enable OpenTelemetry to correlate frontend and backend traces for end-to-end debugging
4. **Test User Flows**: Automate navigation and interactions
5. **Visual Verification**: Compare visual states, verify UI changes
6. **Content Extraction**: Get HTML/text content with filtering and cleaning options
7. **Accessibility Analysis**: Use ARIA and AX tree snapshots to understand page structure and detect UI issues
8. **Performance Analysis**: Monitor HTTP request timing and failures

### Example Workflow

1. Navigate to a web page using `navigation_go-to`
2. Take a screenshot with `content_take-screenshot` to see the current state
3. Check console messages with `monitoring_get-console-messages` for errors
4. Monitor HTTP requests with `monitoring_get-http-requests` to see API calls
5. Capture accessibility snapshots with `a11y_take-aria-snapshot` and `accessibility_take-ax-tree-snapshot` to understand page structure
6. Interact with elements using `interaction_click`, `interaction_fill`, etc.
7. Extract content using `content_get-as-html` or `content_get-as-text`
8. Save the page as PDF using `content_save-as-pdf` for documentation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

**Serkan Ozal**

- Email: serkanozal86@gmail.com
- GitHub: [@serkan-ozal](https://github.com/serkan-ozal)

## Acknowledgments

- Built with [Playwright](https://playwright.dev) for browser automation
- Uses [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) for MCP implementation
- HTTP transport powered by [Hono](https://hono.dev)
