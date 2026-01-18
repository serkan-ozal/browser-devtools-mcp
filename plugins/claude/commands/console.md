# /console

Get console messages from the browser.

## Usage

```
/console [level]
```

## Description

Retrieves console messages from the browser including logs, warnings, errors, and debug information. Useful for debugging JavaScript issues.

## Arguments

- `level` (optional): Filter by log level - `log`, `warn`, `error`, `info`, `debug`

## Examples

```
/console
/console error
/console warn
```

## Output

Shows console messages with:
- Timestamp
- Log level (log, warn, error, info, debug)
- Message content
- Source location (file and line number)

## MCP Tools Used

- `o11y_get-console-messages` - Retrieve console messages with filtering
