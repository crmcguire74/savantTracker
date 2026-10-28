# Moving the tracker to Azure

Two people do this. Part A is for whoever holds admin rights in Azure. Part B
is for Chris. Neither part assumes prior Azure experience.

Read the whole page once before running anything. The order matters, and one
step near the end locks the doors.

---

## What gets built

```
Savant network (office / VPN)
        │
        │  private IP, no internet route
        ▼
┌──────────────────────────────┐
│  App Service (Linux, Node)   │   serves the React app
│  ─ Easy Auth (Entra sign-in) │   checks every request before the app sees it
│  ─ managed identity          │   the app's own account, no passwords
└──────────────┬───────────────┘
               │  private endpoint
               ▼
┌──────────────────────────────┐
│  Cosmos DB (serverless)      │   three documents: state, log, settings
│  ─ keys disabled             │   identity is the only way in
└──────────────────────────────┘
```

Three requirements, three answers:

| You asked for | What does it |
|---|---|
| Web server and project in Azure | App Service, Linux, Node 22, serving the built React app and the API |
| Azure holds the database | Cosmos DB for NoSQL, serverless, reached over a private endpoint |
| Azure handles authentication and access | Entra ID sign-in through App Service Easy Auth, with Editor and Viewer roles |

---

## Cost

Monthly, US East 2, list price. Prices move, so treat these as the shape of
the bill rather than a quote. The
[Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/)
gives your real numbers.

| Resource | Monthly |
|---|---|
| App Service Linux B1 | about $13 |
| Cosmos DB serverless | under $1 at this volume. Billed per request at about $0.25 per million request units, plus about $0.25 per GB stored. The tracker is 3 documents and roughly 130 KB. |
| Private endpoint, web app | about $7 |
| Private endpoint, Cosmos | about $7 |
| Entra ID sign-in | included in your existing Microsoft 365 licensing |
| **Total** | **roughly $28 a month** |

B1 is one small instance with no redundancy. If this becomes something
leadership depends on, P1v3 is about $124 a month and buys you deployment
slots, autoscale, and a better SLA. Start on B1. Changing the plan later is a
dropdown, not a rebuild.

---

# Part A: for the Azure administrator

You need two different kinds of permission. They often sit with different
people:

1. **Contributor on an Azure subscription**, to create the resources. This is
   most of the work.
2. **Application Administrator or Cloud Application Administrator in Entra
   ID**, to create the sign-in registration. If you do not have this, step A3
   fails with "Insufficient privileges" and the identity team has to run that
   one script.

Also involve your **network team** before step A6. That step makes the site
private, and if the office network cannot reach the new virtual network,
everyone is locked out including you. It is reversible, but better not to
need reversing.

## A1. Open Cloud Shell

Cloud Shell is a terminal inside the Azure portal. Nothing to install, and
you are already signed in as yourself.

1. Go to [portal.azure.com](https://portal.azure.com)
2. Click the `>_` icon in the top toolbar
3. Choose **Bash** if asked
4. If it asks to create a storage account, say yes. It needs somewhere to
   keep your files. A few cents a month.

Confirm you are in the right subscription:

```bash
az account show --output table
```

If it is the wrong one:

```bash
az account list --output table
az account set --subscription "<the right subscription name>"
```

## A2. Provision the resources

Upload the project folder to Cloud Shell, or just the `infra` folder. Use the
upload button in the Cloud Shell toolbar.

Open `infra/provision.sh` and edit the four values at the top:

```bash
PREFIX="savant-tracker"      # naming, leave it unless you have a convention
LOCATION="eastus2"           # use the region your firm already uses
RESOURCE_GROUP="rg-savant-tracker"
APP_SERVICE_SKU="B1"
```

Then run it:

```bash
chmod +x infra/*.sh
./infra/provision.sh
```

It takes about ten minutes, mostly waiting on Cosmos DB. It prints a summary
at the end with three values you need for everything that follows. Copy them
somewhere:

```
RESOURCE_GROUP=rg-savant-tracker
WEBAPP=app-savant-tracker-ab12cd
COSMOS_ACCOUNT=cosmos-savant-tracker-ab12cd
```

The script is safe to run twice if something fails partway through.

### What it made, in plain terms

- **A resource group.** A folder for everything else. Deleting it deletes all
  of this, which is a useful thing to know and a dangerous thing to do.
- **A virtual network** with two subnets. One lets the web app send traffic
  into your network. The other holds private IP addresses for the services.
- **Cosmos DB**, serverless, with one container. Serverless means you pay per
  request instead of reserving capacity. For this workload that is pennies.
- **An App Service** running Node 22.
- **A managed identity** for the app. This is the part worth understanding:
  the app gets its own account in Entra, and Cosmos grants that account
  access directly. There is no connection string and no key anywhere. Nothing
  to rotate, nothing to leak, nothing to find in a config file.
- **Two private endpoints.** Each gives a service a private IP inside your
  network, plus the DNS records that make the normal hostname resolve to it.

One thing the script does **not** do, on purpose: it leaves public access on.
The app has to be deployed and the data loaded before the doors close. Do not
share the URL yet.

## A3. Set up sign-in

This is the step that needs Entra permissions.

```bash
export RESOURCE_GROUP=rg-savant-tracker
export WEBAPP=app-savant-tracker-ab12cd
./infra/entra-app.sh
```

It creates the app registration, defines the two roles, generates the client
secret, stores it in the app's settings, and switches on App Service
authentication.

**Write down the secret expiry date it prints and put it in a shared
calendar.** When that secret expires, sign-in stops working and the error
message will not tell you why. Renewing is one command, but only if someone
remembers.

If this fails with "Insufficient privileges to complete the operation", your
account cannot create app registrations. Send the script to whoever
administers Entra ID. Nothing else in this guide depends on you personally
running it.

## A4. Hand over to Chris

Give Chris:

- `RESOURCE_GROUP`, `WEBAPP`, and `COSMOS_ACCOUNT`
- the Cosmos endpoint, which is
  `https://<COSMOS_ACCOUNT>.documents.azure.com:443/`
- **Contributor** on the resource group, so he can deploy
- the **Cosmos DB data contributor** role, so he can load the data. This one
  is not in the portal's Access control blade. It is data-plane access and
  CLI only:

```bash
CHRIS=$(az ad user show --id christopher.mcguire@savantwealth.com --query id -o tsv)
az cosmosdb sql role assignment create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "$CHRIS" --scope "/"
```

If you skip this, the data load in Part B fails with a 403 that reads like a
network problem.

## A5. Assign people to roles

Nobody can sign in until you do this, including you. The registration is set
to require an explicit assignment, which is the behaviour you want.

Ask the identity team for two Entra security groups, or make them yourself:

- `SG-Tracker-Editors`
- `SG-Tracker-Viewers`

Then in the portal:

1. **Microsoft Entra ID** → **Enterprise applications**
2. Search **Savant Strategic Initiatives Tracker**
3. **Users and groups** → **Add user/group**
4. Pick the group, then pick the role: **Tracker Editor** or **Tracker
   Viewer**
5. Repeat for the other group

Groups rather than individuals. Access then becomes a membership change
somebody in IT can do in thirty seconds, rather than an Azure task that
routes back to you.

A person with no role assigned who reaches the site gets a clear message
saying to ask an administrator, not a broken page.

## A6. Lock it down

**Stop. Do not run this until Chris confirms the app is deployed, the data is
loaded, and he can sign in.**

Before running it, confirm with your network team:

- the office network and VPN can route to the virtual network
  `vnet-savant-tracker`
- client machines resolve the `privatelink.azurewebsites.net` private DNS
  zone, usually by linking the zone to the hub network or forwarding from the
  corporate DNS servers

If the answer to either is no, work that out first. Running this without it
locks out everyone.

```bash
export RESOURCE_GROUP=rg-savant-tracker
export WEBAPP=app-savant-tracker-ab12cd
export COSMOS_ACCOUNT=cosmos-savant-tracker-ab12cd
./infra/lockdown.sh
```

Verify: open the site from a machine on the corporate network. It should
load. Open it from a phone on cellular. It should fail. The failure is the
proof.

To reverse: `./infra/lockdown.sh --undo`

---

# Part B: for Chris

You need the Azure CLI on your machine and the three values from Part A.

Install the CLI: [the install page](https://learn.microsoft.com/cli/azure/install-azure-cli)
has one-liners per platform. Then:

```bash
az login
```

A browser window opens. Sign in with your Savant account.

## B1. Deploy the app

From the project folder:

```bash
export RESOURCE_GROUP=rg-savant-tracker
export WEBAPP=app-savant-tracker-ab12cd

./infra/deploy.sh
```

It installs dependencies, builds the front end, zips `dist` and `server`
together, and pushes it. Azure installs the production dependencies on its
side. Three or four minutes.

The production build reads `.env.production`, which points the app's storage
proxy at `/api` instead of IndexedDB. That is the whole switch. The storage
proxy you already have does the rest, and no component changed.

## B2. Load the data

```bash
export COSMOS_ENDPOINT=https://cosmos-savant-tracker-ab12cd.documents.azure.com:443/
npm run seed
```

This writes the migration snapshot into Cosmos: 4 pillars, 28 initiatives, 43
projects, 183 change log entries. It prints what it loaded and reads it back
to confirm.

To load a newer export instead of the bundled snapshot, for instance if
you have kept editing locally since:

```bash
npm run seed -- ./savant-initiatives-tracker-2026-09-23-1400.json
```

It refuses to overwrite existing tracker data unless you add `--force`. That
guard is there so a stray command cannot wipe live edits.

## B3. Check it works

Open `https://app-savant-tracker-ab12cd.azurewebsites.net`.

You should be redirected to a Microsoft sign-in page, then land on the
tracker with your 43 projects. Your name appears in the header instead of the
"Set your name" button, because Entra is supplying it now.

Check these five things before telling anyone it is ready:

1. **The data is there.** 43 projects, 16 on track, 18 at risk, 9 off track.
2. **An edit sticks.** Change a RAG status, hard refresh, confirm it held.
3. **Two browsers agree.** Open it in a second browser signed in as someone
   else. Make an edit in one. The other picks it up within about five
   seconds.
4. **Viewer really is view-only.** Have someone in the Viewers group open it.
   They should see a banner saying view-only, no Add buttons, and greyed
   controls. Export still works for them, which is intentional.
5. **The change log attributes correctly.** Edits now show real names.

Then tell the admin to run A6.

## B4. After lockdown

Deploying now requires the corporate network or VPN. Same command, just run
it while connected:

```bash
./infra/deploy.sh
```

Nothing else changes.

---

## When something breaks

**The site shows "Application Error".**
The app failed to start. Stream the logs:

```bash
az webapp log tail --resource-group $RESOURCE_GROUP --name $WEBAPP
```

Most likely the startup command or a missing app setting. Check that
`COSMOS_ENDPOINT` is set:
`az webapp config appsettings list -g $RESOURCE_GROUP -n $WEBAPP -o table`

**The page loads but says it cannot reach the database.**
Hit `https://<your-app>/api/health`. If it returns 503, the app cannot reach
Cosmos. Three usual causes, in order of likelihood:

1. The managed identity has no Cosmos data role. Re-run the role assignment
   from A2 step 5. Remember it will not show in the portal's IAM blade, which
   makes it look missing when it is not.
2. Virtual network integration did not attach. Check
   **App Service → Networking → Outbound traffic**.
3. DNS. From **App Service → Development Tools → SSH**, run
   `nslookup <cosmos-account>.documents.azure.com`. It should answer with a
   `10.20.2.x` address. A public address means the private DNS zone is not
   linked.

**Sign-in loops, or "AADSTS50011: redirect URI mismatch".**
The redirect URI on the app registration does not match the site. It must be
exactly `https://<your-app>.azurewebsites.net/.auth/login/aad/callback`. Fix
it under **Entra ID → App registrations → Authentication**.

**"You do not have permission to view this directory or page."**
The signed-in account has no role assigned. Go back to A5.

**Everyone can sign in but everyone is view-only.**
The role assignment landed on the wrong role, or people were assigned to the
enterprise application without a role. Check **Enterprise applications →
Users and groups** and confirm the Role column says Tracker Editor.

**Sign-in worked for months and then stopped.**
The client secret expired. Re-run `./infra/entra-app.sh`. It generates a new
secret and updates the app setting. This is the one scheduled maintenance
this system has.

**Nobody can reach the site after lockdown.**
`./infra/lockdown.sh --undo` puts it back while the network path gets sorted.

---

## Things worth knowing before you commit

**The app trusts a header, and that is fine, but only because of how it is
deployed.** App Service Easy Auth validates the Entra token itself and passes
the result to the app in `X-MS-CLIENT-PRINCIPAL`. It also strips any copy of
that header a browser tries to send. That protection depends on traffic
reaching the app through Easy Auth. The deployment keeps that true by
disabling public access and setting authentication to required. If someone
later turns Easy Auth off or exposes the container directly, the header
becomes forgeable. The server refuses to start with `REQUIRE_AUTH=false` when
`NODE_ENV=production` as a backstop, but the real protection is not
dismantling the front door.

**B1 has no redundancy and no deployment slot.** A deploy restarts the app
and drops connections for a few seconds. At this scale nobody notices. If it
starts to matter, P1v3 gives you slots and a real SLA.

**Cosmos backup is continuous with 7 day point-in-time restore**, which the
provisioning script sets. That covers an accidental delete. It does not cover
someone thoughtfully editing the wrong thing, which is what the change log
and the export file are for. Keep exporting monthly.

**Two people editing the same field still works the way it did.** The version
check moved from the browser to Cosmos, where an etag makes it atomic. The
conflict dialog you already have is what a user sees. That path is tested.

**The private networking is the expensive part of the complexity, not the
cost.** Two private endpoints are $14 a month. The real price is that
deployments need VPN, DNS has to be right, and a network change elsewhere can
break the tracker in a way that looks like an app bug. That is the trade you
are making for no public route, and for strategic data at a wealth management
firm it is usually the right one. Just go in knowing the failure mode.

---

## Sources

- [Azure App Service pricing, Linux](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)
- [Azure App Service pricing breakdown](https://www.pump.co/blog/azure-app-service-pricing/)
- [Azure Cosmos DB serverless pricing](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/serverless/)
- [Cosmos DB provisioned vs serverless cost](https://www.mssqltips.com/sqlservertip/7206/azure-cosmos-db-price-differences-provisioned-serverless-throughput-cost/)
- [Connect to Cosmos DB with role-based access control](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-connect-role-based-access-control)
- [App Service virtual network integration](https://learn.microsoft.com/en-us/azure/app-service/overview-vnet-integration)
- [App Service private endpoints](https://learn.microsoft.com/en-us/azure/app-service/networking/private-endpoint)
- [Work with user identities in App Service authentication](https://docs.azure.cn/en-us/app-service/configure-authentication-user-identities)
- [az webapp auth reference](https://learn.microsoft.com/en-us/cli/azure/webapp/auth)
- [az webapp auth microsoft reference](https://learn.microsoft.com/en-us/cli/azure/webapp/auth/microsoft)
- [Azure Functions supported runtime versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions)
- [Azure Static Web Apps hosting plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans)
- [API support in Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)
