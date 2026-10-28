// 🖼️ Builds a bundler-free preview of the real app so it can be rendered and
// screenshotted in Chromium. This environment has no npm registry access, so
// React is loaded from the globally installed CJS builds through a tiny
// module registry and exposed to the compiled ESM code via an import map.
//
// This file is verification scaffolding. On a normal machine `npm run dev`
// does all of this properly.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const globalModules = '/home/claude/.npm-global/lib/node_modules'
const vendor = join(here, 'vendor')
const esm = join(here, 'esm')
mkdirSync(vendor, { recursive: true })
mkdirSync(esm, { recursive: true })

const cjsFiles = {
  'react.js': `${globalModules}/react/cjs/react.production.js`,
  'react-jsx-runtime.js': `${globalModules}/react/cjs/react-jsx-runtime.production.js`,
  'react-dom.js': `${globalModules}/react-dom/cjs/react-dom.production.js`,
  'react-dom-client.js': `${globalModules}/react-dom/cjs/react-dom-client.production.js`,
  'scheduler.js': `${globalModules}/react-dom/node_modules/scheduler/cjs/scheduler.production.js`,
}

for (const [target, source] of Object.entries(cjsFiles)) {
  copyFileSync(source, join(vendor, target))
}

writeFileSync(
  join(vendor, 'loader.js'),
  `// Minimal CommonJS registry: enough to run React in a page with no bundler.
const registry = new Map()
const sources = {
  react: './vendor/react.js',
  'react/jsx-runtime': './vendor/react-jsx-runtime.js',
  scheduler: './vendor/scheduler.js',
  'react-dom': './vendor/react-dom.js',
  'react-dom/client': './vendor/react-dom-client.js',
}
const order = ['react', 'react/jsx-runtime', 'scheduler', 'react-dom', 'react-dom/client']

window.process = window.process || { env: { NODE_ENV: 'production' } }

const req = (name) => {
  if (!registry.has(name)) throw new Error('module not loaded: ' + name)
  return registry.get(name)
}

export async function bootCjs() {
  for (const name of order) {
    const source = await fetch(sources[name]).then((r) => r.text())
    const module = { exports: {} }
    new Function('module', 'exports', 'require', 'process', source)(
      module,
      module.exports,
      req,
      window.process,
    )
    registry.set(name, module.exports)
  }
  window.__CJS__ = req
}
`,
)

const shim = (moduleName, named) => `const mod = window.__CJS__(${JSON.stringify(moduleName)})
export default mod
${named.map((name) => `export const ${name} = mod.${name}`).join('\n')}
`

writeFileSync(
  join(esm, 'react.js'),
  shim('react', [
    'useState',
    'useEffect',
    'useCallback',
    'useMemo',
    'useRef',
    'StrictMode',
    'Fragment',
    'createElement',
  ]),
)
writeFileSync(join(esm, 'react-jsx-runtime.js'), shim('react/jsx-runtime', ['jsx', 'jsxs', 'Fragment']))
writeFileSync(join(esm, 'react-dom-client.js'), shim('react-dom/client', ['createRoot', 'hydrateRoot']))

writeFileSync(
  join(here, 'preview.html'),
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Savant Strategic Initiatives Tracker — preview</title>
    <link rel="stylesheet" href="../src/styles.css" />
    <script type="importmap">
      {
        "imports": {
          "react": "./esm/react.js",
          "react/jsx-runtime": "./esm/react-jsx-runtime.js",
          "react-dom/client": "./esm/react-dom-client.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import { bootCjs } from './vendor/loader.js'
      await bootCjs()
      const { createRoot } = await import('react-dom/client')
      const { default: App } = await import('./ui-out/App.js')
      const { jsx } = await import('react/jsx-runtime')
      createRoot(document.getElementById('root')).render(jsx(App, {}))
      window.__MOUNTED__ = true
    </script>
  </body>
</html>
`,
)

console.log('preview scaffolding written')
