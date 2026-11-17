# Help module

How to use the tracker, inside the tracker. A short start, workflows for each role, a FAQ, a glossary of terms, and the full User Guide.

| | |
| --- | --- |
| Route | `#/help?tab=start\|roles\|faq\|glossary\|guide&role=viewer\|executive\|editor\|admin` |
| Rail | Yes, position 90 |
| Access | Every role (`requires: null`) |

## Files

- `manifest.ts`: the plug.
- `entry.tsx`: lazy entry.
- `HelpView.tsx`: tabs, search and layout. No words of its own.
- `content.ts`: all the text, as data. Edit this file to change the help.
- `markdown.tsx`: a small Markdown renderer (headings, lists, tables, code, links) that builds React elements, never HTML strings. Used for the User Guide tab.
- `help.test.tsx`: renders the page, the User Guide tab and the Markdown parser, and checks the content is complete.

## User Guide tab

`#/help?tab=guide` shows the repository's `User Guide.md`. The SDK's `loadUserGuide()` imports it with Vite's `?raw`, so it is bundled as text in its own chunk and fetched only when the tab opens: editing `User Guide.md` updates the app at the next build, with nothing to copy. The side panel lists the sections and offers **Download (web page)** (the rendered guide as one self-contained HTML file), **Download (Markdown)** and **Print or save as PDF** (prints the guide alone through a hidden frame, so no pop-up is needed). Links inside the guide to its own sections scroll the page; links to repository files show as plain text.

## Keeping it right

- Name screens and buttons exactly as the app shows them.
- Add a term to `GLOSSARY` whenever a new word appears in the interface.
- When a role's access changes, update that role's `can` and `cannot` lines in `GUIDES`.
- Write in short sentences. No em dashes (a test checks).

## Uses from the platform

`roles` (to open on your own role's guide), `navigate`, `hrefFor`, `loadUserGuide`, `USER_GUIDE_FILE_NAME`, `downloadText`. Nothing is stored.
