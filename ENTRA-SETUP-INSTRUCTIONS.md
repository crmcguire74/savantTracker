# Entra sign-in and roles setup: Savant Strategic Initiatives Tracker

For the person who administers Microsoft Entra ID, and for the Azure administrator who owns the web app. Every step says exactly where to click or what to type.

Do not start until Chris confirms the release date. Turning this on makes sign-in mandatory: anyone without a role is blocked.

## Read this first: a script does most of the work

`infra/entra-app.sh` does all of this in one run, in about 5 minutes: creates the app registration, defines the four roles, turns on "Assignment required", creates the client secret, and switches on sign-in for the web app. **If you can run it, use Way 1 and skip Way 2.** Do not click through the portal steps first.

The script does **not** create the groups or assign them to roles. Those are Part C, done by hand.

## Order of work (to keep the lockout short)

1. **Before the release window:** create the four groups and add the people (Part C, "Create four groups"). This changes nothing for current users.
2. **In the release window:** run the script (Way 1). Sign-in becomes mandatory the moment it finishes.
3. **Straight after, in the same window:** assign the groups to the roles (Part C, "Assign each group to its role"). Until this is done, everyone sees a "no role" page.
4. Chris deploys the new version.

Only the person who runs the script needs Application Administrator and Contributor on the web app. If no one has both, use Way 2 and do Part B last, after Part C, so sign-in goes on only once the assignments exist.

---

## What you are setting up

The tracker is a web app in Azure App Service. We want only Savant staff who are assigned a role to open it. Four things make that work:

1. An **app registration** in Entra. This is the tracker's identity. It is how the web app asks Microsoft to sign people in.
2. Four **app roles** on that registration: Admin, Editor, Executive, Viewer.
3. **Authentication** switched on in the web app, pointing at the registration. This blocks every request until the person signs in.
4. **Groups** assigned to the roles. Membership in a group decides access.

## Who needs which permission

| Permission | Needed for | Typical holder |
|---|---|---|
| Application Administrator or Cloud Application Administrator (Entra) | Parts A and C | Identity team |
| Contributor on the web app (Azure) | Part B | Azure administrator (Frank) |
| Group Administrator or User Administrator (Entra) | Part C groups | Identity team |

Two people may need to do this together. The script in Way 1 does Parts A and B in one run, so the person running it needs both permissions. Part C is manual in either way.

## The exact app this applies to

This is the existing production deployment of the tracker. Frank Payne set it up on Sep 25, 2026. These names are fixed. Use them exactly.

| Item | Value |
|---|---|
| Subscription | `c27a3bfa-07bb-42e3-b309-4372a9123682` |
| Resource group | `SWM-OWLPLAN-EASTUS2` |
| Web app (App Service) | `app-owlplan` |
| Web app address | `https://app-owlplan.azurewebsites.net` |
| Cosmos DB account | `cosmos-owlplan-swm` (database `tracker`, container `documents`) |
| Entra registration name | `Savant Strategic Initiatives Tracker` |
| Redirect address | `https://app-owlplan.azurewebsites.net/.auth/login/aad/callback` |
| Tenant ID | Entra admin center > Overview > Tenant ID |

## Check first: sign-in may already be partly set up

The first deployment may already have a registration and sign-in switched on. Run these two checks in Cloud Shell before changing anything, and send Chris the output:

```bash
az account set --subscription "c27a3bfa-07bb-42e3-b309-4372a9123682"
az webapp auth show -g SWM-OWLPLAN-EASTUS2 -n app-owlplan --query "{enabled:platform.enabled, required:globalValidation.requireAuthentication}" -o json
az ad app list --display-name "Savant Strategic Initiatives Tracker" --query "[].{name:displayName, appId:appId, roles:appRoles[].value, redirects:web.redirectUris}" -o json
```

| You see | What it means | What to do |
|---|---|---|
| `enabled` is false or null, and the app list is empty | No sign-in exists | Run the full setup below |
| A registration exists with a redirect address for `app-owlplan` | Sign-in exists from the first deployment | Run the same script. It keeps the registration, adds missing roles, and replaces the secret |
| A registration exists but its redirect address names a different web app | Another deployment owns it | Stop and tell Chris. Set a different `DISPLAY_NAME` before running |

---

---

## Way 1: run the script (fastest, about 5 minutes)

The repo has `infra/entra-app.sh`. It does Parts A and B and creates the secret. You still do Part C in the portal.

1. Go to https://portal.azure.com and sign in.
2. Click the `>_` icon in the top bar. If asked, choose **Bash**. If asked to create storage, choose yes.
3. Click **Manage files**, then **Upload**. Upload the `infra` folder as a zip named `infra.zip` (Chris sends it, or take it from the repo).
4. In the Cloud Shell window, type each line and press Enter after each:

```bash
unzip -o infra.zip
chmod +x infra/*.sh
az account set --subscription "c27a3bfa-07bb-42e3-b309-4372a9123682"
export RESOURCE_GROUP="SWM-OWLPLAN-EASTUS2"
export WEBAPP="app-owlplan"
./infra/entra-app.sh
```

5. Wait for the line `Sign-in is configured.`

**You should see:** a summary with the Application (client) ID, Tenant ID and a **Secret expires** date. Copy the summary into a ticket. Put the expiry date in a shared calendar with a reminder one month earlier. When the secret expires, sign-in stops and the error does not explain why.

**If it fails with "Insufficient privileges to complete the operation":** your account lacks the Application Administrator role. Use Way 2, or ask the right person to run it.

The script is safe to run again. If the registration exists, it keeps it and keeps existing role ids. Each run creates a new client secret and replaces the old one.

Then go to Part C.

---

## Way 2: do it by hand in the portals

Portal labels shift between releases, so a label may differ slightly. The values to enter do not change.

### Part A. Create the app registration (Entra admin center)

1. Go to https://entra.microsoft.com and sign in.
2. In the left menu, click **Entra ID**, then **App registrations**. (Older portals: **Identity > Applications > App registrations**.)
3. Click **New registration**.
4. Fill in:
   - **Name:** `Savant Strategic Initiatives Tracker`
   - **Supported account types:** choose **Accounts in this organizational directory only (Savant only - Single tenant)**
   - **Redirect URI:** in the first box choose **Web**. In the second box type `https://app-owlplan.azurewebsites.net/.auth/login/aad/callback`
5. Click **Register**.
6. On the page that opens, copy the **Application (client) ID** and the **Directory (tenant) ID**. Write them down. Chris needs the client ID.

**Turn on ID tokens**

7. In the left menu of the registration, click **Authentication**.
8. Under **Implicit grant and hybrid flows**, tick **ID tokens (used for implicit and hybrid flows)**.
9. Click **Save**.

**Create the four app roles**

10. In the left menu, click **App roles**, then **Create app role**.
11. Create the roles below, one at a time. For each, set **Allowed member types** to **Users/Groups**, tick **Do you want to enable this app role?**, and click **Apply**.

| Display name | Value | Description |
|---|---|---|
| Tracker Admin | `Tracker.Admin` | Can edit everything and decide which roles see which views and reports. |
| Tracker Editor | `Tracker.Editor` | Can view and edit every project, initiative and pillar in the tracker. |
| Tracker Executive | `Tracker.Executive` | Leadership. Can view the tracker and executive reports but cannot change anything. |
| Tracker Viewer | `Tracker.Viewer` | Can view the tracker but cannot change anything. |

The **Value** must match exactly, including capital letters and the dot. The app reads the Value.

**Create the client secret**

12. In the left menu, click **Certificates & secrets**, then **New client secret**.
13. **Description:** `Tracker web app sign-in`. **Expires:** choose the longest option (24 months).
14. Click **Add**.
15. **Copy the Value now.** Entra shows it only once. Paste it into a password manager or hand it to the Azure administrator in person. Do not email it or put it in chat.
16. Put the expiry date in a shared calendar with a reminder one month earlier.

**Require assignment**

17. Go to **Entra ID > Enterprise applications**. Search for `Savant Strategic Initiatives Tracker` and open it. (If it is missing, go back to the app registration, click **Overview**, and under **Managed application in local directory** click the link.)
18. In the left menu, click **Properties**.
19. Set **Assignment required?** to **Yes**.
20. Click **Save**.

This is what blocks anyone not assigned to a role.

### Part B. Turn on authentication in the web app (Azure portal)

Needs Contributor on the web app.

1. Go to https://portal.azure.com. In the search bar type the web app name and open it.
2. In the left menu, under **Settings**, click **Authentication**.
3. Click **Add identity provider**.
4. **Identity provider:** choose **Microsoft**.
5. **App registration type:** choose **Pick an existing app registration in this directory**.
6. **Name or app id:** type `Savant Strategic Initiatives Tracker` and pick it.
7. **Client secret:** paste the secret Value from Part A step 15. The portal stores it as an app setting.
8. **Issuer URL:** `https://login.microsoftonline.com/<tenant id>/v2.0`
9. **Allowed token audiences:** add two lines, `api://<client id>` and `<client id>`.
10. **Restrict access:** choose **Require authentication**.
11. **Unauthenticated requests:** choose **HTTP 302 Found redirect: recommended for websites**.
12. **Token store:** tick it.
13. Click **Add**.

**You should see:** the Authentication page lists Microsoft as an identity provider and shows "Require authentication".

Also check the web app setting named `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` exists: left menu **Settings > Environment variables > App settings**. The script uses that name. If the portal named the secret setting differently, leave it as the portal named it.

---

## Part C. Groups and role assignments (Entra admin center)

Do this after Way 1 or after Parts A and B.

### Create four groups

1. Go to https://entra.microsoft.com. Click **Entra ID > Groups > All groups > New group**.
2. Create each group:

| Group name | Members |
|---|---|
| `SG-Tracker-Admins` | Christopher McGuire, plus any other admins Chris names |
| `SG-Tracker-Editors` | People Chris lists |
| `SG-Tracker-Executives` | People Chris lists |
| `SG-Tracker-Viewers` | People Chris lists |

For each: **Group type:** Security. **Membership type:** Assigned. Add an owner (Chris). Add members. Click **Create**.

### Assign each group to its role

1. Go to **Entra ID > Enterprise applications**. Open `Savant Strategic Initiatives Tracker`.
2. In the left menu, click **Users and groups**.
3. Click **Add user/group**.
4. Under **Users and groups**, click **None Selected**. Search for `SG-Tracker-Admins`. Tick it. Click **Select**.
5. Under **Select a role**, click **None Selected**. Click **Tracker Admin**. Click **Select**.
6. Click **Assign**.
7. Repeat steps 3 to 6 for the other three groups:
   - `SG-Tracker-Editors` with **Tracker Editor**
   - `SG-Tracker-Executives` with **Tracker Executive**
   - `SG-Tracker-Viewers` with **Tracker Viewer**

**You should see:** four rows in Users and groups, each group next to its role.

Role assignment to a group can take a few minutes to reach a person's next sign-in. People may need to sign out and back in.

---

## Test it

1. Open a private browser window. Go to `https://app-owlplan.azurewebsites.net`. If the site is on a private network, connect to the VPN first.
2. You are sent to a Microsoft sign-in page. Sign in as Chris (an Admin).
3. The tracker opens. In the account menu (top right), Chris sees his name and the role Admin.
4. Test a person who is **not** in any group. They must see a Microsoft error such as `AADSTS50105: ... your administrator has configured the application to block users unless they are specifically granted access`. That error proves "Assignment required" works.
5. Test one Viewer. They see the tracker with a view-only banner and no Add buttons.

## If something goes wrong

| You see | Cause | Fix |
|---|---|---|
| `Insufficient privileges to complete the operation` | You lack Application Administrator | Ask someone who has it |
| `AADSTS50011: The redirect URI ... does not match` | Wrong redirect address | Entra > App registrations > the tracker > Authentication. The Web redirect URI must be exactly `https://app-owlplan.azurewebsites.net/.auth/login/aad/callback` |
| `AADSTS7000215: Invalid client secret` | Wrong or expired secret | Create a new secret (Part A steps 12 to 15), paste it in the web app: Authentication > Edit the Microsoft provider |
| `AADSTS50105` for someone who should have access | Not assigned | Part C |
| Signed in, but the tracker says "no role" | Assigned after their last sign-in, or no group membership | Sign out, sign in again. Check group membership |
| Sign-in loops | Redirect URI or issuer URL wrong | Recheck Part A step 4 and Part B step 8 |
| Everyone is view-only | People assigned the Viewer role, or assigned with no role | Check the Role column in Users and groups |

## Handing back to Chris

Send Chris:

- the Application (client) ID
- the secret's expiry date
- confirmation that Part C is done and which groups hold which people

Chris deploys the app after that. The web app then runs with sign-in required, and the tracker picks up roles on its own.
