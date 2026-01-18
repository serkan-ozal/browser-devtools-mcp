# /drag

Drag an element to a target location.

## Usage

```
/drag <source-selector> <target-selector>
```

## Description

Performs a drag and drop operation from a source element to a target element. Useful for testing drag-and-drop interfaces, sortable lists, and file uploads.

## Arguments

- `source-selector` (required): CSS selector of element to drag
- `target-selector` (required): CSS selector of drop target

## Examples

```
/drag .draggable-item .drop-zone
/drag #card-1 #column-2
/drag [data-testid="task"] [data-testid="done-column"]
/drag .file-item .trash-bin
```

## Notes

- Simulates mouse down, move, and up events
- Triggers all relevant drag events (dragstart, drag, dragend, drop)
- Works with HTML5 drag and drop API
- Supports custom drag implementations

## MCP Tools Used

- `interaction_drag` - Perform drag and drop
