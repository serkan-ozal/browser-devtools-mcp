VERSION="$(jq -r '.version' package.json)"
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "❌ Error: Could not read 'version' from package.json"
  exit 1
fi

ASSET=".mcpb/browser-devtools.mcpb"
if [[ ! -f "$ASSET" ]]; then
  echo "❌ Error: Asset not found at $ASSET"
  exit 1
fi

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
# Ensure release exists for the tag
until gh release view "$TAG" --repo ${GITHUB_REPOSITORY} >/dev/null 2>&1; do
  i=$((i+1))
  if (( i >= MAX_TRIES )); then
    echo "❌ Release '$TAG' not visible after ${MAX_TRIES} tries."
    exit 1
  fi
  echo "⏳ Waiting for release '$TAG' to appear… ($i/$MAX_TRIES)"
  sleep "$SLEEP_SECS"
done

echo "ℹ️ Uploading MCPB asset to release $TAG…"
gh release upload "$TAG" "$ASSET" --repo ${GITHUB_REPOSITORY} --clobber

echo "✅ Done: browser-devtools.mcpb attached to release $TAG"
