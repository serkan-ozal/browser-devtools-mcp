# /resize

Resize the browser viewport.

## Usage

```
/resize <width> <height>
/resize <preset>
```

## Description

Resizes the browser viewport to specified dimensions. Useful for responsive design testing.

## Arguments

- `width` (required): Viewport width in pixels
- `height` (required): Viewport height in pixels
- `preset` (optional): Device preset name

## Presets

| Preset | Dimensions |
|--------|------------|
| mobile | 375x667 |
| tablet | 768x1024 |
| desktop | 1920x1080 |
| laptop | 1366x768 |

## Examples

```
/resize 1920 1080
/resize 375 667
/resize mobile
/resize tablet
```

## MCP Tools Used

- `interaction_resize-viewport` - Resize viewport
