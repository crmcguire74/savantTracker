# Timeline module

A twelve-month window, paged by quarter: start-to-forecast bars per project, milestone diamonds and a today line, grouped by pillar.

| | |
| --- | --- |
| Route | `#/timeline` |
| Rail | Yes, position 30 |
| Access | Feature `timeline`; every role by default |
| Shared filters | Yes (`usesFilters`) |

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry.
- `TimelineView.tsx`: the page. Geometry comes from `timelineWindow` / `timelinePosition` in the SDK.

## Uses from the platform

`tracker` (state), `matches`/`filtering`, `openProject`.

## Links out

- `project` via `openProject`.
