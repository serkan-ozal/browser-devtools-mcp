# Figma Tools

Design comparison and validation commands.

## Prerequisites

- Figma API access token (environment variable `FIGMA_ACCESS_TOKEN`)
- Cloud configuration for image/text embeddings (optional, for semantic comparison)

## compare-page-with-design

Compare live page UI against a Figma design.

```bash
browser-devtools-cli figma compare-page-with-design --figma-url <url> [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--figma-url` | string | Yes | - | Figma frame/component URL |
| `--selector` | string | No | - | CSS selector to compare (defaults to viewport) |
| `--full-page` | boolean | No | `false` | Compare full scrollable page |
| `--mode` | enum | No | `semantic` | Comparison mode: `raw` or `semantic` |
| `--mssim-weight` | number | No | `0.4` | Weight for structural similarity |
| `--image-weight` | number | No | `0.3` | Weight for image embedding similarity |
| `--text-weight` | number | No | `0.3` | Weight for text embedding similarity |

**Comparison Modes:**

- **`semantic`**: More tolerant of text/data differences, focuses on layout and visual structure
- **`raw`**: Pixel-level comparison, expects near-identical output

**Examples:**

```bash
# Compare viewport with Figma frame
browser-devtools-cli figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx/Design?node-id=1:2"

# Compare specific component (JSON for parsing)
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx/Design?node-id=1:2" \
  --selector "#header"

# Raw comparison for static designs
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx/Design?node-id=1:2" \
  --mode raw

# Full page comparison
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx/Design?node-id=1:2" \
  --full-page

# Custom weights (focus on layout)
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx/Design?node-id=1:2" \
  --mssim-weight 0.7 \
  --image-weight 0.2 \
  --text-weight 0.1
```

**Output (JSON):**

```json
{
  "similarity": {
    "overall": 0.87,
    "mssim": 0.92,
    "imageEmbedding": 0.85,
    "textEmbedding": 0.84
  },
  "passed": true,
  "threshold": 0.8,
  "notes": [
    "MSSIM score indicates good structural similarity",
    "Minor text differences detected"
  ],
  "screenshots": {
    "actual": "/tmp/actual-screenshot.png",
    "expected": "/tmp/figma-design.png",
    "diff": "/tmp/diff.png"
  }
}
```

## Design QA Workflow

```bash
# Set Figma API token
export FIGMA_ACCESS_TOKEN="your-token-here"

SESSION="--session-id design-qa --json"

# Navigate to implementation
browser-devtools-cli $SESSION navigation go-to --url "http://localhost:3000/dashboard"
browser-devtools-cli $SESSION sync wait-for-network-idle

# Compare header
HEADER_RESULT=$(browser-devtools-cli $SESSION figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx?node-id=1:header" \
  --selector "header")
echo "Header: $HEADER_RESULT"

# Compare hero section
HERO_RESULT=$(browser-devtools-cli $SESSION figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx?node-id=1:hero" \
  --selector ".hero-section")
echo "Hero: $HERO_RESULT"

# Compare full page
PAGE_RESULT=$(browser-devtools-cli $SESSION figma compare-page-with-design \
  --figma-url "https://figma.com/file/xxx?node-id=1:page" \
  --full-page)
echo "Full page: $PAGE_RESULT"

# Screenshot for reference
browser-devtools-cli $SESSION content take-screenshot --name "implementation" --full-page
```

## CI/CD Design Validation

```bash
#!/bin/bash
set -e

export FIGMA_ACCESS_TOKEN="$FIGMA_TOKEN"
CLI="browser-devtools-cli --json --quiet --session-id design-ci-$$"

# Navigate
$CLI navigation go-to --url "$APP_URL"
$CLI sync wait-for-network-idle

# Compare with design
RESULT=$($CLI figma compare-page-with-design \
  --figma-url "$FIGMA_DESIGN_URL" \
  --mode semantic)

# Check if passed
PASSED=$(echo $RESULT | jq '.passed')
SIMILARITY=$(echo $RESULT | jq '.similarity.overall')

echo "Design comparison: similarity=$SIMILARITY, passed=$PASSED"

if [ "$PASSED" != "true" ]; then
  echo "Design mismatch detected!"
  echo "Details: $RESULT"
  exit 1
fi

echo "Design validation passed"
```

## Similarity Signals

| Signal | Description | Weight (default) |
|--------|-------------|------------------|
| MSSIM | Structural similarity (layout, shapes) | 0.4 |
| Image Embedding | Visual feature similarity | 0.3 |
| Text Embedding | Semantic text similarity | 0.3 |

**Weight Configurations:**

```bash
# Focus on layout
--mssim-weight 0.7 --image-weight 0.2 --text-weight 0.1

# Focus on visual appearance
--mssim-weight 0.3 --image-weight 0.5 --text-weight 0.2

# Focus on content
--mssim-weight 0.2 --image-weight 0.2 --text-weight 0.6
```

## Comparison Modes

### Semantic Mode (Default)

Use when:
- Comparing designs with dynamic/real data
- Testing layout and visual structure
- Allowing for text content differences

```bash
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "..." \
  --mode semantic
```

### Raw Mode

Use when:
- Comparing static designs
- Expecting pixel-perfect match
- Testing specific visual details

```bash
browser-devtools-cli --json figma compare-page-with-design \
  --figma-url "..." \
  --mode raw
```

## Troubleshooting

### Low Similarity Scores

1. **Check viewport size:** Ensure browser viewport matches Figma frame size

```bash
# Set viewport to match Figma
browser-devtools-cli interaction resize-viewport --width 1440 --height 900
```

2. **Wait for content:** Use `sync wait-for-network-idle` before comparing

3. **Check selector:** Ensure selector targets the correct element

4. **Mode selection:** Use `semantic` mode for dynamic content

### Missing Signals

- Image/text embedding may be skipped without cloud configuration
- Check `notes` field in output for skipped signals
- MSSIM is always available locally

### Figma Access Issues

- Verify `FIGMA_ACCESS_TOKEN` environment variable is set
- Check Figma URL format includes `node-id` parameter
- Ensure you have access to the Figma file
