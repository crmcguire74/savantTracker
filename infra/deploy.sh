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
# Ship the production dependencies inside the package and tell Azure not to
# build. Letting Azure build fails ("tsc: not found") because it installs
# without dev dependencies and then runs the build script.
( cd "$STAGING" && npm ci --omit=dev --no-audit --no-fund )
rm -f "$ROOT/deploy.zip"
( cd "$STAGING" && zip -qr "$ROOT/deploy.zip" . )
rm -rf "$STAGING"
echo "    $(du -h deploy.zip | cut -f1) package"

echo "==> [4/4] Deploying"
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false --output none
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --src-path deploy.zip --type zip --async true

rm -f deploy.zip

echo
echo "Upload accepted. The app restarts and takes 1 to 2 minutes to come up. Checking in 90 seconds..."
sleep 90
STATUS=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --query state -o tsv)
echo "  app state: ${STATUS}"
echo "  url:       https://${WEBAPP}.azurewebsites.net"
echo
echo "If the page does not load, stream the logs:"
echo "  az webapp log tail --resource-group ${RESOURCE_GROUP} --name ${WEBAPP}"
