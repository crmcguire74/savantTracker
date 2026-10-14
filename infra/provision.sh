#!/usr/bin/env bash
# ============================================================================
# Savant Strategic Initiatives Tracker - Azure provisioning, phase 1
# ============================================================================
#
# Run this in Azure Cloud Shell (Bash). Cloud Shell is a terminal inside the
# Azure portal: no install, already signed in as you. Open the portal, click
# the >_ icon in the top bar, choose Bash.
#
# What this creates:
#   - a resource group
#   - a virtual network with two subnets (app outbound, private endpoints)
#   - Cosmos DB for NoSQL, serverless, with a private endpoint
#   - a Linux App Service running Node 22, with a private endpoint
#   - a managed identity for the app, granted data access to Cosmos
#
# What this deliberately does NOT do yet:
#   - it leaves public network access ON, so the app can be deployed and the
#     data can be loaded from a laptop. infra/lockdown.sh closes both doors
#     once that is done. Locking down first means locking yourself out.
#   - it does not create the Entra app registration. That needs different
#     permissions and lives in infra/entra-app.sh.
#
# Safe to re-run: every command either creates or updates.
#
# ---------------------------------------------------------------------------
set -euo pipefail

# ---- EDIT THESE -----------------------------------------------------------
PREFIX="savant-tracker"          # used to name everything
LOCATION="eastus2"               # pick the region your firm already uses
RESOURCE_GROUP="rg-${PREFIX}"
APP_SERVICE_SKU="B1"             # B1 to start. P1V3 for production traffic.
# ---------------------------------------------------------------------------

# Names derived from the prefix. Cosmos and web app names must be globally
# unique, so a short random suffix is appended the first time.
SUFFIX="${TRACKER_SUFFIX:-$(echo -n "$RESOURCE_GROUP$(az account show --query id -o tsv)" | md5sum | cut -c1-6)}"
VNET="vnet-${PREFIX}"
SUBNET_APP="snet-app"
SUBNET_PE="snet-private-endpoints"
COSMOS_ACCOUNT="cosmos-${PREFIX}-${SUFFIX}"
COSMOS_DB="tracker"
COSMOS_CONTAINER="documents"
PLAN="plan-${PREFIX}"
WEBAPP="app-${PREFIX}-${SUFFIX}"

echo "==> Subscription: $(az account show --query name -o tsv)"
echo "==> Resource group: ${RESOURCE_GROUP} in ${LOCATION}"
echo "==> Web app will be: ${WEBAPP}"
echo "==> Cosmos account:  ${COSMOS_ACCOUNT}"
echo
read -r -p "Continue? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || exit 1

# ---------------------------------------------------------------------------
# 1. Resource group
# ---------------------------------------------------------------------------
echo "==> [1/9] Resource group"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# ---------------------------------------------------------------------------
# 2. Network
#
# Two subnets. The app subnet is delegated to App Service so the web app can
# send outbound traffic into the network. The private endpoint subnet holds
# the private IPs that Cosmos and the web app answer on.
# ---------------------------------------------------------------------------
echo "==> [2/9] Virtual network and subnets"
az network vnet create \
  --resource-group "$RESOURCE_GROUP" --name "$VNET" \
  --address-prefix 10.20.0.0/16 \
  --subnet-name "$SUBNET_APP" --subnet-prefix 10.20.1.0/27 \
  --output none

az network vnet subnet update \
  --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET" --name "$SUBNET_APP" \
  --delegations Microsoft.Web/serverFarms --output none

az network vnet subnet create \
  --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET" --name "$SUBNET_PE" \
  --address-prefix 10.20.2.0/27 \
  --output none

# ---------------------------------------------------------------------------
# 3. Cosmos DB, serverless
#
# Serverless bills per request rather than per reserved throughput. A tracker
# a few dozen people touch during the workday costs cents per month.
# ---------------------------------------------------------------------------
echo "==> [3/9] Cosmos DB account (this one takes a few minutes)"
az cosmosdb create \
  --resource-group "$RESOURCE_GROUP" --name "$COSMOS_ACCOUNT" \
  --locations regionName="$LOCATION" failoverPriority=0 isZoneRedundant=false \
  --capabilities EnableServerless \
  --default-consistency-level Session \
  --backup-policy-type Continuous \
  --output none

az cosmosdb sql database create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --name "$COSMOS_DB" --output none

# Partition key is the document path (tracker/state, tracker/log, ...).
az cosmosdb sql container create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --database-name "$COSMOS_DB" --name "$COSMOS_CONTAINER" \
  --partition-key-path "/key" --output none

COSMOS_ENDPOINT="https://${COSMOS_ACCOUNT}.documents.azure.com:443/"

# ---------------------------------------------------------------------------
# 4. App Service
# ---------------------------------------------------------------------------
echo "==> [4/9] App Service plan and web app"
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" --name "$PLAN" \
  --is-linux --sku "$APP_SERVICE_SKU" --location "$LOCATION" --output none

az webapp create \
  --resource-group "$RESOURCE_GROUP" --plan "$PLAN" --name "$WEBAPP" \
  --runtime "NODE:22-lts" --output none

az webapp config set \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --startup-file "node server/index.js" \
  --http20-enabled true \
  --min-tls-version 1.2 \
  --always-on true \
  --output none

az webapp update \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --https-only true --output none

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --settings \
    NODE_ENV=production \
    REQUIRE_AUTH=true \
    COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
    COSMOS_DATABASE="$COSMOS_DB" \
    COSMOS_CONTAINER="$COSMOS_CONTAINER" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    WEBSITE_VNET_ROUTE_ALL=1 \
  --output none

# ---------------------------------------------------------------------------
# 5. Managed identity and Cosmos data access
#
# The app gets its own identity in Entra. Cosmos grants that identity data
# access directly. No connection string, no key, nothing to rotate or leak.
#
# Note: this role assignment is data-plane. It does NOT appear in the portal's
# Access control (IAM) blade and cannot be made there. CLI only.
# ---------------------------------------------------------------------------
echo "==> [5/9] Managed identity and Cosmos data role"
PRINCIPAL_ID=$(az webapp identity assign \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --query principalId -o tsv)

az cosmosdb sql role assignment create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "$PRINCIPAL_ID" \
  --scope "/" --output none

# The person running this also needs data access, to load the starting data.
MY_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
az cosmosdb sql role assignment create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "$MY_OBJECT_ID" \
  --scope "/" --output none

# ---------------------------------------------------------------------------
# 6. Outbound: the app joins the network so it can reach private endpoints
# ---------------------------------------------------------------------------
echo "==> [6/9] Virtual network integration"
az webapp vnet-integration add \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --vnet "$VNET" --subnet "$SUBNET_APP" --output none

# ---------------------------------------------------------------------------
# 7. Private endpoint for Cosmos
#
# A private endpoint gives the service a private IP inside your network. The
# private DNS zone is what makes the public hostname resolve to that IP, so
# the app's normal connection string keeps working while the traffic never
# touches the internet. Forget the DNS zone and nothing resolves.
# ---------------------------------------------------------------------------
echo "==> [7/9] Private endpoint and DNS for Cosmos"
COSMOS_ID=$(az cosmosdb show --resource-group "$RESOURCE_GROUP" --name "$COSMOS_ACCOUNT" --query id -o tsv)

az network private-dns zone create \
  --resource-group "$RESOURCE_GROUP" --name "privatelink.documents.azure.com" --output none
az network private-dns link vnet create \
  --resource-group "$RESOURCE_GROUP" --zone-name "privatelink.documents.azure.com" \
  --name "link-${VNET}" --virtual-network "$VNET" --registration-enabled false --output none

az network private-endpoint create \
  --resource-group "$RESOURCE_GROUP" --name "pe-${COSMOS_ACCOUNT}" \
  --vnet-name "$VNET" --subnet "$SUBNET_PE" \
  --private-connection-resource-id "$COSMOS_ID" \
  --group-id Sql --connection-name "conn-cosmos" --output none

az network private-endpoint dns-zone-group create \
  --resource-group "$RESOURCE_GROUP" --endpoint-name "pe-${COSMOS_ACCOUNT}" \
  --name "zg-cosmos" --private-dns-zone "privatelink.documents.azure.com" \
  --zone-name "documents" --output none

# ---------------------------------------------------------------------------
# 8. Private endpoint for the web app
# ---------------------------------------------------------------------------
echo "==> [8/9] Private endpoint and DNS for the web app"
WEBAPP_ID=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" --query id -o tsv)

az network private-dns zone create \
  --resource-group "$RESOURCE_GROUP" --name "privatelink.azurewebsites.net" --output none
az network private-dns link vnet create \
  --resource-group "$RESOURCE_GROUP" --zone-name "privatelink.azurewebsites.net" \
  --name "link-${VNET}" --virtual-network "$VNET" --registration-enabled false --output none

az network private-endpoint create \
  --resource-group "$RESOURCE_GROUP" --name "pe-${WEBAPP}" \
  --vnet-name "$VNET" --subnet "$SUBNET_PE" \
  --private-connection-resource-id "$WEBAPP_ID" \
  --group-id sites --connection-name "conn-webapp" --output none

az network private-endpoint dns-zone-group create \
  --resource-group "$RESOURCE_GROUP" --endpoint-name "pe-${WEBAPP}" \
  --name "zg-webapp" --private-dns-zone "privatelink.azurewebsites.net" \
  --zone-name "azurewebsites" --output none

# ---------------------------------------------------------------------------
# 9. Logging
# ---------------------------------------------------------------------------
echo "==> [9/9] Application logging"
az webapp log config \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --application-logging filesystem --level information \
  --docker-container-logging filesystem --output none

# ---------------------------------------------------------------------------
cat <<SUMMARY

============================================================================
Phase 1 complete.

  Resource group     ${RESOURCE_GROUP}
  Web app            ${WEBAPP}
  Public URL         https://${WEBAPP}.azurewebsites.net
  Cosmos account     ${COSMOS_ACCOUNT}
  Cosmos endpoint    ${COSMOS_ENDPOINT}

Public access is still ON, on purpose, so the app can be deployed and the
data loaded. Nothing is locked down yet and nobody should be told the URL.

Next, in order:
  1. infra/entra-app.sh          create the sign-in registration and roles
  2. infra/deploy.sh             build and publish the app
  3. npm run seed                load the tracker data into Cosmos
  4. infra/lockdown.sh           close public access on both resources

Save these two values. The next scripts ask for them.
  RESOURCE_GROUP=${RESOURCE_GROUP}
  WEBAPP=${WEBAPP}
  COSMOS_ACCOUNT=${COSMOS_ACCOUNT}
============================================================================
SUMMARY
