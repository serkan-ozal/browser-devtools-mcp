# /scroll

Scroll the page or an element.

## Usage

```
/scroll [direction] [amount]
/scroll <selector>
```

## Description

Scrolls the page or a specific element. Supports directional scrolling and scrolling to specific elements.

## Arguments

- `direction` (optional): `up`, `down`, `left`, `right`, `top`, `bottom`
- `amount` (optional): Pixels to scroll (default: viewport height)
- `selector` (optional): CSS selector of element to scroll into view

## Examples

```
/scroll down
/scroll up 500
/scroll bottom
/scroll top
/scroll #footer
/scroll .section-3
```

## Notes

- Smooth scrolling is enabled by default
- Scrolling to element centers it in viewport

## MCP Tools Used

- `interaction_scroll` - Scroll page or element
