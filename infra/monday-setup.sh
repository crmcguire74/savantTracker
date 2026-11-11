#!/usr/bin/env bash
# ============================================================================
# Savant Strategic Initiatives Tracker - monday.com connection
# ============================================================================
#
# Gives the deployed app what it needs to read monday.com:
#
#   - a Key Vault that holds the monday API token (RBAC, no access policies)
#   - a private endpoint and private DNS for the vault, same pattern as provision.sh
#   - app settings on the web app: the token (as a Key Vault reference), the
#     workspace id and the optional sync timer
#
# Run it in Azure Cloud Shell (Bash) after infra/provision.sh. Safe to re-run.
#
# Who can run it: someone who can create a Key Vault and assign roles on the
# resource group (Owner, or Contributor plus User Access Administrator).
#
# You need the monday API token first. It belongs to a monday SERVICE ACCOUNT,
# not to a person. See README.md, monday.com integration, Configure monday.com.
#
# Usage:
#   export RESOURCE_GROUP=rg-savant-tracker
#   export WEBAPP=app-savant-tracker-ab12cd
#   ./infra/monday-setup.sh                  first time: vault, token, settings
#   ./infra/monday-setup.sh --rotate-token   replace the token in a vault this script already set up
#                                            (a vault made by hand has no private endpoint, app role or app settings: run the plain script)
#   ./infra/monday-setup.sh --add-nat        give the app a fixed outbound IP (see below)
#   MODE=appsetting ./infra/monday-setup.sh  skip Key Vault, store the token as an app setting
#
# About outbound access: provision.sh sends ALL of the app's outbound traffic
# through the virtual network (WEBSITE_VNET_ROUTE_ALL=1). The app must reach
# https://api.monday.com from there. Many tenants block default outbound
# internet access from new subnets. If "Test connection" on the Admin screen
# says it cannot reach monday.com, run --add-nat. A NAT gateway also gives the
# app one fixed public IP, which monday.com can allow-list if your account
# restricts API access by IP.
#
# ---------------------------------------------------------------------------
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:?Set RESOURCE_GROUP first, e.g. export RESOURCE_GROUP=rg-savant-tracker}"
WEBAPP="${WEBAPP:?Set WEBAPP first, e.g. export WEBAPP=app-savant-tracker-ab12cd}"

# ---- EDIT THESE (or set them in the environment) --------------------------
MONDAY_WORKSPACE_ID="${MONDAY_WORKSPACE_ID:-17893919}"      # "Savant Strategic Initiatives"
SYNC_MINUTES="${SYNC_MINUTES:-0}"                           # Starting value only. 0 = off. Minimum 5. Admins change it in the app (Open sync, Automatic pulls).
MODE="${MODE:-keyvault}"                                    # keyvault | appsetting
# ---------------------------------------------------------------------------

PREFIX="${PREFIX:-${RESOURCE_GROUP#rg-}}"
SUFFIX="${WEBAPP##*-}"
LOCATION="$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)"
VNET="${VNET:-vnet-${PREFIX}}"
SUBNET_APP="${SUBNET_APP:-snet-app}"
SUBNET_PE="${SUBNET_PE:-snet-private-endpoints}"
KEYVAULT="${KEYVAULT:-$(echo -n "kv-${PREFIX}-${SUFFIX}" | cut -c1-24)}"
SECRET_NAME="monday-api-token"

read_token() {
  read -r -s -p "Paste the monday API token (hidden, then Enter): " TOKEN
  echo
  [[ -n "$TOKEN" ]] || { echo "No token entered. Nothing changed."; exit 1; }
}

# Writes the token to the vault through a private temp file, so it never
# appears in the process list or the shell history.
store_secret() {
  local file err tries=0
  file="$(umask 077; mktemp)"
  printf '%s' "$TOKEN" > "$file"
  until err="$(az keyvault secret set --vault-name "$KEYVAULT" --name "$SECRET_NAME" \
          --file "$file" --encoding utf-8 --output none 2>&1 >/dev/null)"; do
    tries=$((tries + 1))
    if [[ $tries -ge 8 ]]; then
      rm -f "$file"
      echo
      echo "Could not write the secret to vault '${KEYVAULT}'. Azure said:"
      echo "$err" | tail -n 4 | sed 's/^/    /'
      echo
      case "$err" in
        *ForbiddenByRbac*|*"not authorized"*|*"does not have"*|*AuthorizationFailed*)
          echo "Cause: your account may not write secrets in this vault. Give it the role, wait 2 to 5 minutes, re-run:"
          echo "  az role assignment create --assignee-object-id \$(az ad signed-in-user show --query id -o tsv) --assignee-principal-type User --role 'Key Vault Secrets Officer' --scope \$(az keyvault show -n ${KEYVAULT} --query id -o tsv)" ;;
        *ForbiddenByFirewall*|*"Client address"*|*"network"*)
          echo "Cause: the vault's firewall blocks this session. Check Networking on the vault, or run from the VPN." ;;
        *"not found"*|*NotFound*|*"could not be found"*)
          echo "Cause: no vault named '${KEYVAULT}'. List them: az keyvault list -g ${RESOURCE_GROUP} -o table" ;;
        *) echo "Re-run after checking the message above." ;;
      esac
      exit 1
    fi
    echo "    cannot write yet, retrying (${tries}/8)..."
    sleep 20
  done
  rm -f "$file"
}

# ---------------------------------------------------------------------------
# --add-nat: a fixed outbound path to the internet
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--add-nat" ]]; then
  echo "==> NAT gateway for outbound traffic from ${SUBNET_APP}"
  az network public-ip create --resource-group "$RESOURCE_GROUP" --name "pip-${PREFIX}-nat" \
    --sku Standard --allocation-method Static --output none
  az network nat gateway create --resource-group "$RESOURCE_GROUP" --name "nat-${PREFIX}" \
    --public-ip-addresses "pip-${PREFIX}-nat" --idle-timeout 10 --output none
  az network vnet subnet update --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET" \
    --name "$SUBNET_APP" --nat-gateway "nat-${PREFIX}" --output none
  IP=$(az network public-ip show --resource-group "$RESOURCE_GROUP" --name "pip-${PREFIX}-nat" --query ipAddress -o tsv)
  echo
  echo "Done. The app now leaves the network from ${IP}."
  echo "If monday.com restricts API access by IP, allow ${IP}."
  echo "Then press Test connection on the Admin screen."
  exit 0
fi

# ---------------------------------------------------------------------------
# --rotate-token: replace the secret in a vault that is already locked down
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--rotate-token" ]]; then
  echo "==> Making sure your account can write secrets in the vault"
  ROT_KV_ID=$(az keyvault show --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --query id -o tsv)
  az role assignment create --assignee-object-id "$(az ad signed-in-user show --query id -o tsv)" \
    --assignee-principal-type User --role "Key Vault Secrets Officer" --scope "$ROT_KV_ID" --output none 2>/dev/null || true
  echo "==> Opening the vault to this session"
  az keyvault update --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --public-network-access Enabled --output none
  read_token
  store_secret
  unset TOKEN
  echo "==> Closing the vault again"
  az keyvault update --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --public-network-access Disabled --output none
  az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --output none
  echo "Token replaced. The app restarted. Press Test connection on the Admin screen."
  exit 0
fi

echo "==> Resource group: ${RESOURCE_GROUP}"
echo "==> Web app:        ${WEBAPP}"
echo "==> Mode:           ${MODE}"
[[ "$MODE" == "keyvault" ]] && echo "==> Key Vault:      ${KEYVAULT}"
echo "==> Workspace id:   ${MONDAY_WORKSPACE_ID}"
echo "==> Sync timer:     ${SYNC_MINUTES} minutes (0 = off)"
echo
read -r -p "Continue? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || exit 1

if [[ "$SYNC_MINUTES" != "0" && "$SYNC_MINUTES" -lt 5 ]]; then
  echo "SYNC_MINUTES must be 0 or at least 5."
  exit 1
fi

# ---------------------------------------------------------------------------
# Simple mode: the token as an app setting. Encrypted at rest, but visible to
# anyone who can read the app's configuration. Use Key Vault when you can.
# ---------------------------------------------------------------------------
if [[ "$MODE" == "appsetting" ]]; then
  read_token
  az webapp config appsettings set --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
    --settings MONDAY_API_TOKEN="$TOKEN" MONDAY_WORKSPACE_ID="$MONDAY_WORKSPACE_ID" \
               MONDAY_SYNC_INTERVAL_MINUTES="$SYNC_MINUTES" --output none
  unset TOKEN
  echo "Done. Press Test connection on the Admin screen."
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Key Vault
#
# RBAC mode: access comes from role assignments, not from vault access
# policies. Public access stays on only until the token is stored and the
# private endpoint exists, then it is switched off.
# ---------------------------------------------------------------------------
echo "==> [1/6] Key Vault"
az keyvault create --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --location "$LOCATION" \
  --enable-rbac-authorization true --public-network-access Enabled \
  --retention-days 90 --output none
KV_ID=$(az keyvault show --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --query id -o tsv)

# ---------------------------------------------------------------------------
# 2. Who may do what
#
# You: write the secret (Secrets Officer).
# The app's managed identity: read it, nothing else (Secrets User).
# ---------------------------------------------------------------------------
echo "==> [2/6] Role assignments"
MY_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
az role assignment create --assignee-object-id "$MY_OBJECT_ID" --assignee-principal-type User \
  --role "Key Vault Secrets Officer" --scope "$KV_ID" --output none
APP_PRINCIPAL=$(az webapp identity show --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --query principalId -o tsv)
[[ -n "$APP_PRINCIPAL" ]] || { echo "The web app has no managed identity. Run infra/provision.sh first."; exit 1; }
az role assignment create --assignee-object-id "$APP_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" --scope "$KV_ID" --output none

# ---------------------------------------------------------------------------
# 3. The token
# ---------------------------------------------------------------------------
echo "==> [3/6] The monday API token"
read_token
store_secret
unset TOKEN

# ---------------------------------------------------------------------------
# 4. Private endpoint and DNS, same pattern as the Cosmos and web app endpoints
# ---------------------------------------------------------------------------
echo "==> [4/6] Private endpoint and DNS for the vault"
az network private-dns zone create --resource-group "$RESOURCE_GROUP" \
  --name "privatelink.vaultcore.azure.net" --output none
az network private-dns link vnet create --resource-group "$RESOURCE_GROUP" \
  --zone-name "privatelink.vaultcore.azure.net" --name "link-${VNET}-kv" \
  --virtual-network "$VNET" --registration-enabled false --output none
az network private-endpoint create --resource-group "$RESOURCE_GROUP" --name "pe-${KEYVAULT}" \
  --vnet-name "$VNET" --subnet "$SUBNET_PE" \
  --private-connection-resource-id "$KV_ID" --group-id vault --connection-name "conn-keyvault" --output none
az network private-endpoint dns-zone-group create --resource-group "$RESOURCE_GROUP" \
  --endpoint-name "pe-${KEYVAULT}" --name "zg-keyvault" \
  --private-dns-zone "privatelink.vaultcore.azure.net" --zone-name "vaultcore" --output none

# ---------------------------------------------------------------------------
# 5. App settings. The token setting is a Key Vault reference: App Service
# reads the secret with the managed identity, so the value is never stored
# in the app's configuration.
# ---------------------------------------------------------------------------
echo "==> [5/6] App settings"
az webapp config appsettings set --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --settings \
    "MONDAY_API_TOKEN=@Microsoft.KeyVault(VaultName=${KEYVAULT};SecretName=${SECRET_NAME})" \
    "MONDAY_WORKSPACE_ID=${MONDAY_WORKSPACE_ID}" \
    "MONDAY_SYNC_INTERVAL_MINUTES=${SYNC_MINUTES}" \
  --output none

# ---------------------------------------------------------------------------
# 6. Close the vault's public door and restart
# ---------------------------------------------------------------------------
echo "==> [6/6] Vault: public access off, app restart"
az keyvault update --resource-group "$RESOURCE_GROUP" --name "$KEYVAULT" --public-network-access Disabled --output none
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --output none

cat <<SUMMARY

============================================================================
monday.com is connected.

  Key Vault          ${KEYVAULT}
  Secret             ${SECRET_NAME}
  Workspace id       ${MONDAY_WORKSPACE_ID}
  Sync timer         ${SYNC_MINUTES} minutes (0 = off)

Next:
  1. Sign in to the tracker as an admin and open Admin, then Open sync.
  2. Press Test connection. You should see the service account name and the
     workspace name.
       - "monday rejected the token"      the token is wrong or the account is inactive
       - "workspace ... is not visible"   add the service account to the workspace in monday
       - "Cannot reach monday.com"        outbound access: run  ./infra/monday-setup.sh --add-nat
       - "No monday token is set"         the Key Vault reference did not resolve. In the portal,
                                          open the web app, Environment variables, and look at the
                                          status next to MONDAY_API_TOKEN.
  3. Then run the first sync (README.md, monday.com integration, Using the sync).

To replace the token later:  ./infra/monday-setup.sh --rotate-token
============================================================================
SUMMARY
