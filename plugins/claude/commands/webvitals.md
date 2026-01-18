# /webvitals

Get Core Web Vitals metrics from the current page.

## Usage

```
/webvitals
```

## Description

Retrieves Core Web Vitals performance metrics from the current page including:
- **LCP** (Largest Contentful Paint) - Loading performance
- **FID** (First Input Delay) - Interactivity
- **CLS** (Cumulative Layout Shift) - Visual stability
- **TTFB** (Time to First Byte) - Server response time
- **FCP** (First Contentful Paint) - Initial render time

## Examples

```
/webvitals
```

## Interpreting Results

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤2.5s | 2.5s-4s | >4s |
| FID | ≤100ms | 100ms-300ms | >300ms |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |

## MCP Tools Used

- `o11y_get-web-vitals` - Retrieve Web Vitals metrics
