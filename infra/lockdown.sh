#!/usr/bin/env bash
# ============================================================================
# Phase 2: close the public doors.
# ============================================================================
#
# Run this only after the app is deployed, the data is loaded, and sign-in
# works. It is reversible, but while it is on:
#
#   - the tracker is reachable only from the corporate network or VPN
#   - Cosmos is reachable only from inside the virtual network
#   - deployments must run from the corporate network too
#
# Check with your network team first that the office network and VPN can
# reach this virtual network, and that DNS for privatelink zones resolves
# from client machines. If that plumbing is not in place, everyone including
# you is locked out until it is. That is the single most common way this
# step goes wrong.
#
# To reverse:  infra/lockdown.sh --undo
#
# ---------------------------------------------------------------------------
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:?Set RESOURCE_GROUP first}"
WEBAPP="${WEBAPP:?Set WEBAPP first}"
COSMOS_ACCOUNT="${COSMOS_ACCOUNT:?Set COSMOS_ACCOUNT first}"

UNDO="false"
[[ "${1:-}" == "--undo" ]] && UNDO="true"

if [[ "$UNDO" == "true" ]]; then
  echo "==> Reopening public access"
  az webapp update --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
    --set publicNetworkAccess=Enabled --output none
  az cosmosdb update --resource-group "$RESOURCE_GROUP" --name "$COSMOS_ACCOUNT" \
    --public-network-access ENABLED --output none
  echo "    both resources are reachable from the internet again."
  echo "    sign-in still applies. Re-run without --undo when you are done."
  exit 0
fi

cat <<WARNING

About to close public access on:
  web app   ${WEBAPP}
  cosmos    ${COSMOS_ACCOUNT}

After this, the site answers only from inside the virtual network and
whatever is peered to it. If your office network and VPN are not connected
to that network yet, nobody will be able to open the tracker.

WARNING
read -r -p "Have you confirmed network connectivity with your network team? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Stopping. Nothing changed."; exit 1; }

# ---------------------------------------------------------------------------
# Cosmos: no public route at all. The app reaches it over the private
# endpoint, and key-based auth is switched off so the only way in is an
# Entra identity that has been granted data access.
# ---------------------------------------------------------------------------
echo "==> [1/3] Cosmos: public access off"
az cosmosdb update \
  --resource-group "$RESOURCE_GROUP" --name "$COSMOS_ACCOUNT" \
  --public-network-access DISABLED --output none

echo "==> [2/3] Cosmos: key authentication off"
COSMOS_ID=$(az cosmosdb show --resource-group "$RESOURCE_GROUP" --name "$COSMOS_ACCOUNT" --query id -o tsv)
az resource update --ids "$COSMOS_ID" --set properties.disableLocalAuth=true --output none

# ---------------------------------------------------------------------------
# Web app: private endpoint only.
# ---------------------------------------------------------------------------
echo "==> [3/3] Web app: public access off"
az webapp update \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --set publicNetworkAccess=Disabled --output none

cat <<SUMMARY

============================================================================
Locked down.

  https://${WEBAPP}.azurewebsites.net
    resolves to a private IP from inside the network, and to nothing useful
    from outside it.

Test it from a machine on the corporate network or VPN. From your phone on
cellular it should fail, and that failing is the proof it worked.

Deployments now need the same network. Run infra/deploy.sh from a machine on
the VPN, or set up a self-hosted build agent inside the network.

To undo:  ./infra/lockdown.sh --undo
============================================================================
SUMMARY
