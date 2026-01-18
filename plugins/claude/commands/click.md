# /click

Click an element on the page.

## Usage

```
/click <selector>
```

## Description

Clicks an element on the page identified by CSS selector. Supports buttons, links, and any clickable elements.

## Arguments

- `selector` (required): CSS selector of element to click

## Examples

```
/click button[type="submit"]
/click .login-button
/click #checkout
/click a[href="/products"]
/click [data-testid="add-to-cart"]
```

## Notes

- Waits for element to be visible and clickable
- Scrolls element into view if needed
- Triggers all associated event handlers

## MCP Tools Used

- `interaction_click` - Click element
