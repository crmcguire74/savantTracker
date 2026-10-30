# Board module

Projects as cards in columns, by phase or by status. Editors drag a card to another column to change that field.

| | |
| --- | --- |
| Route | `#/board?layout=status`; phase is the default |
| Rail | Yes, position 20 |
| Access | Feature `board`; every role by default |
| Shared filters | Yes (`usesFilters`) |

## Files

- `manifest.ts`: the plug.
- `routes.ts`: parses `layout`.
- `entry.tsx`: lazy entry; URL → `BoardView` props.
- `BoardView.tsx`: columns, cards and drag-and-drop.
- `board.test.tsx`: the reference example of a module testing itself in isolation with `@sdk/testing`.

## Uses from the platform

`tracker` (state, settings, `updateProjectField`), `matches`/`filtering`, `canWrite`, `contextOf`, `navigate`, `openProject`.

## Links out

- `project` via `openProject`.
