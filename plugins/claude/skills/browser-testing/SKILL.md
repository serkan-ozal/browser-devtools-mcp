# Browser Testing Skill

Automated browser testing and debugging skill using Browser DevTools MCP.

## When to Use

This skill activates when:
- User asks to test a web page or application
- User wants to debug frontend issues
- User needs to verify UI behavior
- User asks about page performance or accessibility
- User wants to automate browser interactions

## Capabilities

### Navigation & Interaction
- Navigate to URLs (`navigation_go-to`)
- Click elements (`interaction_click`)
- Fill forms (`interaction_fill`)
- Hover elements (`interaction_hover`)
- Press keys (`interaction_press-key`)
- Scroll pages (`interaction_scroll`)
- Drag and drop (`interaction_drag`)

### Content Capture
- Take screenshots (`content_take-screenshot`)
- Get HTML content (`content_get-as-html`)
- Get text content (`content_get-as-text`)
- Save as PDF (`content_save-as-pdf`)

### Debugging & Observability
- Get console messages (`o11y_get-console-messages`)
- Monitor HTTP requests (`o11y_get-http-requests`)
- Get Web Vitals (`o11y_get-web-vitals`)
- OpenTelemetry tracing (`o11y_get-trace-id`, `o11y_set-trace-id`)

### Accessibility
- ARIA snapshot (`a11y_take-aria-snapshot`)
- Accessibility tree (`accessibility_take-ax-tree-snapshot`)

### Mocking & Stubbing
- Intercept HTTP requests (`stub_intercept-http-request`)
- Mock HTTP responses (`stub_mock-http-response`)
- List stubs (`stub_list`)
- Clear stubs (`stub_clear`)

### React DevTools
- Get React component for element (`react_get-component-for-element`)
- Get element for React component (`react_get-element-for-component`)

### Code Execution
- Run JavaScript in browser (`run_js-in-browser`)
- Run JavaScript in sandbox (`run_js-in-sandbox`)

## Best Practices

1. **Wait for network idle** after navigation before interacting
2. **Take screenshots** after important actions for visual verification
3. **Check console messages** for JavaScript errors
4. **Use ARIA snapshots** for accessibility audits
5. **Monitor HTTP requests** to debug API issues
