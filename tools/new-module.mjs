#!/usr/bin/env node
// 🧩 Scaffolds a module from tools/module-template and plugs it in.
//
//   npm run new:module -- risks "Risk register" Open risks across every project.
//
// Creates src/modules/<id>/ (manifest, entry, view, test, README) and adds the
// manifest to src/modules/index.ts. The generated module passes the
// architecture tests as is; open it with `npm run dev:module` at #/<id>.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [id, title = id, ...rest] = process.argv.slice(2)
const description = rest.join(' ') || `The ${title} page.`

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: npm run new:module -- <id> "<Title>" [description]\n  id: lowercase letters, digits and dashes, starting with a letter')
  process.exit(1)
}

const modulesDir = join(root, 'src', 'modules')
const target = join(modulesDir, id)
if (existsSync(target)) {
  console.error(`src/modules/${id} already exists`)
  process.exit(1)
}

const component = id.replace(/(^|-)([a-z0-9])/g, (_, __, char) => char.toUpperCase())
const alias = component.charAt(0).toLowerCase() + component.slice(1)

// Next rail slot after the last module.
const orders = readdirSync(modulesDir)
  .map((name) => join(modulesDir, name, 'manifest.ts'))
  .filter((file) => existsSync(file))
  .map((file) => Number(readFileSync(file, 'utf8').match(/navOrder:\s*(\d+)/)?.[1] ?? 0))
const order = Math.max(0, ...orders) + 10

const fill = (text) =>
  text
    .replaceAll('__ID__', id)
    .replaceAll('__TITLE__', title)
    .replaceAll('__DESCRIPTION__', description)
    .replaceAll('__COMPONENT__', component)
    .replaceAll('__ORDER__', String(order))

const files = {
  'manifest.ts': 'manifest.ts',
  'entry.tsx': 'entry.tsx',
  'View.tsx': `${component}View.tsx`,
  'module.test.tsx': `${id}.test.tsx`,
  'README.md': 'README.md',
}

mkdirSync(target)
for (const [from, to] of Object.entries(files)) {
  writeFileSync(join(target, to), fill(readFileSync(join(root, 'tools', 'module-template', from), 'utf8')))
}

// Plug it in: an import after the last manifest import, and an array entry.
const indexFile = join(modulesDir, 'index.ts')
const index = readFileSync(indexFile, 'utf8')
const imports = [...index.matchAll(/^import \{ manifest as \w+ \} from '\.\/[\w-]+\/manifest'\r?\n/gm)]
const last = imports.at(-1)
const list = index.match(/export const MODULES: readonly ModuleManifest\[\] = \[[^\]]*\]/)
if (!last || !list) {
  console.warn(`Could not edit src/modules/index.ts. Add the module yourself:\n  import { manifest as ${alias} } from './${id}/manifest'`)
} else {
  const at = last.index + last[0].length
  let next = `${index.slice(0, at)}import { manifest as ${alias} } from './${id}/manifest'\n${index.slice(at)}`
  next = next.replace(list[0], list[0].replace(/\]$/, `, ${alias}]`))
  writeFileSync(indexFile, next)
}

console.log(`Created src/modules/${id}/ and registered it in src/modules/index.ts.

  npm run dev:module               then open #/${id}
  npx vitest run src/modules/${id}
`)
