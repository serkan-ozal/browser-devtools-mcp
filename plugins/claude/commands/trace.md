# /trace

Manage OpenTelemetry trace IDs for distributed tracing.

## Usage

```
/trace [action] [trace-id]
```

## Description

Manages OpenTelemetry compatible trace IDs for correlating browser sessions with backend traces. Useful for debugging distributed systems and tracking requests across services.

## Actions

- `get` - Get the current trace ID
- `new` - Generate a new trace ID
- `set <trace-id>` - Set a specific trace ID

## Examples

```
/trace get
/trace new
/trace set 4bf92f3577b34da6a3ce929d0e0e4736
```

## Use Cases

### Debug a specific request
1. Set trace ID before action
2. Perform the action
3. Use trace ID to find related logs in your observability platform

### Correlate frontend and backend
1. Get trace ID from browser session
2. Search backend logs with same trace ID
3. See full request journey

## Configuration

Requires OpenTelemetry to be enabled via environment variables:
- `OTEL_ENABLE=true`
- `OTEL_EXPORTER_TYPE=otlp/http`
- `OTEL_EXPORTER_HTTP_URL=http://localhost:4318`

## MCP Tools Used

- `o11y_get-trace-id` - Get current trace ID
- `o11y_new-trace-id` - Generate new trace ID
- `o11y_set-trace-id` - Set specific trace ID
