# Portfolio module

The landing page: every pillar, initiative and project, in four layouts. Editors add, edit and delete pillars, initiatives and projects here.

| | |
| --- | --- |
| Route | `#/portfolio?layout=heatmap\|brief\|pace&pillar=<id>&initiative=<id>`; ledger is the default |
| Rail | Yes, position 10 |
| Access | `portfolio` (everyone) gates the ledger. `portfolio.heatmap` (everyone), `portfolio.brief` and `portfolio.pace` (admin, editor, executive) gate their layouts and need `portfolio` too |
| Shared filters | Yes (`usesFilters`): status, stale and search chips narrow the ledger |

## Files

- `manifest.ts`: the plug. Declares the four features; `requires` picks one by layout.
- `routes.ts`: parses `layout`, and maps a layout to its feature. Used by the manifest and the views.
- `entry.tsx`: lazy entry; URL → `PortfolioView` props.
- `PortfolioView.tsx`: layout switcher, ledger, heatmap and leadership brief.
- `PaceView.tsx`, `PaceMap.tsx`: the pillar pace layout and its scatter map.
- `forms.tsx`: new and edit forms for pillars, initiatives and projects.

## Uses from the platform

`tracker` (state, settings, add/update/delete for pillars, initiatives and projects), `filters`/`setFilters`/`matches`/`filtering`, `can`, `canReport`, `canWrite`, `ask`, `navigate`, `openProject`.

## Links out

- `onepager` (Print one-pager from the leadership brief).
- `project` via `openProject`.
