# Workload module

Everyone named in owner fields, with their projects by status and by role, plus the PM heat map (attention score per project manager). A person row opens that person's work.

| | |
| --- | --- |
| Route | `#/workload?layout=pm-heatmap`; people is the default |
| Rail | Yes, position 50 |
| Access | `workload` gates the page; `workload.pm-heatmap` gates the heat map and needs `workload` too. Admin, editor and executive by default |

## Files

- `manifest.ts`: the plug. `requires` picks the feature by layout.
- `routes.ts`: parses `layout`, and maps a layout to its feature.
- `entry.tsx`: lazy entry; URL → `WorkloadView` props.
- `WorkloadView.tsx`: layout switcher and the people table.
- `PmHeatmap.tsx`: the PM heat map layout.

## Uses from the platform

`tracker` (state), `people`, `me`, `can`, `navigate`, `openProject`.

## Links out

- `work?person=<key>`, `project` via `openProject`.
