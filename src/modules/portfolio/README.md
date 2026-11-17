# Portfolio module

The landing page: every pillar, initiative and project, in four layouts.

- **Create (Admins).** **+** on the Pillars card, **+ Initiative** beside a pillar, **+ Add project** inside an initiative (`isAdmin`). While the monday.com sync is live (`mondayLive`), `actions.addPillar` / `addInitiative` / `addProject` go through the server, which creates the record in monday.com first and saves it already linked (README, Write-back).
- **Edit (Admins and Editors).** The pencil beside a pillar edits its name and owner. **Edit initiative** edits the name, pillar, scope statement, business owner, delivery owner and start and end quarter (`canWrite`). On a record **Linked to monday.com**, a new name or pillar goes to monday.com first; the other fields are stored in the tracker. The pillar picker offers only linked pillars for a linked initiative.
- **Delete.** Only records not linked to monday.com (`structureLocked`).
- Forms wait for the save: **Saving…**, close on success, stay open with a toast on failure.
- The expanded initiative shows its **Scope statement** above its projects.
- Admins also get **Reorder** on the Pillars card: drag or use the arrows to save a custom pillar order (`tracker.pillarOrder`, `actions.savePillarOrder`, `actions.clearPillarOrder`). **Use monday order** removes it.

| | |
| --- | --- |
| Route | `#/portfolio?layout=heatmap\|brief\|pace&pillar=<id>&initiative=<id>`; ledger is the default |
| Rail | Yes, position 10 |
| Access | `portfolio` (everyone) gates the ledger. `portfolio.heatmap` (everyone), `portfolio.brief` and `portfolio.pace` (admin, editor, executive) gate their layouts and need `portfolio` too |
| Shared filters | Yes (`usesFilters`): status, stale (any age from the chip's picker) and search chips narrow the ledger. The brief's Stale tile toggles the filter at the Settings threshold |

## Files

- `manifest.ts`: the plug. Declares the four features; `requires` picks one by layout.
- `routes.ts`: parses `layout`, and maps a layout to its feature. Used by the manifest and the views.
- `entry.tsx`: lazy entry; URL → `PortfolioView` props.
- `PortfolioView.tsx`: layout switcher, ledger, heatmap and leadership brief.
- `PaceView.tsx`, `PaceMap.tsx`: the pillar pace layout and its scatter map.
- `forms.tsx`: new and edit forms for pillars, initiatives and projects, with labelled fields, the save-in-progress state and a note on what goes to monday.com.

## Uses from the platform

`tracker` (state, settings, add/update/delete for pillars, initiatives and projects), `filters`/`setFilters`/`matches`/`filtering`, `can`, `canReport`, `canWrite`, `isAdmin`, `mondayLive`, `ask`, `navigate`, `openProject`.

## Links out

- `onepager` (Print one-pager from the leadership brief).
- `project` via `openProject`.
