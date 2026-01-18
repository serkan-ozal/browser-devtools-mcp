# /mock

Mock HTTP responses for testing.

## Usage

```
/mock <url-pattern> <response>
```

## Description

Intercepts HTTP requests matching the URL pattern and returns a mocked response. Useful for testing error states, slow networks, or unavailable APIs.

## Arguments

- `url-pattern` (required): URL pattern to match (supports wildcards)
- `response` (required): JSON response or status code

## Examples

```
/mock */api/users {"users": [{"id": 1, "name": "Test"}]}
/mock */api/error 500
/mock */api/products {"products": [], "total": 0}
```

## Advanced Usage

Mock with specific status and headers:
```
/mock */api/auth {"status": 401, "body": {"error": "Unauthorized"}}
```

## Related Commands

- `/mock-list` - List active mocks
- `/mock-clear` - Clear all mocks

## MCP Tools Used

- `stub_mock-http-response` - Create HTTP mock
- `stub_list` - List active stubs
- `stub_clear` - Clear all stubs
