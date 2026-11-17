// 📘 The User Guide, for the Help page. `User Guide.md` at the repository root is the one copy:
// the build bundles it as text in its own chunk, fetched only when someone opens the guide, so the
// guide in the app is always the guide in the repository.

/** The name the guide downloads as. */
export const USER_GUIDE_FILE_NAME = 'WiseTrack User Guide'

/** Loads the User Guide's Markdown text. */
export const loadUserGuide = (): Promise<string> => import('../../User Guide.md?raw').then((module) => module.default)
