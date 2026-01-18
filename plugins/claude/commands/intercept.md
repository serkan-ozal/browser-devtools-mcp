# /intercept

Intercept HTTP requests matching a pattern.

## Usage

```
/intercept <url-pattern> [action]
```

## Description

Intercepts HTTP requests matching the URL pattern. Can block, modify, or log requests. Useful for testing error handling, offline scenarios, and request modification.

## Arguments

- `url-pattern` (required): URL pattern to match (supports wildcards)
- `action` (optional): What to do with matched requests

## Actions

- `block` - Block the request entirely
- `delay:<ms>` - Add delay before request
- `log` - Log request details
- `abort` - Abort with network error

## Examples

```
/intercept */api/users block
/intercept */analytics/* block
/intercept */api/* delay:2000
/intercept *.jpg block
/intercept */api/payment abort
```

## Use Cases

### Test Offline Behavior
```
/intercept */api/* block
```

### Simulate Slow Network
```
/intercept * delay:3000
```

### Block Analytics
```
/intercept *google-analytics* block
/intercept *facebook.com/tr* block
```

### Debug API Calls
```
/intercept */api/* log
```

## Related Commands

- `/mock` - Mock HTTP responses
- `/network` - View network requests

## MCP Tools Used

- `stub_intercept-http-request` - Intercept requests
- `stub_list` - List active intercepts
- `stub_clear` - Clear all intercepts
