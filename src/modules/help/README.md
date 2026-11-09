# Help module

How to use the tracker, inside the tracker. A short start, workflows for each role, a FAQ and a glossary of terms.

| | |
| --- | --- |
| Route | `#/help?tab=start\|roles\|faq\|glossary&role=viewer\|executive\|editor\|admin` |
| Rail | Yes, position 90 |
| Access | Every role (`requires: null`) |

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry.
- `HelpView.tsx`: tabs, search and layout. No words of its own.
- `content.ts`: all the text, as data. Edit this file to change the help.
- `help.test.tsx`: renders the page and checks the content is complete.

## Keeping it right

- Name screens and buttons exactly as the app shows them.
- Add a term to `GLOSSARY` whenever a new word appears in the interface.
- When a role's access changes, update that role's `can` and `cannot` lines in `GUIDES`.
- Write in short sentences. No em dashes (a test checks).

## Uses from the platform

`roles` (to open on your own role's guide), `navigate`, `hrefFor`. Nothing is stored.
