#!/bin/bash
set -e

VERSION=$(jq -r '.version' package.json)
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "❌ Error: Could not read 'version' from package.json"
  exit 1
fi

echo "📦 Syncing version $VERSION across all files..."

# Update manifest.json (MCPB)
if [[ -f "manifest.json" ]]; then
  jq --arg v "$VERSION" '.version = $v' manifest.json > tmp && mv tmp manifest.json
  echo "  ✅ manifest.json"
fi

# Update server.json (MCP Publisher)
if [[ -f "server.json" ]]; then
  jq --arg v "$VERSION" '.version = $v | .packages[].version = $v' server.json > tmp && mv tmp server.json
  echo "  ✅ server.json"
fi

# Update .claude-plugin/marketplace.json (Claude Code Plugin)
if [[ -f ".claude-plugin/marketplace.json" ]]; then
  jq --arg v "$VERSION" '.metadata.version = $v | .plugins[0].version = $v' .claude-plugin/marketplace.json > tmp && mv tmp .claude-plugin/marketplace.json
  echo "  ✅ .claude-plugin/marketplace.json"
fi

# Update plugins/claude/.claude-plugin/plugin.json (Claude Code Plugin)
if [[ -f "plugins/claude/.claude-plugin/plugin.json" ]]; then
  jq --arg v "$VERSION" '.version = $v' plugins/claude/.claude-plugin/plugin.json > tmp && mv tmp plugins/claude/.claude-plugin/plugin.json
  echo "  ✅ plugins/claude/.claude-plugin/plugin.json"
fi

echo "✅ Done: All files updated to version $VERSION"
