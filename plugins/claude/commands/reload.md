# /reload

Reload the current page.

## Usage

```
/reload [--hard]
```

## Description

Reloads the current page. Optionally performs a hard reload that bypasses the cache.

## Arguments

- `--hard` (optional): Bypass browser cache

## Examples

```
/reload
/reload --hard
```

## Notes

- Normal reload uses cached resources
- Hard reload fetches all resources fresh from server
- Waits for page load to complete before returning

## MCP Tools Used

- `navigation_reload` - Reload the page
