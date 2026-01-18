#!/bin/bash
set -e

VERSION=$(jq -r '.version' package.json)
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "❌ Error: Could not read 'version' from package.json"
  exit 1
fi

jq --arg v "$VERSION" '.version = $v | .packages[].version = $v' server.json > tmp && mv tmp server.json
echo "✅ Done: Updated version to $VERSION in the server.json"
