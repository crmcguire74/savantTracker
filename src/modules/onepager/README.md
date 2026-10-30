# One-pager module

The printable pillar one-pager: one landscape page per pillar (objective, team, key results, dependencies, accomplishments, next steps, risks), built for the leadership deck. Print to PDF from the browser.

| | |
| --- | --- |
| Route | `#/onepager?pillar=<id>`; every pillar when none is named |
| Rail | No. Lights up Portfolio (`activeNav`); opened from the leadership brief |
| Access | Feature `portfolio.brief` to open; the page also checks report `pillar-one-pager`, which itself requires `portfolio.brief` |
| Legacy | `#/reports?report=pillar-one-pager&pillar=<id>` redirects here (declared by the Admin module) |

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry; `pillar` param → `ReportPreview`.
- `ReportPreview.tsx`: toolbar, pillar picker and the printable sheets. Content comes from `buildOnePager` in the SDK.

## Uses from the platform

`tracker` (state, log, settings), `canReport`, `navigate`, `hrefFor` (absolute pillar links printed on each sheet).

## Links out

- `portfolio?layout=brief` (back), `portfolio?pillar=<id>` (printed link).
