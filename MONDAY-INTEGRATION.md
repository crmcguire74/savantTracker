# monday.com integration

monday.com is the source of truth for project fields. The tracker pulls them in. Nothing flows back to monday.

This page has four parts:

1. Configure monday.com
2. Configure roles and sign-in in Azure
3. Push the release to Azure
4. Run the first sync

Before those, there is a section on trying everything with no accounts at all.

---

## What syncs

| monday.com | Tracker |
|---|---|
| Top-level folder | Pillar |
| Sub-folder | Initiative |
| Board with the project columns, group "Projects" | Project register |
| One row | One project |

monday owns these 17 fields on every linked project: Business Owner, Delivery Owner, Project Manager, Scope, RAG Status, Trend, Phase, Validation, Project Progress, Start Date, Original End Date, Forecast End Date, Key Risk / Blocker, Dependencies, Decision Needed, Next Milestone, Next Milestone Date.

The tracker keeps these: issues, decision outcome, plan link.

Rules the sync follows:

- A blank value in monday never erases a value in the tracker.
- Running it twice changes nothing the second time.
- Rows named "Rename" or "test" are ignored. Change this with `MONDAY_IGNORE_TITLES`.
- Boards are matched by column title, not column id. Renaming a monday column stops that field syncing. The sync warns you.
- Every change shows in the change log under "monday sync".

---

## Where it runs and what it needs

One build does all of this. Nothing is rebuilt to switch.

| Where | monday data | Sign-in | Roles |
|---|---|---|---|
| Browser only (`npm run dev`, Netlify) | Capture file or the bundled sample, replayed in the browser | Test sign-in | Pick one at sign-in |
| Local server (`npm run start:local`) | Same, or live if you set a token | Test sign-in | Pick one at sign-in |
| Azure | Live with the service account, or an uploaded capture | Microsoft Entra | Assigned in Entra |

The app asks the server at start-up whether real sign-in stands behind it. If yes, it uses Entra roles. If not, it shows the test sign-in. To force one, set `VITE_AUTH_MODE=local` or `VITE_AUTH_MODE=entra` at build time.

An Entra user with no role sees a "no role" page, not a broken app.

### Roles

| Role | Can do |
|---|---|
| Admin | Everything. Runs the monday sync. Sets who sees which views. |
| Editor | Edits the tracker. Cannot run the sync. |
| Executive | Reads everything. |
| Viewer | Reads the portfolio. |

### Field lock

When the server pulls live from monday, the 17 synced fields on linked projects are read-only in the tracker. An edit shows "comes from monday.com". Change it in monday and the next sync brings it in.

With no token (test mode) nothing is locked, so testers can still edit. A later capture upload overwrites those edits.

---

## Try it now, no accounts needed

### In the browser

1. `npm run dev`
2. Sign in as `savant` / `sw2026`, test as **Admin**.
3. Open **Admin**, then **Open sync** on the monday.com card.
4. Choose **The sample data bundled with this build**. Press **Preview**. Read the counts. Press **Apply**.

The sample is a copy of the live workspace taken on 2 November 2026. It includes the placeholder rows, so you can see them ignored.

To test removal of stale records, tick **Also remove records monday.com does not have**, Preview, read the list, tick the box under it, Apply. A backup file downloads first. To undo, use **Import data** in Settings with that file.

### With a local server

1. `npm run build`
2. `npm run start:local`
3. Same steps as above. Backups are stored in the data file and listed under **Backups** in the sync dialog.

### From the command line

```powershell
npm run sync:monday -- --file=src/data/monday-capture.sample.json
npm run sync:monday -- --file=src/data/monday-capture.sample.json --apply
```

This needs the local server's data file, so run `npm run start:local` once first.

### With real data, before the service account exists

Anyone with a monday login can make a capture:

```powershell
$env:MONDAY_API_TOKEN = "<your personal token>"
$env:MONDAY_WORKSPACE_ID = "17893919"
npm run monday:capture
```

That writes `monday-capture.json`. It is ignored by git. It holds real project data, so keep it internal. Upload it in the sync dialog with **A capture file**. It works in any build, including Netlify.

---

## Part 1. Configure monday.com

Use a service account. A personal token stops working when its owner changes jobs or loses access.

monday signs in with Microsoft Entra, so the account needs a Microsoft identity.

1. **Ask IT for a Microsoft account** for the sync, for example `svc-monday-tracker@savantwealth.com`. It needs a mailbox only if monday must send it an invitation.
2. **Add it to monday** as a **Member**. An admin seat is not needed.
3. **Give it the workspace.** Add the account to the workspace "Savant Strategic Initiatives" (id 17893919). Add it to the workspace itself, not to single boards. The sync reads the workspace's folder tree and every project board in it.
4. **Sign in once as that account** so it is active.
5. **Copy its API token.** Click the profile picture, open **Developers**, open **API token**, show it, copy it. Regenerating the token breaks the old one.
6. **Store the token** in Part 3. Do not email it or put it in a repo.

Check it before going further. From your laptop:

```powershell
$env:MONDAY_API_TOKEN = "<service account token>"
$env:MONDAY_WORKSPACE_ID = "17893919"
npm run monday:test
```

Expected: `OK. Signed in as <service account>, workspace "Savant Strategic Initiatives".`

| You see | Fix |
|---|---|
| `monday rejected the token` | Wrong token, or the account is inactive. |
| `workspace ... is not visible` | Add the account to the workspace. |
| `Cannot reach monday.com` | Your network blocks it. Try another network. |

Things to know:

- If IT deactivates the service account, the sync stops. Tell IT it is in use.
- If your monday account restricts API access by IP, add the Azure outbound IP (see Part 3, NAT gateway).
- monday has API rate limits. The sync reads about 35 boards and retries on a limit.

---

## Part 2. Configure roles and sign-in in Azure

This is in `AZURE-DEPLOYMENT.md` in more detail. The short form:

1. **Create the app registration and turn on sign-in.** Someone with Application Administrator runs:
   ```bash
   export RESOURCE_GROUP=rg-savant-tracker
   export WEBAPP=app-savant-tracker-ab12cd
   ./infra/entra-app.sh
   ```
   This defines four app roles (Tracker.Admin, Tracker.Editor, Tracker.Executive, Tracker.Viewer) from `infra/app-roles.json`.
2. **Assign roles.** Azure portal, Microsoft Entra ID, Enterprise applications, Savant Strategic Initiatives Tracker, Users and groups, Add user/group. Pick a group, pick a role.
   - Make two groups: one for admins, one for editors. Add more for Executive and Viewer.
   - Put yourself in the Admin group. Without Admin you cannot run the sync.
3. **Check it.** Open the site. You should go straight in, with no username and password screen. Your name and role show in the account menu. A person with no role sees the "no role" page.

No build change is needed. The app detects Entra on its own.

If you assign nobody a role, nobody gets in. Assign yourself before you release.

---

## Part 3. Push the release to Azure

### Before you start

- `npm test` passes on your machine.
- `npm run build` finishes with no errors.
- You have the service account token (Part 1) and Azure admin rights, or the Azure admin has them.

### New deployment

Follow `AZURE-DEPLOYMENT.md` and add the monday step. In order:

| Step | Command | Who |
|---|---|---|
| 1 | `./infra/provision.sh` | Azure admin |
| 2 | `./infra/entra-app.sh` and assign roles (Part 2) | Identity admin |
| 3 | `./infra/monday-setup.sh` | Azure admin |
| 4 | `./infra/deploy.sh` | You |
| 5 | `npm run seed` | You |
| 6 | Sign in, run the first sync (Part 4) | You |
| 7 | `./infra/lockdown.sh` | Azure admin |

Run step 3 before step 7. After lockdown, Cloud Shell can no longer reach the vault. Use `--rotate-token` later.

### Existing deployment

1. Run `./infra/monday-setup.sh` once.
2. Run `./infra/deploy.sh` from a machine on the VPN.
3. Sign in and run Part 4.

### What `monday-setup.sh` does

- Creates a Key Vault (RBAC mode) and stores the token as the secret `monday-api-token`.
- Gives the web app's managed identity read access to that secret and nothing else.
- Adds a private endpoint and private DNS for the vault, like Cosmos and the web app.
- Sets these app settings:

| Setting | Value |
|---|---|
| `MONDAY_API_TOKEN` | A Key Vault reference to the secret |
| `MONDAY_WORKSPACE_ID` | `17893919` |
| `MONDAY_SYNC_INTERVAL_MINUTES` | `0` (timer off) until an admin turns it on in the app |

- Turns off the vault's public access and restarts the app.

If your firm does not allow Key Vault for this, run `MODE=appsetting ./infra/monday-setup.sh`. The token then sits in the app's configuration.

### Outbound access to monday.com

`provision.sh` sends all outbound traffic through the virtual network. The app must reach `https://api.monday.com` from there. Many tenants block that for new subnets.

If **Test connection** says it cannot reach monday.com, run:

```bash
./infra/monday-setup.sh --add-nat
```

This adds a NAT gateway with a fixed public IP and prints the IP. Allow that IP in monday if your account restricts API access by IP.

### Rolling back

Redeploy the previous zip. The sync adds only data, and every retire run saves a backup first. To undo data, restore a backup (Part 4).

---

## Part 4. Run the first sync

Do this as an Admin.

1. Open **Admin**. The monday.com card shows **Live** when the token works, **Test mode** when it does not.
2. Press **Open sync**.
3. Press **Test connection**. You should see the service account name and the workspace name.
4. Source: **monday.com (live)**. Press **Preview**.
5. Read the counts and warnings. A first sync on seeded data should show mostly "updated" or "unchanged". Warnings list anything skipped, such as a board with a renamed column.
6. Press **Apply**.
7. Open the change log and check the "monday sync" lines.

### Remove stale records, once

Records the tracker has that monday does not are left over from before the PMO restructure. To remove them:

1. Tick **Also remove records monday.com does not have**.
2. Press **Preview**.
3. Read **To remove**. Every project, initiative and pillar is listed.
4. Tick the box under the list. The approval code is tied to that exact list. If the list changes, the code stops matching and nothing is removed.
5. Press **Apply**. A full backup is saved first.

Issues, plan links and decision outcomes on a removed project move to a project with the same title, if there is one.

Do this once, then leave it off. Projects you add in the tracker have no monday link. The next retire run removes them. Add projects in monday.

### Restore a backup

In the sync dialog open **Backups**, press **Restore**, read the counts, confirm. The current data is saved as its own backup first, so a restore can be undone too.

### Keep everyone current (automatic pulls)

monday has no push channel the app can listen to without a public web address, so the app asks monday on a timer instead. Everyone sees the same data, and the top bar shows **monday data as of 2:35 PM** to every user.

After one good manual sync, an admin opens the sync dialog, picks **Automatic pulls** (5 minutes to once a day) and presses Save. It applies to everyone and takes effect within a minute. No restart and no Azure setting needed.

How a scheduled check works:

- Every minute the server checks whether the interval has passed since the last run.
- It asks monday for the folder layout and each board's last-changed time. That is one small request per 25 boards.
- If nothing changed since the last pull, it stops there and only moves the "as of" time. If anything changed, it reads the boards and merges. Only changed values are written, and an unchanged project is never touched.
- It does a full read at least once an hour even when nothing looks different, as a safety net.
- It never removes records. Removal always needs a person and an approval code.
- A failed run shows in the top bar for everyone ("monday sync failed") and the reason shows on the Admin card.

`MONDAY_SYNC_INTERVAL_MINUTES` still works as the starting value. Once an admin saves a choice in the app, the app setting wins. If you scale to more than one instance, each pulls. That is safe but wasteful, so keep one instance.

### Replace the token

```bash
./infra/monday-setup.sh --rotate-token
```

---

## When something breaks

| You see | Cause | Fix |
|---|---|---|
| Card says **Test mode** in Azure | No token, or the vault reference did not resolve | Portal, web app, Environment variables, check the status next to `MONDAY_API_TOKEN`. The app identity needs **Key Vault Secrets User**. |
| Card says **Live, unreachable** | The token is set but monday.com did not answer the last check | Pulling is switched off in the dialog. Use a capture file until it is back. The check repeats at most once a minute. |
| `monday rejected the token` | Token wrong or account inactive | `--rotate-token`. Ask IT if the account is active. |
| `workspace ... is not visible` | Service account is not in the workspace | Add it in monday. |
| `Cannot reach monday.com` | Outbound blocked | `./infra/monday-setup.sh --add-nat` |
| `Retiring needs approval` | You skipped Preview or the list changed | Preview again, review, apply. |
| `The tracker changed while syncing` | Someone saved at the same moment | Run it again. |
| 403 on the sync | You are not an Admin | Ask for the Tracker.Admin role. |
| A field stops updating | The monday column was renamed | Rename it back. The preview warns "no column for ...". |
| Projects show green RAG | The monday RAG is unset | Set it in monday. A blank value is not copied. |
| Edit refused: "comes from monday.com" | The field lock | Edit it in monday. |

---

## Reference

### Settings

| Setting | Default | Meaning |
|---|---|---|
| `MONDAY_API_TOKEN` | none | Service account token. Turns on live mode. |
| `MONDAY_WORKSPACE_ID` | none | Workspace to read. Required for live mode. |
| `MONDAY_SYNC_INTERVAL_MINUTES` | `0` | Starting value for the timer. An admin can change it in the app, and that wins. `0` is off. Minimum `5`. |
| `MONDAY_PROJECT_GROUP` | `Projects` | Group name that holds project rows. |
| `MONDAY_IGNORE_TITLES` | `Rename,test` | Row names to skip. Comma separated. |
| `MONDAY_PILLAR_MAP` | none | JSON map from a monday pillar folder name to a tracker pillar id. |
| `MONDAY_API_VERSION` | `2026-04` | monday API version. |

### API

All admin only. A dry run unless `apply` is `true`.

| Route | Does |
|---|---|
| `GET /api/admin/sync/status` | Mode and last applied run |
| `POST /api/admin/sync/test` | Token and workspace check |
| `POST /api/admin/sync/monday` | Live pull |
| `POST /api/admin/sync/upload` | Replay a capture file |
| `POST /api/admin/sync/schedule` | Set the pull interval: `{ "intervalMinutes": 0 }` or 5 to 1440 |
| `POST /api/admin/sync/capture` | Raw capture of live monday |
| `GET /api/admin/sync/backups` | Saved backups |
| `POST /api/admin/sync/restore` | Restore a backup |

### Files

| File | Purpose |
|---|---|
| `server/monday/` | The sync. Plain JavaScript, shared with the browser. |
| `server/monday/service.js` | One object the API, timer and command line use. |
| `server/monday/cli.js` | `npm run sync:monday` |
| `src/data/mondaySync.ts` | Browser side: replay in the browser, or call the server. |
| `src/data/monday-capture.sample.json` | The bundled sample. |
| `src/modules/admin/MondaySync.tsx` | The Admin card and dialog. |
| `infra/monday-setup.sh` | Key Vault, token, app settings. |
