# Access module

Who sees what. Admins edit a draft of the access policy (roles × views, layouts and reports) and save it for everyone at once. The Admin column is fixed on.

| | |
| --- | --- |
| Route | `#/access` |
| Rail | Yes, position 70, admins only |
| Access | `adminOnly`: decided by role, not by the policy, so no edit can lock admins out of this page |

The "Views and layouts" rows are not listed here. They come from `platform.features`, which the registry assembles from every module's `features`. A new module's features appear on this page without changing this module.

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry.
- `AccessView.tsx`: role cards and the two access matrices.

## Uses from the platform

`tracker` (`access`, `saveAccess`), `features`, `identitySource`, `ask`.

## Links out

None.
