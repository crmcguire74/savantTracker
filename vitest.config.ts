import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // fake-indexeddb gives the IndexedDB adapter a real implementation under
    // Node, so the storage tests exercise the same code path the browser does.
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.js'],
  },
})
