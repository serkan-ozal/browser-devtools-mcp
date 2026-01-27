# Run Tools

JavaScript execution commands.

## js-in-browser

Execute JavaScript code in the browser page context.

```bash
browser-devtools-cli run js-in-browser --code <code>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--code` | string | Yes | - | JavaScript code to execute |

**Context available:**
- `window` - Browser window object
- `document` - DOM document
- All Web APIs (fetch, localStorage, etc.)

**Examples:**

```bash
# Get page title
browser-devtools-cli run js-in-browser --code "document.title"

# Get element text
browser-devtools-cli run js-in-browser --code "document.querySelector('h1').textContent"

# Get all links (JSON for parsing)
browser-devtools-cli --json run js-in-browser --code "Array.from(document.querySelectorAll('a')).map(a => a.href)"

# Access localStorage
browser-devtools-cli --json run js-in-browser --code "JSON.stringify(localStorage)"

# Get computed styles
browser-devtools-cli run js-in-browser --code "getComputedStyle(document.body).fontSize"

# Check if element exists
browser-devtools-cli --json run js-in-browser --code "!!document.querySelector('#login-form')"
```

**Output (JSON):**

```json
{
  "result": "Example Domain"
}
```

---

## js-in-sandbox

Execute JavaScript code in a Node.js sandbox environment.

```bash
browser-devtools-cli run js-in-sandbox --code <code>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--code` | string | Yes | - | JavaScript code to execute |

**Context available:**
- `page` - Playwright Page object
- Safe Node.js built-ins
- No filesystem access

**Examples:**

```bash
# Get page URL via Playwright
browser-devtools-cli run js-in-sandbox --code "await page.url()"

# Evaluate in page context
browser-devtools-cli run js-in-sandbox --code "await page.evaluate(() => document.title)"

# Get page content
browser-devtools-cli run js-in-sandbox --code "await page.content()"

# Wait for selector
browser-devtools-cli run js-in-sandbox --code "await page.waitForSelector('#loaded')"

# Complex operation (JSON output)
browser-devtools-cli --json run js-in-sandbox --code "
  const title = await page.title();
  const url = page.url();
  return { title, url };
"
```

## Data Extraction Example

```bash
SESSION="--session-id extract --json"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Extract all links
LINKS=$(browser-devtools-cli $SESSION run js-in-browser --code "
  Array.from(document.querySelectorAll('a'))
    .map(a => ({ text: a.textContent.trim(), href: a.href }))
")
echo "Links: $LINKS"

# Extract metadata
META=$(browser-devtools-cli $SESSION run js-in-browser --code "
  ({
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    canonical: document.querySelector('link[rel=canonical]')?.href
  })
")
echo "Metadata: $META"
```

## State Inspection Example

```bash
SESSION="--session-id state --json"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://app.example.com"

# Check application state
browser-devtools-cli $SESSION run js-in-browser --code "
  JSON.stringify({
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    cookies: document.cookie
  })
"

# Check if user is logged in
browser-devtools-cli $SESSION run js-in-browser --code "
  !!localStorage.getItem('authToken')
"
```

## DOM Manipulation Example

```bash
SESSION="--session-id dom-test"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Highlight element for debugging
browser-devtools-cli $SESSION run js-in-browser --code "
  document.querySelector('h1').style.border = '3px solid red'
"

# Take screenshot with highlight
browser-devtools-cli $SESSION content take-screenshot --name "highlighted"

# Remove highlight
browser-devtools-cli $SESSION run js-in-browser --code "
  document.querySelector('h1').style.border = ''
"
```

## Waiting with Playwright Example

```bash
SESSION="--session-id wait-test"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Wait for specific element with Playwright
browser-devtools-cli $SESSION run js-in-sandbox --code "
  await page.waitForSelector('.dynamic-content', { state: 'visible' })
"

# Wait for network request
browser-devtools-cli $SESSION run js-in-sandbox --code "
  await page.waitForResponse(r => r.url().includes('/api/data'))
"

# Wait for condition
browser-devtools-cli $SESSION run js-in-sandbox --code "
  await page.waitForFunction(() => window.appReady === true)
"
```

## Security Notes

- `js-in-browser` executes in the page context with full DOM access
- `js-in-sandbox` runs in an isolated Node.js VM with Playwright access
- Neither has direct filesystem access
- Network access depends on the execution context
