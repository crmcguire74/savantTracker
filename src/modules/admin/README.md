# Admin module

PMO upkeep: decisions waiting and stale counts, stale projects filterable by age and PM, the running decision list, recent activity, and the monday.com sync (status card, the Preview/Apply dialog and the automatic pull interval).

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
- `MondaySync.tsx`: the sync status card and dialog. Admin only. Reads live monday with a server token, or replays a capture file or the bundled sample, so it works with no token. With a token it also sets the automatic pull interval (`mondaySync.setSchedule`). The "monday data as of" line in the top bar is `src/platform/SyncFreshness.tsx`, fed by `tracker.syncInfo`.

## Uses from the platform

`tracker` (state, log, settings, `mondaySync`), `isAdmin`, `ask`, `people`, `contextOf`, `openProject`, `openChangeLog`.

## Links out

- `project` via `openProject`; the change log drawer via `openChangeLog`.
