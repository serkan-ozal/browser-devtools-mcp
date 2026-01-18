# Web Debugging Skill

Debug web applications by inspecting console logs, network requests, and JavaScript errors.

## When to Use

This skill activates when:
- User reports a bug or error on a web page
- User asks to debug JavaScript issues
- User wants to inspect API calls or network requests
- User needs to troubleshoot page loading issues
- User mentions console errors or warnings

## Capabilities

### Console Inspection
- Get all console messages (`o11y_get-console-messages`)
- Filter by log level (error, warn, info, debug)
- Identify JavaScript exceptions and stack traces

### Network Analysis
- Monitor HTTP requests (`o11y_get-http-requests`)
- Inspect request/response headers
- Check response status codes and timing
- Identify failed or slow requests

### JavaScript Debugging
- Execute diagnostic code (`run_js-in-browser`)
- Inspect DOM state and element properties
- Check localStorage, sessionStorage, cookies
- Verify JavaScript variables and state

### Error Investigation
- Capture screenshots at error state (`content_take-screenshot`)
- Get HTML snapshot for context (`content_get-as-html`)
- Check for missing resources or 404s

## Debugging Workflow

1. **Reproduce**: Navigate to the problematic page
2. **Capture**: Take screenshot of current state
3. **Inspect Console**: Check for JavaScript errors
4. **Analyze Network**: Look for failed requests
5. **Investigate**: Run diagnostic JavaScript
6. **Document**: Summarize findings with evidence

## Best Practices

- Always check console for errors first
- Filter network requests to relevant endpoints
- Take screenshots before and after actions
- Document reproduction steps clearly
