# Navigation Tools

Browser navigation commands for page control.

## go-to

Navigate to a URL.

```bash
browser-devtools-cli navigation go-to --url <url> [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--url` | string | Yes | - | URL to navigate to (include scheme: `http://`, `https://`) |
| `--timeout` | number | No | `0` | Max operation time in ms (`0` = no timeout) |
| `--wait-until` | enum | No | `load` | When to consider navigation complete |

**wait-until values:**
- `load` - Wait for `load` event
- `domcontentloaded` - Wait for `DOMContentLoaded` event
- `networkidle` - Wait for no network connections for 500ms (discouraged for testing)
- `commit` - Wait for network response and document loading started

**Examples:**

```bash
# Basic navigation
browser-devtools-cli navigation go-to --url "https://example.com"

# With timeout
browser-devtools-cli navigation go-to --url "https://example.com" --timeout 10000

# Wait for DOM ready
browser-devtools-cli navigation go-to --url "https://example.com" --wait-until domcontentloaded

# JSON output for parsing
browser-devtools-cli --json navigation go-to --url "https://example.com"
```

**Output (JSON):**

```json
{
  "url": "https://example.com/",
  "status": 200,
  "statusText": "OK",
  "ok": true
}
```

---

## go-back

Navigate backward in browser history.

```bash
browser-devtools-cli navigation go-back [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--timeout` | number | No | `0` | Max operation time in ms |
| `--wait-until` | enum | No | `load` | When to consider navigation complete |

**Example:**

```bash
browser-devtools-cli navigation go-back
browser-devtools-cli navigation go-back --wait-until domcontentloaded
```

---

## go-forward

Navigate forward in browser history.

```bash
browser-devtools-cli navigation go-forward [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--timeout` | number | No | `0` | Max operation time in ms |
| `--wait-until` | enum | No | `load` | When to consider navigation complete |

**Example:**

```bash
browser-devtools-cli navigation go-forward
```

---

## reload

Reload the current page.

```bash
browser-devtools-cli navigation reload [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--timeout` | number | No | `0` | Max operation time in ms |
| `--wait-until` | enum | No | `load` | When to consider navigation complete |

**Examples:**

```bash
# Simple reload
browser-devtools-cli navigation reload

# Reload and wait for network idle
browser-devtools-cli navigation reload --wait-until networkidle
```

## Workflow Example

```bash
SESSION="--session-id nav-test"

# Navigate to page
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Click a link (handled by interaction tools)
browser-devtools-cli $SESSION interaction click --selector "a.next-page"

# Go back
browser-devtools-cli $SESSION navigation go-back

# Go forward
browser-devtools-cli $SESSION navigation go-forward

# Reload
browser-devtools-cli $SESSION navigation reload
```
