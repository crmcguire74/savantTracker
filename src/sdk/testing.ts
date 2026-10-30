// 🧪 `@sdk/testing`: the harness a module's own tests use. Mounts the module
// inside the real platform, sandbox and all; see src/platform/testing.tsx.

export { mountModule, settled, waitFor } from '../platform/testing'
export type { Mounted, MountOptions } from '../platform/testing'
