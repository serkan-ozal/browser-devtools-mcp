# Observability Skill

Monitor and debug web applications using OpenTelemetry, console logs, network requests, and distributed tracing.

## When to Use

This skill activates when:
- User asks about distributed tracing
- User wants to correlate frontend and backend requests
- User mentions OpenTelemetry, Jaeger, Zipkin, or tracing
- User needs to debug request flow across services
- User wants to monitor application behavior

## Capabilities

### Distributed Tracing
- Get current trace ID (`o11y_get-trace-id`)
- Generate new trace ID (`o11y_new-trace-id`)
- Set specific trace ID (`o11y_set-trace-id`)
- Correlate browser actions with backend traces

### Console Monitoring
- Capture all console output (`o11y_get-console-messages`)
- Filter by level (error, warn, info, debug)
- Track JavaScript exceptions
- Monitor application logs

### Network Observability
- Track HTTP requests (`o11y_get-http-requests`)
- Monitor API call timing
- Identify failed requests
- Inspect request/response details

### Performance Metrics
- Core Web Vitals (`o11y_get-web-vitals`)
- Page load timing
- Resource timing
- User interaction metrics

## OpenTelemetry Integration

### Trace Context
Browser DevTools MCP can inject and extract W3C Trace Context headers:
- `traceparent`: Contains trace-id, span-id, and trace flags
- `tracestate`: Vendor-specific trace information

### Correlation Flow
```
Browser Session
    │
    ├─► trace-id: abc123
    │
    ▼
Frontend Request
    │
    ├─► Header: traceparent: 00-abc123-def456-01
    │
    ▼
Backend Service
    │
    ├─► Logs with trace-id: abc123
    │
    ▼
Observability Platform
    │
    └─► Full trace visualization
```

## Debugging Workflow

### 1. Set Up Tracing
```
/trace new
```
Generate a fresh trace ID for the session.

### 2. Perform Actions
Navigate, click, fill forms - all requests will carry the trace ID.

### 3. Capture Evidence
```
/console error
/network api/
```
Get console errors and API requests.

### 4. Correlate in Backend
Use the trace ID to search your observability platform:
- Jaeger: Search by trace ID
- Grafana: Query by trace ID
- Datadog: APM trace search

### 5. Analyze Full Journey
See the complete request flow from browser to backend services.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_ENABLE` | Enable OpenTelemetry | `false` |
| `OTEL_SERVICE_NAME` | Service identifier | `frontend` |
| `OTEL_EXPORTER_TYPE` | Export destination | `none` |
| `OTEL_EXPORTER_HTTP_URL` | Collector endpoint | - |
| `OTEL_EXPORTER_HTTP_HEADERS` | Auth headers | - |

### Exporter Types

| Type | Description |
|------|-------------|
| `none` | Disabled |
| `console` | Log to console |
| `otlp/http` | Send to OTLP collector |

## Common Platforms

### Jaeger
```
OTEL_EXPORTER_HTTP_URL=http://localhost:4318
```

### Grafana Tempo
```
OTEL_EXPORTER_HTTP_URL=http://tempo:4318
```

### Honeycomb
```
OTEL_EXPORTER_HTTP_URL=https://api.honeycomb.io
OTEL_EXPORTER_HTTP_HEADERS=x-honeycomb-team=YOUR_API_KEY
```

### Datadog
```
OTEL_EXPORTER_HTTP_URL=http://localhost:4318
```

## Best Practices

1. **Generate new trace IDs** for each test scenario
2. **Document trace IDs** in bug reports
3. **Check console first** for JavaScript errors
4. **Filter network requests** to relevant endpoints
5. **Correlate timestamps** between frontend and backend
6. **Use structured logging** with trace context
