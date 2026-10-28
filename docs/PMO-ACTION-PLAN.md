# WiseTrack: PMO requests, roles and reporting

Action plan for the Project Management team's dashboard requests (Oct 2026) and the platform work that goes with them: role-based access, Entra sign-in, an admin console, report exports and two new visualizations.

**Status:** Phase 1 is built on branch `feature/pmo-requests-rbac-reports` and passes 118 automated tests. It has not been deployed. Phases 2–5 are planned below.

---

## 1. What the PMO asked for

| Request | What changed | Where |
|---|---|---|
| Search by PM (search only matched business and delivery owners) | A **PM filter chip** on Portfolio, Board and Timeline. A **"Managed by"** group in the top search that filters to a PM's projects. Name variants are folded together, so "Padman" and "Padman Perumal" count as one person. The older search helper now also matches the PM field. | Filter row; top search |
| New phase list | Discovery, Planning, Execution, Review, Launch, Stabilize, Closed, **Multi-Phase (Release Based)** | Update status drawer, board columns, phase stepper |
| Validation dropdown, to the right of Phase | Not Started, Pending, In Progress, Completed, N/A. Shown as a tag on the project header, logged in the change log, and included in exports. | Update status drawer |
| Dependencies free-text field, before Key risks/blockers | A new field placed ahead of Key risk on the project page, in the drawer and in every export. | Project page, drawer |

### Moving existing projects to the new phases

Stored projects are upgraded automatically when they are read. Nothing has to be re-entered.

| Old phase | New phase |
|---|---|
| Discovery | Discovery |
| Design | Planning |
| Execution | Execution |
| Build | Execution |
| UAT | Review |
| Launch | Launch |
| Continuous Improvement | Stabilize |
| Close | Closed |

**PMO to confirm:** Build → Execution and UAT → Review are judgment calls. Change them in `LEGACY_PHASE` in `src/constants.ts` before deploying if they're wrong.

Multi-Phase sits outside the linear stepper. Choosing it draws every step as striped, because the phases run in parallel across releases.

### The attached slide

The image is the PMO's OKR one-pager ("M&A Growth | Integrate Acquired Firms"). It is now a report: **Reports → Pillar one-pager** builds one landscape page per pillar in the same layout and saves to PDF. Some sections of the slide have no data in the tracker yet. Section 5, Phase 3, proposes adding them.

| Slide section | Source today |
|---|---|
| Objective | A summary line: progress, number of projects and initiatives. The tracker has no objective field yet. |
| Team | Pillar owner as sponsor. Members are every owner and PM on the pillar's projects. |
| Key results / Goal / YTD | One row per initiative: target (end quarter or latest end date), progress and pace |
| Goals & outcomes | Open projects, worst status first |
| Dependencies | The new Dependencies field |
| Recent accomplishments | From the change log, last 45 days: moves to Launch, Stabilize or Closed; validation completed; decisions recorded; issues resolved; projects reaching 100% |
| Next steps | Next milestones due in the next 60 days |
| Risks / issues | Key risks on at-risk and off-track projects, plus open high-severity issues |
| Budget | **Not tracked.** Proposed in Phase 3. |

---

## 2. Roles and access (built)

### The four roles

| Role | Entra app role | Can edit | Default access |
|---|---|---|---|
| Admin | `Tracker.Admin` | Yes | Everything, always. Also gets the Admin console. |
| Editor | `Tracker.Editor` | Yes | Everything except the admin console |
| Executive | `Tracker.Executive` | No | Everything except My work and the change-log export |
| Viewer | `Tracker.Viewer` | No | Portfolio (ledger and heatmap), Board, Timeline, Reports, status register |

### How sign-in works in each environment

| | Local / dev | Azure, Entra on |
|---|---|---|
| Switch | `VITE_AUTH_MODE` unset (the default) | `VITE_AUTH_MODE=entra` at build time |
| Sign-in | Shared username and password (unchanged), plus a **"Test as" role picker** | Microsoft sign-in through App Service; no password screen |
| Roles come from | The picker. Testers can also switch roles from the account menu. | The user's Entra app-role claims |
| Server enforcement | The local server acts as the picked role, sent in the `x-tracker-dev-role` header | The API reads Entra claims; the dev header is ignored |

### Admin console

**Admin** in the left rail is visible to admins only. It has a role × view matrix and a role × report matrix. Changes stay a draft (unsaved cells are ringed) until **Save access**. The API accepts writes to the access policy from `Tracker.Admin` only. The Admin column is locked on, so an edit can't lock the last admin out.

### What access control does and doesn't cover

The policy controls **what the app shows** each role. Tracker data is one shared document, so any role that can sign in can still read all of it through the API. That is fine for hiding views from an audience. It is not enough for confidentiality, for example hiding one pillar from some people. That would need the server to filter records; see Phase 3.

---

## 3. Reports (built)

**Reports → Export a report.** Each role sees only the reports the admin console allows.

| Report | Format | Default roles |
|---|---|---|
| Pillar one-pager | Print / PDF, landscape, one page per pillar | Admin, Editor, Executive |
| Project status register (every field) | CSV, opens in Excel | Everyone |
| Status by project manager | CSV | Admin, Editor, Executive |
| Needs attention, with the reasons | CSV | Admin, Editor, Executive |
| Decision log | CSV | Admin, Editor, Executive |
| Change log | CSV | Admin, Editor |

CSV files open in Excel with accents intact. Text that Excel would treat as a formula is neutralized before export.

---

## 4. Visualizations (built)

### Pillar pace: Portfolio → Pillar pace

For each pillar, the view answers: is it as far along as its schedule says it should be today?

- **Headline:** one plain sentence naming which pillars are behind or ahead, the portfolio-wide gap in points, and a warning when the data is stale.
- **Ranked chart (default):** one row per pillar, furthest behind first.
  - The hollow ring marks where the schedule says the work should be today, and the solid dot marks where it is.
  - The bar between them is the gap: red means behind, teal on pace, blue ahead. The gap in points is printed large on the right.
  - Click a pillar to focus it.
- **One grammar at every level:** initiatives and projects use the same row on the same 0–100% axis, so you can read straight down from pillar to initiative to project.
- **Map (optional view):** across is the share of the schedule elapsed, and up is work done. The diagonal means "on plan". Pillars are bubbles and projects are dots.
- **Schedule coverage:** one mark per project, filled if it has a start and an original end date. Pace can only be measured for those, so this shows how far to trust the chart. It links to the ledger to add the missing dates.
- **Focus panel:** for the selected pillar:
  - "Biggest gaps" cards for the projects furthest behind, with their PM and the age of their last update.
  - Its initiatives as ranked rows, each expandable to its projects.
- **Schedule and freshness are separate readings.** A stale pillar still shows whether it leans behind or ahead. Stale marks are hollow or dashed, so the reading is visibly soft rather than hidden.
- **Like-for-like numbers:** pace compares the progress of *dated* projects with their expected progress. Undated projects count toward overall progress but not toward the gap.
- **Encoding:** each state has a shape as well as a color (▼ behind, ● on pace, ▲ ahead, dash for no schedule). On the map, position alone tells behind from ahead, so it reads for color-blind viewers and in print.
- **Rules:** within ±10 points counts as on pace. More than 14 days of forecast slip counts as behind. A pillar is stale when half or more of its projects are past the stale threshold.
- The filter chips apply, so "pace for Nicole's projects" is one click, and the bubbles glide to their new positions.

### PM heat map: Workload → PM heat map

- One row per project manager, with each of their projects as a tile. Rows with the most critical projects come first. Projects with no PM are grouped in a final row, and the summary tile counts them.
- Tile heat comes from an attention score:

  | Signal | Points |
  |---|---|
  | Off track | 40 |
  | At risk | 20 |
  | No recent update | 15 |
  | Milestone overdue | 15 |
  | Forecast slipping | 10 |
  | Trending down | 10 |
  | Decision waiting | 10 |
  | Each high-severity issue (up to 2) | 10 |

  40 points or more is Critical, 20–39 is Watch, under 20 is Low.
- Each tile states its main reason, such as "Off track" or "No update in 43 days". Hover for the full list; click to open the project.

**PMO to confirm:** the weights and thresholds are a first draft. They are constants in `src/lib/pace.ts` and easy to tune.

---

## 5. Roadmap

### Phase 1: PMO requests and framework (done on the branch)

- [x] PM search, phase list and migration, Validation, Dependencies
- [x] Four roles, an access policy, admin console, server enforcement, local role picker
- [x] Report library: one-pager plus five CSV exports
- [x] Pillar pace and PM heat map
- [ ] **PMO review on a test copy.** Run locally with `npm run build && npm start` and sign in as each role.
- [ ] Confirm the phase mapping (section 1) and the heat-map weights (section 4)
- [ ] Merge and deploy. Entra stays off, so sign-in works exactly as today.

### Phase 2: Turn on Entra roles (about 1 day of work, plus waiting on the identity team)

1. Run `infra/entra-app.sh`. It now registers all four app roles and keeps the ids of the existing Editor and Viewer roles, so current assignments survive.
2. Create groups and assign them in **Entra → Enterprise applications → WiseTrack → Users and groups**:
   - `SG-Tracker-Admins` → Tracker Admin (PMO leads)
   - `SG-Tracker-Editors` → Tracker Editor (PMs)
   - `SG-Tracker-Executives` → Tracker Executive (leadership)
   - `SG-Tracker-Viewers` → Tracker Viewer
3. Set `VITE_AUTH_MODE=entra` in `.env.production`, build and deploy.
4. Check: sign in as one person per role. Each should see the right nav, and Admin should appear only for admins.
5. Rollback: unset `VITE_AUTH_MODE` and redeploy.

### Phase 3: Make the one-pager complete (about 1–2 weeks)

The slide has content the tracker doesn't store yet. Proposed additions:

- **Pillar:** objective statement, sponsor, team members, budget notes
- **Initiative (key result):** target metric and value, current value. This turns "Key results / 2023 goal / YTD" into real numbers instead of progress percentages.
- **Project:** an optional "accomplishment" note, for wins that don't show up in the change log
- **Server-side filtering:** only if some records must be hidden from some roles, rather than just hiding views
- **Backups:** include the access policy in JSON exports and imports

### Phase 4: monday.com integration (scope after the walkthrough the PMO offered)

The PMO's suggestion to walk through their monday setup should happen before this phase is designed. Questions to answer in that session:

1. **Which system is the source of truth?** Does monday hold task-level plans while WiseTrack holds the portfolio view? Which fields does each own?
2. **What maps to what?** For example, monday board → initiative, item → project, group → phase, owner column → PM.
3. **Which direction does data flow?** One-way pull from monday into WiseTrack is simplest. Two-way sync needs conflict rules.
4. **How fresh does it need to be?** A nightly sync or webhooks on each change.

Candidate data to pull from monday:

- Task-level percent complete, to replace hand-entered progress
- Real milestone dates
- Dependencies between items
- Time tracking and budget columns, which would fill the one-pager's Budget section
- Item updates, which could feed "Recent accomplishments"

Technical approach: a small server job using monday's GraphQL API with a service token stored in Key Vault. It would write into the same tracker document through the existing version-checked writes, so the change log records sync edits like any other.

### Phase 5: Report polish

- Native PowerPoint export of the one-pager (`.pptx`) for the leadership deck
- Excel workbook (`.xlsx`) with one tab per report
- Scheduled delivery, for example a weekly PDF to leadership by email or Teams

---

## 6. Decisions needed

| # | Decision | Who | Default if no answer |
|---|---|---|---|
| 1 | Phase mapping for Build and UAT | PMO | Build → Execution, UAT → Review |
| 2 | Default access per role (section 2) | PMO and leadership | As shipped |
| 3 | Heat-map weights and thresholds | PMO | As shipped |
| 4 | Who holds Tracker.Admin | PMO lead | PMO leads only |
| 5 | Must any data be hidden from some roles, not just views? | Leadership | No, so no server-side filtering |
| 6 | monday.com: source of truth and sync direction | PMO, after the walkthrough | Not started |

---

## 7. Verification done

- 118 unit and API tests pass: phase migration, PM search, pace and attention scoring, every CSV report, one-pager assembly, access-policy rules, admin-only writes, and the local role header being ignored once sign-in is enforced.
- Checked in Edge against the local server, as admin and as viewer, in light and dark themes: login role picker, pillar pace, PM heat map, admin console, report library, one-pager on screen and in print layout, project page and drawer, PM filter, and the "no access" page.
- Not yet done: a test on the Azure deployment, and the Entra sign-in path. Phase 2 covers both.

## Where the code lives

| Area | Files |
|---|---|
| Roles, access policy, auth mode | `src/auth/` |
| Server enforcement | `server/auth.js`, `server/app.js` |
| Admin console | `src/ui/views/AdminView.tsx` |
| Reports | `src/reports/` and `src/ui/views/ReportPreview.tsx` |
| Pace and attention math | `src/lib/pace.ts` |
| Pillar pace | `src/ui/views/PaceView.tsx`, `src/ui/pace.tsx` |
| PM heat map | `src/ui/views/PmHeatmap.tsx` |
| Phase migration | `src/data/appfile.ts` (`migratePhase`, `upgradeState`) |
