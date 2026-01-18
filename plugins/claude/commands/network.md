# /network

Monitor and inspect HTTP network requests.

## Usage

```
/network [filter]
```

## Description

Retrieves HTTP requests made by the page including XHR, fetch, and resource requests. Useful for debugging API calls and network issues.

## Arguments

- `filter` (optional): Filter requests by URL pattern

## Examples

```
/network
/network api/
/network .json
/network graphql
```

## Output

Shows network requests with:
- HTTP method (GET, POST, PUT, DELETE, etc.)
- URL
- Status code
- Response time
- Response size
- Request/response headers

## MCP Tools Used

- `o11y_get-http-requests` - Retrieve HTTP requests with filtering
