# /accessibility

Run accessibility analysis on the current page.

## Usage

```
/accessibility [selector]
```

## Description

Performs accessibility analysis on the current page using ARIA snapshots and accessibility tree inspection. Helps identify accessibility issues like missing labels, improper heading hierarchy, and ARIA violations.

## Examples

```
/accessibility
/accessibility #navigation
/accessibility form
```

## What It Checks

- ARIA labels and roles
- Heading hierarchy
- Form input labels
- Focusable elements
- Color contrast (via visual inspection)
- Keyboard navigation paths

## MCP Tools Used

- `a11y_take-aria-snapshot` - ARIA snapshot analysis
- `accessibility_take-ax-tree-snapshot` - Full accessibility tree
