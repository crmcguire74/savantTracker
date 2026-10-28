#!/usr/bin/env bash
# ============================================================================
# Savant Strategic Initiatives Tracker - sign-in and roles
# ============================================================================
#
# Creates the Microsoft Entra app registration the tracker signs people in
# with, defines the two roles, and switches on App Service authentication.
#
# Who can run this: someone who can create app registrations in the tenant.
# That is usually Application Administrator or Cloud Application
# Administrator, not the same permission as creating Azure resources. If this
# script fails with "Insufficient privileges", that is the reason, and the
# identity team has to do this part.
#
# After this runs, nobody can reach the site without a Savant account AND a
# role assignment. Assigning people to roles is the last step and is done in
# the portal, covered in AZURE-DEPLOYMENT.md.
#
# ---------------------------------------------------------------------------
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:?Set RESOURCE_GROUP first, e.g. export RESOURCE_GROUP=rg-savant-tracker}"
WEBAPP="${WEBAPP:?Set WEBAPP first, e.g. export WEBAPP=app-savant-tracker-ab12cd}"
DISPLAY_NAME="${DISPLAY_NAME:-Savant Strategic Initiatives Tracker}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANT_ID=$(az account show --query tenantId -o tsv)
APP_HOST="${WEBAPP}.azurewebsites.net"
REDIRECT_URI="https://${APP_HOST}/.auth/login/aad/callback"

echo "==> Tenant:   ${TENANT_ID}"
echo "==> App host: ${APP_HOST}"

# ---------------------------------------------------------------------------
# 1. The app registration
#
# --sign-in-audience AzureADMyOrg means Savant accounts only. Not personal
# Microsoft accounts, not other tenants.
# ---------------------------------------------------------------------------
echo "==> [1/6] App registration"
APP_ID=$(az ad app list --display-name "$DISPLAY_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)

if [[ -z "$APP_ID" || "$APP_ID" == "null" ]]; then
  APP_ID=$(az ad app create \
    --display-name "$DISPLAY_NAME" \
    --sign-in-audience AzureADMyOrg \
    --web-redirect-uris "$REDIRECT_URI" \
    --enable-id-token-issuance true \
    --query appId -o tsv)
  echo "    created ${APP_ID}"
else
  az ad app update --id "$APP_ID" \
    --web-redirect-uris "$REDIRECT_URI" \
    --enable-id-token-issuance true --output none
  echo "    reusing ${APP_ID}"
fi

# ---------------------------------------------------------------------------
# 2. The app roles (Admin, Editor, Executive, Viewer)
#
# Roles are declared on the registration, then assigned to people. A role has
# to keep the same id across updates, or every assignment to it is lost, so an
# existing role's id is reused and only roles new to app-roles.json get one.
# ---------------------------------------------------------------------------
echo "==> [2/6] App roles (from infra/app-roles.json)"
EXISTING_JSON=$(mktemp)
az ad app show --id "$APP_ID" --query "appRoles" -o json > "$EXISTING_JSON"
ROLES_FILE=$(mktemp)

if python3 - "$SCRIPT_DIR/app-roles.json" "$EXISTING_JSON" > "$ROLES_FILE" <<'PY'
import json, sys, uuid
wanted = json.load(open(sys.argv[1]))
existing = {role['value']: role for role in json.load(open(sys.argv[2])) or []}
missing = [role['value'] for role in wanted if role['value'] not in existing]
for role in wanted:
    role['id'] = existing.get(role['value'], {}).get('id') or str(uuid.uuid4())
# Roles on the registration that the file no longer lists stay, so removing
# one is a deliberate act in the portal rather than a side effect of a deploy.
kept = [role for value, role in existing.items() if value not in {r['value'] for r in wanted}]
print(json.dumps(wanted + kept))
sys.exit(0 if missing else 3)
PY
then
  az ad app update --id "$APP_ID" --app-roles "@${ROLES_FILE}" --output none
  echo "    roles added or updated"
else
  echo "    every role already present, leaving them alone"
fi
rm -f "$ROLES_FILE" "$EXISTING_JSON"

# ---------------------------------------------------------------------------
# 3. Service principal
#
# The registration describes the app. The service principal is the app's
# presence in your tenant, and it is what people get assigned to. Without it
# the roles cannot be handed out.
# ---------------------------------------------------------------------------
echo "==> [3/6] Service principal"
az ad sp create --id "$APP_ID" --output none 2>/dev/null || echo "    already exists"

# Require an explicit role assignment. Without this, any Savant account can
# sign in; with it, only people you assign get through the front door.
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${SP_ID}" \
  --headers "Content-Type=application/json" \
  --body '{"appRoleAssignmentRequired": true}' --output none
echo "    assignment required: on"

# ---------------------------------------------------------------------------
# 4. Client secret
#
# App Service needs a secret to complete the sign-in handshake. Two years is
# the maximum the tenant usually allows. Put the expiry in a calendar: when
# it lapses, sign-in stops and the cause is not obvious.
# ---------------------------------------------------------------------------
echo "==> [4/6] Client secret"
SECRET=$(az ad app credential reset --id "$APP_ID" --years 2 --query password -o tsv)
EXPIRY=$(date -u -d "+2 years" +%Y-%m-%d 2>/dev/null || date -u -v+2y +%Y-%m-%d)

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --settings MICROSOFT_PROVIDER_AUTHENTICATION_SECRET="$SECRET" --output none
echo "    stored in app settings, expires ${EXPIRY}"

# ---------------------------------------------------------------------------
# 5. Turn on App Service authentication
#
# This is the platform feature usually called Easy Auth. Every request is
# checked before it reaches the application. The app never sees an
# unauthenticated caller and never handles a token itself.
# ---------------------------------------------------------------------------
echo "==> [5/6] App Service authentication"
az extension add --name authV2 --upgrade --only-show-errors 2>/dev/null || true

az webapp auth microsoft update \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --client-id "$APP_ID" \
  --client-secret-setting-name "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET" \
  --issuer "https://login.microsoftonline.com/${TENANT_ID}/v2.0" \
  --allowed-audiences "api://${APP_ID}" "$APP_ID" \
  --tenant-id "$TENANT_ID" \
  --yes --output none

az webapp auth update \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP" \
  --enabled true \
  --unauthenticated-client-action RedirectToLoginPage \
  --redirect-provider azureActiveDirectory \
  --require-https true \
  --enable-token-store true --output none

# ---------------------------------------------------------------------------
# 6. Done
# ---------------------------------------------------------------------------
cat <<SUMMARY

============================================================================
Sign-in is configured.

  Application (client) ID   ${APP_ID}
  Tenant ID                 ${TENANT_ID}
  Secret expires            ${EXPIRY}   <-- put this in a calendar
  Sign-in URL               https://${APP_HOST}

Nobody can get in yet. Assign people to roles:

  Azure portal
    -> Microsoft Entra ID
    -> Enterprise applications
    -> ${DISPLAY_NAME}
    -> Users and groups
    -> Add user/group
       pick the person or an Entra group, then pick
       Tracker Editor  (can change things)
       Tracker Viewer  (can look only)

Assigning a group is better than assigning people one at a time. Two groups,
one per role, and access becomes a membership change instead of an Azure task.
============================================================================
SUMMARY
