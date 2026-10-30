# User Guide

## Executive Summary

The Savant Strategic Initiatives Tracker is a simple, structured way to monitor strategic work across pillars, initiatives, and projects. It gives teams one place to review project health, owners, issues, decisions, progress, and stale items without juggling separate spreadsheets or disconnected updates.

In everyday use, the app helps business owners, delivery managers, and leadership teams quickly see what is on track, what needs attention, and what decisions are still waiting. It is built to be easy to use: choose a pillar, review the initiatives and projects under it, update status, and keep an audit trail of changes so everyone knows what changed and who changed it.

## 1. What the tracker is for

The tracker organizes work into three layers:

- Pillars: major strategy or portfolio areas
- Initiatives: programs or workstreams inside a pillar
- Projects: individual execution items that belong to an initiative

Each project can show:

- business owner
- execution owner
- project manager
- scope
- dates and milestones
- plan links
- key risks
- decisions needed and decision outcomes
- progress percentage
- RAG status
- issue log
- last updated timestamp and editor

This makes it useful both for delivery tracking and for leadership review.

## 2. How to open the app

### Local browser mode

From the project folder:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

### Local shared server mode

If you want a shared demo or local server behavior similar to Azure:

```bash
npm run start:local
```

This runs the Express API locally and stores data in a file on the machine rather than in the browser-only storage.

### Azure production mode

Once deployed, open the App Service URL. You will sign in with your Microsoft account and only see the data you are permitted to access.

### Install it as an app (optional)

The tracker can run in its own window, with a Start menu or dock shortcut, like a desktop app:

- **Edge or Chrome**: click the install icon at the right end of the address bar, or choose **Install app** in your avatar menu or under Settings → App.
- **iPhone or iPad (Safari)**: Share → **Add to Home Screen**.

It is still the same tracker with the same sign-in and data. Nothing is copied to your computer except a cache of the app itself. To remove it, uninstall it like any other app, or from the browser's Apps page.

**Updates are automatic.** Opening the app always loads the latest version. If you keep it open while a new version is published, a message appears at the bottom of the screen: **"A new version is available · Reload."** Reload when it suits you; anything you have already saved is kept. Settings → App shows the version you are running and has a **Check for updates** button.

**Sharing it with someone else.** An installed app cannot be copied or emailed. It is a shortcut to the tracker's web address. Send the link instead; they open it, sign in, and can install it themselves. For people without access to the Azure deployment, see SHARING-LOCALLY.md.

## 3. First-time use

When the app opens:

- In local mode you are asked for your name once. It is attached to every change you make and is kept in this browser.
- In Azure mode your Microsoft identity is used automatically.
- Viewers see a "View only" badge and can browse, search and filter, but not edit.
- A **LOCAL** badge in the top bar means you are on a development or demo copy, not the production tracker.

**Light or dark?** Use the sun/moon button in the top bar, or choose Light, Dark or Match system under your avatar menu or in Settings. The choice is remembered in this browser.

## 4. Main screen layout

- **Top bar**: the On track / At risk / Off track counts (click one to see those projects), the search box (press `/` to jump to it), the theme toggle, and your avatar menu (My work, Change log, Export backup, theme, Settings).
- **Left rail**: Portfolio, Board, Timeline, My work, Workload, Admin, Access (admins only), Settings. On a phone the rail moves to the bottom of the screen.
- **Filter chips**: On track, At risk, Off track, Stale and Decisions. They work the same way on Portfolio, Board and Timeline, and stay applied as you move between those three. Click **Clear** to reset.

Every page has its own link, so you can bookmark a pillar, a board layout or a project and send it to a colleague.

## 5. Portfolio: pillars and initiatives

Portfolio is the landing page. Pick a layout at the top right:

- **Ledger**: pillars on the left, the selected pillar's initiatives on the right. Click an initiative to expand its projects, then click a project to open it.
- **Heatmap**: every initiative as a tile, colored by its worst project. Click a tile to open that initiative in the ledger.
- **Leadership brief**: headline numbers, one card per pillar, and a "Needs leadership attention" list of off-track projects and projects waiting on a decision. The headline tiles double as filters.

When any filter is on, the ledger shows a flat list of every matching project across all pillars.

### Add, edit or delete a pillar (editors)

1. In the Pillars card, click **+** to add one.
2. To edit or delete the selected pillar, use the pencil or trash icons next to its title.

> Deleting a pillar also deletes the initiatives and projects below it. The change log cannot undo this.

### Add, edit or delete an initiative (editors)

1. Select the pillar and click **+ Initiative**.
2. Fill in the name, owners and start/end quarters.
3. To edit or delete it later, expand the initiative and use **Edit initiative** or **Delete** at the bottom.

## 6. Working with projects

### Create a project (editors)

1. In the ledger, expand the initiative.
2. Click **+ Add project**, enter the title and owners, and click Add.

### Read a project

Click any project, anywhere in the app, to open its page:

- the status, trend, phase, stale and "decision waiting" tags, plus a link to the detailed plan when one is set
- a **phase stepper** with progress
- scope, next milestone and key risk
- the **Decision** card: what was asked and what was decided
- **Issues**
- owners, schedule (including how many days the forecast has slipped) and recent changes

The breadcrumb at the top returns you to the pillar or initiative.

### Update a project (editors)

- **Quick changes on the page**: click a step in the phase stepper to move the phase, use **Record the decision** or **Request a decision**, and **Resolve** or add issues.
- **Everything else**: click **Update status**. The drawer has the status buttons, trend, phase, progress, next milestone, risk and decision fields, owners, schedule dates, scope and plan link. Changes save as you leave each field. **Delete project** is at the bottom.
- **On the Board**: drag a card to another column to change its phase (By phase) or status (By status).

If someone else changed the same field while you were editing, you are asked which value to keep. The other value can still be recovered from the change log.

## 7. Board and Timeline

- **Board** shows project cards in columns **By phase** or **By status**. Each card shows progress plus tags for status or phase, stale, decision and open issues. Filters narrow the columns in place.
- **Timeline** shows twelve months, grouped by pillar. A bar runs from the start date to the forecast end (or the original end when there is no forecast), a diamond marks the next milestone, and the vertical line is today. Use the arrows to move by a quarter, and **Today** to return. Projects with no dates are counted below the chart.

## 8. My work and Workload

**My work** lists the decisions, open issues and milestones on the projects you own as business owner, delivery owner or project manager. Use the Role switch to narrow it to one role.

- Click an item to open its details. Then you can record the decision, change an issue's severity or resolve it, or update the milestone, without leaving the page.
- **How the app knows who you are**: it matches your sign-in name (or local name) against the project owner fields. If it cannot find you, it asks you to pick your name once. If it picked the wrong person, click **Not you?**.

**Workload** shows everyone named in a project owner field, with their projects by status, by role, and their open issues. Sort by size, off-track count, open issues or name. Click a person to see their work. The page is titled with their name and has a **Back to my work** link, so it is always clear whose list you are looking at. You can also find a person from the search box.

## 9. Search and filters

Type in the search box at the top to jump straight to a project, an initiative or a person. Choose **Filter all views by "…"** (or press Enter on it) to apply the text as a filter chip instead.

- Search matches project titles, all three owner fields, scope and initiative names.
- **Stale** means not updated for longer than the stale threshold, which is set in Settings.
- **Decisions** means a decision has been requested but no outcome has been recorded yet.

## 10. Admin, exports and the change log

**Admin** is the PMO's upkeep page. It shows how many decisions are waiting and how many projects are stale, plus the monday.com sync status (with a **Pull from monday** button once the connection is set up). Below that are three lists:

- **Stale projects**, longest without an update first. Use **Stale for** to show only projects quiet for 30, 60 or 90+ days, and the PM picker to see one PM's projects or the ones with no PM.
- **Decisions needed**, the running list of decisions waiting on leadership, longest-waiting first.
- **Recent activity**, the latest edits.

**Export**: open your avatar menu and choose **Export** to download any spreadsheet report your role can use (status register, status by PM, needs attention, decision log, change log) or a full backup.

**Pillar one-pager**: on **Portfolio → Leadership brief**, click **Open one-pager**. If you've picked a pillar with the pillar filter, it opens just that pillar. Each page links back to its pillar in WiseTrack, and the link still works after you save it as a PDF.

**Change log**: open it from a project page (that project's history first, with an "Everything" switch), from your avatar menu, or from Admin or Settings. Each entry shows what changed, who changed it, when, and the old and new values. Editors can click **Restore previous** to undo a field edit.

## 11. Importing and exporting tracker data

The app allows full backup and restore via a JSON file. Both actions are in **Settings → Data**. Export is also in your avatar menu as **Export backup**.

### Export a file

1. Click **Export file**.
2. Save the generated JSON file to a safe location.

This is the best way to create:

- backups
- snapshots for handoff
- copies between machines
- restore points before bulk changes

### Import a file (editors)

1. Click **Import file**.
2. Choose a valid tracker export JSON file.
3. Confirm the warning prompt.
4. A backup is downloaded automatically before the import replaces current data.

> Importing a file replaces the current tracker state. Make sure you are intentionally replacing the data.

## 12. Storage and local behavior

The app supports multiple storage modes:

- browser IndexedDB by default
- memory for tests or broken browser storage situations
- REST-based backend when connected to a service
- Azure-managed Cosmos DB in production

Settings → Data shows which one you are on. In local mode you can also switch drivers there (**Change storage**) or reset to the bundled snapshot. Neither option appears in the Azure deployment.

If browser storage is blocked, the app degrades to memory mode and warns you that changes may be lost when the tab closes.

## 13. Roles and permissions

In Azure-backed deployments, access is controlled by app roles.

- Viewer: can read everything, cannot edit
- Editor: can create, update, and delete data

Settings → Access shows the role you are signed in with. If you cannot access the tracker, ask an administrator to add your account to the correct Entra group or app role.

## 14. Common tasks and quick workflows

### Weekly leadership review

1. Portfolio → **Leadership brief**.
2. Work through "Needs leadership attention" from the top.
3. Click **Decisions waiting** to filter, then open each project and record the outcome.

### Update my projects

1. **My work**.
2. Resolve finished issues and replace milestones you have hit.
3. Open any project that changed status and use **Update status**.

### Find stale work

1. Click the **Stale** chip on Portfolio or Board, or see "Stale projects" on the Admin page, where you can narrow by how long they have been quiet and by PM.
2. Open each project, refresh its status, or ping its owner.

### Fix a mistake

1. Open the project's **Change log**.
2. Find the change.
3. Click **Restore previous**.

### Prepare a backup

1. Settings → **Export file**.
2. Keep the JSON in a shared storage location or a controlled archive.


## 15. Troubleshooting

### “I cannot edit anything”

Your account is likely in Viewer mode. Request Editor access from the system administrator.

### “The app is running but data is missing”

Check whether you opened the app in a different storage context or whether a previous import replaced the data. Export any current data first before resetting.

### “A project shows as stale”

This is expected if no changes were made for longer than the configured stale threshold. Update the project or adjust the stale setting.

### “I accidentally replaced data during import”

Use the export file created before the import as the restore point. Re-import the backup file.

## 16. Best practices

- Export a backup before large import or bulk data replacement.
- Keep the stale threshold meaningful for your governance cycle.
- Use issue logs for blockers and unresolved actions.
- Keep project owners and decision fields current.
- Use the change log as the operational audit trail for the tracker.

## 17. Quick reference

### Local development

```bash
npm install
npm run dev
```

### Local shared server

```bash
npm run start:local
```

### Production-style checks

```bash
npm run build
npm test
```

## 18. Final note

The tracker is designed for strategic monitoring, project governance, and operational visibility. It is most effective when someone owns stewardship of the data and keeps it current, especially around stale items, decisions, and issue tracking.

For deployment and Azure configuration details, read [AZURE-DEPLOYMENT.md](AZURE-DEPLOYMENT.md). For architecture and system background, read [AZURE-OVERVIEW.md](AZURE-OVERVIEW.md).
