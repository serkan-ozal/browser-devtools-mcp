#!/bin/bash
set -e

VERSION=$(jq -r '.version' package.json)
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "❌ Error: Could not read 'version' from package.json"
  exit 1
fi

jq --arg v "$VERSION" '.version = $v' manifest.json > tmp && mv tmp manifest.json
echo "✅ Done: Updated version to $VERSION in the manifest.json"
