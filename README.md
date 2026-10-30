# Savant Strategic Initiatives Tracker (WiseTrack)

## Executive summary

The Savant Strategic Initiatives Tracker is a portfolio and initiative management application for tracking strategic pillars, initiatives, project execution, key decisions and issues. It gives leadership and delivery teams one place to see health, ownership, risks, milestones and action items.

It is a React + TypeScript single-page app built on a **micro-UI module architecture**:

- A **base framework** (`src/platform`) provides the shell, the left rail, storage, identity, access control, routing, shared filters and the global overlays.
- Every page is a **module** (`src/modules/<id>`). A module is developed and tested on its own, plugs in with one line, and gets its own rail entry.
- Each module runs in a **sandbox**: lazily loaded, behind its own error boundary and access gate. A bug in one module does not take down the others.
- Modules reach the framework through one import surface, the **SDK** (`@sdk`). Architecture tests fail the build if a module reaches anywhere else.

The architecture follows the lead of Thrive Financial's module-scoped micro-UI (see [SampleArchitecture/](SampleArchitecture/)) and tightens the parts that Thrive's own documents call out as hotspots. It is meant to be reused as a template; see [Applying this architecture to a new application](#applying-this-architecture-to-a-new-application).

Storage runs against browser IndexedDB, a shared local JSON server, or an Azure-hosted API backed by Cosmos DB. See [AZURE-OVERVIEW.md](AZURE-OVERVIEW.md) and [AZURE-DEPLOYMENT.md](AZURE-DEPLOYMENT.md).

---

## Contents

1. [Quick start](#quick-start)
2. [Architecture](#architecture)
3. [Workflows](#workflows)
4. [Applying this architecture to a new application](#applying-this-architecture-to-a-new-application)
5. [What the application does](#what-the-application-does)
6. [Data, storage and API](#data-storage-and-api)
7. [Authentication and authorization](#authentication-and-authorization)
8. [Installable app (PWA)](#installable-app-pwa)
9. [Testing](#testing)
10. [Project structure](#project-structure)
11. [Decision notes, hotspots and future work](#decision-notes-hotspots-and-future-work)

---

## Quick start

```bash
npm install
npm run dev            # the app, http://localhost:5173 (IndexedDB storage)
npm run dev:module     # the module workbench: one module, in-memory data, no shell
npm test               # full Vitest suite, including the architecture tests
npm run build          # typecheck + production build to dist/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server for the full app |
| `npm run dev:module` | Opens `workbench.html`, the standalone module environment |
| `npm run new:module -- <id> "<Title>" [description]` | Scaffolds a module and plugs it in |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the built app locally |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest: unit, module, sandbox, contract and architecture tests |
| `npm run start` / `start:local` | Express server: production, or local with file-backed storage and no auth |
| `npm run seed` | Seed Cosmos from the bundled snapshot |

---

## Architecture

### The three layers

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ src/platform: the base framework                                         │
│                                                                          │
│  PlatformProvider: storage · identity · access · location · filters      │
│                    toasts · confirm · conflict · change log · panels     │
│  AppShell: top bar · left rail (built from the registry) · content area  │
│                                                                          │
│   ┌─ ModuleHost (one per open module): the sandbox ───────────────────┐  │
│   │  access gate → error boundary → Suspense → lazy module bundle     │  │
│   └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────▲───────────────────────────────────────────┘
                               │ usePlatform()  (the platform API)
┌──────────────────────────────┴───────────────────────────────────────────┐
│ src/sdk (`@sdk`): the only import surface for modules                    │
│  platform API · module contract types · domain types and pure logic ·    │
│  shared UI kit · `@sdk/testing`                                          │
└──────────────────────────────▲───────────────────────────────────────────┘
                               │ import … from '@sdk'
┌──────────────────────────────┴───────────────────────────────────────────┐
│ src/modules/<id>: one folder per page                                    │
│  manifest.ts (the plug) · entry.tsx (lazy) · views · routes.ts · tests · │
│  README.md                                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

The dependency direction is one way. Modules depend on the SDK. The SDK re-exports parts of the platform and the shared libraries. Nothing outside `src/modules` imports a module, except `src/App.tsx` (the app) and the workbench entry. The architecture tests enforce this.

### The module contract

A module is described by a **manifest** ([src/platform/module.ts](src/platform/module.ts)):

```ts
export const manifest: ModuleManifest = {
  id: 'board',                    // URL segment and registry key
  title: 'Board',                 // rail label, page title, fault panel title
  icon: Icon.Board,
  navOrder: 20,                   // rail position; omit for link-only pages
  usesFilters: true,              // honours the shared status/stale/search filters
  features: [{ key: 'board', label: 'Board', defaultRoles: ['admin', 'editor', 'executive', 'viewer'] }],
  requires: 'board',              // feature needed to open it (or a function of the location)
  load: () => import('./entry'),  // the module's code, fetched on first visit
}
```

| Field | Purpose |
| --- | --- |
| `id` | Lowercase, unique. The URL is `#/<id>/<optional id>?<params>`. |
| `title`, `description`, `icon` | Rail entry, document title, workbench and fault panel. |
| `navOrder` | Rail position. Omit it for detail pages reached by link (Project, One-pager). |
| `features` | Access-policy features the module **contributes**. They appear on the Access page automatically. |
| `requires` | The feature needed to open it at a location; `null` for every role. A function lets one module gate its layouts separately (Portfolio, Workload). |
| `adminOnly` | Decided by role, not policy (Access). |
| `usesFilters` | The top bar sends status and search filters to a module that shows them. |
| `activeNav` | Which rail item lights up (Project → Portfolio; someone else's work → Workload). |
| `redirects` | Retired URL segments this module answers for (Admin owns the old `#/reports`). |
| `load` | `() => import('./entry')`. The entry's default export receives `{ location }`. |

The manifest is loaded eagerly with the shell, so it holds only data, an icon and the `import()`. The views load on first visit, each as its own bundle (`assets/module-<id>-<hash>.js`).

**Routing is owned by modules.** The platform reads only the first hash segment, the module id. Everything after it belongs to the module, which parses its own params (see `routes.ts` in Portfolio, Board and Workload). Modules link to each other like hyperlinks: `navigate({ module: 'work', params: { person } })`. There is no central route table to edit when a module is added.

### The plug board

[src/modules/index.ts](src/modules/index.ts) lists every module the app is built from: one import and one array entry each. [src/App.tsx](src/App.tsx) hands that list to `createRegistry`, which validates it:

- Ids are well formed and unique. Every manifest has a title and a loader.
- Features are unique across modules, and parents and `requires` refer to declared features.
- Redirects don't shadow a module or each other.

In development and tests a bad manifest **throws**, so the mistake is found at the desk. In production the bad module is **left out and reported**, so one broken plug-in cannot stop the app from starting.

From the registry the shell builds the rail (ordered by `navOrder`, filtered by access), the access catalogue, redirects, and the landing page (the first rail module the viewer may open).

### The sandbox

Every module renders inside a `ModuleHost` ([src/platform/ModuleHost.tsx](src/platform/ModuleHost.tsx)):

| Wall | What it does |
| --- | --- |
| **Access gate** | Checks `adminOnly` / `requires` *before* loading. A module the viewer may not open is never downloaded; they see the no-access page. A `requires` function that throws fails closed. |
| **Lazy loading** | The bundle loads on first visit behind a local spinner; the rail and top bar stay interactive. |
| **Stale-chunk recovery** | After a deploy, an old tab asking for a deleted bundle gets **one** guarded reload (30-second window, recorded in session storage), never a loop. Any other load failure shows "couldn't load" with a retry. |
| **Error boundary** | A render or lifecycle crash is caught at the module boundary and replaced by a recoverable panel ("Board hit a problem"). The shell and every other module keep working. |
| **Recovery** | **Try again** re-imports and remounts the module with fresh state. Navigating anywhere else clears the fault. |
| **Guarded manifest code** | Manifest callbacks the shell calls outside the boundary (`activeNav`, `requires`, `redirects`) are wrapped; a throw is reported and a safe default is used. |
| **Frozen shared data** | In development and tests, the shared tracker data handed to modules is deep-frozen. A module that mutates it in place throws inside its own sandbox, instead of silently corrupting what every other module shows. Production skips the freeze. |
| **Fault reporting** | Every contained fault goes to [src/platform/diagnostics.ts](src/platform/diagnostics.ts) with the module id and phase (`render`, `load`, `manifest`). Attach telemetry once with `onModuleFault(...)`. The workbench lists faults live. |
| **Import boundary** | A module can only reach the platform through `@sdk`, so it cannot depend on platform internals or another module's code. |

**Limits, stated plainly.** This is in-process isolation (the Thrive model), not an iframe or a separate origin. React error boundaries do not catch errors thrown in event handlers, timers or promises. Those don't unmount anything, so the page stays up, and tracker actions report their own failures as toasts. A module can still block the main thread with an infinite loop, or style the page badly with global CSS. Hard isolation for untrusted third-party code would need iframes or a separate origin; see [Future work](#decision-notes-hotspots-and-future-work).

### The platform API

Modules call `usePlatform()` ([src/platform/context.ts](src/platform/context.ts)) and get one read-mostly bundle:

| Group | Members |
| --- | --- |
| Data | `tracker`: state, log, settings, access policy, storage status and every mutation (`tracker.actions.*`) |
| Identity and access | `identity`, `identitySource`, `roles`, `isAdmin`, `canWrite`, `can(feature)`, `canReport(id)`, `features`, `setName`, `setTestRole` |
| Navigation | `location`, `navigate(to, { replace })`, `hrefFor(to)`, `openProject(id)` |
| Shared view state | `filters`, `setFilters`, `matches`, `filtering`, `people`, `me`, `meClaimed`, `claimMe`, `contextOf` |
| Global UI services | `ask` (confirm dialog), `theme`, `themePreference`, `setThemePreference`, `toggleTheme`, `openChangeLog`, `openStorage`, `openIdentity`, `startImport` |

Modules communicate **only** through shared data, shared filters and links. A module never imports another module, and it never holds state another module needs. When two modules need to share something new, it becomes a platform service.

### The SDK

[src/sdk/index.ts](src/sdk/index.ts) is the whole import surface for modules: the platform API, the contract types, the domain model and pure logic (`types`, `constants`, `lib/*`, `reports`), PWA helpers, and the shared UI kit (`ui/common`, `ui/atoms`, `ui/pace`, `Icon`). [src/sdk/testing.ts](src/sdk/testing.ts) (`@sdk/testing`) is the test harness.

The `@sdk` alias is defined in `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`. Adding to the SDK is a platform decision: export the narrowest thing that works.

### Architecture tests (enforced rules)

[src/platform/boundaries.test.ts](src/platform/boundaries.test.ts) reads the source and fails `npm test` when:

1. A module imports anything except `react`, `@sdk`, or files inside its own folder. Its tests may also import `@sdk/testing` and `vitest`.
2. A module folder lacks `manifest.ts`, `entry.tsx` or `README.md`.
3. A manifest statically imports a view, which would pull the module's code into the startup bundle. The only dynamic import allowed is `./entry`.
4. The plug board imports anything but manifests, or misses a module folder.
5. Code outside `src/modules` reaches into a module (only `App.tsx` and the workbench entry may).

[src/platform/modules.contract.test.tsx](src/platform/modules.contract.test.tsx) mounts **every registered module** in the real platform with the bundled data and asserts it renders without a fault. It also checks rail order and role filtering, the no-access page, legacy redirects and unknown URLs. A new module is covered the moment it is plugged in.

### Patterns adopted from Thrive Financial, and what changed

| Thrive pattern ([SampleArchitecture/](SampleArchitecture/)) | Here |
| --- | --- |
| Module-scoped micro-UI: `modules/<Feature>/`, shared shell and primitives in `components/` | `src/modules/<id>/`; shared kit in `src/ui`, reached through `@sdk` |
| `lazyWithReload`: lazy modules, one guarded reload on a stale chunk | `lazyModule.ts`: same, plus retry that forgets the cached rejection |
| `ModuleErrorBoundary` for feature-level crashes | `ModuleHost`: boundary plus access gate, Suspense, auto-reset on navigation and fault reporting |
| A README in every module | Required and enforced by test |
| `repo-map.md` "start here / crawl order" | [Where to start reading](#where-to-start-reading) below |
| `activeView` plus a central switch in `App.tsx` (no router) | Hash routing where the platform owns only the module segment; no central switch |
| Central Zustand store, flagged as the main coupling hotspot | The platform owns shared state; module-local state stays in the module. Recommended rule: "prefer module-local state unless two modules need it" |
| Tier gating via `TierGate` / `tierFeatures.ts` | Access features **declared by modules** and assembled by the registry; grants for absent modules are kept |
| Deterministic logic separated from UI (`utils/`, `services/`) | `src/lib`, `src/reports`: pure, unit-tested, exported through the SDK |
| Local-first storage behind a service layer | Storage adapter contract plus proxy (IndexedDB, memory, REST/Cosmos) |
| Fire-and-forget telemetry that never blocks work | `onModuleFault` listeners are isolated; a broken sink can't break the app |
| Hotspot lists and "why X over Y" decision notes | [Decision notes](#decision-notes-hotspots-and-future-work) below |

What Thrive left undone and this adds: an enforced import boundary, a validated registry, module-contributed access features, a standalone workbench, a module test harness, a scaffolder, and a contract test over every module.

### Where to start reading

1. [src/platform/module.ts](src/platform/module.ts): the contract.
2. [src/modules/index.ts](src/modules/index.ts) and one module, e.g. [src/modules/board/](src/modules/board/).
3. [src/sdk/index.ts](src/sdk/index.ts): what modules can use.
4. [src/platform/ModuleHost.tsx](src/platform/ModuleHost.tsx), [registry.ts](src/platform/registry.ts), [lazyModule.ts](src/platform/lazyModule.ts): the sandbox.
5. [src/platform/PlatformProvider.tsx](src/platform/PlatformProvider.tsx) and [Shell.tsx](src/platform/Shell.tsx): global state and chrome.
6. Only then [src/hooks/useTracker.ts](src/hooks/useTracker.ts), [src/data](src/data/) and [src/storage](src/storage/) for data work.

---

## Workflows

### 1. Create a module

```bash
npm run new:module -- risks "Risk register" Open risks across every project.
```

On PowerShell, if the title arrives split, call the script directly: `node tools/new-module.mjs risks "Risk register"`.

This creates `src/modules/risks/` from [tools/module-template/](tools/module-template/) (manifest, entry, view, test, README) and adds it to `src/modules/index.ts`. The generated module passes every architecture test as generated, gets a rail entry after the last module, and adds a `risks` feature to the Access page (admin and editor by default).

### 2. Develop it standalone

```bash
npm run dev:module
```

This opens the **module workbench** (`workbench.html`): the real platform and sandbox, without the production shell or login gate. From the bar you can switch module, role (admin, editor, executive, viewer) and theme. Contained faults are listed live under the bar.

| URL | Use |
| --- | --- |
| `/workbench.html#/risks` | The module, with every other module registered (cross-links work) |
| `/workbench.html?only=risks#/risks` | **Isolated**: only this module is registered. Proves it stands alone |
| `/workbench.html?storage=indexeddb` | Your real browser data instead of in-memory |

Storage defaults to **memory**, seeded from the bundled snapshot, so experiments never touch your real data. The workbench runs under `StrictMode` with frozen shared data, so mutation and effect bugs surface early. It is never part of the production build.

### 3. Test it on its own

A module's tests live in its folder and use only `@sdk/testing`:

```ts
import { mountModule } from '@sdk/testing'
import { manifest } from './manifest'

const app = await mountModule(manifest, { hash: '#/board?layout=status', role: 'viewer' })
expect(app.container.querySelector('h1')?.textContent).toBe('Projects by status')
app.unmount()
```

`mountModule` mounts the module inside the real `PlatformProvider` and `ModuleHost`, with real storage (fake-indexeddb under Vitest) seeded from the snapshot. Options: `hash`, `role`, `with` (other modules to register), `shell` (render the full top bar and rail). [src/modules/board/board.test.tsx](src/modules/board/board.test.tsx) is the reference example.

```bash
npx vitest run src/modules/risks      # just this module
npm test                              # everything, including the contract and architecture tests
```

### 4. Plug it in (or out)

Plugging in is the one line in `src/modules/index.ts` (the scaffolder does it). Unplugging is removing that line and the folder. Access grants saved for a removed module are **kept** in the stored policy, so adding it back restores them.

Before merging, `npm test` must pass: the module's own tests, the contract test that mounts it in the full app, and the boundary rules.

### 5. Develop a module outside this repository

An external team works against the same contract:

1. Clone this repository (the template), or a trimmed copy with the platform, SDK and workbench.
2. Build the module in `src/modules/<id>/`, importing only `react`, `@sdk` and its own files. The boundary test proves it.
3. Develop in the workbench with `?only=<id>`, and test with `@sdk/testing`.
4. Hand over the folder (pull request, git subtree, or a package). Integration is the one plug-board line, plus a review of the module README and its declared features.

Because the module depends only on the SDK, the host can change anything behind the SDK without breaking it. Changing what the SDK exports is a versioned, reviewed platform change.

### 6. Change the platform

- Adding a **platform service** (something two modules need): add it to `PlatformApi` and the provider, and export only what modules need from `@sdk`.
- Adding to the **shared UI kit**: put it in `src/ui` and export it from `@sdk`. Keep module-only components inside the module.
- Run `npm test`. The contract test re-mounts every module against your change.

### 7. Diagnose a fault in production

- The user sees "<Module> hit a problem" with **Try again** and **Reload the app**. Everything else still works.
- The console logs `[module:<id>] render|load|manifest failed` with the error.
- Chunk names (`module-<id>-<hash>.js`) identify the module in network and error reports.
- To forward faults to telemetry (e.g. Application Insights), add one `onModuleFault(...)` call at startup.

---

## Applying this architecture to a new application

The platform splits into a **generic core** you copy as is, and an **app layer** you adapt.

| Copy as is (generic core) | File |
| --- | --- |
| Module contract | `src/platform/module.ts` |
| Hash location | `src/platform/location.ts` |
| Registry and validation, access helpers, resolution | `src/platform/registry.ts` |
| Lazy loading and stale-chunk reload | `src/platform/lazyModule.ts` |
| Sandbox (`ModuleHost`, `ModuleBoundary`, `CurrentModule`, `NoAccess`) | `src/platform/ModuleHost.tsx` |
| Fault reporting | `src/platform/diagnostics.ts` |
| Architecture tests, contract test | `src/platform/boundaries.test.ts`, `modules.contract.test.tsx` |
| Test harness | `src/platform/testing.tsx`, `src/sdk/testing.ts` |
| Workbench | `workbench.html`, `src/platform/dev/` |
| Scaffolder | `tools/new-module.mjs`, `tools/module-template/` |
| Role-based access with module-declared features | `src/auth/access.ts`, `src/auth/roles.ts` |
| Aliases | the `@sdk` / `@sdk/testing` entries in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` |

| Adapt (app layer) | What to change |
| --- | --- |
| `src/platform/context.ts` (`PlatformApi`) | Replace the tracker-specific members (`tracker`, `people`, `filters`, `contextOf`, `openProject`) with your domain's shared services. Keep identity, access, navigation and UI services. |
| `src/platform/PlatformProvider.tsx` | Wire your data hook and storage in place of `useTracker`; keep the freeze, access normalization, location resolution and overlays pattern. |
| `src/platform/Shell.tsx` | Your brand, top bar and account menu. The rail and content area stay as they are. |
| `src/sdk/index.ts` | Export your domain types, pure logic and UI kit. |
| `src/modules/*` | Your pages. |
| `src/hooks`, `src/data`, `src/storage`, `server/` | Your data layer. The storage adapter contract and proxy are reusable if the app is document-shaped. |

### Steps

1. **Start from this repository.** Delete `src/modules/*` except one module to keep as an example, then empty the array in `src/modules/index.ts`.
2. **Define the platform API** your modules will share (`context.ts`). Begin small: identity, access, navigation, notifications, confirm. Add domain services only when a second module needs them.
3. **Define the SDK.** Export the API, contract types, domain types, pure logic and UI kit. Nothing else.
4. **Scaffold modules** with `npm run new:module`. Give each a README, its features and its `navOrder`.
5. **Keep the guard rails on.** Do not relax `boundaries.test.ts` to get a build green; fix the import, or promote the thing into the SDK.
6. **Attach telemetry** with `onModuleFault` before go-live.

### Rules of thumb

- **One page, one module.** Detail pages are their own link-only module (`navOrder` omitted, `activeNav` pointing at the parent).
- **The URL is the interface between modules.** Link with `{ module, id, params }`. Never import another module.
- **State lives as low as possible.** Module state stays in the module. Shared state goes into the platform, reached through the API.
- **The manifest stays tiny.** Data, an icon, `import('./entry')`.
- **Access belongs to the module that needs it.** Declare features in the manifest; the Access page and the policy pick them up.
- **Pure logic is a library, not a module.** Calculations two modules use go in `src/lib` and are exported through the SDK, with unit tests.
- **Prefer a narrow SDK.** Each export is a promise to every module, including ones built elsewhere.

---

## What the application does

The tracker models strategic initiative governance:

- **Pillars**: top-level strategic themes. **Initiatives**: programs within a pillar. **Projects**: delivery efforts within an initiative.
- **Project health**: RAG status, trend, phase, schedule dates, milestones, owners, scope, risks, decisions, issues.
- **Change log**: every field edit with previous and new values, restorable.
- **Import/export**: the complete tracker as one JSON app file.
- **Conflict handling**: field-level detection when two people edit the same project; choose mine or theirs.

### Modules

| Module | Route | Rail | What it does |
| --- | --- | --- | --- |
| [Portfolio](src/modules/portfolio/README.md) | `#/portfolio?layout=…&pillar=…&initiative=…` | 10 | Ledger, heatmap, leadership brief, pillar pace. Add, edit and delete pillars, initiatives and projects. |
| [Board](src/modules/board/README.md) | `#/board?layout=status` | 20 | Cards by phase or status; drag to change. |
| [Timeline](src/modules/timeline/README.md) | `#/timeline` | 30 | Twelve-month window with bars, milestones and a today line. |
| [My work](src/modules/work/README.md) | `#/work?person=…` | 40 | Decisions, issues and milestones you own, with in-place actions. |
| [Workload](src/modules/workload/README.md) | `#/workload?layout=pm-heatmap` | 50 | Everyone's projects by status and role; PM heat map. |
| [Admin](src/modules/admin/README.md) | `#/admin` | 60 | PMO upkeep: stale projects, decisions, recent activity, monday.com sync. |
| [Access](src/modules/access/README.md) | `#/access` | 70 | Who sees which views and reports (admins only). |
| [Settings](src/modules/settings/README.md) | `#/settings` | 80 | Stale threshold, theme, install and update, import and export. |
| [Project](src/modules/project/README.md) | `#/project/<id>` | link | Status report and editor for one project. |
| [One-pager](src/modules/onepager/README.md) | `#/onepager?pillar=…` | link | Printable pillar one-pager. |

The **top bar** (platform) shows portfolio status counts (click one to filter), the omnibox search (press `/`), the theme toggle and the account menu (export, change log, role testing, sign out). A `LOCAL` badge appears whenever the app is not behind Entra sign-in.

**Filters are shared.** The status, stale and decision chips and omnibox search narrow every module with `usesFilters` (Portfolio, Board, Timeline), and stay applied as you move between them.

**"My work" means you.** The signed-in name is matched against the free-text owner fields. Without a match, the page asks which owner you are and remembers it in that browser. **People are derived, not stored**: `lib/people.ts` pulls names out of owner prose and folds obvious duplicates.

Every page deep-links through the URL hash, so the back button and shared links work on any host. Links saved from the retired Reports page (`#/reports…`) redirect to Admin or the one-pager.

---

## Data, storage and API

### Layers

```text
Module → usePlatform().tracker → useTracker → TrackerRepository → StorageProxy
       → IndexedDbAdapter | MemoryAdapter | RestAdapter → (Express → Cosmos DB)
```

Tracker data is a small set of versioned documents: `tracker.state`, `tracker.log`, `tracker.settings` and `tracker.access`.

```json
{ "key": "tracker/state", "value": { "quarter": "Q4 2026", "pillars": [], "initiatives": [], "projects": [] }, "version": 12, "updatedAt": "2026-10-13T12:00:00.000Z" }
```

| Backend | Use |
| --- | --- |
| IndexedDB (default) | Browser-local; cross-tab sync through BroadcastChannel |
| Memory | Tests, workbench, and fallback when the browser refuses a database |
| REST | Shared backend: `/api/documents` and `/api/stream` with versioned semantics |
| Cosmos DB via Express | Production, using managed identity and no embedded credentials |

Driver selection: `VITE_STORAGE_DRIVER`, else `?storage=` in the URL, else IndexedDB. Settings → Storage swaps the driver at runtime and migrates the data.

### App file format

```json
{ "app": "savant-strategic-initiatives-tracker", "formatVersion": 1, "exportedAt": "…", "source": "app-export",
  "settings": { "staleThresholdDays": 30 }, "state": { "quarter": "Q4 2026", "pillars": [], "initiatives": [], "projects": [] }, "log": [] }
```

The import parser is tolerant: it accepts v1 files and legacy bare-state exports, normalizes missing fields, and warns rather than failing on schema drift. A backup downloads before any import.

### Core data model

- **Pillar**: id, title, owner.
- **Initiative**: id, pillarId, title, business and execution owners, start and end quarter.
- **Project**: id, initiativeId, title, `businessOwner`, `executionOwner`, `projectManager`, `scope`, `planLink`, `startDate`, `originalEndDate`, `forecastEndDate`, `nextMilestone`, `nextMilestoneDate`, `dependencies`, `keyRisk`, `decisionNeeded`, `decisionOutcome`, `rag`, `trending`, `phase`, `validation`, `progress`, `issues`.
- **Issue**: id, title, severity, status.
- **LogEntry**: timestamp, field, old and new value, editor.
- **Settings**: `staleThresholdDays`.

### REST API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/me` | Identity, roles, write permission (mock editor when auth is off locally) |
| `GET /api/documents?prefix=tracker/` | List documents |
| `GET /api/documents/:key` | Read one versioned document |
| `PUT /api/documents/:key` | Write; honours `If-Match` for optimistic concurrency (409 on conflict) |
| `DELETE /api/documents/:key` | Delete if the version matches |
| `GET /api/stream?keys=a,b` | One SSE stream per tab for live updates (falls back to polling) |
| `GET /api/health` | Database connectivity |

Viewers read; editors read and write; `tracker.access` is admin-only. A caller without an app role gets 403.

### Environment variables

```bash
# browser
VITE_STORAGE_DRIVER=indexeddb   # indexeddb | memory | rest
VITE_API_BASE_URL=https://api.example.com
VITE_API_TOKEN=
VITE_AUTH_MODE=local            # local | entra

# server
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

In Azure, never store database keys in the app; production uses managed identity and App Service Easy Auth.

---

## Authentication and authorization

### Production (Azure)

Microsoft Entra ID through App Service Easy Auth, enforced before any route. Read access goes to `Tracker.Admin`, `Tracker.Editor`, `Tracker.Executive` and `Tracker.Viewer`; write access to Admin and Editor only. The server reads the injected `X-MS-CLIENT-PRINCIPAL` header ([server/auth.js](server/auth.js)).

The browser takes roles from Entra only when built with `VITE_AUTH_MODE=entra`. Until then it shows the shared username and password screen with a role picker, so anyone can test every role. See [docs/PMO-ACTION-PLAN.md](docs/PMO-ACTION-PLAN.md).

### Access policy

The access policy (`tracker.access`) decides which roles see which **features** and **reports**:

- **Features are declared by modules** in their manifests, and assembled by the registry into the catalogue the Access page edits. A layout feature (`portfolio.brief`) also needs its parent (`portfolio`).
- A feature missing from the stored policy uses the module's `defaultRoles`. A stored grant for a feature this build doesn't include is **kept**, not dropped.
- Admin always sees everything, and the Access module is `adminOnly`, so no policy edit can lock admins out.
- A report that opens from a view (the one-pager, from the leadership brief) declares `requiresFeature` in the report catalogue.

The policy decides what the interface offers. Every role with access can still read the shared tracker data through the API; per-record restriction would need server-side filtering.

### Local development

Without a Cosmos endpoint the server runs in local mode: no real authentication. The app acts as the role picked on the sign-in screen (editor if none) and sends it in `x-tracker-dev-role`, which the server honours only while sign-in is off. The server refuses `NODE_ENV=production` without `COSMOS_ENDPOINT`.

---

## Installable app (PWA)

The production build is a Progressive Web App (Edge or Chrome **Install app**; iOS Share → Add to Home Screen).

| Piece | Where | Notes |
| --- | --- | --- |
| Manifest and icons | `public/manifest.webmanifest`, `public/icons/` | Linked with `crossorigin="use-credentials"` so Easy Auth doesn't redirect the manifest request |
| Service worker | `pwa/service-worker.js` → `dist/sw.js` | Emitted by the `serviceWorker` plugin in `vite.config.ts` with the precache list (including every module chunk) and a content hash |
| Registration and updates | `src/hooks/usePwa.ts` | Production builds only, over HTTPS or localhost |

`/api/*` and `/.auth/*` are never cached. Pages load network-first; hashed assets come from cache. An open window checks for a new deploy every 30 minutes and on focus, and offers **Reload**; it never reloads by itself. If a module chunk from an old build is gone, the module sandbox does one guarded reload. One shared `EventSource` per tab keeps within the browser's six connections per host. To share a PWA, send the URL; for people without Azure access, see [SHARING-LOCALLY.md](SHARING-LOCALLY.md).

---

## Testing

```bash
npm test               # all suites
npx vitest run src/platform           # framework: sandbox, registry, location, contract, boundaries
npx vitest run src/modules/board      # one module
```

| Suite | Covers |
| --- | --- |
| `src/platform/sandbox.test.tsx` | Render crash contained, shell and other modules unaffected; retry remounts; shared data mutation caught; load failure reported without reload; stale chunk reloads exactly once; throwing manifest callback survived; a forbidden module never downloaded |
| `src/platform/modules.contract.test.tsx` | Every registered module renders in the real platform with real data; rail order and role filtering; no-access page; legacy redirects; unknown URLs |
| `src/platform/boundaries.test.ts` | The five architecture rules |
| `src/platform/registry.test.ts`, `location.test.ts` | Validation, strict and forgiving modes, gating, landing page, redirects, URL round-trips |
| `src/modules/*/…test.tsx` | Module-owned tests through `@sdk/testing` (Board is the reference) |
| `src/lib`, `src/reports`, `src/data`, `src/storage`, `src/hooks` | Domain logic, reports and access policy, app-file import, storage adapters, PWA |
| `server/server.test.js` | API authentication and authorization |

Current result: **15 test files, 183 tests, all passing**. `npm run typecheck` and `npm run build` are clean.

The production build was also exercised in headless Edge: every rail module rendered with no fault, each module chunk loaded only on first visit, the legacy `#/reports` link redirected to the one-pager, and there were no runtime errors.

---

## Project structure

```text
.
├── index.html                 # the app
├── workbench.html             # module workbench (development only; not built)
├── src/
│   ├── main.tsx               # mount: LoginGate → App
│   ├── App.tsx                # the app = platform + registered modules
│   ├── platform/              # base framework
│   │   ├── module.ts          #   module contract (manifest, location, link)
│   │   ├── registry.ts        #   validation, access gating, landing, redirects
│   │   ├── location.ts        #   hash routing
│   │   ├── lazyModule.ts      #   lazy loading, stale-chunk reload
│   │   ├── ModuleHost.tsx     #   the sandbox
│   │   ├── diagnostics.ts     #   fault reporting
│   │   ├── context.ts         #   PlatformApi, usePlatform
│   │   ├── PlatformProvider.tsx   # global state and overlays
│   │   ├── Shell.tsx          #   top bar, rail, account menu
│   │   ├── modals.tsx, ChangeLog.tsx, LoginGate.tsx
│   │   ├── testing.tsx        #   module test harness
│   │   ├── dev/               #   workbench
│   │   └── *.test.ts(x)       #   sandbox, contract, boundary, registry, location tests
│   ├── sdk/                   # `@sdk` and `@sdk/testing`: the module import surface
│   ├── modules/               # one folder per page, plus index.ts (the plug board)
│   │   └── <id>/              #   manifest.ts · entry.tsx · views · routes.ts · tests · README.md
│   ├── ui/                    # shared UI kit (common, atoms, icons, pace)
│   ├── lib/                   # pure domain logic
│   ├── reports/               # report catalogue and builders
│   ├── auth/                  # roles, session, access policy
│   ├── hooks/                 # useTracker, useIdentity, useTheme, useMe, usePwa
│   ├── data/                  # repository, app file, bundled snapshot
│   ├── storage/               # adapter contract, IndexedDB, memory, REST, proxy
│   ├── types.ts, constants.ts, styles.css
├── tools/
│   ├── new-module.mjs         # scaffolder
│   ├── module-template/       # what it copies
│   └── build-snapshot.py
├── server/                    # Express API, auth, Cosmos and file stores
├── infra/                     # Azure provisioning, Entra app roles, deploy, seed
├── pwa/service-worker.js
├── public/                    # manifest and icons
├── SampleArchitecture/        # Thrive Financial reference documents
└── verify/                    # browser harness used during the original port
```

---

## Decision notes, hotspots and future work

### Decisions

- **Module-scoped micro-UI in one build, not runtime micro-frontends.** Modules are folders compiled into one app and split into lazy chunks. This gives independent development, testing, loading and fault isolation without a module federation runtime, duplicated React copies or cross-origin plumbing. It is Thrive's choice, made enforceable.
- **Hash routing with module-owned params, not React Router.** The app is served from relative bases (file shares, App Service, sub-paths). The hash survives all of them, and module-owned params remove the central route table.
- **One platform context, not a global store.** Shared state is small and owned by the provider; module state stays local. This avoids the central-store coupling Thrive flags as its main hotspot.
- **Access features declared by modules.** Plugging a module in brings its access controls with it; nothing else is edited.
- **Strict registry in development, forgiving in production.** Mistakes are loud at the desk and contained in the field.

### Hotspots

- `src/platform/PlatformProvider.tsx` and `context.ts` are shared by every module. Treat changes as API changes, and run the contract test.
- `src/sdk/index.ts`: each export is a promise to every module.
- `src/hooks/useTracker.ts` owns every mutation and the conflict, import and export flows.
- `src/styles.css` is global. New modules should scope their styles under a module-specific class prefix; the existing styles are the shared design layer.
- The `@sdk` alias is defined in three places (`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`); keep them in step.

### Future work

- **Runtime remote modules.** For modules deployed independently of the host, load `manifest.load` from a remote URL (import maps or Module Federation) with React shared as a singleton. The contract already isolates modules behind `load()` and `@sdk`, so this is a loader change, not a module change.
- **Hard isolation for untrusted code**: iframe-hosted modules with a postMessage bridge implementing the platform API.
- **Per-module CSS** (CSS modules or a `.mod-<id>` scope) once styles are split from `styles.css`.
- **Telemetry sink**: forward `onModuleFault` to Application Insights.
- **Playwright end-to-end tests** in CI for the shell and each module (the headless Edge check above was manual).
- Server-side per-record authorization if views must hide data, not just pages.

---

This project is for internal Savant use and operational portfolio governance. Before exposing it beyond a controlled network, review the deployment scripts and roles. Local mode is for development only; do not leave a local server reachable without permissions.
