// 🏗️ Architecture fitness tests. These read the source, not the running app,
// and fail when a change breaks the module rules that keep modules sandboxed
// and portable. A failure here names the file and the import to fix.
//
//   1. A module imports React, `@sdk`, and files inside its own folder only.
//      Tests may also import `@sdk/testing` and `vitest`.
//   2. A module folder has manifest.ts, entry.tsx and README.md.
//   3. A manifest never statically imports a view; its code loads via import().
//   4. The plug board (src/modules/index.ts) imports manifests and nothing else.
//   5. Nothing outside src/modules reaches into a module, apart from the app
//      entry, the workbench, and tests that check every module.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MODULES_DIR = join(SRC, 'modules')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
  })

const rel = (file: string) => relative(SRC, file).split(sep).join('/')
const isTest = (file: string) => /\.test\.tsx?$/.test(file)

/** Every module specifier a file imports: static, re-export, side effect and dynamic. */
function importsOf(file: string): Array<{ spec: string; dynamic: boolean }> {
  const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: Array<{ spec: string; dynamic: boolean }> = []
  for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g)) found.push({ spec: match[1], dynamic: false })
  for (const match of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) found.push({ spec: match[1], dynamic: false })
  for (const match of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push({ spec: match[1], dynamic: true })
  return found
}

const moduleDirs = readdirSync(MODULES_DIR).filter((name) => statSync(join(MODULES_DIR, name)).isDirectory())

describe('module boundaries', () => {
  it('finds the modules to check', () => {
    expect(moduleDirs.length).toBeGreaterThan(0)
  })

  it.each(moduleDirs)('%s imports only React, @sdk and its own files', (name) => {
    const root = join(MODULES_DIR, name)
    const violations: string[] = []
    for (const file of walk(root)) {
      for (const { spec } of importsOf(file)) {
        if (spec === 'react' || spec.startsWith('react/') || spec === '@sdk') continue
        if ((spec === '@sdk/testing' || spec === 'vitest') && isTest(file)) continue
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec)
          if (target === root || target.startsWith(root + sep)) continue
        }
        violations.push(`${rel(file)} imports '${spec}'`)
      }
    }
    expect(violations).toEqual([])
  })

  it.each(moduleDirs)('%s has a manifest, an entry and a README', (name) => {
    const missing = ['manifest.ts', 'entry.tsx', 'README.md'].filter((file) => !existsSync(join(MODULES_DIR, name, file)))
    expect(missing).toEqual([])
  })

  it.each(moduleDirs)('%s keeps its views out of the startup bundle', (name) => {
    const manifest = join(MODULES_DIR, name, 'manifest.ts')
    const imports = importsOf(manifest)
    const eagerViews = imports.filter(({ spec, dynamic }) => !dynamic && spec.startsWith('.') && existsSync(resolve(dirname(manifest), `${spec}.tsx`)))
    expect(eagerViews.map(({ spec }) => spec)).toEqual([])
    expect(imports.filter(({ dynamic }) => dynamic).map(({ spec }) => spec)).toEqual(['./entry'])
  })

  it('plugs in manifests and nothing else', () => {
    const specs = importsOf(join(MODULES_DIR, 'index.ts')).map(({ spec }) => spec)
    const plugs = specs.filter((spec) => spec !== '@sdk')
    expect(plugs.filter((spec) => !/^\.\/[a-z][a-z0-9-]*\/manifest$/.test(spec))).toEqual([])
    expect(plugs.map((spec) => spec.split('/')[1]).sort()).toEqual([...moduleDirs].sort())
  })

  it('is not reached into from outside src/modules', () => {
    const allowed = new Set(['App.tsx', 'platform/dev/main.tsx'])
    const violations: string[] = []
    for (const file of walk(SRC)) {
      if (file.startsWith(MODULES_DIR + sep) || isTest(file) || allowed.has(rel(file))) continue
      for (const { spec } of importsOf(file)) {
        if (!spec.startsWith('.')) continue
        const target = resolve(dirname(file), spec)
        if (target === MODULES_DIR || target.startsWith(MODULES_DIR + sep)) violations.push(`${rel(file)} imports '${spec}'`)
      }
    }
    expect(violations).toEqual([])
  })
})
