# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Browser DevTools MCP, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Report via one of these methods:
   - **GitHub Security Advisory** (preferred): [Create a security advisory](https://github.com/serkan-ozal/browser-devtools-mcp/security/advisories/new)
   - **Email**: serkanozal86@gmail.com
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: You will receive an acknowledgment within 48 hours
- **Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical issues within 7 days
- **Credit**: With your permission, we will credit you in the release notes

## Security Considerations

### Browser Automation Risks

Browser DevTools MCP provides powerful browser automation capabilities. Users should be aware of:

1. **Code Execution**: The `run_js-in-browser` and `run_js-in-sandbox` tools execute arbitrary JavaScript code
   - `run_js-in-browser`: Executes in the page context with full DOM access
   - `run_js-in-sandbox`: Executes in a Node.js VM sandbox (NOT a security boundary)
   - Only use with trusted code inputs

2. **Network Access**: The browser can make requests to any URL
   - HTTP requests from the browser inherit the page's cookies and session
   - Stubbing/mocking tools can intercept and modify requests
   - Be cautious when automating authenticated sessions

3. **Persistent Context**: When `BROWSER_PERSISTENT_ENABLE=true`
   - Browser state (cookies, localStorage) persists across sessions
   - User data is stored in `BROWSER_PERSISTENT_USER_DATA_DIR`
   - Sensitive data may be stored locally

4. **Screenshot/PDF Capture**: Content tools can capture sensitive information
   - Screenshots may contain PII or credentials visible on screen
   - PDFs preserve full page content
   - Be mindful of what pages are captured

### API Keys and Secrets

The following environment variables may contain sensitive information:

| Variable | Sensitivity | Description |
|----------|-------------|-------------|
| `FIGMA_ACCESS_TOKEN` | High | Figma API access token |
| `OTEL_EXPORTER_HTTP_HEADERS` | High | May contain API keys for observability platforms |
| `AWS_PROFILE` | Medium | AWS credentials profile name |

**Best Practices:**
- Never commit secrets to version control
- Use environment variables or secret management tools
- Rotate API keys regularly
- Use minimal-permission API tokens

### Network Security

When using HTTP transport (`--transport=streamable-http`):

1. **Local Development**: The server binds to `localhost` by default
2. **Remote Deployment**: 
   - Always use HTTPS in production
   - Implement authentication/authorization
   - Consider network isolation
3. **CORS**: The server does not implement CORS restrictions by default

### Session Security

- Sessions are isolated per MCP client connection
- Session data is stored in memory (not persisted by default)
- Idle sessions are automatically cleaned up (`SESSION_IDLE_SECONDS`)
- Setting `SESSION_CLOSE_ON_SOCKET_CLOSE=true` closes sessions immediately on disconnect

## Security Features

### Sandbox Isolation

The `run_js-in-sandbox` tool provides limited isolation:
- Runs in Node.js VM context
- No access to `require`, `process`, `fs`, `Buffer`
- Limited built-in APIs available
- **Note**: This is NOT a security boundary - treat all input as trusted

### OpenTelemetry Security

When using OpenTelemetry integration:
- Trace data may contain sensitive URL paths and parameters
- Headers can be configured to authenticate with collectors
- Consider what data is being exported to observability platforms

## Responsible Disclosure

We kindly ask security researchers to:

1. Give us reasonable time to fix issues before public disclosure
2. Avoid accessing or modifying other users' data
3. Act in good faith to avoid privacy violations and service disruptions

We commit to:

1. Not pursuing legal action against researchers acting in good faith
2. Working with you to understand and resolve the issue
3. Acknowledging your contribution (with your permission)

## Security Updates

Security updates are released as patch versions. We recommend:

1. Always using the latest version
2. Subscribing to GitHub releases for notifications
3. Reviewing the changelog for security-related fixes

## Contact

For security-related inquiries:
- **GitHub Security Advisory**: [Report a vulnerability](https://github.com/serkan-ozal/browser-devtools-mcp/security/advisories/new)
- **Email**: serkanozal86@gmail.com
- **GitHub**: [@serkan-ozal](https://github.com/serkan-ozal)
