# /fill

Fill an input field with text.

## Usage

```
/fill <selector> <text>
```

## Description

Fills an input field with the specified text. Works with text inputs, textareas, and contenteditable elements.

## Arguments

- `selector` (required): CSS selector of input element
- `text` (required): Text to enter

## Examples

```
/fill #username john.doe
/fill input[name="email"] user@example.com
/fill .search-box product search query
/fill textarea#message Hello, this is my message
```

## Notes

- Clears existing content before filling
- Triggers input, change, and other relevant events
- Works with password fields and other input types

## MCP Tools Used

- `interaction_fill` - Fill input field
