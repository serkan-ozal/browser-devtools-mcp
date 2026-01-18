# /react

Inspect React components on the page.

## Usage

```
/react <selector>
```

## Description

Gets React component information for a DOM element. Shows component name, props, state, and hooks. Requires React DevTools to be available.

## Arguments

- `selector` (required): CSS selector of element to inspect

## Examples

```
/react #app
/react .product-card
/react [data-testid="user-profile"]
```

## Output

Returns:
- Component name
- Props (with values)
- State (with values)
- Context values
- Hooks information

## Notes

- Only works on React applications
- Requires React to be in development mode or have DevTools enabled
- May not work with production builds that strip DevTools

## MCP Tools Used

- `react_get-component-for-element` - Get React component info
- `react_get-element-for-component` - Get DOM element for component
