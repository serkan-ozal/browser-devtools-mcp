# /keypress

Press a key or key combination.

## Usage

```
/keypress <key>
```

## Description

Presses a key or key combination on the page. Supports special keys, modifiers, and key combinations.

## Arguments

- `key` (required): Key or key combination to press

## Key Names

### Special Keys
- `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Home`, `End`, `PageUp`, `PageDown`
- `F1` - `F12`

### Modifiers
- `Control` or `Ctrl`
- `Alt`
- `Shift`
- `Meta` (Cmd on Mac, Win on Windows)

## Examples

```
/keypress Enter
/keypress Tab
/keypress Escape
/keypress Control+a
/keypress Control+c
/keypress Control+v
/keypress Control+Shift+p
/keypress Alt+F4
/keypress ArrowDown
```

## Common Shortcuts

| Shortcut | Action |
|----------|--------|
| `Control+a` | Select all |
| `Control+c` | Copy |
| `Control+v` | Paste |
| `Control+z` | Undo |
| `Control+s` | Save |
| `Escape` | Close/Cancel |
| `Enter` | Submit/Confirm |
| `Tab` | Next field |

## MCP Tools Used

- `interaction_press-key` - Press key combination
