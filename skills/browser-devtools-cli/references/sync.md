# Sync Tools

Synchronization and waiting commands.

## wait-for-network-idle

Wait for network activity to settle.

```bash
browser-devtools-cli sync wait-for-network-idle [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--timeout` | number | No | `30000` | Max wait time in ms |
| `--idle-time` | number | No | `500` | Time with no network activity to consider idle (ms) |

**Description:**

Waits until there are no network connections for the specified idle time. Useful for:
- Waiting after navigation
- Waiting after triggering async operations
- Ensuring all API calls have completed

**Examples:**

```bash
# Default wait (500ms idle)
browser-devtools-cli sync wait-for-network-idle

# Shorter idle time for faster tests
browser-devtools-cli sync wait-for-network-idle --idle-time 200

# Longer timeout for slow pages
browser-devtools-cli sync wait-for-network-idle --timeout 60000

# Stricter idle requirement
browser-devtools-cli sync wait-for-network-idle --idle-time 1000

# JSON output
browser-devtools-cli --json sync wait-for-network-idle
```

**Output (JSON):**

```json
{
  "waited": true,
  "durationMs": 1234
}
```

## Common Usage Patterns

### After Navigation

```bash
browser-devtools-cli navigation go-to --url "https://example.com"
browser-devtools-cli sync wait-for-network-idle
browser-devtools-cli content take-screenshot --name "loaded"
```

### After User Interaction

```bash
browser-devtools-cli interaction click --selector "#submit"
browser-devtools-cli sync wait-for-network-idle
browser-devtools-cli --json o11y get-http-requests
```

### Before Assertions

```bash
browser-devtools-cli interaction fill --selector "#search" --value "test"
browser-devtools-cli interaction press-key --key "Enter"
browser-devtools-cli sync wait-for-network-idle
browser-devtools-cli content get-as-text --selector ".results"
```

## Form Submission Workflow

```bash
SESSION="--session-id form-test"

# Fill form
browser-devtools-cli $SESSION interaction fill --selector "#email" --value "user@example.com"
browser-devtools-cli $SESSION interaction fill --selector "#password" --value "password"

# Submit
browser-devtools-cli $SESSION interaction click --selector "button[type=submit]"

# Wait for API response
browser-devtools-cli $SESSION sync wait-for-network-idle

# Check redirect URL
browser-devtools-cli $SESSION run js-in-browser --code "window.location.href"
```

## Infinite Scroll Workflow

```bash
SESSION="--session-id scroll-test"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com/feed"
browser-devtools-cli $SESSION sync wait-for-network-idle

# Scroll down to trigger load
browser-devtools-cli $SESSION interaction scroll --direction down --amount 1000

# Wait for new content
browser-devtools-cli $SESSION sync wait-for-network-idle --idle-time 200

# Get loaded items count
browser-devtools-cli $SESSION run js-in-browser --code "document.querySelectorAll('.feed-item').length"
```

## Best Practices

1. **Use after actions that trigger network requests:**
   - Form submissions
   - Button clicks that fetch data
   - Navigation
   - Infinite scroll triggers

2. **Adjust idle time based on your app:**
   - Fast APIs: 200-300ms
   - Typical apps: 500ms (default)
   - Slow/complex apps: 1000ms+

3. **Set appropriate timeouts:**
   - Default 30s is usually sufficient
   - Increase for slow networks or heavy pages
   - Consider test timeout budgets

4. **Combine with JavaScript waits when needed:**

```bash
# Wait for network
browser-devtools-cli sync wait-for-network-idle

# Additional wait for animations
browser-devtools-cli run js-in-sandbox --code "await page.waitForTimeout(500)"
```

## Caveats

- WebSocket connections don't affect network idle detection
- Long-polling requests may prevent idle state
- Some SPAs continuously poll - consider using shorter idle times
- For more precise control, use `run js-in-sandbox` with custom wait logic:

```bash
# Custom wait with Playwright
browser-devtools-cli run js-in-sandbox --code "
  await page.waitForFunction(() => window.appReady === true)
"
```
