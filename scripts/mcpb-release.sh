#!/bin/bash
set -e

VERSION="$(jq -r '.version' package.json)"
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "❌ Error: Could not read 'version' from package.json"
  exit 1
fi

MCPB_DIR="${MCPB_DIR:-.mcpb}"
if [[ ! -d "$MCPB_DIR" ]]; then
  echo "❌ Error: MCPB directory not found at $MCPB_DIR"
  exit 1
fi

MCPB_FILES=("$MCPB_DIR"/*.mcpb)
if [[ ${#MCPB_FILES[@]} -eq 0 || ! -f "${MCPB_FILES[0]}" ]]; then
  echo "❌ Error: No .mcpb files found in $MCPB_DIR"
  exit 1
fi

echo "ℹ️ Found ${#MCPB_FILES[@]} MCPB file(s):"
for f in "${MCPB_FILES[@]}"; do
  echo "   - $(basename "$f")"
done

# If this job runs on a tag ref, use it; otherwise fallback to v${VERSION}
if [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
  TAG="${GITHUB_REF_NAME}"
else
  TAG="v${VERSION}"
fi
echo "ℹ️ Using tag: ${TAG}"

# Poll until release becomes visible via API
MAX_TRIES=18   # ~90s
SLEEP_SECS=5
i=0
until gh release view "$TAG" --repo "${GITHUB_REPOSITORY}" >/dev/null 2>&1; do
  i=$((i+1))
  if (( i >= MAX_TRIES )); then
    echo "❌ Release '$TAG' not visible after ${MAX_TRIES} tries."
    exit 1
  fi
  echo "⏳ Waiting for release '$TAG' to appear… ($i/$MAX_TRIES)"
  sleep "$SLEEP_SECS"
done

echo "✅ Release '$TAG' found"
echo "ℹ️ Uploading MCPB assets to release $TAG…"

for file in "${MCPB_FILES[@]}"; do
  echo "📦 Uploading $(basename "$file")…"
  gh release upload "$TAG" "$file" --repo "${GITHUB_REPOSITORY}" --clobber
done

echo "✅ Done: All MCPB files attached to release $TAG"
