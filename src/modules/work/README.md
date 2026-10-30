# My work module

Decisions, open issues and milestones on the projects a person owns, with in-place actions (record a decision, resolve an issue, update a milestone). Without a `person` param it shows the signed-in user's work, asking once which owner they are when their name does not match.

| | |
| --- | --- |
| Route | `#/work?person=<person key>`; the signed-in user when omitted |
| Rail | Yes, position 40. Someone else's work lights up Workload instead (`activeNav`) |
| Access | Feature `work`; admin and editor by default |

## Files

- `manifest.ts`: the plug, including the `activeNav` rule.
- `entry.tsx`: lazy entry; `person` param → `WorkView`.
- `WorkView.tsx`: the page, the "who are you" picker, and the item drawer.

## Uses from the platform

`tracker` (state, `updateProjectField`, issue actions), `people`, `me`/`meClaimed`/`claimMe`, `identity`, `identitySource`, `openIdentity`, `canWrite`, `contextOf`, `navigate`, `openProject`.

## Links out

- `workload` (browse everyone), `work?person=…` (person picker), `project` via `openProject`.
