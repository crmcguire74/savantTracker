#!/usr/bin/env bash
# ============================================================================
# Build and publish the tracker to the Azure App Service.
# ============================================================================
#
# Run this from the project folder on a machine that has Node and the Azure
# CLI, signed in with `az login`.
#
# While public access is still on, this works from anywhere. After
# infra/lockdown.sh runs, it only works from the corporate network or VPN,
# because that is the point of the lockdown.
#
# ---------------------------------------------------------------------------
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:?Set RESOURCE_GROUP first}"
WEBAPP="${WEBAPP:?Set WEBAPP first}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> [1/4] Installing dependencies"
npm ci

echo "==> [2/4] Building the front end"
npm run build

echo "==> [3/4] Packaging"
STAGING="$(mktemp -d)"
mkdir -p "$STAGING"
cp -r dist server package.json package-lock.json "$STAGING/"
# Azure runs `npm install --omit=dev` on the server during deployment, so
# only the runtime dependencies ship. No node_modules in the zip.
( cd "$STAGING" && zip -qr "$ROOT/deploy.zip" . )
rm -rf "$STAGING"
echo "    $(du -h deploy.zip | cut -f1) package"

echo "==> [4/4] Deploying"
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --src-path deploy.zip --type zip --async false

rm -f deploy.zip

echo
echo "Deployed. Checking health in 20 seconds..."
sleep 20
STATUS=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --query state -o tsv)
echo "  app state: ${STATUS}"
echo "  url:       https://${WEBAPP}.azurewebsites.net"
echo
echo "If the page does not load, stream the logs:"
echo "  az webapp log tail --resource-group ${RESOURCE_GROUP} --name ${WEBAPP}"
