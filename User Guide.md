# User Guide

How to use the Savant Strategic Initiatives Tracker (WiseTrack). Written for the people who use it every week, not for developers. Developers and administrators: see the [README](README.md).

You can also read most of this inside the tracker. Open **Help** in the left menu for workflows by role, frequently asked questions and a glossary.

---

## 1. What the tracker is for

The tracker is one place to see how the firm's strategic work is going. It shows what is on track, what needs attention, who owns what, and which decisions are waiting.

Work is organized in three layers:

| Layer | What it is | Example use |
| --- | --- | --- |
| **Pillar** | A major strategic theme | "Pillar 1: Client Experience" |
| **Initiative** | A program or workstream inside a pillar | A multi-quarter effort |
| **Project** | One delivery effort inside an initiative. This is what gets updated | A single deliverable with an owner and dates |

Each project shows its status, trend, phase, progress, owners, dates, next milestone, key risk, decision and issues.

**Where the data comes from.** The firm's project boards in monday.com feed the tracker. Project managers keep updating monday.com, and the tracker follows. The tracker adds the things monday.com does not hold: issues, decision outcomes and plan links. See [section 8](#8-the-tracker-and-mondaycom).

## 2. Signing in and finding your way

Open the tracker address your administrator gave you. Sign in with your normal Savant (Microsoft) account, the same way you sign in to Outlook or Teams. There is no separate password.

If you see a **no role** page, you have not been added to a tracker group yet. Ask the person who manages tracker access, then sign out and sign back in.

### The screen

- **Left menu.** Portfolio, Board, Timeline, My work, Workload, Admin, Access, Settings and Help. You see only the pages your role may open. On a phone the menu moves to the bottom.
- **Top bar.**
  - **monday data as of ...** shows when the tracker last pulled from monday.com. It turns amber when the data is more than a day old or the last pull failed. It hides on narrow windows.
  - **Three colored numbers** count your projects by status. A green dot is On track, amber is At risk, red is Off track. Click one to show only those projects. On a narrow window the words hide and the colored dot and number remain.
  - **Search** (press `/` anywhere).
  - **Theme button** (light or dark) and your **account menu** (My work, change log, export, theme, sign out).
- **Badges.** **View only** means your role cannot edit. **LOCAL** means you are on a test copy, not the real tracker.
- **Filter chips.** On track, At risk, Off track, Stale and Decisions. They work on Portfolio, Board and Timeline and stay applied as you move between them. Click **Clear** to reset.

Every page has its own link. Bookmark a pillar, a board layout or a project and send it to a colleague.

## 3. Which role am I?

Your role decides what you see and what you can change. Roles come from Microsoft security groups, so a change in group changes your role at your next sign-in.

| Role | Who | Can do |
| --- | --- | --- |
| **Viewer** | Anyone who needs to stay informed | Read Portfolio, Board and Timeline. Open projects. Search, filter and export the reports the role is allowed. |
| **Executive** | Leadership | Everything a Viewer does, plus the Leadership brief, Pillar pace and Workload. Cannot edit. |
| **Editor** | Project managers and the PMO | Everything an Executive does, plus My work and Admin. Updates projects, decisions and issues. |
| **Admin** | Tracker administrators | Everything an Editor does, plus Access, the monday.com sync, backups and pillar order. |

These are the defaults. An Admin can open or close individual views for a role on the Access page.

To change your role, ask the owner of the tracker security groups (for example `SG-Tracker-Editors`) to move you. Admins cannot change group membership from inside the tracker.

## 4. Reading the portfolio

### Portfolio

Portfolio is the home page. Pick a layout at the top right:

- **Ledger.** Pillars on the left, the selected pillar's initiatives on the right. Expand an initiative to see its projects, then click a project to open it.
- **Heatmap.** One tile per initiative, colored by its worst project. Click a tile to open that initiative.
- **Leadership brief** (Executive and above). Headline numbers, one card per pillar, and a **Needs leadership attention** list of off-track projects and projects waiting on a decision. The headline tiles double as filters. **Open one-pager** makes a printable page for a pillar.
- **Pillar pace** (Executive and above). Compares how far along each pillar is with how much of its planned time has passed.

With any filter on, the ledger shows a flat list of every matching project.

### A project page

Click any project, anywhere, to open its page. It shows:

- status, trend, phase, stale and "decision waiting" tags, and a link to the detailed plan when one is set
- the **phase stepper** with progress
- scope, next milestone and key risk
- the **Decision** card: what was asked and what was decided
- **Issues**
- owners, schedule (including how many days the forecast has slipped) and recent changes

The breadcrumb at the top returns you to the pillar or initiative. **Open in monday** takes you to the project's item in monday.com.

### Board and Timeline

- **Board** shows project cards in columns **By phase** or **By status**. Cards show progress and tags for status, stale, decision and open issues.
- **Timeline** shows twelve months, grouped by pillar. A bar runs from start date to forecast end. A diamond marks the next milestone. The vertical line is today. Use the arrows to move by a quarter and **Today** to come back. Projects with no dates are counted under the chart.

### Search

Press `/` and type part of a project, an initiative or a person. Choose a result to jump to it, or choose **Filter all views by "..."** to apply the text as a filter everywhere. Search matches titles, all three owner fields, scope and initiative names.

### My work and Workload

- **My work** (Editor and Admin) lists the decisions, open issues and milestones on projects where you are business owner, delivery owner or project manager. The tracker matches your sign-in name to the owner fields. If it cannot, it asks you to pick your name once. Click **Not you?** to pick again.
- **Workload** (Executive and above) shows everyone named on projects: their projects by status and role and their open issues. Sort by size, off-track count, open issues or name. Click a person to see their work. **PM heat map** colors each project manager's portfolio.

## 5. Workflows by role

### Viewer

**See what needs attention**
1. In the top bar, click the red number (Off track) or the amber number (At risk).
2. Open a project from the list to read the key risk, the decision needed and the open issues.
3. Click **Clear** to see everything again.

**Read one project**
1. Press `/` and type part of the project name.
2. Read the status tags, phase stepper, scope, next milestone and key risk.
3. Scroll to **Decision**, **Issues** and recent changes.

**Check dates across the year**
1. Open **Timeline**.
2. Use the arrows to move by a quarter. **Today** returns you to now.

### Executive

**Run the weekly leadership review**
1. Open **Portfolio** and choose **Leadership brief**.
2. Work through **Needs leadership attention** from the top.
3. Click **Decisions** to list every decision waiting on leadership, longest wait first.
4. Switch to **Pillar pace** to see which pillars are behind their plan.

**Share a pillar on one page**
1. In the Leadership brief, choose a pillar with the pillar filter.
2. Click **Open one-pager**, then print it or save it as a PDF. The link back to the tracker still works in the PDF.

**See who carries what**
1. Open **Workload** and sort by off-track count or open issues.
2. Click a person to see their projects. Use the PM heat map for the portfolio-wide view.

### Editor

**Update my projects**
1. Open **My work**. Resolve finished issues and replace milestones you have hit.
2. Open a project that changed and click **Update status**. Set status, trend, phase, progress and next milestone. Changes save as you leave each field.
3. On the project page you can also click a step in the phase stepper to move the phase.

**Request and record a decision**
1. On the project page, click **Request a decision** and write the question. It appears under **Decisions needed** on Admin and under the **Decisions** filter.
2. When leadership decides, open the project and click **Record the decision**.

**Log and close an issue**
1. On the project page, add an issue and set its severity (Low, Medium or High).
2. Change the severity as things develop. Click **Resolve** when it is fixed.

**Find stale work**
1. Open **Admin**. **Stale projects** lists the longest quiet ones first.
2. Use **Stale for** (30, 60 or 90+ days) and the PM picker to focus.
3. Open each project and update it, or contact its owner.

**Undo a mistake**
1. Open the project's **Change log**.
2. Find the edit and click **Restore previous**.

If someone else changed the same field while you were editing, you are asked to keep yours or theirs. The other value stays in the change log.

**Add or change structure.** Pillars, initiatives and projects that come from monday.com are managed there (see [section 8](#8-the-tracker-and-mondaycom)). For anything created in the tracker, use **+** in the Pillars card, **+ Initiative**, and **+ Add project**. Deleting a pillar also deletes its initiatives and projects, and the change log cannot undo that.

### Admin

**Pull the latest from monday.com**
1. Open **Admin** and click **Open sync**.
2. Choose **monday.com (live)** and click **Preview**. Read the counts and warnings. Preview saves nothing.
3. Click **Apply**.

**Set how often the tracker checks monday.com**
1. In **Open sync**, find **Automatic pulls**.
2. Choose Off, or 5 minutes up to once a day, then **Save**.
3. A check that finds nothing new changes nothing, and automatic pulls never remove records. Everyone sees **monday data as of** in the top bar.

**Remove records monday.com no longer has** (rare)
1. In **Open sync**, tick **Also remove records monday.com does not have**, then **Preview**.
2. Read the **To remove** list and tick the box under it to confirm that exact list.
3. Click **Apply**. A backup file downloads first. To undo, restore it from **Backups** in the same dialog or **Import file** in Settings.

**Choose who sees what**
1. Open **Access**. Each row is a view or report and each column is a role.
2. Tick or untick a cell and click **Save access**. Admin always keeps everything.

**Change the pillar order**
1. In Portfolio, open the **Pillars** card and click **Reorder**.
2. Drag a pillar, or use the arrows, then click **Done**. **Use monday order** removes your override. Numbering the folders in monday.com ("Pillar 1:", "Pillar 2:") is the cleanest fix.

**Take and restore a backup**
1. **Settings, Data, Export file** saves the whole tracker as a JSON file.
2. **Import file** restores one. A backup of the current data downloads first, and importing replaces what is there.

## 6. Reports, export and the change log

- **Export.** Open your account menu and choose **Export** to download any spreadsheet report your role may use (status register, status by PM, needs attention, decision log, change log) or a full backup.
- **Change log.** Open it from a project page (that project first, with an **Everything** switch), from your account menu, or from Admin or Settings. Each entry shows what changed, who changed it, when, and the old and new values. Editors can click **Restore previous**.
- **Pillar one-pager.** Portfolio, Leadership brief, **Open one-pager**.

## 7. Settings and installing the app

- **Stale threshold.** A project is stale when nobody has updated it for longer than this: weekly, biweekly, monthly, quarterly or your own number of days. Settings shows how many projects each choice would flag.
- **Theme.** Light, Dark or Match system. The sun and moon button in the top bar toggles it.
- **Install as an app.** In Edge or Chrome click the install icon at the right of the address bar, or use **Settings, App**. On iPhone or iPad use Share, then **Add to Home Screen**. It is the same tracker with the same sign-in.
- **Updates.** Opening the tracker always loads the latest version. If it is open when a new version is published, a message says **A new version is available · Reload**. Reload when it suits you. Anything you saved is kept.
- **Sharing.** An installed app cannot be emailed. Send the tracker's web address instead.

## 8. The tracker and monday.com

monday.com owns most project information. The tracker pulls it in, and nothing flows back to monday.com.

- **What monday.com supplies:** business owner, delivery owner, project manager, scope, RAG status, trend, phase, validation, progress, start date, original end date, forecast end date, key risk, dependencies, decision needed, next milestone and next milestone date. It also supplies the pillars, initiatives and projects themselves.
- **What the tracker keeps:** issues, decision outcomes and plan links.
- **Editing.** Those monday.com fields are read-only in the tracker. A refused edit says "comes from monday.com". Change it in monday.com and the next pull brings it in. Buttons to add, rename or delete linked pillars, initiatives and projects are hidden and say **Managed in monday.com**.
- **How fresh is it?** The top bar shows **monday data as of** the last good pull. Pulls run automatically on the interval an admin chose, and an Admin can pull right away.
- **Something looks wrong.** If a project is missing or a value is stale, check monday.com first. A blank value in monday.com never erases a value in the tracker. If the data is old, ask an Admin to pull.
- **Test copies.** On a test copy (a **LOCAL** badge) nothing is locked and the data may come from a saved file.

## 9. Questions and problems

**I cannot edit anything.** Your role is Viewer or Executive, or the field comes from monday.com. The top bar shows **View only** when your role cannot edit. To get Editor, ask the group owner to add you to the Editors group.

**I see "no role".** You are not in any tracker group. Ask for access, then sign out and in.

**My work is empty.** The tracker matches your name to the owner fields. Pick your name when asked, or use **Not you?**. If your name is spelled differently in monday.com, ask the PMO to align it.

**I cannot see Workload, Admin or Access.** Those views are limited by role. By default Workload is for Admin, Editor and Executive, Admin and My work for Admin and Editor, and Access for Admin only.

**A project shows as stale.** Nobody has updated it within the stale threshold. Update the project and the tag clears.

**I made a mistake.** Use the change log and **Restore previous**.

**The data looks old.** Check **monday data as of**. If it is amber, ask an Admin to pull from monday.com or to check the connection.

**I replaced data by importing a file.** Re-import the backup file that downloaded just before. Import always saves a backup first.

## 10. Best practices

- Keep owners, status and next milestone current in monday.com. That is where updates start.
- Record decisions in the tracker when they are made, so the list of waiting decisions stays true.
- Log blockers as issues, with a severity, and resolve them when done.
- Export a backup before any large import or restore.
- Keep the stale threshold meaningful for your review cycle.
- Use the change log as the audit trail.

## 11. Terms

The full glossary is in **Help, Glossary** inside the tracker. The short version:

| Term | Meaning |
| --- | --- |
| Pillar, initiative, project | The three layers of work, top to bottom |
| RAG status | Red, amber, green health. On track, At risk, Off track |
| Trend | Improving, Flat or Declining |
| Phase | Discovery, Planning, Execution, Review, Launch, Stabilize, Closed. Multi-Phase is for release-based work |
| Stale | Not updated within the stale threshold |
| Decision needed | A question leadership has not answered yet |
| Issue | A current problem, with a severity of Low, Medium or High |
| Slip | How many days the forecast end is later than the original end |
| Change log | The record of every edit, with restore |
| Role | Admin, Editor, Executive or Viewer |
| Managed in monday.com | A field or record that comes from monday.com. Change it there |
