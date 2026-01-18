# /screenshot

Take a screenshot of the current browser page or a specific element.

## Usage

```
/screenshot [selector]
```

## Description

Captures a screenshot of the current page. Optionally specify a CSS selector to capture only a specific element.

## Examples

```
/screenshot
/screenshot #main-content
/screenshot .hero-section
/screenshot [data-testid="login-form"]
```

## Options

- No arguments: Captures full page
- With selector: Captures only the matched element

## MCP Tools Used

- `content_take-screenshot` - Capture the screenshot
