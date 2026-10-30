// 📇 The module registry: the validated set of modules an app is built from.
// The app hands its manifest list to `createRegistry` once at startup; the
// shell builds the rail, the access catalogue, redirects and the landing
// page from the result. Nothing in the platform names a specific module.
//
// Validation is strict in development and tests (a bad manifest throws, so
// the mistake is found at the desk) and forgiving in production (the bad
// module is left out and reported, so one broken plug-in cannot stop the
// app from starting).

import type { FeatureInfo, FeatureKey } from '../auth/access'
import { guard, reportModuleFault } from './diagnostics'
import type { LinkTo, Location, ModuleManifest } from './module'

const MODULE_ID = /^[a-z][a-z0-9-]*$/

export interface Registry {
  /** Every accepted module, in rail order (unlisted modules last). */
  readonly modules: readonly ModuleManifest[]
  /** Modules with a rail entry, in rail order. */
  readonly nav: readonly ModuleManifest[]
  /** The access catalogue assembled from every module's features. */
  readonly features: readonly FeatureInfo[]
  get(id: string): ModuleManifest | undefined
  /** Where a retired URL segment now lives; null when nothing claims it. */
  redirect(location: Location): LinkTo | null
}

/** What the shell knows about the viewer when deciding what they may open. */
export interface Viewer {
  isAdmin: boolean
  can: (feature: FeatureKey) => boolean
}

export class RegistryError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid module registry:\n  - ${problems.join('\n  - ')}`)
    this.name = 'RegistryError'
  }
}

const isDev = (): boolean => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false
  }
}

export function createRegistry(manifests: readonly ModuleManifest[], options: { strict?: boolean } = {}): Registry {
  const strict = options.strict ?? isDev()
  const problems: string[] = []
  const accepted: ModuleManifest[] = []
  const ids = new Set<string>()
  const featureOwner = new Map<FeatureKey, string>()

  const reject = (manifest: Partial<ModuleManifest>, problem: string) => {
    problems.push(`${manifest.id ?? '(no id)'}: ${problem}`)
  }

  // Pass 1: each manifest on its own, and ids/features unique across modules.
  for (const manifest of manifests) {
    const before = problems.length
    if (typeof manifest.id !== 'string' || !MODULE_ID.test(manifest.id)) reject(manifest, 'id must be lowercase letters, digits and dashes, starting with a letter')
    else if (ids.has(manifest.id)) reject(manifest, 'id is already registered by another module')
    if (!manifest.title?.trim()) reject(manifest, 'title is required')
    if (typeof manifest.load !== 'function') reject(manifest, 'load must be a function returning import() of the module entry')
    for (const feature of manifest.features ?? []) {
      const owner = featureOwner.get(feature.key)
      if (owner && owner !== manifest.id) reject(manifest, `feature "${feature.key}" is already declared by module "${owner}"`)
    }
    if (problems.length > before) continue
    ids.add(manifest.id)
    for (const feature of manifest.features ?? []) featureOwner.set(feature.key, manifest.id)
    accepted.push(manifest)
  }

  // Pass 2: references between modules, now that every feature is known.
  const features = accepted.flatMap((manifest) => manifest.features ?? [])
  const known = new Set(features.map((feature) => feature.key))
  const redirects = new Map<string, ModuleManifest>()
  const valid = accepted.filter((manifest) => {
    const before = problems.length
    for (const feature of manifest.features ?? []) {
      if (feature.parent && !known.has(feature.parent)) reject(manifest, `feature "${feature.key}" names unknown parent "${feature.parent}"`)
    }
    if (typeof manifest.requires === 'string' && !known.has(manifest.requires)) {
      reject(manifest, `requires "${manifest.requires}", which no module declares`)
    }
    for (const segment of Object.keys(manifest.redirects ?? {})) {
      if (ids.has(segment)) reject(manifest, `redirect "${segment}" shadows the module with that id`)
      else if (redirects.has(segment)) reject(manifest, `redirect "${segment}" is already claimed by "${redirects.get(segment)!.id}"`)
      else redirects.set(segment, manifest)
    }
    return problems.length === before
  })

  if (problems.length) {
    if (strict) throw new RegistryError(problems)
    for (const problem of problems) reportModuleFault({ moduleId: problem.split(':')[0], phase: 'manifest', error: new Error(problem) })
  }

  const byOrder = (a: ModuleManifest, b: ModuleManifest) =>
    (a.navOrder ?? Infinity) - (b.navOrder ?? Infinity) || a.id.localeCompare(b.id)
  const modules = [...valid].sort(byOrder)
  const byId = new Map(modules.map((manifest) => [manifest.id, manifest]))
  // Drop features of modules that failed pass 2, so the catalogue matches.
  const catalog = modules.flatMap((manifest) => manifest.features ?? [])

  return {
    modules,
    nav: modules.filter((manifest) => manifest.navOrder !== undefined),
    features: catalog,
    get: (id) => byId.get(id),
    redirect(location) {
      const owner = redirects.get(location.module)
      if (!owner || !byId.has(owner.id)) return null
      return guard(owner.id, () => owner.redirects![location.module](location), { module: owner.id })
    },
  }
}

/** The feature a module needs at a location; null when every role may open it. */
export function requiredFeature(manifest: ModuleManifest, location: Location): FeatureKey | null {
  const { requires } = manifest
  if (typeof requires !== 'function') return requires ?? null
  // A throwing access check fails closed: better a "no access" page than a leak.
  return guard(manifest.id, () => requires(location), `${manifest.id}:invalid`)
}

export function canOpen(manifest: ModuleManifest, location: Location, viewer: Viewer): boolean {
  if (manifest.adminOnly) return viewer.isAdmin
  const feature = requiredFeature(manifest, location)
  return feature === null || viewer.can(feature)
}

/** The landing module: the first rail entry this viewer may open. */
export function homeModule(registry: Registry, viewer: Viewer): ModuleManifest | undefined {
  const allowed = (manifest: ModuleManifest) => canOpen(manifest, { module: manifest.id, params: {} }, viewer)
  return registry.nav.find(allowed) ?? registry.modules.find(allowed)
}

/**
 * Turns the raw URL into the location the app shows: a known module as is, a
 * retired segment through its redirect, anything else to the landing page.
 */
export function resolveLocation(registry: Registry, raw: Location, viewer: Viewer): { location: Location; redirected: boolean } {
  if (registry.get(raw.module)) return { location: raw, redirected: false }
  const target = registry.redirect(raw)
  if (target && registry.get(target.module)) {
    const params = Object.fromEntries(Object.entries(target.params ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])))
    return { location: { module: target.module, ...(target.id ? { id: target.id } : {}), params }, redirected: true }
  }
  const home = homeModule(registry, viewer)
  return { location: { module: home?.id ?? '', params: {} }, redirected: false }
}
