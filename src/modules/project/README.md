# Project module

One project as a status report: phase stepper, decision and issue cards, owners, schedule slip, recent changes, and the **Update project** drawer for every field.

| | |
| --- | --- |
| Route | `#/project/<project id>` |
| Rail | No. Lights up Portfolio (`activeNav`) |
| Access | Every role may read a project (`requires: null`); writes need `canWrite` |

An unknown or missing id renders "This project no longer exists" with a link back to the portfolio.

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry; `location.id` → `ProjectView`.
- `ProjectView.tsx`: the page and its drawer.

## Uses from the platform

`tracker` (state, settings, `updateProjectField`, `deleteProject`, issue actions), `contextOf`, `canWrite`, `ask`, `navigate`, `openChangeLog`.

## Links out

- `portfolio` with `pillar` / `initiative` params (breadcrumbs, and after deleting).
