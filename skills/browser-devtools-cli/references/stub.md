# Stub Tools

HTTP request interception and mocking commands.

## intercept-http-request

Intercept and modify outgoing HTTP requests.

```bash
browser-devtools-cli stub intercept-http-request --url-pattern <pattern> [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--url-pattern` | string | Yes | - | URL glob pattern to match |
| `--method` | string | No | - | HTTP method to match |
| `--headers` | object | No | - | Headers to inject/override |
| `--body` | string | No | - | Request body to set |
| `--delay` | number | No | `0` | Delay before forwarding (ms) |
| `--times` | number | No | - | Number of times to apply |
| `--probability` | number | No | `1` | Probability of applying (0-1) |

**Examples:**

```bash
# Add auth header to API calls
browser-devtools-cli stub intercept-http-request \
  --url-pattern "**/api/**" \
  --headers '{"Authorization": "Bearer token123"}'

# Modify request body
browser-devtools-cli stub intercept-http-request \
  --url-pattern "**/api/submit" \
  --method POST \
  --body '{"modified": true}'

# Add delay to simulate slow network
browser-devtools-cli stub intercept-http-request \
  --url-pattern "**/*" \
  --delay 2000

# Apply only 50% of the time (flaky testing)
browser-devtools-cli stub intercept-http-request \
  --url-pattern "**/api/**" \
  --probability 0.5 \
  --delay 5000
```

---

## mock-http-response

Mock HTTP responses for matching requests.

```bash
browser-devtools-cli stub mock-http-response --url-pattern <pattern> [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--url-pattern` | string | Yes | - | URL glob pattern to match |
| `--method` | string | No | - | HTTP method to match |
| `--status` | number | No | `200` | Response status code |
| `--headers` | object | No | - | Response headers |
| `--body` | string | No | - | Response body |
| `--delay` | number | No | `0` | Delay before responding (ms) |
| `--times` | number | No | - | Number of times to apply |
| `--abort` | boolean | No | `false` | Abort the request instead |

**Examples:**

```bash
# Mock API response
browser-devtools-cli stub mock-http-response \
  --url-pattern "**/api/users" \
  --body '[{"id": 1, "name": "Test User"}]' \
  --headers '{"Content-Type": "application/json"}'

# Simulate error response
browser-devtools-cli stub mock-http-response \
  --url-pattern "**/api/data" \
  --status 500 \
  --body '{"error": "Internal Server Error"}'

# Simulate network failure
browser-devtools-cli stub mock-http-response \
  --url-pattern "**/api/**" \
  --abort

# Mock with delay (slow API)
browser-devtools-cli stub mock-http-response \
  --url-pattern "**/api/slow" \
  --delay 3000 \
  --body '{"result": "delayed"}'

# Mock only first 3 requests
browser-devtools-cli stub mock-http-response \
  --url-pattern "**/api/limited" \
  --times 3 \
  --body '{"mocked": true}'
```

---

## list

List all active stubs.

```bash
browser-devtools-cli stub list
```

**Output (JSON):**

```json
{
  "stubs": [
    {
      "id": "stub-1",
      "type": "intercept",
      "urlPattern": "**/api/**",
      "method": null,
      "active": true
    },
    {
      "id": "stub-2",
      "type": "mock",
      "urlPattern": "**/api/users",
      "status": 200,
      "active": true
    }
  ]
}
```

---

## clear

Clear stubs.

```bash
browser-devtools-cli stub clear [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--id` | string | No | - | Specific stub ID to clear |
| `--all` | boolean | No | `false` | Clear all stubs |

**Examples:**

```bash
# Clear specific stub
browser-devtools-cli stub clear --id "stub-1"

# Clear all stubs
browser-devtools-cli stub clear --all
```

## API Mocking Example

```bash
SESSION="--session-id mock-test"

# Setup mock before navigation
browser-devtools-cli $SESSION stub mock-http-response \
  --url-pattern "**/api/users" \
  --body '[{"id": 1, "name": "Test User"}]' \
  --headers '{"Content-Type": "application/json"}'

# Navigate (will use mocked data)
browser-devtools-cli $SESSION navigation go-to --url "https://app.example.com"

# Verify mock is active
browser-devtools-cli --json $SESSION stub list

# Test UI with mocked data
browser-devtools-cli $SESSION content take-screenshot --name "mocked-data"

# Cleanup
browser-devtools-cli $SESSION stub clear --all
```

## Error Handling Testing

```bash
SESSION="--session-id error-test"

# Navigate first
browser-devtools-cli $SESSION navigation go-to --url "https://app.example.com"

# Setup error mock
browser-devtools-cli $SESSION stub mock-http-response \
  --url-pattern "**/api/submit" \
  --status 500 \
  --body '{"error": "Server Error"}'

# Trigger form submission
browser-devtools-cli $SESSION interaction click --selector "#submit-btn"

# Wait for error handling
browser-devtools-cli $SESSION sync wait-for-network-idle

# Verify error UI
browser-devtools-cli $SESSION content get-as-text --selector ".error-message"
browser-devtools-cli $SESSION content take-screenshot --name "error-state"

# Cleanup
browser-devtools-cli $SESSION stub clear --all
```

## Offline Testing

```bash
SESSION="--session-id offline-test"

# Navigate while online
browser-devtools-cli $SESSION navigation go-to --url "https://app.example.com"

# Simulate offline by aborting all requests
browser-devtools-cli $SESSION stub mock-http-response \
  --url-pattern "**/*" \
  --abort

# Test offline behavior
browser-devtools-cli $SESSION interaction click --selector "#refresh-data"
browser-devtools-cli $SESSION content take-screenshot --name "offline-state"

# Cleanup
browser-devtools-cli $SESSION stub clear --all
```

## Slow Network Testing

```bash
SESSION="--session-id slow-test"

# Add 3 second delay to all requests
browser-devtools-cli $SESSION stub intercept-http-request \
  --url-pattern "**/*" \
  --delay 3000

# Navigate and observe loading states
browser-devtools-cli $SESSION navigation go-to --url "https://app.example.com"

# Screenshot during loading
browser-devtools-cli $SESSION content take-screenshot --name "loading-state"

# Wait for completion
browser-devtools-cli $SESSION sync wait-for-network-idle --timeout 60000

# Screenshot after load
browser-devtools-cli $SESSION content take-screenshot --name "loaded-state"

# Cleanup
browser-devtools-cli $SESSION stub clear --all
```
