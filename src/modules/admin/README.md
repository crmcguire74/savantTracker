# Admin module

PMO upkeep: decisions waiting and stale counts, stale projects filterable by age and PM, the running decision list, recent activity, and monday.com sync status.

| | |
| --- | --- |
| Route | `#/admin` |
| Rail | Yes, position 60 |
| Access | Feature `admin` ("Admin page"); admin and editor by default. A fresh key, so grants made for the retired Reports page do not carry over |
| Legacy | Declares the `reports` redirect: `#/reports` → `#/admin`, and `#/reports?report=pillar-one-pager&pillar=<id>` → `#/onepager?pillar=<id>` |

## Files

- `manifest.ts`: the plug, including the legacy redirect.
- `entry.tsx`: lazy entry.
- `AdminView.tsx`: the page.

## Uses from the platform

`tracker` (state, log, settings), `people`, `contextOf`, `openProject`, `openChangeLog`.

## Links out

- `project` via `openProject`; the change log drawer via `openChangeLog`.
