# Browser DevTools MCP Configuration

This plugin uses environment variables for configuration. You can set these in your Claude Code settings or shell environment.

## Configuration Methods

### Method 1: Claude Code Settings (Recommended)

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp@latest"],
      "env": {
        "BROWSER_HEADLESS_ENABLE": "false"
      }
    }
  }
}
```

### Method 2: Project-Level Override

Create `.mcp.json` in your project root to override plugin defaults.

### Method 3: Shell Environment

```bash
export BROWSER_HEADLESS_ENABLE="false"
claude
```

## Available Environment Variables

### Browser Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BROWSER_HEADLESS_ENABLE` | boolean | `true` | Run browser in headless mode |
| `BROWSER_PERSISTENT_ENABLE` | boolean | `false` | Enable persistent browser context |
| `BROWSER_PERSISTENT_USER_DATA_DIR` | string | - | Directory for persistent user data |
| `BROWSER_USE_INSTALLED_ON_SYSTEM` | boolean | `false` | Use system browser instead of bundled |
| `BROWSER_EXECUTABLE_PATH` | string | - | Custom browser executable path |

### OpenTelemetry Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OTEL_ENABLE` | boolean | `false` | Enable OpenTelemetry instrumentation |
| `OTEL_SERVICE_NAME` | string | `frontend` | Service name for traces |
| `OTEL_EXPORTER_TYPE` | string | `none` | Exporter type: `none`, `console`, `otlp/http` |
| `OTEL_EXPORTER_HTTP_URL` | string | - | OTLP collector URL |
| `OTEL_EXPORTER_HTTP_HEADERS` | string | - | HTTP headers (key=value,key=value) |

### AWS / Amazon Bedrock Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AWS_REGION` | string | - | AWS region for Bedrock |
| `AWS_PROFILE` | string | - | AWS profile name |
| `AMAZON_BEDROCK_ENABLE` | boolean | `false` | Enable Bedrock for AI features |
| `AMAZON_BEDROCK_IMAGE_EMBED_MODEL_ID` | string | - | Bedrock image embedding model |
| `AMAZON_BEDROCK_TEXT_EMBED_MODEL_ID` | string | - | Bedrock text embedding model |
| `AMAZON_BEDROCK_VISION_MODEL_ID` | string | - | Bedrock vision model |

### Figma Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FIGMA_ACCESS_TOKEN` | string | - | Figma API access token (required for `/figma` command) |

## Example: Full Configuration

```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "npx",
      "args": ["-y", "browser-devtools-mcp@latest"],
      "env": {
        "BROWSER_HEADLESS_ENABLE": "false",
        "BROWSER_PERSISTENT_ENABLE": "true",
        "BROWSER_PERSISTENT_USER_DATA_DIR": "~/.browser-devtools-data",
        "OTEL_ENABLE": "true",
        "OTEL_EXPORTER_TYPE": "otlp/http",
        "OTEL_EXPORTER_HTTP_URL": "http://localhost:4318",
        "FIGMA_ACCESS_TOKEN": "figd_your_token_here",
        "AWS_REGION": "us-east-1",
        "AMAZON_BEDROCK_ENABLE": "true"
      }
    }
  }
}
```
