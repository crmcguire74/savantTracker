# Deploy the Savant Strategic Initiatives Tracker to Azure

Step by step. Do the steps in order. Every step says:

- **WHO** does it
- **WHERE** you go
- **DO** exactly what to type or click
- **YOU SHOULD SEE** how to know it worked

Explanations are at the end, in the Appendix. You do not need them to follow the steps.

Last reviewed: 3 November 2026.

---

## Places you will work

Each step names one of these places.

| Place | What it is | How to get there |
|---|---|---|
| **PowerShell** | The command window on your laptop | Start menu, type `PowerShell`, press Enter. Then run the `cd` line below |
| **Azure portal** | Microsoft's Azure website | Go to https://portal.azure.com and sign in with your Savant account |
| **Cloud Shell** | A command window inside the Azure portal. Used by admins | In the Azure portal, click the `>_` icon in the top bar. Choose **Bash** |
| **ADO** | Azure DevOps, the website for your code | Go to https://dev.azure.com and pick the Savant organization |
| **monday.com** | The monday website | Your normal monday address |
| **The tracker site** | The deployed app | The address Frank gives you in Step 0 |

Every time you open PowerShell to work on the tracker, first run this line to move into the project folder:

```powershell
cd "C:\Users\christopher.mcguire\Documents\Code\savant-tracker-gitclone\savantTracker"
```

**YOU SHOULD SEE** the prompt end with `savantTracker>`.

---

## Step 0. Get what you need from other people

### 0.1 Send this message

**WHO:** you. **WHERE:** email or Teams.

Send to Frank (Azure administrator). Copy and paste:

> Frank, I am ready to deploy the Savant Strategic Initiatives Tracker to Azure. I need:
>
> 1. Does the Azure environment for this tracker already exist (resource group, App Service, Cosmos DB)? If not, can you create it with `infra/provision.sh`? The steps are in DEPLOYMENT-RUNBOOK.md, Step 3.
> 2. The three names once it exists: resource group, web app, Cosmos DB account.
> 3. Contributor on that resource group for me, so I can deploy.
> 4. The Cosmos DB data role for me (Step 3.6).
> 5. Please confirm the VPN and DNS reach the private network.
> 6. Can you or the identity team do the sign-in setup in Steps 4.1 to 4.3?
> 7. Can you create the Key Vault for the monday token (Step 6)?

Send to IT:

> Please create a Microsoft account for a service account: `svc-monday-tracker@savantwealth.com`. It will sign in to monday.com and run an automatic data sync. Please do not disable it. A mailbox is not needed unless monday must email it.

Send to the ADO administrator:

> Please create an Azure DevOps project for the Strategic Initiatives Tracker, with a Git repo named `savantTracker`, and add me as a Contributor.

### 0.2 Fill in your values

**WHO:** you. When people reply, write the answers here. You use them in later steps.

| Value | Your answer |
|---|---|
| Subscription | `c27a3bfa-07bb-42e3-b309-4372a9123682` |
| Resource group name | `SWM-OWLPLAN-EASTUS2` |
| Web app name | `app-owlplan` |
| Cosmos DB account name | `cosmos-owlplan-swm` (database `tracker`, container `documents`) |
| Site address | `https://app-owlplan.azurewebsites.net` |
| ADO repo address | `https://dev.azure.com/<org>/<project>/_git/savantTracker` |
| Key Vault name | (Frank creates it in Step 6.4) |
| monday workspace id | `17893919` |

---

## Step 1. Check the code is ready

**WHO:** Chris. **WHERE:** PowerShell (after the `cd` line above).

### 1.1 Run the tests and the build

```powershell
npm test
npm run build
git restore tsconfig.tsbuildinfo
git status --short
```

**YOU SHOULD SEE:** `npm test` ends with all tests passing. `npm run build` finishes with no errors. The last line prints nothing.

**IF NOT:** stop and send the output to Claude.

---

## Step 2. Move the code from GitHub to Azure DevOps

### 2.1 Decide how much history to move

**WHO:** Chris.

Three zip files in the repo root do not belong in a firm repo: `Lumiant.zip`, `finlife-lumiant-mainline-c63531b16874.zip` and `Lumiant-API-US-Reference-send.zip`. They are third-party material. Every commit so far also carries a personal Gmail address.

- **Option 1: clean start (recommended).** One new commit. No old history. Use this unless you need the history.
- **Option 2: keep history.** Every commit moves, including the zips and the Gmail address.

Pick one. The steps below show both.

### 2.2 Set your work identity

**WHERE:** PowerShell.

```powershell
git config user.name  "Christopher McGuire"
git config user.email "christopher.mcguire@savantwealth.com"
```

**YOU SHOULD SEE:** no output.

### 2.3 Remove the zip files from the repo

**WHERE:** PowerShell.

Option 1 (clean start):

```powershell
New-Item -ItemType Directory -Force ..\lumiant-files | Out-Null
Move-Item *.zip ..\lumiant-files\
Add-Content .gitignore "`n# keep third-party archives out of the repo`n/*.zip"
git checkout --orphan ado-main
git add -A
git commit -m "Initial import from GitHub (savantTracker) with cleanup"
```

Option 2 (keep history):

```powershell
git rm --cached Lumiant.zip finlife-lumiant-mainline-c63531b16874.zip Lumiant-API-US-Reference-send.zip
Add-Content .gitignore "`n/*.zip"
git add .gitignore
git commit -m "Remove third-party archives from the repo"
```

**YOU SHOULD SEE:** a line like `[ado-main (root-commit) abc1234] Initial import...` (option 1) or `[main abc1234] Remove third-party...` (option 2).

### 2.4 Copy the ADO repo address

**WHERE:** ADO. Open your project, click **Repos**, click **Clone**, copy the HTTPS address. Paste it into the table in Step 0.2.

### 2.5 Push the code to ADO

**WHERE:** PowerShell. Replace the address with yours.

Option 1:

```powershell
git remote add ado https://dev.azure.com/<org>/<project>/_git/savantTracker
git push ado ado-main:main
```

Option 2:

```powershell
git remote add ado https://dev.azure.com/<org>/<project>/_git/savantTracker
git push ado main
git push ado --tags
```

A Microsoft sign-in window opens the first time. Sign in with your Savant account.

**YOU SHOULD SEE:** a message ending `* [new branch] ... -> main`. In ADO, **Repos > Files** shows the project files, including `infra`, `server` and `src`.

### 2.6 Make ADO your main remote

**WHERE:** PowerShell.

```powershell
git remote rename origin github
git remote rename ado origin
git fetch origin
git checkout -B main origin/main
git branch -u origin/main main
git remote -v
```

**YOU SHOULD SEE:** `git remote -v` lists `origin` pointing at dev.azure.com and `github` pointing at github.com.

Keep the GitHub repo, set to private, as your archive. Do not delete it.

### 2.7 Protect the main branch

**WHO:** Chris, or the ADO administrator if you lack permission. **WHERE:** ADO.

1. Click **Project settings** (bottom left).
2. Click **Repositories**, then **savantTracker**.
3. Click the **Policies** tab, then under **Branch Policies** click **main**.
4. Turn on **Require a minimum number of reviewers**. Set it to 1.
5. Click **Save**.

From now on, change code on a branch and merge it with a pull request:

```powershell
git checkout -b feature/short-name
git add -A
git commit -m "What changed and why"
git push -u origin feature/short-name
```

Then in ADO: **Repos > Pull requests > New pull request**. Get one approval. Click **Complete**.

---

## Step 3. Build the Azure environment

**SKIP THIS STEP.** The environment already exists (app-owlplan in SWM-OWLPLAN-EASTUS2, built by Frank on Sep 25). Go to Step 3.6 only if Frank still needs to give you the Cosmos role, then Step 4. The rest of Step 3 is kept for a rebuild.

**WHO:** Frank, or any Azure administrator.

You need two kinds of Azure permission. They often sit with different people:

- **Contributor on the subscription**, to create resources
- **Application Administrator** in Entra ID, for Step 4

### 3.1 Prepare the infra folder

**WHO:** Chris. **WHERE:** PowerShell.

```powershell
tar -a -c -f infra.zip infra
```

**YOU SHOULD SEE:** a file `infra.zip` in the project folder. Send it to Frank. Do not commit it.

### 3.2 Open Cloud Shell and upload

**WHO:** Frank. **WHERE:** Azure portal.

1. Click the `>_` icon in the top bar. Choose **Bash**. If it asks to create storage, say yes.
2. Click **Manage files**, then **Upload**. Pick `infra.zip`.
3. Run:

```bash
unzip -o infra.zip
chmod +x infra/*.sh
az account show --output table
```

**YOU SHOULD SEE:** the table shows the right subscription. If it is wrong: `az account list --output table`, then `az account set --subscription "<name>"`.

### 3.3 Set the names

**WHO:** Frank. **WHERE:** Cloud Shell.

Open the script to set the names:

```bash
nano infra/provision.sh
```

Edit the lines near the top:

```bash
PREFIX="savant-tracker"            # naming. Change it to follow Savant's naming rule
LOCATION="eastus2"                 # the region Savant already uses
RESOURCE_GROUP="rg-savant-tracker"
APP_SERVICE_SKU="B1"
```

Save with Ctrl+O, Enter, then exit with Ctrl+X.

### 3.4 Create the resources

**WHO:** Frank. **WHERE:** Cloud Shell. Before this, ask the network team to read Step 5, so they are ready.

```bash
./infra/provision.sh
```

It takes about 10 minutes.

**YOU SHOULD SEE:** a summary at the end listing `RESOURCE_GROUP`, `WEBAPP` and `COSMOS_ACCOUNT`. Frank sends these to Chris. Write them in Step 0.2.

It is safe to run again if it stops partway.

### 3.5 What it made

A resource group (a folder for everything), a virtual network, a Cosmos DB database, an App Service running Node 22, a managed identity for the app, and two private endpoints. It leaves public access ON on purpose, so do not share the web address yet.

### 3.6 Give Chris the Cosmos data role

**WHO:** Frank. **WHERE:** Cloud Shell.

This role does not show in the portal's Access control page. It is data-plane access and CLI only.

```bash
export RESOURCE_GROUP="SWM-OWLPLAN-EASTUS2"
export COSMOS_ACCOUNT="cosmos-owlplan-swm"
CHRIS=$(az ad user show --id christopher.mcguire@savantwealth.com --query id -o tsv)
az cosmosdb sql role assignment create \
  --resource-group "$RESOURCE_GROUP" --account-name "$COSMOS_ACCOUNT" \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "$CHRIS" --scope "/"
```

**YOU SHOULD SEE:** a block of JSON describing the new assignment.

### 3.7 Give Chris Contributor on the resource group

**WHO:** Frank. **WHERE:** Azure portal.

1. Search **Resource groups**. Open yours.
2. Click **Access control (IAM)**, then **Add**, then **Add role assignment**.
3. Choose **Contributor**. Click **Next**.
4. Click **Select members**, pick Chris, click **Review + assign**.

---

## Step 4. Set up sign-in and roles

### 4.0 Check what already exists

**WHO:** identity administrator or Frank. **WHERE:** Cloud Shell.

The first deployment shows `sign-in: required (App Service authentication)` in its startup log, so sign-in may already be on. Check before changing anything:

```bash
az webapp auth show -g SWM-OWLPLAN-EASTUS2 -n app-owlplan --query "{enabled:platform.enabled, required:globalValidation.requireAuthentication}" -o json
az ad app list --display-name "Savant Strategic Initiatives Tracker" --query "[].{name:displayName, appId:appId, roles:appRoles[].value, redirects:web.redirectUris}" -o json
```

If a registration exists for this web app, Step 4.1 reuses it and adds the missing roles. If none exists, Step 4.1 creates it.

### 4.1 Create the sign-in registration

**WHO:** identity administrator (needs Application Administrator or Cloud Application Administrator). **WHERE:** Cloud Shell.

```bash
export RESOURCE_GROUP="SWM-OWLPLAN-EASTUS2"
export WEBAPP="app-owlplan"
./infra/entra-app.sh
```

**YOU SHOULD SEE:** a summary with a **Secret expires** date. Put that date in a shared calendar. When the secret expires, sign-in stops with an unhelpful error.

If it says "Insufficient privileges", the wrong person ran it. Give the script to the identity team.

Running it again later is safe. It keeps existing roles, adds new ones, and creates a new secret.

### 4.2 Check the four roles exist

**WHO:** identity administrator. **WHERE:** Cloud Shell.

```bash
az ad app list --display-name "Savant Strategic Initiatives Tracker" --query "[0].appRoles[].value" -o tsv
```

**YOU SHOULD SEE:** `Tracker.Admin`, `Tracker.Editor`, `Tracker.Executive`, `Tracker.Viewer`. If any is missing, run Step 4.1 again.

### 4.3 Create four groups

**WHO:** identity administrator. **WHERE:** Azure portal, then **Microsoft Entra ID > Groups > New group**.

Create four **Security** groups:

- `SG-Tracker-Admins`
- `SG-Tracker-Editors`
- `SG-Tracker-Executives`
- `SG-Tracker-Viewers`

Add people to them. Put Chris in `SG-Tracker-Admins`. Without Admin, Chris cannot run the monday sync.

### 4.4 Assign each group to a role

**WHO:** identity administrator. **WHERE:** Azure portal.

1. Click **Microsoft Entra ID**, then **Enterprise applications**.
2. Search **Savant Strategic Initiatives Tracker** and open it.
3. Click **Users and groups**, then **Add user/group**.
4. Click **None Selected** under Users and groups. Pick `SG-Tracker-Admins`. Click **Select**.
5. Click **None Selected** under Select a role. Pick **Tracker Admin**. Click **Select**.
6. Click **Assign**.
7. Repeat for each group with its matching role: Editors > Tracker Editor, Executives > Tracker Executive, Viewers > Tracker Viewer.

**YOU SHOULD SEE:** the Users and groups list shows four rows, each group beside its role.

Nobody can sign in until this is done, including you.

---

## Step 5. Network check before lockdown

**WHO:** Frank with the network team. **WHERE:** a call.

Lockdown (Step 9) closes the public route. Confirm first:

- the office network and VPN can route to the virtual network (`vnet-<prefix>`)
- computers resolve the private DNS zones, such as `privatelink.azurewebsites.net`

If either answer is no, fix it before Step 9, or everyone is locked out.

---

## Step 6. monday.com service account and token

### 6.1 Add the service account to monday

**WHO:** the monday account administrator. **WHERE:** monday.com.

1. Invite `svc-monday-tracker@savantwealth.com` as a **Member**. It does not need an admin seat.
2. Open the workspace **Savant Strategic Initiatives**. Add the account to the workspace itself, not to single boards.

### 6.2 Sign in once as the service account

**WHO:** Chris or the monday administrator. **WHERE:** a private browser window on monday.com.

1. Sign in as `svc-monday-tracker@savantwealth.com` with Microsoft sign-in.
2. Click the profile picture, then **Developers**, then **API token** (some versions say **My access tokens**).
3. Click **Show**, then **Copy**.

Do not regenerate the token. That breaks the old one. Do not paste it into email, chat or any file in the repo.

### 6.3 Test the token

**WHO:** Chris. **WHERE:** PowerShell.

```powershell
$env:MONDAY_API_TOKEN = "<paste the token>"
$env:MONDAY_WORKSPACE_ID = "17893919"
npm run monday:test
```

**YOU SHOULD SEE:** `OK. Signed in as <service account>, workspace "Savant Strategic Initiatives".`

| You see | Fix |
|---|---|
| `monday rejected the token` | Wrong token, or the account is not active. Redo 6.2 |
| `workspace ... is not visible` | The account is not in the workspace. Redo 6.1 |
| `Cannot reach monday.com` | Your network blocks it. Try another network |

When it works, close the PowerShell window. That clears the token from memory.

### 6.4 Store the token in Key Vault

**WHO:** Frank, with Chris on a call to paste the token. **WHERE:** Cloud Shell.

The script guesses network and vault names from the resource group name. Check the real network names first:

```bash
az network vnet list -g "SWM-OWLPLAN-EASTUS2" --query "[].{vnet:name, subnets:subnets[].name}" -o json
```

Then run, filling in the values:

```bash
export RESOURCE_GROUP="SWM-OWLPLAN-EASTUS2"
export WEBAPP="app-owlplan"
export VNET="<vnet name from above>"
export SUBNET_APP="<subnet the web app uses>"
export SUBNET_PE="<subnet for private endpoints>"
export KEYVAULT="<new vault name: 3 to 24 letters, digits and hyphens, unique in Azure>"
export MONDAY_WORKSPACE_ID=17893919
./infra/monday-setup.sh
```

When it asks `Paste the monday API token`, Chris pastes it. It stays hidden.

**YOU SHOULD SEE:** a summary listing the Key Vault, the secret `monday-api-token` and the app settings. Write the vault name in Step 0.2.

Check it:

```bash
az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$WEBAPP" --query "[?starts_with(name,'MONDAY')].{name:name, value:value}" -o table
```

**YOU SHOULD SEE:** `MONDAY_API_TOKEN` with a value starting `@Microsoft.KeyVault(`.

---

## Step 7. Deploy the app

**WHO:** Chris. This is the step you repeat for every release.

### 7.1 Connect to the VPN

**WHERE:** your VPN client. Connect. This matters most after lockdown, because the deploy address is then private.

### 7.2 Sign in to Azure

**WHERE:** PowerShell.

Check the Azure tool is installed:

```powershell
az --version
```

If PowerShell says the command is not found, install the Azure CLI from Microsoft's install page, open a new PowerShell window, and start again at the `cd` line.

Sign in and set the names from Step 0.2:

```powershell
az login
az account set --subscription "c27a3bfa-07bb-42e3-b309-4372a9123682"
$env:RESOURCE_GROUP = "SWM-OWLPLAN-EASTUS2"
$env:WEBAPP         = "app-owlplan"
```

**YOU SHOULD SEE:** `az login` opens a browser. After you sign in, PowerShell prints your subscription list. Closing the PowerShell window forgets the two `$env:` names, so run them again each session.

### 7.3 Start from clean, tested code

**WHERE:** PowerShell.

```powershell
git checkout main
git pull
git status --short
```

**YOU SHOULD SEE:** the last command prints nothing.

### 7.4 Tag the release

**WHERE:** PowerShell. Use today's date.

```powershell
git tag -a release-2026-11-03 -m "monday sync and automatic pulls"
git push origin release-2026-11-03
```

### 7.5 Deploy

**WHERE:** PowerShell.

```powershell
.\infra\deploy.ps1
```

**YOU SHOULD SEE**, in order: seven steps print `==> [1/7]` to `==> [7/7]`. It checks the folder is clean, installs, checks the server code, runs the tests, builds, packages and uploads. It ends with `Upload accepted.` If any step fails it stops before uploading anything.

### 7.6 Watch the app start

**WHERE:** PowerShell.

```powershell
az webapp log tail -g $env:RESOURCE_GROUP -n $env:WEBAPP
```

**YOU SHOULD SEE:** within about two minutes, a line with `Site startup probe succeeded`, then `Site started`. Press Ctrl+C to stop watching.

**IF YOU SEE** `Container exited with exit code 1`: the app crashed on start. Read the lines above it, then see Step 12.

### 7.7 Check the site

**WHERE:** your browser, on the VPN.

Open the site address from Step 0.2.

1. You go through the Microsoft sign-in and land on the tracker.
2. Your name and role show in the account menu, top right.
3. Make a small edit to a non-monday field, refresh, and confirm it stayed.
4. Open the site in a second browser as another person. An edit in one shows in the other within about 5 seconds.
5. Someone in the Viewers group sees a view-only banner and no Add buttons.

First deploy only: the database is empty. Load the starting data:

```powershell
$env:COSMOS_ENDPOINT = "https://cosmos-owlplan-swm.documents.azure.com:443/"
npm run seed
```

**YOU SHOULD SEE:** it prints what it loaded and confirms it. It refuses to overwrite existing data. Never add `--force` on production.

---

## Step 8. First monday sync

**WHO:** Chris, signed in as an Admin. **WHERE:** the tracker site.

1. Click **Admin** in the navigation.
2. On the **monday.com sync** card, click **Open sync**.
3. Click **Test connection**.

**YOU SHOULD SEE:** `Connected as <service account>. Workspace: Savant Strategic Initiatives.`

**IF** it says it cannot reach monday.com: Frank runs `./infra/monday-setup.sh --add-nat` in Cloud Shell, with the same `export` values as Step 6.4, then you try again.

4. Choose **monday.com (live)**. Click **Preview**. Read the counts. Do **not** tick "Also remove records monday.com does not have" this time.
5. Click **Apply**.
6. Set **Automatic pulls** to **Every 5 minutes**. Click **Save**.

**YOU SHOULD SEE:** the top bar shows `monday data as of <time>`.

---

## Step 9. Lock it down

**WHO:** Frank. **WHERE:** Cloud Shell. Only after Steps 7 and 8 work and Step 5 is confirmed.

```bash
export RESOURCE_GROUP="SWM-OWLPLAN-EASTUS2"
export WEBAPP="app-owlplan"
export COSMOS_ACCOUNT="cosmos-owlplan-swm"
./infra/lockdown.sh
```

Type `y` when it asks.

**YOU SHOULD SEE:** three steps complete: Cosmos public access off, Cosmos keys off, web app public access off.

Check: the site loads from a work computer on the VPN. It fails from a phone on cellular. The failure is the proof.

To undo: `./infra/lockdown.sh --undo`.

---

## Step 10. Every later release

**WHO:** Chris.

1. Merge your change to `main` with a pull request in ADO (Step 2.7).
2. Connect to the VPN.
3. In PowerShell: the `cd` line, then `az login`, then the two `$env:` lines from Step 7.2.
4. Run Steps 7.3 to 7.7. That is the whole release.

The app's data lives in the database and is not touched by a deploy.

## Step 11. Roll back

**WHO:** Chris. **WHERE:** PowerShell.

Code: deploy the previous tag.

```powershell
git checkout release-<previous date>
.\infra\deploy.ps1
git checkout main
```

Data:

- monday sync mistakes: **Admin > Open sync > Backups > Restore**. The app saves a backup before any removal.
- Anything else: Frank restores the database from its 7 day point-in-time backup (Azure portal > the Cosmos account > **Point In Time Restore**). It creates a new account, so it is a recovery tool.

---

## Step 12. When something breaks

| You see | Likely cause | Do this |
|---|---|---|
| `tsc: not found`, "Deployment Failed" | Azure tried to build | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` on the web app (the deploy script does it) |
| `Container exited with exit code 1 during startup` | A code error on start | Run `az webapp log tail`, read the error above the exit line. Run `node --check server\<file>.js` |
| `Site startup probe failed` | Same, or a slow start | A healthy start takes about 55 seconds. Otherwise as above |
| Page loads, says it cannot reach the database | The app has no Cosmos role, or network setup is wrong | Open `<site>/api/health`. A 503 confirms it. Ask Frank to check the role assignment (below) |
| App loads but is empty | The database is empty or has wrong keys | Run the seed (Step 7.7). Keys must be `tracker.state`, `tracker.log`, `tracker.settings` |
| Everyone sees "no role" | Roles not assigned | Step 4.4 |
| Everyone is view-only | Assigned the Viewer role | Check the Role column in Step 4.4 |
| `AADSTS50011` or sign-in loops | Redirect address mismatch | In Entra ID > App registrations > the tracker > Authentication, the address must be exactly `https://app-owlplan.azurewebsites.net/.auth/login/aad/callback` |
| Sign-in worked, then stopped months later | The client secret expired | Run Step 4.1 again |
| Admin screen: "Key Vault reference did not resolve" | The app lacks Key Vault Secrets User, or the vault's private DNS is not linked | Ask Frank to check |
| Admin screen: "Live, unreachable" | The app cannot reach api.monday.com | Frank runs `--add-nat` (Step 8), or monday is down. Use a capture file meanwhile |
| Cannot deploy after lockdown | You are not on the VPN | Connect and retry |
| Shell script: `syntax error near unexpected token` | Windows line endings | In PowerShell: `git add --renormalize .` |

Frank's check for the app's database role:

```bash
az webapp identity show -g "$RESOURCE_GROUP" -n "$WEBAPP" --query principalId -o tsv
az cosmosdb sql role assignment list -g "$RESOURCE_GROUP" -a "$COSMOS_ACCOUNT" -o table
```

The first command's value must appear in the second command's `PrincipalId` column.

Useful commands:

```powershell
az webapp log tail -g $env:RESOURCE_GROUP -n $env:WEBAPP
az webapp log download -g $env:RESOURCE_GROUP -n $env:WEBAPP --log-file logs.zip
az webapp show -g $env:RESOURCE_GROUP -n $env:WEBAPP --query state -o tsv
az webapp restart -g $env:RESOURCE_GROUP -n $env:WEBAPP
```

---

## Step 13. Optional: automate with an ADO pipeline

Do this only after you have deployed by hand from ADO once.

After lockdown, the deploy address is private. A Microsoft-hosted ADO agent cannot reach it. Frank must set up a **self-hosted agent**, a small VM inside the Azure virtual network, in an agent pool such as `Savant-VNet-Agents`. Until then, keep using `deploy.ps1`.

### 13.1 Create the service connection

**WHO:** ADO administrator with Owner or User Access Administrator on the resource group. **WHERE:** ADO.

1. **Project settings > Service connections > New service connection > Azure Resource Manager**.
2. Choose **Workload identity federation (automatic)**.
3. Scope level **Resource group**. Pick the tracker's resource group.
4. Name it `sc-savant-tracker-prod`. Do not grant access to all pipelines.

### 13.2 Create the variable group

**WHERE:** ADO. **Pipelines > Library > + Variable group**. Name `tracker-prod`. Add `RESOURCE_GROUP` and `WEBAPP` with your values. No secrets.

### 13.3 Create the approval gate

**WHERE:** ADO. **Pipelines > Environments > New environment**. Name `tracker-prod`. Open it. **Approvals and checks > Approvals**. Add Chris and one more person.

### 13.4 Add the pipeline

**WHERE:** PowerShell, then ADO.

Save this as `azure-pipelines.yml` in the repo root, then commit and push it through a pull request:

```yaml
trigger: none
pr:
  branches:
    include: [main]

variables:
  - group: tracker-prod

stages:
  - stage: Build
    jobs:
      - job: build
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '22.x'
          - script: npm ci
            displayName: Install
          - script: for f in $(find server -name '*.js'); do node --check "$f" || exit 1; done
            displayName: Check server syntax
          - script: npm test
            displayName: Test
          - script: npm run build
            displayName: Build
          - script: |
              set -e
              PKG=$(Build.ArtifactStagingDirectory)/pkg
              mkdir -p "$PKG"
              cp -r dist server package.json package-lock.json "$PKG/"
              cd "$PKG" && npm ci --omit=dev --no-audit --no-fund
            displayName: Assemble package
          - task: ArchiveFiles@2
            inputs:
              rootFolderOrFile: '$(Build.ArtifactStagingDirectory)/pkg'
              includeRootFolder: false
              archiveType: zip
              archiveFile: '$(Build.ArtifactStagingDirectory)/deploy.zip'
          - publish: $(Build.ArtifactStagingDirectory)/deploy.zip
            artifact: deploy

  - stage: Deploy
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: production
        environment: tracker-prod
        pool:
          name: Savant-VNet-Agents
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: deploy
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: sc-savant-tracker-prod
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      az webapp config appsettings set -g $(RESOURCE_GROUP) -n $(WEBAPP) \
                        --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false --output none
                      az webapp deploy -g $(RESOURCE_GROUP) -n $(WEBAPP) \
                        --src-path $(Pipeline.Workspace)/deploy/deploy.zip --type zip --async true
```

Then in ADO: **Pipelines > New pipeline > Azure Repos Git > savantTracker > Existing Azure Pipelines YAML file** and pick `azure-pipelines.yml`.

This YAML has not been run against your ADO organization. Expect small fixes the first time, such as the agent pool name. Try the Build stage alone first, with the Deploy stage commented out.

Last, add the pipeline as **Build validation** on the `main` branch policy (Step 2.7), so every pull request runs the tests.

---

# Appendix: what it all is

You do not need this to follow the steps.

## Who does what

| Role | Who | Only they can |
|---|---|---|
| Developer | Chris | Change code, test, deploy, run the first sync |
| Azure administrator | Frank | Create or change Azure resources, assign Azure roles, create the Key Vault, lock the network |
| Identity administrator | Entra ID team | Create the sign-in registration, define roles, assign people to roles |
| ADO administrator | Whoever runs Azure DevOps | Create the project, grant access, create service connections |
| monday administrator | monday admin plus IT | Create the service account, add it to the workspace |
| Network team | IT networking | Confirm the VPN and DNS reach the private network |

## How access works

1. A person opens the site. Azure's built-in sign-in ("Easy Auth") requires a Microsoft sign-in first.
2. Entra ID checks whether the person has an app role on the registration. No role, no entry.
3. The role goes to the app, which decides what the person can do.

| Role | Can do |
|---|---|
| Tracker.Admin | Everything, including the monday sync and access settings |
| Tracker.Editor | View and edit all projects, initiatives and pillars. Sees the Admin page, cannot run the sync |
| Tracker.Executive | View the tracker and executive reports, cannot change anything |
| Tracker.Viewer | View only |

The roles come from `infra/app-roles.json`.

## Security checklist

| Control | Set by | Expected |
|---|---|---|
| Sign-in required for every request | `entra-app.sh` | On |
| `REQUIRE_AUTH=true`, `NODE_ENV=production` | `provision.sh` | The server refuses to start with auth off in production |
| HTTPS only, TLS 1.2 minimum | `provision.sh` | On |
| No database passwords | Managed identity, keys disabled by `lockdown.sh` | Keys disabled |
| No public route | `lockdown.sh` | Public access disabled |
| monday token in Key Vault | `monday-setup.sh` | App setting shows `@Microsoft.KeyVault(...)` |
| Client secret expiry on a calendar | `entra-app.sh` output | Calendar entry exists |
| `main` branch protected | ADO branch policy | Review required |

Never commit the monday token. `.env.production` holds only `VITE_STORAGE_DRIVER=rest` and `VITE_API_BASE_URL=/api`.

## Checks you can run on Azure

Anyone with Reader on the resource group can run these. Fill in the names.

```powershell
az webapp auth show -g $env:RESOURCE_GROUP -n $env:WEBAPP --query "{enabled:platform.enabled, required:globalValidation.requireAuthentication}" -o json
az webapp config appsettings list -g $env:RESOURCE_GROUP -n $env:WEBAPP --query "[].{name:name, value:value}" -o table
az webapp show -g $env:RESOURCE_GROUP -n $env:WEBAPP --query "{state:state, httpsOnly:httpsOnly, publicNetworkAccess:publicNetworkAccess}" -o json
az cosmosdb show -g $env:RESOURCE_GROUP -n cosmos-owlplan-swm --query "{publicNetworkAccess:publicNetworkAccess, keysDisabled:disableLocalAuth}" -o json
```

## What was learned from Frank's Sep 25 deployment

That chat is the first deployment of this same tracker. The method and the names both apply.

**What worked**

- Build on the laptop, zip `dist`, `server`, `node_modules`, `package.json` and `package-lock.json` with `tar -a -c -f deploy.zip`, upload with `az webapp deploy --type zip --async true`, then watch `az webapp log tail`. `deploy.ps1` repeats this.
- Giving the web app's managed identity the Cosmos DB data role (id `00000000-0000-0000-0000-000000000002`).
- `node --check` on server files, which caught the crash below.

**What failed, and the fix**

| What failed | Cause | Fix |
|---|---|---|
| `tsc: not found`, deployment failed | Azure ran the build without dev dependencies | Build locally, ship `node_modules`, set `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. Done in `provision.sh`, `deploy.sh`, `deploy.ps1` |
| `exit code 1 during startup` | A syntax error in `server/cosmos.js` after a hand edit | Syntax-check and test before every deploy. `deploy.ps1` does both |
| No data after seeding | Seed wrote `tracker/state`, the app reads `tracker.state` | Fixed in the seed script, already in the repo |
| Live updates froze | Compression buffered the event stream | `/api/stream` excluded from compression, already in `server/app.js` |
| Expired sign-in broke the page | The app read Microsoft's login page as JSON | The app reloads on an HTML reply, already in `src/storage/rest.ts` |
| Fixes lived in one folder, not in git | Two copies of the project | One source of truth: the git repo. Deploy only from a clean `main` or a tag |
| `--async true` looked like success | It only means the upload was accepted | Always watch the log tail |

## Terms

| Term | Meaning |
|---|---|
| Subscription | The billing container for Azure resources |
| Resource group | A folder that holds related resources. Deleting it deletes everything inside |
| App Service | The managed web server that runs the tracker |
| Cosmos DB | The database. The tracker stores a few JSON documents there |
| Managed identity | A built-in account for the web app, so it needs no password |
| Entra ID | Microsoft's sign-in and directory service (formerly Azure AD) |
| App registration | The sign-in definition for the tracker in Entra, with its roles |
| Enterprise application | The place in Entra where you assign people to roles |
| Easy Auth | App Service's built-in sign-in check in front of the app |
| Key Vault | A safe for secrets such as the monday token |
| Private endpoint | A private network address for a service, so it needs no public route |
| Virtual network | The private network the app and database sit in |
| Kudu or SCM site | The management site behind every web app. It accepts deployments |
| Service connection | The permission an ADO pipeline uses to act in Azure |
| Self-hosted agent | A machine you run that executes pipeline jobs inside your network |
| Point-in-time restore | The database backup you can wind back up to 7 days |
