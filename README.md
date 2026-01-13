# Browser DevTools MCP

![Build Status](https://github.com/serkan-ozal/browser-devtools-mcp/actions/workflows/build.yml/badge.svg)
![NPM Version](https://badge.fury.io/js/browser-devtools-mcp.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

A powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides AI coding assistants with comprehensive browser automation and debugging capabilities using Playwright. This server enables both **execution-level debugging** (logs, network requests) and **visual debugging** (screenshots, ARIA snapshots) to help AI assistants understand and interact with web pages effectively.

## Overview

Browser DevTools MCP exposes a Playwright-powered browser runtime to AI agents, enabling deep, bidirectional debugging and interaction with live web pages. It supports both visual understanding and code-level inspection of browser state, making it ideal for AI-driven exploration, diagnosis, and automation.

### Key Capabilities

- **Visual Inspection**: Screenshots, ARIA snapshots, HTML/text extraction, PDF generation
- **Design Comparison**: Compare live page UI against Figma designs with similarity scoring
- **DOM & Code-Level Debugging**: Element inspection, computed styles, accessibility data
- **Browser Automation**: Navigation, input, clicking, scrolling, viewport control
- **Execution Monitoring**: Console message capture, HTTP request/response tracking
- **OpenTelemetry Integration**: Automatic trace injection into web pages, UI trace collection, and backend trace correlation via trace context propagation
- **JavaScript Execution**: Execute code in browser page context or in Node.js VM sandbox on the server
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
- **Scroll**: Scroll the page viewport or specific scrollable elements with multiple modes (by, to, top, bottom, left, right)
- **Resize Viewport**: Resize the page viewport using Playwright viewport emulation
- **Resize Window**: Resize the real browser window (OS-level) using Chrome DevTools Protocol

### Navigation Tools
- **Go To**: Navigate to URLs with configurable wait strategies
- **Go Back**: Navigate backward in history
- **Go Forward**: Navigate forward in history

### Run Tools
- **JS in Browser**: Execute JavaScript code inside the active browser page (page context with access to window, document, DOM, and Web APIs)
- **JS in Sandbox**: Execute JavaScript code in a Node.js VM sandbox on the MCP server (with access to Playwright Page, console logging, and safe built-ins)

### Observability (O11Y) Tools
- **Console Messages**: Capture and filter browser console logs with advanced filtering (level, search, timestamp, sequence number)
- **HTTP Requests**: Monitor network traffic with detailed request/response data, filtering by resource type, status code, and more
- **Web Vitals**: Collect Core Web Vitals (LCP, INP, CLS) and supporting metrics (TTFB, FCP) with ratings and recommendations based on Google's thresholds
- **OpenTelemetry Tracing**: Automatic trace injection into web pages, UI trace collection (document load, fetch, XMLHttpRequest, user interactions), and trace context propagation for backend correlation
- **Trace ID Management**: Get, set, and generate OpenTelemetry compatible trace IDs for distributed tracing across API calls

### Synchronization Tools
- **Wait for Network Idle**: Wait until the page reaches a network-idle condition based on in-flight request count, useful for SPA pages and before taking screenshots

### Accessibility (A11Y) Tools
- **ARIA Snapshots**: Capture semantic structure and accessibility roles in YAML format
- **AX Tree Snapshots**: Combine Chromium's Accessibility tree with runtime visual diagnostics (bounding boxes, visibility, occlusion detection, computed styles)

### Stub Tools
- **Intercept HTTP Request**: Intercept and modify outgoing HTTP requests (headers, body, method) using glob patterns
- **Mock HTTP Response**: Mock HTTP responses (fulfill with custom status/headers/body or abort) with configurable delay, times limit, and probability (flaky testing)
- **List Stubs**: List all currently installed stubs for the active browser context
- **Clear Stubs**: Remove one or all installed stubs

### Figma Tools
- **Compare Page with Design**: Compare the current page UI against a Figma design snapshot and return a combined similarity score using multiple signals (MSSIM, image embedding, text embedding)

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
| `FIGMA_ACCESS_TOKEN` | Figma API access token for design comparison | (none) |
| `FIGMA_API_BASE_URL` | Figma API base URL | `https://api.figma.com/v1` |

## Available Tools

### Content Tools

<details>
<summary><code>content_take-screenshot</code> - Takes a screenshot of the current page or a specific element.</summary>

**Parameters:**
- `outputPath` (string, optional): Directory path where screenshot will be saved (default: OS temp directory)
- `name` (string, optional): Screenshot name (default: "screenshot")
- `selector` (string, optional): CSS selector for element to capture
- `fullPage` (boolean, optional): Capture full scrollable page (default: false)
- `type` (enum, optional): Image format - "png" or "jpeg" (default: "png")
- `quality` (number, optional): The quality of the image, between 0-100. Not applicable to PNG images, only used for JPEG format (default: 100)

**Returns:**
- `filePath` (string): Full path of the saved screenshot file
- `image` (object): Screenshot image data with mimeType

**Notes:**
- The `quality` parameter only applies to JPEG images. PNG images are always saved at full quality
- Lower quality values (e.g., 50-70) result in smaller file sizes but reduced image quality
- Quality value of 100 provides maximum quality but larger file sizes
</details>

<details>
<summary><code>content_get-as-html</code> - Retrieves the HTML content of the current page or a specific element.</summary>

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
</details>

<details>
<summary><code>content_get-as-text</code> - Retrieves the visible text content of the current page or a specific element.</summary>

**Parameters:**
- `selector` (string, optional): CSS selector to limit the text content to a specific container
- `maxLength` (number, optional): Maximum number of characters to return (default: 50000)

**Returns:**
- `output` (string): The requested text content of the page
</details>

<details>
<summary><code>content_save-as-pdf</code> - Saves the current page as a PDF document.</summary>

**Parameters:**
- `outputPath` (string, optional): Directory path where PDF will be saved (default: OS temp directory)
- `name` (string, optional): PDF name (default: "page")
- `format` (enum, optional): Page format - "Letter", "Legal", "Tabloid", "Ledger", "A0" through "A6" (default: "A4")
- `printBackground` (boolean, optional): Whether to print background graphics (default: false)
- `margin` (object, optional): Page margins with top, right, bottom, left (default: "1cm" for each)

**Returns:**
- `filePath` (string): Full path of the saved PDF file
</details>

### Interaction Tools

<details>
<summary><code>interaction_click</code> - Clicks an element on the page.</summary>

**Parameters:**
- `selector` (string, required): CSS selector for the element to click
</details>

<details>
<summary><code>interaction_fill</code> - Fills a form input field.</summary>

**Parameters:**
- `selector` (string, required): CSS selector for the input field
- `value` (string, required): Value to fill
</details>

<details>
<summary><code>interaction_hover</code> - Hovers over an element.</summary>

**Parameters:**
- `selector` (string, required): CSS selector for the element to hover
</details>

<details>
<summary><code>interaction_press-key</code> - Simulates keyboard input.</summary>

**Parameters:**
- `key` (string, required): Key to press (e.g., "Enter", "Escape", "Tab")
</details>

<details>
<summary><code>interaction_select</code> - Selects an option from a dropdown.</summary>

**Parameters:**
- `selector` (string, required): CSS selector for the select element
- `value` (string, required): Value to select
</details>

<details>
<summary><code>interaction_drag</code> - Performs drag and drop operation.</summary>

**Parameters:**
- `sourceSelector` (string, required): CSS selector for the source element
- `targetSelector` (string, required): CSS selector for the target element
</details>

<details>
<summary><code>interaction_scroll</code> - Scrolls the page viewport or a specific scrollable element.</summary>

**Parameters:**
- `mode` (enum, optional): Scroll mode - "by" (relative delta), "to" (absolute position), "top", "bottom", "left", "right" (default: "by")
- `selector` (string, optional): CSS selector for a scrollable container. If omitted, scrolls the document viewport
- `dx` (number, optional): Horizontal scroll delta in pixels (used when mode="by", default: 0)
- `dy` (number, optional): Vertical scroll delta in pixels (used when mode="by", default: 0)
- `x` (number, optional): Absolute horizontal scroll position in pixels (used when mode="to")
- `y` (number, optional): Absolute vertical scroll position in pixels (used when mode="to")
- `behavior` (enum, optional): Native scroll behavior - "auto" or "smooth" (default: "auto")

**Returns:**
- `mode` (string): The scroll mode used
- `selector` (string | null): The selector of the scroll container if provided; otherwise null (document viewport)
- `behavior` (string): The scroll behavior used
- `before` (object): Scroll metrics before the scroll action (x, y, scrollWidth, scrollHeight, clientWidth, clientHeight)
- `after` (object): Scroll metrics after the scroll action (x, y, scrollWidth, scrollHeight, clientWidth, clientHeight)
- `canScrollX` (boolean): Whether horizontal scrolling is possible
- `canScrollY` (boolean): Whether vertical scrolling is possible
- `maxScrollX` (number): Maximum horizontal scrollLeft
- `maxScrollY` (number): Maximum vertical scrollTop
- `isAtLeft` (boolean): Whether the scroll position is at the far left
- `isAtRight` (boolean): Whether the scroll position is at the far right
- `isAtTop` (boolean): Whether the scroll position is at the very top
- `isAtBottom` (boolean): Whether the scroll position is at the very bottom

**Usage:**
- Reveal content below the fold
- Jump to the top/bottom without knowing exact positions
- Bring elements into view before clicking
- Inspect lazy-loaded content that appears on scroll
</details>

<details>
<summary><code>interaction_resize-viewport</code> - Resizes the page viewport using Playwright viewport emulation.</summary>

**Parameters:**
- `width` (number, required): Target viewport width in CSS pixels (minimum: 200)
- `height` (number, required): Target viewport height in CSS pixels (minimum: 200)

**Returns:**
- `requested` (object): Requested viewport configuration (width, height)
- `viewport` (object): Viewport metrics observed inside the page after resizing:
  - `innerWidth`, `innerHeight`: window.innerWidth/innerHeight
  - `outerWidth`, `outerHeight`: window.outerWidth/outerHeight
  - `devicePixelRatio`: window.devicePixelRatio

**Notes:**
- This affects `window.innerWidth/innerHeight`, CSS media queries, layout, rendering, and screenshots
- This does NOT resize the OS-level browser window
- Runtime switching to viewport=null (binding to real window size) is not supported by Playwright
- If you need real window-driven responsive behavior, start the BrowserContext with viewport: null and use the window resize tool instead
</details>

<details>
<summary><code>interaction_resize-window</code> - Resizes the real browser window (OS-level window) for the current page using Chrome DevTools Protocol (CDP).</summary>

**Parameters:**
- `width` (number, optional): Target window width in pixels (required when state="normal", minimum: 200)
- `height` (number, optional): Target window height in pixels (required when state="normal", minimum: 200)
- `state` (enum, optional): Target window state - "normal", "maximized", "minimized", or "fullscreen" (default: "normal")

**Returns:**
- `requested` (object): Requested window change parameters (width, height, state)
- `before` (object): Window bounds before resizing (windowId, state, left, top, width, height)
- `after` (object): Window bounds after resizing (windowId, state, left, top, width, height)
- `viewport` (object): Page viewport metrics after resizing (innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio)

**Notes:**
- Works best on Chromium-based browsers (Chromium/Chrome/Edge)
- Especially useful in headful sessions when running with viewport emulation disabled (viewport: null)
- If Playwright viewport emulation is enabled (viewport is NOT null), resizing the OS window may not change page layout
- On non-Chromium browsers (Firefox/WebKit), CDP is not available and this tool will fail
</details>

### Navigation Tools

<details>
<summary><code>navigation_go-to</code> - Navigates to a URL.</summary>

**Parameters:**
- `url` (string, required): URL to navigate to (must include scheme)
- `timeout` (number, optional): Maximum operation time in milliseconds (default: 0 - no timeout)
- `waitUntil` (enum, optional): When to consider navigation succeeded - "load", "domcontentloaded", "networkidle", or "commit" (default: "load")

**Returns:**
- `url` (string): Final URL after navigation
- `status` (number): HTTP status code
- `statusText` (string): HTTP status text
- `ok` (boolean): Whether navigation was successful (2xx status)
</details>

<details>
<summary><code>navigation_go-back</code> - Navigates backward in browser history.</summary>
</details>

<details>
<summary><code>navigation_go-forward</code> - Navigates forward in browser history.</summary>
</details>

### Run Tools

<details>
<summary><code>run_js-in-browser</code> - Runs custom JavaScript INSIDE the active browser page using Playwright's "page.evaluate()".</summary>

**Parameters:**
- `script` (string, required): JavaScript code to execute

**Returns:**
- `result` (any): Result of the evaluation. This value can be of any type, including primitives, arrays, or objects. It represents the direct return value of the JavaScript expression executed in the page context.

**Notes:**
- The code executes in the PAGE CONTEXT (real browser environment):
  - Has access to window, document, DOM, Web APIs
  - Can read/modify the page state
  - Runs with the same permissions as the loaded web page
- The code runs in an isolated execution context, but within the page
- No direct access to Node.js APIs
- Return value must be serializable

**Typical use cases:**
- Inspect or mutate DOM state
- Read client-side variables or framework internals
- Trigger browser-side logic
- Extract computed values directly from the page
</details>

<details>
<summary><code>run_js-in-sandbox</code> - Runs custom JavaScript inside a Node.js VM sandbox on the MCP server (NOT in the browser).</summary>

**Parameters:**
- `code` (string, required): JavaScript code to run on the MCP server in a VM sandbox. The code is wrapped in an async IIFE, so `await` is allowed. Use `return ...` to return a value
- `timeoutMs` (number, optional): Max VM CPU time for synchronous execution in milliseconds (default: 5000, max: 30000)

**Returns:**
- `result` (any): Return value of the sandboxed code (best-effort JSON-safe). If user returns undefined but logs exist, returns `{ logs }`. If error occurs, returns `{ error, logs }`

**Available bindings:**
- `page`: Playwright Page (main interaction surface)
- `console`: captured logs (log/warn/error)
- `sleep(ms)`: async helper

**Safe built-ins:**
- Math, JSON, Number, String, Boolean, Array, Object, Date, RegExp
- isFinite, isNaN, parseInt, parseFloat
- URL, URLSearchParams
- TextEncoder, TextDecoder
- structuredClone
- crypto.randomUUID()
- AbortController
- setTimeout / clearTimeout

**NOT available:**
- require, process, fs, Buffer
- globalThis

**Notes:**
- This runs on the MCP SERVER (not in the browser)
- This is NOT a security boundary. Intended for trusted automation logic
- The timeoutMs parameter limits synchronous execution time, but does not automatically time out awaited Promises
</details>

### Observability (O11Y) Tools

<details>
<summary><code>o11y_get-console-messages</code> - Retrieves console messages/logs from the browser with advanced filtering.</summary>

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
</details>

<details>
<summary><code>o11y_get-http-requests</code> - Retrieves HTTP requests from the browser with detailed filtering.</summary>

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
</details>

<details>
<summary><code>o11y-get-web-vitals</code> - Collects Web Vitals-style performance metrics and provides recommendations based on Google's thresholds.</summary>

**Parameters:**
- `waitMs` (number, optional): Optional wait duration in milliseconds before reading metrics (default: 0, max: 30000). Useful to allow LCP/INP/CLS to settle after interactions
- `includeDebug` (boolean, optional): If true, returns additional debug details such as entry counts and LCP element hint (default: false)

**Returns:**
- `url` (string): Current page URL
- `title` (string): Current page title
- `timestampMs` (number): Unix epoch timestamp (ms) when the metrics were captured
- `metrics` (object): Raw metric values (null if unavailable):
  - `lcpMs` (number | null): Largest Contentful Paint in milliseconds
  - `inpMs` (number | null): Interaction to Next Paint in milliseconds (best-effort approximation)
  - `cls` (number | null): Cumulative Layout Shift score
  - `ttfbMs` (number | null): Time to First Byte in milliseconds
  - `fcpMs` (number | null): First Contentful Paint in milliseconds
- `ratings` (object): Ratings computed from Google thresholds for each metric:
  - `lcp`, `inp`, `cls`, `ttfb`, `fcp`: Each contains:
    - `rating` (enum): "good", "needs_improvement", "poor", or "not_available"
    - `value` (number | null): Metric value
    - `unit` (enum): "ms" or "score"
    - `thresholds` (object): Thresholds used for rating (good, poor)
- `recommendations` (object): Recommendations based on measured values:
  - `coreWebVitalsPassed` (boolean): True if all Core Web Vitals are rated "good"
  - `summary` (array): High-level summary and prioritization guidance
  - `lcp`, `inp`, `cls`, `ttfb`, `fcp` (array): Specific recommendations for each metric
  - `general` (array): General measurement and debugging notes
- `notes` (array): Notes about metric availability, browser limitations, and interpretation
- `debug` (object, optional): Optional debug details (when includeDebug=true):
  - `waitMs` (number): Actual wait duration used
  - `entries` (object): Counts of PerformanceEntry types used to compute metrics
  - `lastLcpSelectorHint` (string | null): Best-effort selector hint for the last LCP element
  - `lastLcpTagName` (string | null): Tag name of the last LCP element

**Core Web Vitals Thresholds:**
- **LCP** (Largest Contentful Paint): good <= 2500ms, poor > 4000ms
- **INP** (Interaction to Next Paint): good <= 200ms, poor > 500ms
- **CLS** (Cumulative Layout Shift): good <= 0.1, poor > 0.25

**Supporting Metrics Thresholds:**
- **TTFB** (Time to First Byte): good <= 800ms, poor > 1800ms
- **FCP** (First Contentful Paint): good <= 1800ms, poor > 3000ms

**Usage:**
- Call after navigation and after user actions
- If you need more stable LCP/CLS/INP, pass waitMs (e.g., 1000-3000ms)
- Some metrics may be unavailable depending on browser support and whether interactions occurred
</details>

<details>
<summary><code>o11y_get-trace-id</code> - Gets the OpenTelemetry compatible trace id of the current session.</summary>

**Parameters:**
- No input parameters

**Returns:**
- `traceId` (string, optional): The OpenTelemetry compatible trace id of the current session if available

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`).
</details>

<details>
<summary><code>o11y_new-trace-id</code> - Generates a new OpenTelemetry compatible trace id and sets it to the current session.</summary>

**Parameters:**
- No input parameters

**Returns:**
- `traceId` (string): The generated new OpenTelemetry compatible trace id

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`). The new trace ID is automatically set and will be used for all subsequent traces in the session.
</details>

<details>
<summary><code>o11y_set-trace-id</code> - Sets the OpenTelemetry compatible trace id of the current session.</summary>

**Parameters:**
- `traceId` (string, optional): The OpenTelemetry compatible trace id to be set. Leave it empty to clear the session trace id, so no OpenTelemetry trace header will be propagated from browser throughout the API calls

**Returns:**
- No return value

**Note:** Requires OpenTelemetry to be enabled (`OTEL_ENABLE=true`). When a trace ID is set, it will be propagated in HTTP headers (traceparent) for all API calls, enabling correlation with backend traces.
</details>

### Synchronization Tools

<details>
<summary><code>sync_wait-for-network-idle</code> - Waits until the page reaches a network-idle condition based on the session's tracked in-flight request count.</summary>

**Parameters:**
- `timeoutMs` (number, optional): Maximum time to wait before failing (milliseconds, default: 30000)
- `idleTimeMs` (number, optional): How long the network must stay idle continuously before resolving (milliseconds, default: 500)
- `maxConnections` (number, optional): Idle threshold - network is considered idle when in-flight requests <= maxConnections (default: 0)
- `pollIntervalMs` (number, optional): Polling interval used to sample the in-flight request count (milliseconds, default: 50)

**Returns:**
- `waitedMs` (number): Total time waited until the network became idle or the tool timed out
- `idleTimeMs` (number): Idle duration required for success
- `timeoutMs` (number): Maximum allowed wait time
- `maxConnections` (number): Idle threshold used
- `pollIntervalMs` (number): Polling interval used
- `finalInFlightRequests` (number): The last observed number of in-flight requests
- `observedIdleMs` (number): How long the in-flight request count stayed <= maxConnections

**Usage:**
- Use before interacting with SPA pages that load data asynchronously
- Use before taking screenshots or AX tree snapshots for more stable results
- Use after actions that trigger background fetch/XHR activity

**Note:** This tool uses server-side tracking, so it works reliably even with strict CSP. It does NOT rely on window globals or page-injected counters.
</details>

### Accessibility (A11Y) Tools

<details>
<summary><code>a11y_take-aria-snapshot</code> - Captures an ARIA (accessibility) snapshot of the current page or a specific element.</summary>

**Parameters:**
- `selector` (string, optional): CSS selector for element to snapshot

**Returns:**
- `output` (string): Includes the page URL, title, and a YAML-formatted accessibility tree

**Usage:**
- Use in combination with `accessibility_take-ax-tree-snapshot` for comprehensive UI analysis
- Provides semantic structure and accessibility roles
- Helps identify accessibility issues and page hierarchy problems
</details>

<details>
<summary><code>accessibility_take-ax-tree-snapshot</code> - Captures a UI-focused snapshot by combining Chromium's Accessibility (AX) tree with runtime visual diagnostics.</summary>

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
</details>

### Stub Tools

<details>
<summary><code>stub_intercept-http-request</code> - Installs a request interceptor stub that can modify outgoing requests before they are sent.</summary>

**Parameters:**
- `pattern` (string, required): Glob pattern matched against the full request URL (picomatch)
- `modifications` (object, optional): Request modifications to apply
  - `headers` (object, optional): Headers to merge into the outgoing request headers
  - `body` (string | object, optional): Override request body. If object/array, it will be JSON-stringified
  - `method` (string, optional): Override HTTP method (e.g., POST, PUT)
- `delayMs` (number, optional): Artificial delay in milliseconds before continuing the request (default: 0)
- `times` (number, optional): Apply only N times, then let through. Omit for infinite

**Returns:**
- `stubId` (string): Unique id of the installed stub
- `kind` (string): Stub kind (always "intercept_http_request")
- `pattern` (string): Glob pattern used
- `enabled` (boolean): Whether the stub is enabled
- `delayMs` (number): Applied artificial delay in milliseconds
- `times` (number): Max applications (-1 means infinite)

**Use cases:**
- A/B testing / feature flags (inject headers)
- Security testing (inject malformed headers / payload)
- Edge cases (special characters, large payload)
- Auth simulation (add API keys / tokens in headers)

**Notes:**
- Pattern is a glob matched against the full request URL (picomatch)
- This modifies requests; it does not change responses
- Times limits how many times the interceptor applies (-1 means infinite)
</details>

<details>
<summary><code>stub_mock-http-response</code> - Installs a response stub for matching requests using glob patterns (picomatch).</summary>

**Parameters:**
- `pattern` (string, required): Glob pattern matched against the full request URL (picomatch)
- `response` (object, required): Mock response configuration
  - `action` (enum, optional): "fulfill" or "abort" (default: "fulfill")
  - `status` (number, optional): HTTP status code (used when action="fulfill", range: 100-599)
  - `headers` (object, optional): HTTP headers for the mocked response
  - `body` (string | object, optional): Response body. If object/array, it will be JSON-stringified
  - `abortErrorCode` (string, optional): Playwright abort error code (used when action="abort"), e.g., "timedout"
- `delayMs` (number, optional): Artificial delay in milliseconds before applying the stub (default: 0)
- `times` (number, optional): Apply only N times, then let through. Omit for infinite
- `chance` (number, optional): Probability (0..1) to apply the stub per request (flaky testing)

**Returns:**
- `stubId` (string): Unique id of the installed stub (use it to clear later)
- `kind` (string): Stub kind (always "mock_http_response")
- `pattern` (string): Glob pattern used
- `enabled` (boolean): Whether the stub is enabled
- `delayMs` (number): Applied artificial delay in milliseconds
- `times` (number): Max applications (-1 means infinite)
- `chance` (number, optional): Apply probability (omit means always)
- `action` (string): Applied action ("fulfill" or "abort")
- `status` (number, optional): HTTP status (present when action="fulfill")

**Use cases:**
- Offline testing (return 200 with local JSON)
- Error scenarios (force 500/404 or abort with timedout)
- Edge cases (empty data / huge payload / special characters)
- Flaky API testing (chance < 1.0)
- Performance testing (delayMs)

**Notes:**
- Pattern is a glob matched against the full request URL
- Stubs are evaluated in insertion order; first match wins
- Times limits how many times the stub applies (-1 means infinite)
</details>

<details>
<summary><code>stub_list</code> - Lists currently installed stubs for the active browser context/session.</summary>

**Parameters:**
- No input parameters

**Returns:**
- `stubs` (array): Array of installed stubs, each containing:
  - `id` (string): Stub id
  - `kind` (string): Stub kind ("intercept_http_request" or "mock_http_response")
  - `enabled` (boolean): Whether stub is enabled
  - `pattern` (string): Glob pattern (picomatch)
  - `delayMs` (number): Artificial delay in ms
  - `times` (number): Max applications (-1 means infinite)
  - `usedCount` (number): How many times it has been applied
  - `action` (string, optional): For mock_response: "fulfill" or "abort"
  - `status` (number, optional): For mock_response: HTTP status (if set)

**Usage:**
- Useful to debug why certain calls are being mocked/intercepted
- Check stub status and usage statistics
- Verify stub configuration before debugging issues
</details>

<details>
<summary><code>stub_clear</code> - Clears stubs installed.</summary>

**Parameters:**
- `stubId` (string, optional): Stub id to remove. Omit to remove all stubs

**Returns:**
- `clearedCount` (number): Number of stubs removed

**Usage:**
- Remove specific stub by ID when no longer needed
- Clear all stubs to reset the browser context
- Useful after testing or debugging sessions
</details>

### Figma Tools

<details>
<summary><code>compare-page-with-design</code> - Compares the current page UI against a Figma design snapshot and returns a combined similarity score.</summary>

**Parameters:**
- `figmaFileKey` (string, required): Figma file key (the part after /file/ in Figma URL)
- `figmaNodeId` (string, required): Figma node id (frame/component node, usually looks like "12:34")
- `selector` (string, optional): Optional CSS selector to screenshot only a specific element instead of the whole page
- `fullPage` (boolean, optional): If true, captures the full scrollable page. Ignored when selector is provided (default: true)
- `figmaScale` (number, optional): Optional scale for Figma raster export (e.g., 1, 2, 3)
- `figmaFormat` (enum, optional): Optional format for Figma export - "png" or "jpg" (default: "png")
- `weights` (object, optional): Optional weights for combining signals. Missing/inactive signals are ignored and weights are renormalized:
  - `mssim` (number, optional): Weight for MSSIM signal
  - `imageEmbedding` (number, optional): Weight for image embedding signal
  - `textEmbedding` (number, optional): Weight for vision→text→text embedding signal
- `mssimMode` (enum, optional): MSSIM mode - "raw" (stricter) or "semantic" (more layout-oriented, default: "semantic")
- `maxDim` (number, optional): Optional preprocessing max dimension forwarded to compare pipeline
- `jpegQuality` (number, optional): Optional JPEG quality forwarded to compare pipeline (used only when JPEG encoding is selected internally, range: 50-100)

**Returns:**
- `score` (number): Combined similarity score in the range [0..1]. Higher means more similar
- `notes` (array): Human-readable notes explaining which signals were used and their individual scores
- `meta` (object): Metadata about what was compared:
  - `pageUrl` (string): URL of the page that was compared
  - `pageTitle` (string): Title of the page that was compared
  - `figmaFileKey` (string): Figma file key used for the design snapshot
  - `figmaNodeId` (string): Figma node id used for the design snapshot
  - `selector` (string | null): Selector used for page screenshot, if any. Null means full page
  - `fullPage` (boolean): Whether the page screenshot was full-page
  - `pageImageType` (enum): Image type of the captured page screenshot ("png" or "jpeg")
  - `figmaImageType` (enum): Image type of the captured Figma snapshot ("png" or "jpeg")

**How it works:**
1. Fetches a raster snapshot from Figma (frame/node screenshot)
2. Takes a screenshot of the live browser page (full page or a specific selector)
3. Computes multiple similarity signals and combines them into one score:
   - MSSIM (structural similarity; always available)
   - Image embedding similarity (optional; may be skipped if provider is not configured)
   - Vision→text→text embedding similarity (optional; may be skipped if provider is not configured)

**Usage:**
- Prefer 'semantic' MSSIM mode when comparing Figma sample data vs real data (less sensitive to text/value differences)
- Use 'raw' MSSIM mode only when you expect near pixel-identical output
- If you suspect layout/structure mismatch, run with fullPage=true first, then retry with a selector for the problematic region
- Notes explain which signals were used or skipped; skipped signals usually mean missing cloud configuration (e.g., AWS_REGION, inference profile, etc.)

**Use cases:**
- UI regression checks
- Design parity validation
- "Does this page still match the intended layout?" validation
- Automated visual testing
</details>

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
6. **Design Comparison**: Compare live page UI against Figma designs with automated similarity scoring
7. **Content Extraction**: Get HTML/text content with filtering and cleaning options
8. **Accessibility Analysis**: Use ARIA and AX tree snapshots to understand page structure and detect UI issues
9. **Performance Analysis**: Monitor HTTP request timing and failures

### Example Workflow

1. Navigate to a web page using `navigation_go-to`
2. Wait for network idle with `sync_wait-for-network-idle` if needed (for SPA pages)
3. Take a screenshot with `content_take-screenshot` to see the current state
4. Check console messages with `o11y_get-console-messages` for errors
5. Monitor HTTP requests with `o11y_get-http-requests` to see API calls
6. Capture accessibility snapshots with `a11y_take-aria-snapshot` and `accessibility_take-ax-tree-snapshot` to understand page structure
7. Compare page with Figma design using `compare-page-with-design` to validate design parity
8. Interact with elements using `interaction_click`, `interaction_fill`, etc.
9. Extract content using `content_get-as-html` or `content_get-as-text`
10. Save the page as PDF using `content_save-as-pdf` for documentation

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
