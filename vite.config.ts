import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 📦 Emits dist/sw.js from pwa/service-worker.js with the build's precache
 * list and a version derived from everything it caches. Any source change
 * that alters the output changes the version, which makes sw.js byte-different,
 * which is what tells installed copies an update is waiting.
 */
function serviceWorker(): Plugin {
  const template = 'pwa/service-worker.js'
  const publicDir = 'public'

  const listPublic = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? listPublic(full) : [relative(publicDir, full).split('\\').join('/')]
    })

  return {
    name: 'savant-service-worker',
    apply: 'build',
    // After Vite's HTML plugin, so index.html is already in the bundle.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((file) => !file.endsWith('.map') && file !== 'sw.js')
      // index.html is the offline shell; it must always be precached.
      const files = [...new Set(['index.html', ...built, ...listPublic(publicDir)])].sort()

      const hash = createHash('sha256')
      for (const file of files) {
        const chunk = bundle[file]
        if (chunk) hash.update(file).update(chunk.type === 'chunk' ? chunk.code : String(chunk.source))
        else if (existsSync(join(publicDir, file))) hash.update(file).update(readFileSync(join(publicDir, file)))
      }
      const source = readFileSync(template, 'utf8')
      hash.update(source)
      const version = hash.digest('hex').slice(0, 12)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source
          .replace("'__SW_VERSION__'", JSON.stringify(version))
          .replace('__SW_PRECACHE__', JSON.stringify(files, null, 2)),
      })
    },
  }
}

// 🛠️ Relative base so the built app runs from a file server, S3 bucket,
// SharePoint static host, or a sub-path behind a reverse proxy.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173 },
})
