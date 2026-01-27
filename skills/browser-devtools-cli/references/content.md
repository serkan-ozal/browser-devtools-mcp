# Content Tools

Content extraction and capture commands.

## take-screenshot

Take a screenshot of the current page or a specific element.

The screenshot is always saved to the file system and the file path is returned.
By default, the image data is NOT included in the response to reduce payload size.
Use `--include-base64` when the AI assistant cannot access the MCP server's file system.

```bash
browser-devtools-cli content take-screenshot [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--output-path` | string | No | OS temp dir | Directory to save screenshot |
| `--name` | string | No | `screenshot` | Screenshot name (file: `{name}-{time}.{type}`) |
| `--selector` | string | No | - | CSS selector for element screenshot |
| `--full-page` | boolean | No | `false` | Capture full scrollable page |
| `--type` | enum | No | `png` | Image format: `png` or `jpeg` |
| `--quality` | number | No | `100` | JPEG quality (0-100, ignored for PNG) |
| `--include-base64` | boolean | No | `false` | Include image data in response (for remote MCP servers) |

**When to use `--include-base64`:**
- Remote MCP server (different machine)
- Containerized/sandboxed environment
- AI assistant cannot access the file system where MCP server runs

**Examples:**

```bash
# Basic screenshot (file path only)
browser-devtools-cli content take-screenshot --name "homepage"

# Full page screenshot
browser-devtools-cli content take-screenshot --name "full" --full-page

# Element screenshot
browser-devtools-cli content take-screenshot --selector "#main-content" --name "content"

# JPEG with quality
browser-devtools-cli content take-screenshot --type jpeg --quality 80 --name "compressed"

# Custom output path
browser-devtools-cli content take-screenshot --output-path "/tmp/screenshots" --name "test"

# Include image data in response (for remote access)
browser-devtools-cli --json content take-screenshot --name "test" --include-base64

# JSON output for parsing file path
browser-devtools-cli --json content take-screenshot --name "test"
```

**Output (JSON) - Default (without `--include-base64`):**

```json
{
  "filePath": "/tmp/screenshot-20240115-143022.png"
}
```

**Output (JSON) - With `--include-base64`:**

```json
{
  "filePath": "/tmp/screenshot-20240115-143022.png",
  "image": {
    "data": "<base64-encoded-image-data>",
    "mimeType": "image/png"
  }
}
```

---

## save-as-pdf

Generate a PDF of the current page.

```bash
browser-devtools-cli content save-as-pdf [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--output-path` | string | No | OS temp dir | Directory to save PDF |
| `--name` | string | No | `page` | PDF name |
| `--format` | enum | No | `A4` | Paper format (Letter, Legal, A4, etc.) |
| `--landscape` | boolean | No | `false` | Landscape orientation |
| `--print-background` | boolean | No | `true` | Print background graphics |
| `--scale` | number | No | `1` | Scale factor (0.1-2) |

**Examples:**

```bash
# Basic PDF
browser-devtools-cli content save-as-pdf --name "report"

# Letter format, landscape
browser-devtools-cli content save-as-pdf --format Letter --landscape --name "slides"

# JSON output
browser-devtools-cli --json content save-as-pdf --name "document"
```

---

## get-as-html

Get HTML content of the page or an element.

```bash
browser-devtools-cli content get-as-html [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | No | - | CSS selector (defaults to full page) |
| `--outer` | boolean | No | `true` | Include outer HTML |

**Examples:**

```bash
# Full page HTML
browser-devtools-cli content get-as-html

# Specific element
browser-devtools-cli content get-as-html --selector "#main"

# Inner HTML only
browser-devtools-cli content get-as-html --selector "#content" --outer false
```

---

## get-as-text

Get text content of the page or an element.

```bash
browser-devtools-cli content get-as-text [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | No | - | CSS selector (defaults to body) |

**Examples:**

```bash
# Full page text
browser-devtools-cli content get-as-text

# Specific element text
browser-devtools-cli content get-as-text --selector "article"

# Get heading text
browser-devtools-cli content get-as-text --selector "h1"
```

## Workflow Example

```bash
SESSION="--session-id content-test --json"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Capture screenshot
SCREENSHOT=$(browser-devtools-cli $SESSION content take-screenshot --name "page")
echo "Screenshot saved: $SCREENSHOT"

# Get page title/heading
browser-devtools-cli $SESSION content get-as-text --selector "h1"

# Get specific content
browser-devtools-cli $SESSION content get-as-html --selector "article"

# Save as PDF
browser-devtools-cli $SESSION content save-as-pdf --name "report"
```
