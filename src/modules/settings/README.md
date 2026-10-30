# Settings module

Stale threshold, appearance (light, dark, match system), install and update of the app, import, export and reset of data, and (in local mode) your name and the storage driver.

| | |
| --- | --- |
| Route | `#/settings` |
| Rail | Yes, position 80 |
| Access | Every role (`requires: null`). Writes inside still check `canWrite` |

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry.
- `SettingsView.tsx`: the page.

## Uses from the platform

`tracker` (settings, state, `storageStatus`, `snapshotInfo`, `setStaleThreshold`, `exportData`, `resetToSnapshot`), `canWrite`, `identity`, `identitySource`, `roles`, `me`, `themePreference`/`setThemePreference`, `startImport`, `openStorage`, `openIdentity`, `openChangeLog`, `ask`, `navigate`. PWA install and update from the SDK (`usePwa`, `promptInstall`, `checkForUpdate`, `applyUpdate`).

## Links out

- `work`.
