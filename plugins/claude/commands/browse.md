# /browse

Navigate to a URL and interact with web pages using Browser DevTools MCP.

## Usage

```
/browse <url>
```

## Description

Opens a browser and navigates to the specified URL. After navigation, you can:
- Take screenshots with `content_take-screenshot`
- Get page content with `content_get-as-html` or `content_get-as-text`
- Click elements with `interaction_click`
- Fill forms with `interaction_fill`
- Check accessibility with `a11y_take-aria-snapshot`
- Monitor network requests with `o11y_get-http-requests`
- Get console logs with `o11y_get-console-messages`

## Examples

```
/browse https://example.com
/browse https://github.com/serkan-ozal/browser-devtools-mcp
```

## MCP Tools Used

- `navigation_go-to` - Navigate to the URL
- `content_take-screenshot` - Capture visual state
- `sync_wait-for-network-idle` - Wait for page load
