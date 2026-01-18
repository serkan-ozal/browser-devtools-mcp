# /select

Select an option from a dropdown or select element.

## Usage

```
/select <selector> <value>
```

## Description

Selects an option from a `<select>` dropdown element by its value or visible text.

## Arguments

- `selector` (required): CSS selector of the select element
- `value` (required): Option value or visible text to select

## Examples

```
/select #country USA
/select select[name="size"] Large
/select .product-color Red
/select [data-testid="currency"] EUR
```

## Multi-Select

For multi-select elements, you can select multiple options:
```
/select #tags option1,option2,option3
```

## Notes

- Works with native `<select>` elements
- Triggers change events
- For custom dropdowns (non-native), use `/click` instead

## MCP Tools Used

- `interaction_select` - Select dropdown option
