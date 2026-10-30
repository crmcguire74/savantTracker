# __TITLE__ module

__DESCRIPTION__

| | |
| --- | --- |
| Route | `#/__ID__?filter=<text>` |
| Rail | Yes, position __ORDER__ |
| Access | Feature `__ID__`; admin and editor by default |
| Owner | _team or person_ |

## Files

- `manifest.ts`: the plug. Id, rail entry, access feature, lazy `load`.
- `entry.tsx`: the lazy entry. Turns the URL into props.
- `__COMPONENT__View.tsx`: the page.
- `__ID__.test.tsx`: tests, mounted inside the real platform with `@sdk/testing`.

## Uses from the platform

`tracker.state.projects`, `navigate`.

## Links out

None.
