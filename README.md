# Savant Strategic Initiatives Tracker

## Executive Summary

The Savant Strategic Initiatives Tracker is a portfolio and initiative management application for tracking strategic pillars, workstreams, project execution, key decisions, and issue resolution across an organization. It provides a single place to monitor health, ownership, risks, milestones, status, and action items for programs that matter to leadership and delivery teams.

The app is built as a React frontend with a flexible storage layer that can run against browser-local IndexedDB, a shared local JSON-backed server, or a secure Azure-hosted API backed by Cosmos DB. This architecture supports both lightweight local usage and enterprise deployment with user roles, shared data access, and audit-friendly behavior.

In day-to-day use, the tracker supports project updates, RAG and progress tracking, stale-item monitoring, decision tracking, issue management, change logging, import/export backup, and conflict-aware edits. It is designed for both operational management and leadership review without requiring a single storage or deployment model.

For Azure deployment instructions, see [AZURE-DEPLOYMENT.md](AZURE-DEPLOYMENT.md) and [AZURE-OVERVIEW.md](AZURE-OVERVIEW.md).

## What the application does

The tracker supports a structured portfolio model:

- Pillars: top-level strategic themes or operating areas.
- Initiatives: programs or workstreams that belong to a pillar.
- Projects: detailed delivery efforts grouped under an initiative.
- Project health metadata: RAG status, trend, phase, schedule dates, milestones, owners, scope, risks, and decision fields.
- Issues: open or resolved issues tied to individual projects.
- Search and filtering: searchable portfolio views across owners, project titles, scope, stale items, and decision backlog.
- Change log: every meaningful field edit is appended with previous and new values, and can be restored.
- Import/export: the complete tracker state can be exported and restored as a single JSON app file.
- Authentication and authorization: Azure-hosted deployments enforce reader/editor roles; local runs default to a browser-local identity for quick testing.

This is not just a generic task tracker. It is meant to model strategic initiative governance and leadership visibility.

## Supported workflows

The app supports the following user workflows:

1. Portfolio management
   - Add, edit, and delete pillars.
   - Add, edit, and delete initiatives within a pillar.
   - Add, delete, and revisit project records.

2. Project tracking
   - Edit owners, scope, dates, milestone data, and decision items.
   - Update RAG status, progress, trend, and phase.
   - Log project-level issues and mark them open/resolved.
   - Track stale activity automatically based on a configurable threshold.

3. Leadership visibility
   - View aggregate RAG counts and project totals.
   - See projects that need decisions or are overdue for updates.
   - Filter by status, stale items, and decision backlog.

4. Collaboration and conflict handling
   - Detect field-level conflicts when two users edit the same project concurrently.
   - Show the other writer’s value and allow a user to choose mine or theirs.
   - Keep an audit trail of changes and an undo-like restoration path.

5. Data portability
   - Export the entire tracker as a JSON snapshot.
   - Import a previous snapshot or a legacy artifact export.
   - Restore from a backup before a bulk import.

6. Azure deployment
   - Run behind App Service and Easy Auth.
   - Store documents in Cosmos DB with managed identity.
   - Use Enta role groups to grant Viewer or Editor access.

## System architecture

The project has three major layers:

- Frontend: React + TypeScript + Vite
- Application logic: hooks, repository layer, storage abstraction
- Persistence layer: IndexedDB in the browser, file store for local demo, or REST service/Cosmos in Azure

High-level flow:

```text
Browser UI
  → useTracker / useIdentity
  → TrackerRepository
  → StorageProxy
  → IndexedDbAdapter | MemoryAdapter | RestAdapter
```

In the Azure-hosted runtime, the browser calls the Express API:

```text
React app in browser
  → /api/me           (identity and role lookup)
  → /api/documents    (read/list documents)
  → /api/documents/:key (read/write/delete with version checks)
  → /api/stream       (optional SSE polling for updates)
  → App Service
      → Easy Auth (Entra)
      → Express routes
      → Cosmos DB via managed identity
```

### Architecture summary

- React-based single-page app for portfolio review and editing.
- TypeScript domain model for pillars, initiatives, projects, issues, and log entries.
- Storage abstraction allows swapping persistent backends without changing UI code.
- Server reads Easy Auth headers in Azure; local-only mode simulates identity without security.
- Data versioning is enforced at the document layer to prevent silent overwrites.

## Authentication and authorization

### Azure / production mode

Production uses Microsoft Entra ID through App Service Easy Auth.

- Auth is enforced in the server before route access.
- Reader access is granted to anyone with either of these app roles:
  - Tracker.Viewer
  - Tracker.Editor
- Writer access is allowed only to members of Tracker.Editor.
- If a signed-in user has neither role, the API returns a 403 and asks them to request access.

The server reads the App Service injected principal from the X-MS-CLIENT-PRINCIPAL header. Authorization logic lives in [server/auth.js](server/auth.js).

### Local development mode

When no Cosmos endpoint is configured, the server runs in local/demo mode.

- No real authentication is used.
- The app treats the caller as a local editor with a browser-local name.
- This is intended only for local testing or a shared laptop demo.
- The server refuses to run with NODE_ENV=production unless COSMOS_ENDPOINT is set.

## Data storage model

The app stores tracker data as a small set of versioned documents.

Document keys:

- tracker.state
- tracker.log
- tracker.settings

Each document is versioned and stored with metadata:

```json
{
  "key": "tracker/state",
  "value": { "quarter": "Q4 2026", "pillars": [], "initiatives": [], "projects": [] },
  "version": 12,
  "updatedAt": "2026-10-13T12:00:00.000Z"
}
```

### Supported storage backends

1. IndexedDB (default for the browser)
   - Best for local interactive use.
   - Supports browser-level persistence and per-browser data isolation.
   - Cross-tab sync is implemented via a BroadcastChannel.

2. Memory adapter
   - Used for tests and fallback mode.
   - Data is lost when the tab or process closes.

3. REST adapter
   - Intended for a shared backend service.
   - The client expects /api/documents and /api/stream routes with versioned semantics.

4. Cosmos DB via the Express server
   - Production storage backend.
   - Uses managed identity and no embedded application credentials.

## App data format

The export file is a single JSON document representing the tracker and its change history.

```json
{
  "app": "savant-strategic-initiatives-tracker",
  "formatVersion": 1,
  "exportedAt": "2026-10-13T12:00:00.000Z",
  "source": "app-export",
  "settings": { "staleThresholdDays": 30 },
  "state": {
    "quarter": "Q4 2026",
    "pillars": [],
    "initiatives": [],
    "projects": []
  },
  "log": []
}
```

The import parser is intentionally tolerant:

- Accepts v1 app files.
- Accepts legacy bare state objects exported from older artifact formats.
- Normalizes missing fields and legacy values.
- Warns rather than failing when schema drift is detected.

This makes it safe to migrate historical exports into the current schema.

## Core data model

The domain model includes:

- Pillar: id, title, owner
- Initiative: id, pillarId, title, business owners, start/end quarter
- Project: id, initiativeId, title, owners, scope, trend, phase, RAG, progress, schedule, risk, decision fields, issues
- Issue: id, title, severity, status
- LogEntry: timestamp, field, oldValue, newValue, editedBy metadata
- Settings: staleThresholdDays

Project fields include:

- businessOwner
- executionOwner
- projectManager
- scope
- planLink
- startDate
- originalEndDate
- forecastEndDate
- nextMilestone
- nextMilestoneDate
- keyRisk
- decisionNeeded
- decisionOutcome
- rag
- trending
- phase
- progress

## Application UI behavior

The app is a single-page shell: a top bar, a left navigation rail, and seven views. Every view deep-links through the URL hash (`#/portfolio?pillar=…`, `#/project/<id>`, `#/work?person=…`), so the browser back button and shared links work on any host.

| Area | What it does |
| --- | --- |
| **Top bar** | Portfolio status counts (click one to filter), omnibox search (press `/`), light/dark toggle, account menu. A `LOCAL` badge appears whenever the app is not behind Entra sign-in, so dev and prod are never confused. |
| **Portfolio** | Landing page with three layouts: **Ledger** (pillars + initiative accordion → projects), **Heatmap** (each initiative colored by its worst project), **Leadership brief** (headline tiles, pillar cards, "needs leadership attention"). Editors add/edit/delete pillars, initiatives and projects here. |
| **Board** | Projects as cards by **phase** or by **status**. Editors drag a card to another column to change it. |
| **Timeline** | Twelve-month window (pages by quarter) with start→forecast bars, milestone diamonds and a today line. |
| **My work** | Decisions, open issues and milestones on projects *you* own, with in-place actions (record a decision, resolve an issue, update a milestone). |
| **Workload** | Everyone named in owner fields, with projects by status and by role. A row opens that person's work. |
| **Reports** | Printable portfolio status: tiles, status by pillar, phase mix, decision backlog, stale projects, recent activity. |
| **Settings** | Stale threshold, appearance (light / dark / match system), access, export/import, and in local mode only your name and the storage driver. |
| **Project page** | Status report layout with a clickable phase stepper, decision and issue cards, owners, schedule slip, recent changes, and an **Update status** drawer for every field. |

**Filters are shared.** The status / stale / decisions chips (and a search applied from the omnibox) narrow Portfolio, Board and Timeline in place, and stay applied as you move between those views.

**"My work" means you.** The signed-in Entra name (or the local name) is matched against the free-text owner fields. If there is no match, the page asks which owner you are and remembers the answer in that browser. Looking at someone else's work is a separate, labeled state ("Daran's work", reached from Workload, search or the person picker) with a link back to your own.

**People are derived, not stored.** `lib/people.ts` pulls names out of owner prose ("Padman / Daran for technology delivery", "Business owner: TBD") and folds obvious duplicates ("Padman" → "Padman Perumal", "Tony Behrens" → "Anthony Behrens"). The data model is unchanged.

**Theme** is a per-browser preference stored in `localStorage` and applied before first paint by a small inline script in `index.html`.

### Installable app (PWA)

The production build is a Progressive Web App. In Edge or Chrome a user can choose **Install app** (address bar, avatar menu, or Settings → App) and get the tracker in its own window with a Start menu / dock shortcut. On iPhone and iPad: Share → Add to Home Screen. Installing is optional. The browser tab works exactly as before.

How it is put together:

| Piece | Where | Notes |
| --- | --- | --- |
| Manifest and icons | `public/manifest.webmanifest`, `public/icons/` | Linked from `index.html` with `crossorigin="use-credentials"`. Without it, Easy Auth redirects the cookie-less manifest request and the app is not installable. |
| Service worker | `pwa/service-worker.js` (template) → `dist/sw.js` | Emitted by the `serviceWorker` plugin in `vite.config.ts`, which injects the precache list and a version hash of everything it caches. |
| Registration and updates | `src/hooks/usePwa.ts` | Registers only in production builds (never under `npm run dev`) and only over HTTPS or localhost. |

**Caching rules.** `/api/*` and `/.auth/*` are never touched by the service worker, so tracker data always comes from the live store and sign-in always works. Pages load **network first**: every load gets the newest deployed code, and an expired session still reaches the Microsoft sign-in redirect. The cached shell is used only when the network is unreachable. Hashed build assets are served from cache.

**Updates happen by themselves.** Each `npm run build` produces a byte-different `sw.js` whenever any output changes. Express serves `sw.js`, the manifest and `index.html` with `Cache-Control: no-cache`.

- Opening or reloading the app always runs the latest deploy.
- A window left open during a deploy checks every 30 minutes and whenever it regains focus. It compares both the service worker and the hashed asset names it is running against the server. When something is newer it shows **"A new version is available · Reload"**. It never reloads without the user's say-so, so an edit in progress is never lost.
- Settings → App shows the running version and a **Check for updates** button.

**One stream per tab.** The REST adapter opens a single shared `EventSource` for all documents (`/api/stream?keys=a,b,c`) instead of one per document. Browsers allow six HTTP/1.1 connections per host across all tabs. Three held-open streams per tab starved other requests, and in testing they blocked the service worker's update check entirely.

**Sharing it.** A PWA is not a file. It is the browser's install of a URL. To let someone try it, send them the link; they open it and choose Install. For people without access to the Azure deployment, see [SHARING-LOCALLY.md](SHARING-LOCALLY.md).

### Key app logic

- `useTracker`: central orchestrator for state, mutation, import/export, conflict handling, and change-log persistence.
- `TrackerRepository`: reads/writes the three tracker documents and handles version tracking.
- `rollups.ts`: computes RAG counts, stale state, decision state, and search results.
- `insights.ts`: view-level derivations — shared filters, heatmap status, leadership attention, per-person work items, timeline geometry.
- `people.ts`: the derived people directory and signed-in-user matching.
- `useRoute` / `useTheme` / `useMe`: hash routing, theme preference, and which owner the signed-in user is.
- `appfile.ts`: validates and normalizes exported JSON snapshots.

## Local development and commands

```bash
npm install
npm run dev
```

This starts Vite on the default frontend dev server. In browser mode, the app uses IndexedDB as its default store.

Useful commands:

```bash
npm run dev          # React dev server
npm run build        # production build
npm run preview      # preview built app
npm run typecheck    # TypeScript validation
npm test             # full Vitest suite
npm run start        # production server entrypoint
npm run start:local  # local server with file-backed storage and no auth
npm run seed         # seed Cosmos data from the app-file snapshot
```

### Environment variables

Frontend/browser variables:

```bash
VITE_STORAGE_DRIVER=indexeddb   # indexeddb | memory | rest
VITE_API_BASE_URL=https://api.example.com
VITE_API_TOKEN=
```

Server variables:

```bash
PORT=8080
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_DATABASE=tracker
COSMOS_CONTAINER=documents
NODE_ENV=production
REQUIRE_AUTH=true
LOCAL_DEV_NAME="Local developer"
TRACKER_DATA_FILE=./local-data/tracker.json
STREAM_POLL_MS=5000
```

In Azure, DO NOT store database keys in the app. The production path uses managed identity and App Service Easy Auth instead.

## API reference

The browser-facing REST API is intentionally small and consistent.

### Identity and access

- GET /api/me
  - Returns identity info, roles, and write permission.
  - If authentication is disabled locally, it returns a mock editor identity.

### Document API

- GET /api/documents?prefix=tracker/
  - Lists documents with a key prefix.
- GET /api/documents/:key
  - Reads a single versioned document.
- PUT /api/documents/:key
  - Writes a document. Accepts a JSON body like { value: ... }.
  - Honors If-Match headers for optimistic concurrency.
- DELETE /api/documents/:key
  - Removes document if version matches.

### Stream API

- GET /api/stream?keys=tracker/state,tracker/log
  - SSE endpoint for live updates.
  - If not available, the client falls back to polling.

### Health

- GET /api/health
  - Confirms database connectivity and returns ok.

### Authorization semantics

- Viewers can read all documents.
- Editors can read and write.
- If a caller lacks an app role, the API responds with 403.
- Version conflicts return 409 with the current version.

## Development vs. production

### Development mode

- Vite frontend runs on localhost.
- Browser stores data in IndexedDB.
- Local server can run with JSON file storage for a shared demo.
- No Azure sign-in required.

### Production mode

- App Service serves the frontend and API.
- Easy Auth validates an Entra principal before requests reach the app.
- Cosmos DB is used for shared state and versioned documents.
- Public access can be locked down behind private networking.

The project intentionally keeps the same data model and UI across modes.

## Testing

The repository includes tests covering import/export normalization, storage adapter semantics, API auth/authorization behavior, the derived people directory, view filters and work items, and hash routing.

Verified command:

```bash
npm test -- --run
```

Current result from the repository:

- 7 test files passed
- 76 tests passed
- 0 failed

## Project structure

```text
.
├── AZURE-DEPLOYMENT.md
├── AZURE-OVERVIEW.md
├── index.html
├── package.json
├── pwa/
│   └── service-worker.js   # template; the build emits dist/sw.js
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── README.md
├── User Guide.md
├── infra/
│   ├── app-roles.json
│   ├── deploy.sh
│   ├── entra-app.sh
│   ├── lockdown.sh
│   ├── provision.sh
│   └── seed-cosmos.mjs
├── server/
│   ├── app.js
│   ├── auth.js
│   ├── cosmos.js
│   ├── file-store.js
│   ├── index.js
│   ├── memory-store.js
│   └── server.test.js
├── src/
│   ├── App.tsx
│   ├── constants.ts
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   ├── main.tsx
│   ├── storage/
│   ├── styles.css
│   ├── test-setup.ts
│   ├── types.ts
│   └── ui/              # shell, shared primitives, views/ (one file per page)
├── verify/
├── vite.config.ts
├── vitest.config.ts
└── tsconfig*.json
```

## Operational notes and cautions

- Local mode is intended for development, not security-sensitive use.
- Do not leave a local server running in an environment where anyone can reach it without permissions.
- App Service private networking and Azure lock-down should be done only after deployment works and sign-in is validated.
- The production deployment uses no static secrets for database access; managed identity is the standard path.

## Further reading

- [AZURE-OVERVIEW.md](AZURE-OVERVIEW.md)
- [AZURE-DEPLOYMENT.md](AZURE-DEPLOYMENT.md)
- [User Guide.md](User%20Guide.md)

## Summary

This repository delivers a resilient, portable strategic initiative tracker that behaves like a modern governance tool while remaining compatible with older exports and a simple local development mode. It balances domain fidelity, auditability, and deployment flexibility without forcing a single storage model or auth setup.

The app can be used as a lightweight browser-based tracker today, or deployed to Azure as a secure internal portfolio system with proper Entra-based access controls.

---

This project is intended for internal Savant use and operational portfolio governance. If the app is being used in a new organization or environment, review the deployment scripts and roles before exposing the application beyond a controlled network.

implementation, the proxy swap and its failure path, the migration snapshot's
integrity, the file round trip, legacy import, hostile input, and the derived
counts.

The `verify/` folder holds the scaffolding used to validate this port in an
environment with no npm registry access: a browser harness, a bundler free
preview, and screenshots. Delete it once `npm install` works for you. The
React type shim in `verify/react-shim.d.ts` exists for the same reason and is
strictly worse than the real `@types/react`.
