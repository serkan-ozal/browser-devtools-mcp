# /figma

Compare the current page with a Figma design.

## Usage

```
/figma <figma-url>
```

## Description

Compares the current browser page with a Figma design using visual similarity analysis. Identifies differences between the implementation and the design.

## Arguments

- `figma-url` (required): URL to the Figma frame or component

## Examples

```
/figma https://www.figma.com/file/abc123/Design?node-id=1:2
/figma https://www.figma.com/design/xyz789/App?node-id=100:200
```

## Requirements

- `FIGMA_ACCESS_TOKEN` environment variable must be set
- Amazon Bedrock must be enabled (`AMAZON_BEDROCK_ENABLE=true`)
- Bedrock vision model configured (`AMAZON_BEDROCK_VISION_MODEL_ID`)

## Output

Returns:
- Visual similarity score (0-100%)
- List of detected differences
- Side-by-side comparison screenshots
- Specific areas with deviations

## Use Cases

- Design QA during development
- Regression testing after CSS changes
- Verify responsive implementations
- Catch unintended visual changes

## MCP Tools Used

- `figma_compare-page-with-design` - Compare with Figma design
- `content_take-screenshot` - Capture current state
