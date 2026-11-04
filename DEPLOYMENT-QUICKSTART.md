# Quickstart: get the tracker update live in Azure

The short version. For every detail and the full troubleshooting, see `DEPLOYMENT-RUNBOOK.md`.

What this gets done:

1. Your code in Azure DevOps (ADO)
2. Sign-in and roles set up in Entra
3. monday.com connected
4. The update deployed to the Azure app you already have

---

## How Azure maps to what you know

| You know | Azure calls it | One line |
|---|---|---|
| Firebase project | **Resource group** | A folder that holds all the pieces of one app |
| Netlify site, but it runs your Node server too | **App Service** (the "web app") | Runs `server/index.js` and serves the React build |
| Firestore | **Cosmos DB** | Your data. A deploy never touches it |
| Firebase Auth | **Entra ID** | Microsoft sign-in. Everyone already has an account |
| Custom claims or user roles | **App roles** (Admin, Editor, Executive, Viewer) | Assigned to people in the Azure portal, not in code |
| Firebase secrets, Netlify env vars | **App settings** and **Key Vault** | Env vars for the app. Key Vault holds the monday token |
| `firebase deploy` | `az webapp deploy` | One command that uploads a zip |
| Netlify auto-deploy from Git | **ADO Pipeline** | Optional. Not needed to start |
| Firebase console | **Azure portal** | https://portal.azure.com |

The big difference from Firebase: Azure splits permissions across several people. You can deploy code. Some things only an admin can do. Those steps are marked **ASK FRANK** (Azure admin) or **ASK IDENTITY** (the Entra team).

The sign-in already works without extra code. Azure checks the Microsoft login before a request reaches your app, and passes in who the person is and their role.

---

## Where you work

| Place | How to open it |
|---|---|
| **PowerShell** | Start menu, type `PowerShell`. Then run this first, every time: |

```powershell
cd "C:\Users\christopher.mcguire\Documents\Code\savant-tracker-gitclone\savantTracker"
```

| Place | How to open it |
|---|---|
| **Azure portal** | https://portal.azure.com, sign in with your Savant account |
| **ADO** | https://dev.azure.com, pick the Savant organization |
| **monday.com** | Your usual monday address |

---

## Step 1. Check the code

**Why:** a broken build is the most common failed deploy.

```powershell
npm test
npm run build
git restore tsconfig.tsbuildinfo
```

You should see all tests pass and the build finish. If not, stop.

---

## Step 2. Get the code into ADO

**Why:** ADO becomes your team's Git home. GitHub stays as your archive.

**ASK first:** the ADO admin creates a project and a repo named `savantTracker` and adds you as Contributor. Then:

1. In ADO, open **Repos**, click **Clone**, copy the web address.
2. In PowerShell (replace the address):

```powershell
git config user.name  "Christopher McGuire"
git config user.email "christopher.mcguire@savantwealth.com"

# Take the three Lumiant zip files out of the repo (third-party files)
New-Item -ItemType Directory -Force ..\lumiant-files | Out-Null
Move-Item *.zip ..\lumiant-files\
Add-Content .gitignore "`n/*.zip"

# One fresh commit, no old history
git checkout --orphan ado-main
git add -A
git commit -m "Initial import from GitHub"

git remote add ado https://dev.azure.com/<org>/<project>/_git/savantTracker
git push ado ado-main:main
```

A Microsoft sign-in window opens. Sign in.

3. Make ADO your main remote:

```powershell
git remote rename origin github
git remote rename ado origin
git fetch origin
git checkout -B main origin/main
git branch -u origin/main main
```

You should see the files in ADO under **Repos > Files**. Do not delete the GitHub repo yet.

Want to keep your commit history instead? Skip the `--orphan` lines and see `DEPLOYMENT-RUNBOOK.md`, Step 2.3 (option 2).

4. Protect `main` (optional but recommended): ADO > **Project settings > Repositories > savantTracker > Policies > Branch Policies > main**. Turn on **Require a minimum number of reviewers** (1). Save.

---

## Step 3. Your Azure app (already built by Frank)

**Why:** you need three names for every command. They come from Frank's Sep 25 setup of this tracker.

| Item | Value |
|---|---|
| Subscription | `c27a3bfa-07bb-42e3-b309-4372a9123682` |
| Resource group | `SWM-OWLPLAN-EASTUS2` |
| Web app | `app-owlplan` |
| Cosmos account | `cosmos-owlplan-swm` |
| Address | `https://app-owlplan.azurewebsites.net` |

Set them for this PowerShell window. Closing the window forgets them, so repeat this each time:

```powershell
az login
az account set --subscription "c27a3bfa-07bb-42e3-b309-4372a9123682"
$env:RESOURCE_GROUP = "SWM-OWLPLAN-EASTUS2"
$env:WEBAPP         = "app-owlplan"
$env:COSMOS_ACCOUNT = "cosmos-owlplan-swm"
```

`az login` opens a browser. If PowerShell says `az` is not found, install the Azure CLI from Microsoft's install page, open a new PowerShell window, and start again.

Confirm the names are right:

```powershell
az webapp show -g $env:RESOURCE_GROUP -n $env:WEBAPP --query name -o tsv
```

You should see `app-owlplan`. If the command returns an error, **ASK FRANK**.

Check you have deploy rights:

```powershell
az webapp show -g $env:RESOURCE_GROUP -n $env:WEBAPP --query "{state:state, publicNetworkAccess:publicNetworkAccess}" -o json
```

You should see `"state": "Running"`. If you get a permissions error, **ASK FRANK** for **Contributor** on that resource group.

`publicNetworkAccess: "Disabled"` means the site is locked down. Then you must be on the **VPN** to deploy. Remember that.

---

## Step 4. Sign-in and roles (Entra)

**Why:** this replaces Firebase Auth. The roles decide who can edit and who can run the monday sync.

The new release uses four roles: **Admin, Editor, Executive, Viewer**. The first version's startup log says sign-in was required, so a registration may already exist. The check in 4a shows what is there.

### 4a. Check which roles exist

```powershell
az ad app list --display-name "Savant Strategic Initiatives Tracker" --query "[0].appRoles[].value" -o tsv
```

You should see four lines: `Tracker.Admin`, `Tracker.Editor`, `Tracker.Executive`, `Tracker.Viewer`.

### 4b. If any are missing: ASK IDENTITY

Send them this (they need the Application Administrator role):

> Please run `infra/entra-app.sh` in Azure Cloud Shell (Bash) for the tracker. It adds the Admin and Executive roles and keeps the existing ones. It also creates a new client secret, so please put the expiry date it prints in a shared calendar.
>
> Before running it, set `RESOURCE_GROUP=SWM-OWLPLAN-EASTUS2` and `WEBAPP=app-owlplan`, and run `az account set --subscription c27a3bfa-07bb-42e3-b309-4372a9123682`. The script is in the repo under `infra`.

**Why the secret matters:** when it expires (two years), sign-in stops with an unhelpful error. Renewing is just running the same script again.

### 4c. Assign people to roles: ASK IDENTITY

In the Azure portal: **Microsoft Entra ID > Enterprise applications > Savant Strategic Initiatives Tracker > Users and groups > Add user/group**. Pick a group, then pick its role.

Suggested groups: `SG-Tracker-Admins`, `SG-Tracker-Editors`, `SG-Tracker-Executives`, `SG-Tracker-Viewers`.

**Put yourself in the Admins group before you deploy.** Without Admin you cannot run the monday sync. People already assigned Editor or Viewer keep working.

---

## Step 5. monday.com connection

**Why:** the app reads monday with an API token. Use a service account, not your own token, so the sync survives job changes.

### 5a. Create the service account

1. **ASK IT:** create a Microsoft account `svc-monday-tracker@savantwealth.com`. monday signs in with Microsoft.
2. **ASK the monday admin:** invite it as a **Member** and add it to the workspace **Savant Strategic Initiatives** (the workspace itself, not single boards).
3. Sign in once as that account in a private browser window. Click the profile picture, **Developers**, **API token**, show it, copy it.

Never paste the token into chat, email, or a file in the repo.

### 5b. Test the token

```powershell
$env:MONDAY_API_TOKEN = "<paste token>"
$env:MONDAY_WORKSPACE_ID = "17893919"
npm run monday:test
```

You should see `OK. Signed in as ...`. Then close the PowerShell window to clear the token.

### 5c. Store the token in Azure: ASK FRANK

This is like putting a Firebase secret in a secrets manager. Frank runs a script in Azure Cloud Shell (the `>_` icon in the Azure portal). It creates a **Key Vault** (the secrets safe), stores the token, and sets the app's settings.

Send Frank this:

> Please run `infra/monday-setup.sh` in Cloud Shell for the tracker. Chris will paste the monday token when it asks. Because our Azure names are custom, please set these first and check the real network names with `az network vnet list -g <resource group> -o json`:
>
> `RESOURCE_GROUP`, `WEBAPP`, `VNET`, `SUBNET_APP`, `SUBNET_PE`, `KEYVAULT` (a new vault name, 3 to 24 letters, digits and hyphens), and `MONDAY_WORKSPACE_ID=17893919`.
>
> Steps are in DEPLOYMENT-RUNBOOK.md, Step 6.4.

Afterwards, check it:

```powershell
az webapp config appsettings list -g $env:RESOURCE_GROUP -n $env:WEBAPP --query "[?starts_with(name,'MONDAY')].{name:name, value:value}" -o table
```

`MONDAY_API_TOKEN` should show a value starting `@Microsoft.KeyVault(`.

---

## Step 6. Deploy

**Why from your computer first:** the site is on a private network. A computer on the VPN can reach it. An ADO cloud build agent cannot. Start here, add ADO later (Step 8).

### 6a. Connect

1. Connect to the **VPN**.
2. PowerShell: run the `cd` line at the top, then Step 3's `az login` and the `$env:` lines.

### 6b. Make sure the code is clean and tagged

```powershell
git checkout main
git pull
git status --short
git tag -a release-2026-11-03 -m "monday sync and automatic pulls"
git push origin release-2026-11-03
```

`git status --short` should print nothing.

### 6c. Deploy

```powershell
.\infra\deploy.ps1
```

What it does, so nothing is a mystery: checks the code, runs the tests, builds the React app, installs production dependencies, zips everything, uploads it with `az webapp deploy`. Azure does not build anything. If a step fails, nothing is uploaded.

You should see `Upload accepted.` at the end.

### 6d. Watch it start

```powershell
az webapp log tail -g $env:RESOURCE_GROUP -n $env:WEBAPP
```

Look for `Site startup probe succeeded` (about 1 to 2 minutes). Press Ctrl+C to stop. `Container exited with exit code 1` means the app crashed on start: read the lines above it.

### 6e. Check the site

Open the app's address on the VPN: `https://app-owlplan.azurewebsites.net`.

1. Microsoft sign-in, then the tracker loads.
2. Your name and role show in the account menu.
3. Your existing data is there. A deploy never touches the database. Do **not** run `npm run seed`.
4. **Admin > Open sync > Test connection** shows connected.
   - If it says it cannot reach monday.com: **ASK FRANK** to run `./infra/monday-setup.sh --add-nat` (the app's outbound traffic goes through the private network, which may block the internet).
5. In the sync dialog: **monday.com (live)**, **Preview**, read it, **Apply**. Leave "Also remove records" unticked the first time.
6. Set **Automatic pulls** to **Every 5 minutes**, **Save**. The top bar then shows `monday data as of <time>`.

---

## Step 7. Every future update

1. Change code on a branch, open a pull request in ADO, get approval, complete it.
2. VPN on. PowerShell: `cd` line, `az login`, the three `$env:` lines.
3. `git checkout main`, `git pull`, then `.\infra\deploy.ps1`.
4. `az webapp log tail ...` until you see `Site startup probe succeeded`. Check the site.

Roll back: `git checkout release-<previous date>`, `.\infra\deploy.ps1`, `git checkout main`.

---

## Step 8. Later: deploy from ADO (optional)

This is the Netlify-style "push to main and it deploys". It needs extra setup, so do it after Step 6 works.

You need:

- **A service connection**: ADO's permission to act in Azure. The ADO admin creates it (Project settings > Service connections > Azure Resource Manager > Workload identity federation).
- **An approval gate**: an ADO Environment `tracker-prod` with approvers, so nothing deploys without a click.
- **A self-hosted build agent inside the private network**: ADO's cloud agents cannot reach a private site. **ASK FRANK** for a small VM in the Azure virtual network. If the site is not locked down, ADO's cloud agents work and you can skip this.
- **The pipeline file**: `azure-pipelines.yml` is in `DEPLOYMENT-RUNBOOK.md`, Step 13.4. It runs the same steps as `deploy.ps1`.

---

## Other things that are easy to forget

| What | Why | When |
|---|---|---|
| Put the client secret expiry date in a calendar | Sign-in stops when it expires | Right after Step 4b |
| Lock the site down (**ASK FRANK**: `infra/lockdown.sh`) | Removes the public internet route. Only after the VPN and DNS are confirmed | After the release works. Skip if already done |
| Check the site is locked down | Tells you whether you need the VPN | `az webapp show` in Step 3 |
| Never run `npm run seed -- --force` on production | It overwrites live data | Always |
| Never commit tokens or secrets | They live in Key Vault | Always |
| Keep the GitHub repo as an archive | Safety net until ADO is proven | Archive it later, do not delete |
| Back up with Admin > Open sync > Backups | A restore point before any removal | Automatic. Use it if a sync goes wrong |
| Database restore | Frank can restore the last 7 days from the Azure portal | Only for a real emergency |

---

## Who to ask for what

| Need | Ask |
|---|---|
| ADO project and repo | ADO admin |
| Contributor on the resource group | Frank |
| Add or change roles, assign people | Identity team |
| Key Vault, `monday-setup.sh`, NAT, lockdown, build agent | Frank |
| monday service account | IT, then the monday admin |
| VPN or DNS trouble | Network team |
