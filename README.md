# Savant Strategic Initiatives Tracker (WiseTrack)

## Executive summary

The Savant Strategic Initiatives Tracker is a portfolio and initiative management application for strategic pillars, initiatives and projects. It gives leadership and delivery teams one place to see health, ownership, risks, milestones, decisions and issues.

- **What it is.** A React and TypeScript single-page app with a small Express API. Production runs on Azure App Service behind Microsoft Entra sign-in, with Azure Cosmos DB for data.
- **Where the data comes from.** monday.com is the source of truth for project fields and for the pillar, initiative and project structure. The tracker pulls from monday.com on demand and on a schedule. Nothing flows back to monday.com.
- **How it is built.** A **micro-UI module architecture**. A base framework (`src/platform`) provides the shell, storage, identity, access, routing and shared filters. Every page is a module (`src/modules/<id>`) that plugs in with one line, loads on first visit, and runs in its own sandbox. Modules reach the framework only through one import surface, the SDK (`@sdk`). Architecture tests fail the build if a module reaches anywhere else.
- **Who uses it.** Four roles: Admin, Editor, Executive and Viewer, assigned through Microsoft Entra groups.
- **Where to read next.** Using the tracker: [User Guide.md](User%20Guide.md), or the **Help** page inside the app. Releasing to Azure with exact steps for people new to Azure: [docs/DEPLOYMENT-RUNBOOK.md](docs/DEPLOYMENT-RUNBOOK.md).

The architecture follows the lead of Thrive Financial's module-scoped micro-UI (see [SampleArchitecture/](SampleArchitecture/)) and tightens the parts Thrive's own documents call out as hotspots. It is meant to be reused as a template; see [Applying this architecture to a new application](#applying-this-architecture-to-a-new-application).

---

## Contents

1. [Quick start](#quick-start)
2. [What the application does](#what-the-application-does)
3. [Architecture](#architecture)
4. [Developer workflows](#workflows)
5. [Applying this architecture to a new application](#applying-this-architecture-to-a-new-application)
6. [Data, storage and API](#data-storage-and-api)
7. [Authentication, roles and access](#authentication-roles-and-access)
8. [monday.com integration](#mondaycom-integration)
9. [Azure: architecture and configuration](#azure-architecture-and-configuration)
10. [Deploying and operating](#deploying-and-operating)
11. [Sharing a local copy](#sharing-a-local-copy)
12. [Installable app (PWA)](#installable-app-pwa)
13. [Testing](#testing)
14. [Project structure](#project-structure)
15. [Decision notes, hotspots and future work](#decision-notes-hotspots-and-future-work)

---

## Quick start

```bash
npm install
npm run dev            # the app, http://localhost:5173 (IndexedDB storage, test sign-in)
npm run dev:module     # the module workbench: one module, in-memory data, no shell
npm test               # full Vitest suite, including the architecture tests
npm run build          # typecheck + production build to dist/
npm run start:local    # the real server on this machine, data in a local JSON file
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
| `npm run start` / `start:local` | Express server: production, or local with file-backed storage and no sign-in |
| `npm run seed` | Seed Cosmos from the bundled snapshot |
| `npm run monday:test` | Check a monday token and workspace (needs `MONDAY_API_TOKEN`, `MONDAY_WORKSPACE_ID`) |
| `npm run monday:capture` | Save the live monday workspace to `monday-capture.json` |
| `npm run sync:monday -- --file=<capture> [--apply]` | Replay a capture into the local server's data file |

Local sign-in for testing: username `savant`, password `sw2026`, then pick a role. Local mode is for development only.

---

## What the application does

The tracker models strategic initiative governance:

- **Pillars** are top-level strategic themes. **Initiatives** are programs within a pillar. **Projects** are delivery efforts within an initiative.
- **Project health**: RAG status (On track, At risk, Off track), trend, phase, validation, progress, schedule dates, milestones, owners, scope, dependencies, key risk, decisions and issues.
- **Change log**: every field edit with the previous and new value. Editors can restore an earlier value.
- **Import and export**: the whole tracker as one JSON app file, plus spreadsheet reports.
- **Conflict handling**: field-level detection when two people edit the same project. The editor chooses mine or theirs.
- **monday.com sync**: pulls project fields and structure from monday.com. See [monday.com integration](#mondaycom-integration).

### Modules

| Module | Route | Rail | What it does |
| --- | --- | --- | --- |
| [Portfolio](src/modules/portfolio/README.md) | `#/portfolio?layout=…&pillar=…&initiative=…` | 10 | Ledger, heat map, leadership brief, pillar pace. Add, edit and delete pillars, initiatives and projects. |
| [Board](src/modules/board/README.md) | `#/board?layout=status` | 20 | Cards by phase or status. Drag to change. |
| [Timeline](src/modules/timeline/README.md) | `#/timeline` | 30 | Twelve-month window with bars, milestones and a today line. |
| [My work](src/modules/work/README.md) | `#/work?person=…` | 40 | Decisions, issues and milestones you own, with in-place actions. |
| [Workload](src/modules/workload/README.md) | `#/workload?layout=pm-heatmap` | 50 | Everyone's projects by status and role. PM heat map. |
| [Admin](src/modules/admin/README.md) | `#/admin` | 60 | PMO upkeep: stale projects, decisions, recent activity, monday.com sync. |
| [Access](src/modules/access/README.md) | `#/access` | 70 | Who sees which views and reports (admins only). |
| [Settings](src/modules/settings/README.md) | `#/settings` | 80 | Stale threshold, theme, install and update, import and export. |
| [Help](src/modules/help/README.md) | `#/help?tab=…&role=…` | 90 | Start here, workflows for each role, FAQ and glossary. Content lives in one data file. |
| [Project](src/modules/project/README.md) | `#/project/<id>` | link | Status report and editor for one project. |
| [One-pager](src/modules/onepager/README.md) | `#/onepager?pillar=…` | link | Printable pillar one-pager. |

**The top bar** (platform) shows:

- the **monday data as of** time, when a monday sync has run (amber when old or failed),
- portfolio status counts, each a colored dot with a number. Click one to filter. When the window is too narrow for the label ("On track", "At risk", "Off track"), the dot and number stay,
- the omnibox search (press `/`), the theme toggle and the account menu (export, change log, role testing, sign out).

A `LOCAL` badge appears whenever the app is not behind Entra sign-in. A `View only` badge appears for roles that cannot edit.

**Filters are shared.** The status, stale and decision chips and the omnibox narrow every module with `usesFilters` (Portfolio, Board, Timeline) and stay applied as you move between them.

**"My work" means you.** The signed-in name is matched against the free-text owner fields. Without a match, the page asks which owner you are and remembers it in that browser. People are derived, not stored: `lib/people.ts` pulls names out of owner prose and folds obvious duplicates.

**Every page deep-links** through the URL hash, so the back button and shared links work on any host.

### Roles and default access

Admin sees everything. For other roles, each view is a feature that modules declare in their manifests. These are the defaults. An Admin changes them on the Access page.

| View or action | Admin | Editor | Executive | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Portfolio ledger, initiative heat map | yes | yes | yes | yes |
| Leadership brief, pillar pace (and the one-pager) | yes | yes | yes | no |
| Board, Timeline, Settings, Help | yes | yes | yes | yes |
| Workload and PM heat map | yes | yes | yes | no |
| My work | yes | yes | no | no |
| Admin page | yes | yes | no | no |
| Access page | yes | no | no | no |
| Edit projects, initiatives, pillars | yes | yes | no | no |
| Run or schedule the monday sync, restore backups | yes | no | no | no |

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

## Data, storage and API

### Layers

```text
Module → usePlatform().tracker → useTracker → TrackerRepository → StorageProxy
       → IndexedDbAdapter | MemoryAdapter | RestAdapter → (Express → Cosmos DB)
```

Tracker data is a small set of versioned documents: `tracker.state`, `tracker.log`, `tracker.settings` and `tracker.access`. The server adds the monday.com documents described below.

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

**monday.com.** The sync's own documents are `tracker.sync` (last run, readable by everyone for the "monday data as of" line), `tracker.syncconfig` (pull interval), `tracker.pillarorder` and `tracker.backup.*`. All are admin-write-only. See [monday.com integration](#mondaycom-integration).

**Dataset refresh prompt (IndexedDB only).** The monday.com data ships inside each build as `src/data/snapshot.json`. When a build carries a monday dataset (`source` starting `monday-sync`) that this browser has not taken yet, the app asks on load: replace the local data (a backup downloads first), keep it (stops asking about that dataset), or ask later. The browser remembers its dataset in `localStorage` (`savant-tracker:dataset`). Edits made after taking a dataset never trigger the prompt; only a newer dataset does. Shared backends (REST/Cosmos) never prompt.

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
| `POST /api/admin/sync/schedule` | Admin: set the automatic pull interval (0, or 5 to 1440 minutes) |
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

monday.com settings (`MONDAY_*`) are listed in [monday.com integration](#mondaycom-integration). In Azure, never store database keys in the app; production uses managed identity and App Service Easy Auth.

---

## Authentication, roles and access

### One build, three environments

The app asks the server at start-up (`GET /api/me`) whether real sign-in stands behind it. The same build then behaves correctly everywhere, with no rebuild:

| Where | Sign-in | Roles | monday data |
| --- | --- | --- | --- |
| Browser only (`npm run dev`, a static host) | Test sign-in screen | Pick one at sign-in | Capture file or the bundled sample, replayed in the browser |
| Local server (`npm run start:local`) | Test sign-in screen | Pick one at sign-in | Same, or live if a token is set |
| Azure | Microsoft Entra, no password screen | Assigned in Entra | Live with the service account, or an uploaded capture |

Any failure of the probe falls back to the test sign-in. That is safe, because the API enforces roles on its own. To force a mode, set `VITE_AUTH_MODE=local` or `entra` at build time.

### Production (Azure)

Microsoft Entra ID through App Service Easy Auth, enforced before any request reaches the app. Easy Auth passes the signed-in user to the server in the `X-MS-CLIENT-PRINCIPAL` header ([server/auth.js](server/auth.js)), and strips any copy a browser sends.

- Four app roles, defined in [infra/app-roles.json](infra/app-roles.json): `Tracker.Admin`, `Tracker.Editor`, `Tracker.Executive`, `Tracker.Viewer`.
- Read access goes to all four. Write access goes to Admin and Editor.
- The enterprise application has **Assignment required** on, so a person with no role never reaches the app.
- A person who signs in with no role sees a "no role" page, not a broken app.
- Roles are assigned to **security groups**, not to individuals: `SG-Tracker-Admins`, `SG-Tracker-Editors`, `SG-Tracker-Executives`, `SG-Tracker-Viewers`. **Membership is managed in Microsoft Entra, never in the app.** To change someone's role, change their group. The change takes effect at their next sign-in.
- The server refuses to start with `REQUIRE_AUTH=false` when `NODE_ENV=production`.

### Access policy

The access policy (`tracker.access`) decides which roles see which **features** and **reports**. It controls what the interface offers. It does not change who holds a role.

- **Features are declared by modules** in their manifests and assembled by the registry into the catalogue the Access page edits. A layout feature (`portfolio.brief`) also needs its parent (`portfolio`).
- A feature missing from the stored policy uses the module's `defaultRoles`. A stored grant for a feature this build does not include is kept, not dropped.
- Admin always sees everything, and the Access module is `adminOnly`, so no policy edit can lock admins out.
- A report that opens from a view (the one-pager, from the leadership brief) declares `requiresFeature` in the report catalogue.

Every role with access can still read the shared tracker data through the API. Per-record restriction would need server-side filtering.

### Local development

Without a Cosmos endpoint the server runs in local mode with no real sign-in. The app acts as the role picked on the test sign-in screen (editor if none) and sends it in `x-tracker-dev-role`, which the server honours only while sign-in is off. The server refuses `NODE_ENV=production` without `COSMOS_ENDPOINT`.

---

## monday.com integration

monday.com is the source of truth for project fields. The tracker pulls them in. Nothing flows back to monday.com.

### What syncs

| monday.com | Tracker |
| --- | --- |
| Top-level folder | Pillar |
| Sub-folder | Initiative |
| Board with the project columns, group "Projects" | Project register |
| One row | One project |

monday.com also owns the structure. A renamed folder renames the linked pillar or initiative. A new folder becomes a pillar or initiative at the next sync once it holds a project board. A folder with no project board is not pulled.

monday.com owns these 17 fields on every linked project: Business Owner, Delivery Owner, Project Manager, Scope, RAG Status, Trend, Phase, Validation, Project Progress, Start Date, Original End Date, Forecast End Date, Key Risk / Blocker, Dependencies, Decision Needed, Next Milestone, Next Milestone Date. The tracker keeps issues, decision outcome and plan link.

Rules the sync follows:

- A blank value in monday.com never erases a value in the tracker.
- Running it twice changes nothing the second time.
- Rows named "Rename" or "test" are ignored (`MONDAY_IGNORE_TITLES`).
- Boards are matched by column **title**, not column id. Renaming a monday column stops that field syncing. The preview warns "no column for …".
- Every change shows in the change log as "monday sync".
- Pillars sort by their "Pillar N:" number, then monday folder order, then tracker-only pillars. An admin can override the order from Portfolio (Reorder). It lives in `tracker.pillarorder` and "Use monday order" removes it.

### Field lock

While the server pulls live, the 17 synced fields on linked projects are read-only in the tracker, and so are linked pillars, initiatives and projects (no rename, move, delete, or add). The browser hides the buttons and says "Managed in monday.com". The server enforces it too: a write that changes a locked value gets a 403 with the reason (`server/monday/lock.js`, applied in `server/app.js`). The sync writes straight to the store, so it is not blocked. Records created in the tracker before the connection have no monday link and stay editable until an admin retires them. With no token (test mode) nothing is locked.

### Configure monday.com (once)

Use a service account. A personal token stops working when its owner changes jobs.

1. Ask IT for a Microsoft account for the sync, for example `svc-monday-tracker@savantwealth.com`. monday.com signs in through Entra, so the account needs that identity.
2. Add it to monday.com as a **Member**. An admin seat is not needed.
3. Add it to the workspace **Savant Strategic Initiatives** (id `17893919`). Add it to the workspace, not to single boards. The sync reads the folder tree and every project board in it (about 35 boards).
4. Sign in once as that account so it is active.
5. As that account: profile picture, **Developers**, **My access tokens** (or **API token**), copy the token. Regenerating it breaks the old one.
6. Test it from a laptop:

```powershell
$env:MONDAY_API_TOKEN = Read-Host "Token"
$env:MONDAY_WORKSPACE_ID = "17893919"
npm run monday:test
```

Expect `OK. Signed in as <service account>, workspace "Savant Strategic Initiatives".` If monday.com restricts API access by IP, allow the app's outbound IP (see [Outbound access](#outbound-access-to-mondaycom)). If IT deactivates the account, the sync stops, so tell IT it is in use.

Store the token only in Azure Key Vault, through `infra/monday-setup.sh`. Never in email, chat or a repository.

### Configure Azure for monday.com

`infra/monday-setup.sh` (Azure Cloud Shell, Bash) does all of this. It is safe to re-run.

- Creates a Key Vault (RBAC mode) and stores the token as the secret `monday-api-token`.
- Gives the web app's managed identity **Key Vault Secrets User** on that secret and nothing else.
- Adds a private endpoint and private DNS for the vault.
- Sets the app settings below, with the token as a Key Vault reference.
- Turns off the vault's public access and restarts the app.

| Setting | Value |
| --- | --- |
| `MONDAY_API_TOKEN` | Key Vault reference to `monday-api-token` |
| `MONDAY_WORKSPACE_ID` | `17893919` |
| `MONDAY_SYNC_INTERVAL_MINUTES` | `0` (timer off) until an admin turns it on in the app |

Variants: `./infra/monday-setup.sh --rotate-token` replaces the token, `--add-nat` fixes outbound access, and `MODE=appsetting ./infra/monday-setup.sh` stores the token as an app setting when Key Vault is not allowed. If the environment uses custom resource names, set `VNET`, `SUBNET_APP`, `SUBNET_PE` and `KEYVAULT` before running.

#### Outbound access to monday.com

`provision.sh` sends all outbound traffic through the virtual network, and many tenants block internet access from new subnets. If **Test connection** says it cannot reach monday.com, run `./infra/monday-setup.sh --add-nat`. It adds a NAT gateway with a fixed public IP and prints it. Allow that IP in monday.com if your account restricts API access.

#### Replace the token

Regenerate it in monday.com, then have someone with Azure access run `./infra/monday-setup.sh --rotate-token` and paste the new token at the prompt. The script opens the vault briefly, writes the secret, closes the vault and restarts the app. Test with **Open sync, Test connection**. Do not regenerate the token again unless needed: each regeneration breaks the app until the vault is updated.

### Using the sync (admins)

1. Open **Admin**. The monday.com card says **Live** when the token works, **Test mode** when it does not.
2. Click **Open sync**, then **Test connection**. You should see the service account name and the workspace.
3. Source: **monday.com (live)**. Click **Preview**. Read the counts and warnings. Preview saves nothing.
4. Click **Apply**. Check the change log for "monday sync" lines.

**Remove records monday.com does not have** (after the first sync, and any time items are deleted, renamed or re-created in monday): a pull adds and updates but never deletes. A deleted item stays in the tracker with the warning "no longer on its monday board". A re-created item has a new monday ID, so it arrives as a new project and the old one remains until removed, which shows the project twice. To clean up: Preview with the option ticked, read **To remove**, tick the box under the list, Apply. The approval code is tied to that exact list, and a full backup is saved first. Issues, plan links and decision outcomes on a removed project move to the project with the same title, if one exists. A rename in monday changes the title, so those do not move: copy them over before you remove. Restore from **Backups** in the same dialog.

**Capture files** are a manual fallback and the way to test without a token. Choose **A capture file** or the bundled sample in the dialog. `npm run monday:capture` makes one from live monday.com. A capture holds real project data, so keep it internal (it is ignored by git).

### Automatic pulls

An admin opens **Open sync**, picks **Automatic pulls** (5 minutes to once a day, or Off) and saves. It applies to everyone within a minute, with no restart and no Azure setting.

- Every minute the server checks whether the interval has passed since the last run.
- It asks monday.com for the folder layout and each board's last-changed time (one small request per 25 boards). If nothing changed, it stops and only moves the "as of" time.
- If something changed, it reads the boards and merges. Only changed values are written.
- It does a full read at least once an hour as a safety net.
- It never removes records. Removal always needs a person and an approval code.
- A failed run shows in the top bar for everyone and the reason shows on the Admin card.
- `MONDAY_SYNC_INTERVAL_MINUTES` is the starting value. Once an admin saves a choice in the app, the app setting wins. Keep one web app instance, because each instance would pull.

### Reference

| Setting | Default | Meaning |
| --- | --- | --- |
| `MONDAY_API_TOKEN` | none | Service account token. Turns on live mode. |
| `MONDAY_WORKSPACE_ID` | none | Workspace to read. Required for live mode. |
| `MONDAY_SYNC_INTERVAL_MINUTES` | `0` | Starting value for the timer. `0` is off, minimum `5`. |
| `MONDAY_ACCOUNT_URL` | none | Your monday address, for example `https://savantwealth.monday.com`. Turns on **Open in monday**. |
| `MONDAY_PROJECT_GROUP` | `Projects` | Group name that holds project rows. |
| `MONDAY_IGNORE_TITLES` | `Rename,test` | Row names to skip, comma separated. |
| `MONDAY_PILLAR_MAP` | none | JSON map from a monday pillar folder name to a tracker pillar id. |
| `MONDAY_API_VERSION` | `2026-04` | monday.com API version. |

Admin-only routes: `GET /api/admin/sync/status`, `POST …/test`, `…/monday` (live pull), `…/upload` (replay a capture), `…/schedule` (`{ "intervalMinutes": 0 }` or 5 to 1440), `…/capture`, `GET …/backups`, `POST …/restore`. All are a dry run unless `apply` is `true`.

Code: `server/monday/` (the sync, plain JavaScript shared with the browser; `service.js` is the one object the API, timer and command line use), `src/data/mondaySync.ts` (browser side), `src/modules/admin/MondaySync.tsx` (the Admin card and dialog).

### When something breaks

| You see | Cause | Fix |
| --- | --- | --- |
| Card says **Test mode** in Azure | No token, or the vault reference did not resolve | Web app, Environment variables, check the status beside `MONDAY_API_TOKEN`. The app identity needs **Key Vault Secrets User**. |
| Card says **Live, unreachable** | monday.com did not answer the last check | Use a capture file until it is back. The check repeats at most once a minute. |
| `monday rejected the token` | Token wrong or account inactive | `--rotate-token`. Ask IT if the account is active. |
| `workspace … is not visible` | Service account is not in the workspace | Add it in monday.com. |
| `Cannot reach monday.com` | Outbound blocked | `./infra/monday-setup.sh --add-nat` |
| `Retiring needs approval` | You skipped Preview or the list changed | Preview again, review, apply. |
| `The tracker changed while syncing` | Someone saved at the same moment | Run it again. |
| 403 on the sync | You are not an Admin | Ask for the Tracker.Admin role. |
| A field stops updating | The monday column was renamed | Rename it back. |
| Projects show green RAG | The monday RAG is unset | Set it in monday.com. A blank is not copied. |
| Edit refused: "comes from monday.com" | The field lock | Edit it in monday.com. |

---

## Azure: architecture and configuration

```text
Savant network (office or VPN)
        │  private IP, no public route (after lockdown)
        ▼
┌─────────────────────────────────────────┐
│ App Service (Linux, Node 22)            │  serves the React app and the API
│  Easy Auth: Microsoft Entra sign-in     │  checks every request first
│  Managed identity: the app's own account│  no passwords or keys
└───────┬───────────────────────┬─────────┘
        │ private endpoint      │ private endpoint
        ▼                       ▼
┌───────────────────┐   ┌──────────────────────────┐
│ Cosmos DB         │   │ Key Vault                │
│ serverless, keys  │   │ monday API token         │
│ disabled          │   │ (RBAC, no access policy) │
└───────────────────┘   └──────────────────────────┘
        outbound to https://api.monday.com through the virtual network (NAT gateway if needed)
```

### What exists today

Built by Frank in September 2026 with `infra/provision.sh`. Frank's resource names use "owlplan". It is the same tracker.

| Item | Value |
| --- | --- |
| Subscription | Savant Business Intelligence, `c27a3bfa-07bb-42e3-b309-4372a9123682` |
| Resource group | `SWM-OWLPLAN-EASTUS2` (East US 2) |
| Web app | `app-owlplan`, plan `plan-owlplan` (B1, Linux, one instance) |
| Site | https://app-owlplan.azurewebsites.net |
| Database | Cosmos DB account `cosmos-owlplan-swm`, database `tracker`, container `documents` |
| Entra app registration | "Savant Strategic Initiatives Tracker", client id `b82a674c-6616-45f5-9aeb-76d91a95b347`, single tenant `27c3235e-3626-4e2f-bfc0-01bed21535f2` |
| Sign-in redirect | `https://app-owlplan.azurewebsites.net/.auth/login/aad/callback` |
| Client secret | In the app setting `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET`. **Expires 5 November 2028.** Put the date in a shared calendar. |
| Groups | `SG-Tracker-Admins`, `SG-Tracker-Editors`, `SG-Tracker-Executives`, `SG-Tracker-Viewers`, each assigned to its matching app role on the enterprise application |
| Key Vault | Created by `monday-setup.sh`. Record its name here: ______ |

Verified on 9 November 2026: the web app's Authentication is enabled, requires authentication, and redirects unauthenticated requests to Microsoft. The app registration has all four roles, the groups are assigned, and **Assignment required** is on.

### App settings (web app, Environment variables)

| Setting | Purpose |
| --- | --- |
| `COSMOS_ENDPOINT`, `COSMOS_DATABASE`, `COSMOS_CONTAINER` | The database. Access is by managed identity, with no key. |
| `NODE_ENV=production`, `REQUIRE_AUTH=true` | Production mode. The server refuses to start without sign-in. |
| `SCM_DO_BUILD_DURING_DEPLOYMENT=false` | Azure must not build. The package arrives built. |
| `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` | The Entra client secret. Leave it alone. |
| `MONDAY_API_TOKEN` (Key Vault reference), `MONDAY_WORKSPACE_ID`, `MONDAY_SYNC_INTERVAL_MINUTES`, `MONDAY_ACCOUNT_URL` | monday.com. See [monday.com integration](#mondaycom-integration). |

Startup command: `node server/index.js`.

### Security design

- **No public route.** After `infra/lockdown.sh` the site and the deploy endpoint are reachable only from the Savant network or VPN. `./infra/lockdown.sh --undo` reverses it.
- **No database password.** The app proves who it is with its managed identity, and Cosmos grants that identity data access (role `00000000-0000-0000-0000-000000000002`). That grant does not show in the portal's IAM blade, which makes it look missing when it is not.
- **Trusting a header is safe only here.** Easy Auth validates the Entra token and strips any browser-sent copy of `X-MS-CLIENT-PRINCIPAL`. That protection holds while all traffic goes through Easy Auth. Do not turn Easy Auth off or expose the container directly.
- **Secrets stay in Azure.** The monday.com token lives in Key Vault. Nothing sensitive is in the repository or in a build.
- **Backups.** Cosmos keeps continuous backup with 7-day point-in-time restore. That covers an accidental delete. The change log and exported app files cover a wrong edit. Export a backup monthly.
- **One instance.** B1 has no redundancy and no deployment slot. A deploy restarts the app and drops connections for a few seconds. If leadership depends on it, a P1v3 plan (about $124 a month) adds slots and a better SLA, and changing the plan is a setting, not a rebuild.

### Cost

Roughly **$28 a month** (US East 2, list price): App Service B1 about $13, two private endpoints about $14, Cosmos serverless under $1, Entra sign-in included in existing licensing. A NAT gateway, if needed, adds a few dollars. Check the Azure pricing calculator for current numbers.

### Who does what

| Task | Who | Permission needed |
| --- | --- | --- |
| Create the Azure resources (`provision.sh`) | Azure administrator | Owner, or Contributor plus User Access Administrator |
| Create the Entra registration and roles (`entra-app.sh`) | Identity administrator | Application Administrator, plus Contributor on the web app |
| Group membership (who holds which role) | Group owners | Owner of the `SG-Tracker-*` groups |
| monday.com service account | monday.com admin and IT | monday admin, and an Entra account |
| Key Vault and token (`monday-setup.sh`) | Azure administrator | Key Vault Secrets Officer on the vault, Contributor on the resource group |
| Deploy a release | Release owner | Contributor on the resource group (activate it in Privileged Identity Management if it is eligible), on the VPN |

### Things that fail, and why

| You see | Cause | Fix |
| --- | --- | --- |
| "Application Error" | The app failed to start | `az webapp log tail -g <rg> -n <app>`. Check `COSMOS_ENDPOINT` and a server syntax error. |
| Page loads, "cannot reach the database" | `/api/health` returns 503 | The managed identity lacks the Cosmos role, VNet integration did not attach, or private DNS is wrong (`nslookup <cosmos>.documents.azure.com` should return a private `10.x` address). |
| Sign-in loops, `AADSTS50011` | Redirect URI mismatch | It must be exactly the redirect URI in the table above. |
| "no role" page | Person is in no `SG-Tracker-*` group, or signed in before being added | Add them to a group, then sign out and in. |
| Everyone is view-only | A group is assigned to the wrong role | Enterprise applications, Users and groups, check the Role column. |
| Sign-in stopped after two years | The client secret expired | Re-run `./infra/entra-app.sh`. It makes a new secret and updates the app setting. |
| Nobody can reach the site after lockdown | The network path is missing | `./infra/lockdown.sh --undo`, then fix VPN and DNS. |
| Deploy fails with `tsc: not found` | Azure tried to build | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. |

---

## Deploying and operating

For exact click-by-click steps written for someone new to Azure, use [docs/DEPLOYMENT-RUNBOOK.md](docs/DEPLOYMENT-RUNBOOK.md). This section is the overview.

### First-time environment (already done for `app-owlplan`)

| Step | Command | Who |
| --- | --- | --- |
| 1 | `./infra/provision.sh` (resources, identity, private endpoints) | Azure administrator |
| 2 | `./infra/entra-app.sh`, then create the four groups and assign each to its role | Identity administrator |
| 3 | `./infra/monday-setup.sh` (Key Vault, token, settings) | Azure administrator |
| 4 | `.\infra\deploy.ps1` (Windows) or `./infra/deploy.sh` | Release owner |
| 5 | `npm run seed` (first time only, loads the bundled data) | Release owner |
| 6 | Sign in as Admin, run the first monday sync | Release owner |
| 7 | `./infra/lockdown.sh` (private site) | Azure administrator |

Run step 3 before step 7, because after lockdown Cloud Shell can no longer reach the vault. Use `--rotate-token` later.

### Release a new version

1. Start from clean, committed code: `git status` shows nothing to commit.
2. `npm test` and `npm run build` must pass.
3. Connect to the VPN and sign in: `az login`. Activate Contributor in Privileged Identity Management if it is an eligible role.
4. Tag the release (`git tag v1.2.0`) and push.
5. Deploy:

```powershell
$env:RESOURCE_GROUP = "SWM-OWLPLAN-EASTUS2"
$env:WEBAPP         = "app-owlplan"
.\infra\deploy.ps1
```

`infra/deploy.ps1` runs seven steps and stops on the first failure: check the working copy, `npm ci`, a syntax check of every server file, tests (skip only with `-SkipTests` for an emergency re-deploy), build, package (dist, server and **production** `node_modules` in one zip), and `az webapp deploy` with `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. Azure does not build. Letting it build fails with `tsc: not found`. `infra/deploy.sh` is the same for Bash.

6. Watch it start: `az webapp log tail -g SWM-OWLPLAN-EASTUS2 -n app-owlplan` and wait for "Site startup probe succeeded". The restart takes 1 to 2 minutes.
7. Check: open the site and sign in, open the account menu (name and role show), open `/api/health` (it should return a success response), and as Admin open **Admin, monday sync, Test connection**.

Open tabs show "A new version is available · Reload" and pick up the release without a forced reload.

### Roll back

Redeploy the previous tag's package (check out the tag, run `deploy.ps1`). A release changes code only, so the database is untouched. To undo data, restore an app-file backup in **Settings, Data** or a sync backup in **Open sync, Backups**.

### Azure DevOps

The repository moves from GitHub to an Azure DevOps (ADO) Git repo. Protect `main` with a branch policy (pull request and one reviewer). A pipeline can then build, test and deploy through a service connection (workload identity federation, no stored secret) with an approval gate on a `tracker-prod` environment. After lockdown the deploy endpoint is private, so the pipeline needs a self-hosted agent on the VNet. The runbook has the steps and a pipeline YAML. The manual `deploy.ps1` route above works without ADO.

### Routine upkeep

- **Client secret:** expires 5 November 2028. Calendar it. Renewal is one `entra-app.sh` run.
- **monday.com token:** rotate with `monday-setup.sh --rotate-token` when the service account changes.
- **Node runtime:** the portal warns when the Node version nears end of life. Update the runtime stack on the web app and the `engines` field in `package.json` together, and test first.
- **Group membership:** managed in Entra by the group owners.
- **Backups:** export an app file monthly from **Settings, Data**.

---

## Sharing a local copy

`npm run dev` is the wrong thing to share. Its data lives in each person's browser, so a colleague gets a separate, empty copy that never sees your edits. Use the real server instead:

```powershell
npm install
npm run build
npm run start:local
```

It prints a `localhost` address and a network address, and stores data in one JSON file, so everyone pointed at your machine edits the same tracker. Find your IPv4 address with `ipconfig`. Then, in PowerShell as administrator, open one port for the corporate network only:

```powershell
New-NetFirewallRule -DisplayName "Savant Tracker 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Profile Domain -Action Allow
```

Send `http://<your-ip>:8080` to colleagues on the Savant network or VPN, and keep the terminal open. Remove the rule when done: `Remove-NetFirewallRule -DisplayName "Savant Tracker 8080"`.

- There is **no sign-in** in this mode. Everyone is an editor. Ask people to set their real name, which is what the change log records.
- **Never** use ngrok, Cloudflare Tunnel, VS Code port forwarding or similar to put this on the internet. It would publish strategic data with no authentication.
- A laptop is a demo, not a system. Export a copy the same day if anyone starts relying on it, and use the Azure site instead.
- If a colleague cannot connect: confirm the terminal is still running, check `ping <your-ip>` (corporate wifi often blocks machine-to-machine traffic, and wired usually works), and check the firewall rule with `Get-NetFirewallRule -DisplayName "Savant Tracker 8080"`.

---

## Installable app (PWA)

The production build is a Progressive Web App (Edge or Chrome **Install app**; iOS Share → Add to Home Screen).

| Piece | Where | Notes |
| --- | --- | --- |
| Manifest and icons | `public/manifest.webmanifest`, `public/icons/` | Linked with `crossorigin="use-credentials"` so Easy Auth doesn't redirect the manifest request |
| Service worker | `pwa/service-worker.js` → `dist/sw.js` | Emitted by the `serviceWorker` plugin in `vite.config.ts` with the precache list (including every module chunk) and a content hash |
| Registration and updates | `src/hooks/usePwa.ts` | Production builds only, over HTTPS or localhost |

`/api/*` and `/.auth/*` are never cached. Pages load network-first; hashed assets come from cache. An open window checks for a new deploy every 30 minutes and on focus, and offers **Reload**; it never reloads by itself. If a module chunk from an old build is gone, the module sandbox does one guarded reload. One shared `EventSource` per tab keeps within the browser's six connections per host. To share the installed app, send the URL. For people without access to the Azure site, see [Sharing a local copy](#sharing-a-local-copy).

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
| `src/modules/help/help.test.tsx` | The Help page renders for every role, and its content is complete |
| `server/server.test.js`, `server/sync-routes.test.js`, `server/monday/*.test.js` | API authentication and authorization, the sync routes, the sync service and scheduler |

Run `npm test`, `npm run typecheck` and `npm run build` before every release. `infra/deploy.ps1` runs them for you.

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
│   └── build-snapshot.py      # legacy: artifact export -> snapshot; refuses to overwrite monday data without --force
├── server/                    # Express API, auth, Cosmos and file stores
├── infra/                     # provision, entra-app, monday-setup, lockdown, deploy (.ps1 and .sh), app roles, seed
├── docs/                      # DEPLOYMENT-RUNBOOK.md (step by step) and PMO-ACTION-PLAN.md
├── pwa/service-worker.js
├── public/                    # manifest and icons
├── SampleArchitecture/        # Thrive Financial reference documents
├── README.md                  # this file: architecture, configuration, deployment
├── User Guide.md              # how to use the tracker, by role
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
