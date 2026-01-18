# /otel

Configure and inspect OpenTelemetry instrumentation.

## Usage

```
/otel [status|traces|spans]
```

## Description

Inspect OpenTelemetry instrumentation status and view collected traces and spans from the browser session.

## Subcommands

- `status` - Check if OTel is enabled and configured
- `traces` - List recent traces
- `spans` - View spans for current trace

## Examples

```
/otel status
/otel traces
/otel spans
```

## Configuration

OpenTelemetry can be configured via environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `OTEL_ENABLE` | Enable OTel | `true` |
| `OTEL_SERVICE_NAME` | Service name | `frontend` |
| `OTEL_EXPORTER_TYPE` | Exporter type | `otlp/http`, `console`, `none` |
| `OTEL_EXPORTER_HTTP_URL` | Collector URL | `http://localhost:4318` |
| `OTEL_EXPORTER_HTTP_HEADERS` | Auth headers | `api-key=xxx` |

## Integration

Works with popular observability platforms:
- Jaeger
- Zipkin
- Grafana Tempo
- AWS X-Ray
- Datadog
- Honeycomb
- Lightstep

## MCP Tools Used

- `o11y_get-trace-id` - Get trace context
- `o11y_get-console-messages` - Check for OTel logs
- `run_js-in-browser` - Inspect OTel state
