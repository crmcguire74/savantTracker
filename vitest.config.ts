import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Same alias as vite.config.ts: modules import the platform as `@sdk`.
  resolve: {
    alias: [
      { find: /^@sdk$/, replacement: fileURLToPath(new URL('./src/sdk/index.ts', import.meta.url)) },
      { find: /^@sdk\/testing$/, replacement: fileURLToPath(new URL('./src/sdk/testing.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'jsdom',
    // fake-indexeddb gives the IndexedDB adapter a real implementation under
    // Node, so the storage tests exercise the same code path the browser does.
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.js'],
  },
})
