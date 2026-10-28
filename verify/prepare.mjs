// 🧰 Test-harness post-processing only. Vite resolves extensionless imports
// and JSON imports on its own; a bare browser does not, so for the harness we
// rewrite `./x` to `./x.js` and turn snapshot.json into an ES module.
//
// Nothing here touches src/. It exists because this environment has no npm
// registry access and therefore no bundler to run the tests through.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, process.argv[2] ?? 'out')

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

// snapshot.json -> snapshot.js
const snapshot = readFileSync(join(out, 'data', 'snapshot.json'), 'utf8')
writeFileSync(join(out, 'data', 'snapshot.js'), `export default ${snapshot}\n`)

let rewritten = 0
for (const file of walk(out).filter((f) => f.endsWith('.js'))) {
  const before = readFileSync(file, 'utf8')
  const after = before.replace(
    /(\bfrom\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g,
    (match, head, specifier, tail) => {
      if (specifier.endsWith('.js')) return match
      if (specifier.endsWith('.json')) return `${head}${specifier.replace(/\.json$/, '.js')}${tail}`
      // A specifier can name a directory (`../storage`), which native ESM
      // will not resolve to its index file the way a bundler does.
      const target = resolve(dirname(file), specifier)
      const suffix = existsSync(`${target}.js`) ? '.js' : existsSync(join(target, 'index.js')) ? '/index.js' : '.js'
      return `${head}${specifier}${suffix}${tail}`
    },
  )
  if (after !== before) {
    writeFileSync(file, after)
    rewritten += 1
  }
}

console.log(`prepared ${rewritten} module(s) for native ESM`)
