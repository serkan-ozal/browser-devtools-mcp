# /sandbox

Execute JavaScript in a sandboxed Node.js environment.

## Usage

```
/sandbox <code>
```

## Description

Executes JavaScript code in a sandboxed Node.js environment, separate from the browser. Useful for data processing, file operations, and server-side logic testing.

## Arguments

- `code` (required): JavaScript code to execute

## Examples

```
/sandbox Buffer.from('hello').toString('base64')
/sandbox crypto.randomUUID()
/sandbox JSON.stringify({a: 1, b: 2}, null, 2)
/sandbox Array.from({length: 10}, (_, i) => i * 2)
```

## Available APIs

The sandbox has access to Node.js built-in modules:
- `Buffer` - Binary data handling
- `crypto` - Cryptographic functions
- `JSON` - JSON parsing/serialization
- `Math` - Mathematical operations
- Standard JavaScript APIs

## Differences from /run-js

| Feature | `/run-js` | `/sandbox` |
|---------|-----------|------------|
| Environment | Browser | Node.js |
| DOM Access | ✅ Yes | ❌ No |
| Node APIs | ❌ No | ✅ Yes |
| Page Context | ✅ Yes | ❌ No |
| Isolation | Shared | Sandboxed |

## Use Cases

- Generate test data
- Process/transform data
- Cryptographic operations
- Complex calculations
- Data validation

## MCP Tools Used

- `run_js-in-sandbox` - Execute in Node.js sandbox
