# /html

Get HTML content from the current page.

## Usage

```
/html [selector]
```

## Description

Retrieves the HTML content of the current page or a specific element. Useful for inspecting page structure and debugging DOM issues.

## Arguments

- `selector` (optional): CSS selector to get HTML of specific element

## Examples

```
/html
/html body
/html #main-content
/html .product-list
/html [data-testid="header"]
```

## Output

Returns the HTML content as a formatted string. For full page, returns the complete document HTML.

## MCP Tools Used

- `content_get-as-html` - Get HTML content
