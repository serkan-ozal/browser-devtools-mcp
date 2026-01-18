# /wait

Wait for network activity to become idle.

## Usage

```
/wait [timeout]
```

## Description

Waits for all network requests to complete. Useful after navigation or actions that trigger API calls.

## Arguments

- `timeout` (optional): Maximum wait time in milliseconds (default: 30000)

## Examples

```
/wait
/wait 5000
/wait 60000
```

## Notes

- Considers network idle when no requests for 500ms
- Times out if network doesn't become idle within timeout
- Useful before taking screenshots or assertions

## MCP Tools Used

- `sync_wait-for-network-idle` - Wait for network idle
