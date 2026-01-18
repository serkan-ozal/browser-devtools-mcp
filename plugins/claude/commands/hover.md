# /hover

Hover over an element on the page.

## Usage

```
/hover <selector>
```

## Description

Hovers the mouse over an element, triggering hover states and tooltip displays.

## Arguments

- `selector` (required): CSS selector of element to hover

## Examples

```
/hover .dropdown-trigger
/hover button.menu
/hover [data-tooltip]
/hover .nav-item
```

## Notes

- Useful for testing hover states and dropdowns
- Triggers mouseenter, mouseover events
- Element must be visible

## MCP Tools Used

- `interaction_hover` - Hover element
