import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODULES } from '../modules'
import type { ModuleManifest } from './module'
import { canOpen, createRegistry, homeModule, RegistryError, resolveLocation, type Viewer } from './registry'

const entry = () => Promise.resolve({ default: () => null })
const mod = (patch: Partial<ModuleManifest> & { id: string }): ModuleManifest => ({ title: patch.id, load: entry, ...patch })

const admin: Viewer = { isAdmin: true, can: () => true }
const viewerWith = (...features: string[]): Viewer => ({ isAdmin: false, can: (key) => features.includes(key) })

afterEach(() => vi.restoreAllMocks())

describe('the app registry', () => {
  it('accepts every module this app ships', () => {
    expect(() => createRegistry(MODULES, { strict: true })).not.toThrow()
  })

  it('builds the access catalogue from module features', () => {
    const keys = createRegistry(MODULES, { strict: true }).features.map((feature) => feature.key)
    expect(keys).toEqual(expect.arrayContaining(['portfolio', 'portfolio.brief', 'board', 'workload.pm-heatmap', 'admin']))
  })
})

describe('registry validation', () => {
  it('rejects malformed ids, duplicates and missing loaders', () => {
    const attempt = () =>
      createRegistry(
        [mod({ id: 'Bad Id' }), mod({ id: 'twice' }), mod({ id: 'twice' }), { id: 'noload', title: 'x' } as ModuleManifest],
        { strict: true },
      )
    expect(attempt).toThrow(RegistryError)
    try {
      attempt()
    } catch (error) {
      expect((error as RegistryError).problems).toHaveLength(3)
    }
  })

  it('rejects features claimed twice, unknown parents and unknown requirements', () => {
    expect(() =>
      createRegistry([mod({ id: 'a', features: [{ key: 'x', label: 'X', defaultRoles: [] }] }), mod({ id: 'b', features: [{ key: 'x', label: 'X', defaultRoles: [] }] })], { strict: true }),
    ).toThrow(/already declared/)
    expect(() => createRegistry([mod({ id: 'a', features: [{ key: 'a.b', label: 'AB', parent: 'nope', defaultRoles: [] }] })], { strict: true })).toThrow(/unknown parent/)
    expect(() => createRegistry([mod({ id: 'a', requires: 'ghost' })], { strict: true })).toThrow(/no module declares/)
  })

  it('rejects a redirect that shadows a module', () => {
    expect(() => createRegistry([mod({ id: 'a' }), mod({ id: 'b', redirects: { a: () => ({ module: 'b' }) } })], { strict: true })).toThrow(/shadows/)
  })

  it('in production, leaves a bad module out instead of failing the app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const registry = createRegistry([mod({ id: 'good', navOrder: 1 }), mod({ id: 'bad', requires: 'ghost', navOrder: 2 })], { strict: false })
    expect(registry.modules.map((m) => m.id)).toEqual(['good'])
  })

  it('orders the rail by navOrder and keeps link-only modules out of it', () => {
    const registry = createRegistry([mod({ id: 'c', navOrder: 30 }), mod({ id: 'detail' }), mod({ id: 'a', navOrder: 10 })], { strict: true })
    expect(registry.nav.map((m) => m.id)).toEqual(['a', 'c'])
    expect(registry.get('detail')).toBeDefined()
  })
})

describe('opening modules', () => {
  const registry = createRegistry(
    [
      mod({ id: 'list', navOrder: 1, features: [{ key: 'list', label: 'List', defaultRoles: [] }], requires: 'list' }),
      mod({ id: 'other', navOrder: 2, requires: null }),
      mod({ id: 'console', navOrder: 3, adminOnly: true }),
      mod({ id: 'moved', redirects: { old: (location) => ({ module: 'moved', params: { from: location.params.x } }) } }),
    ],
    { strict: true },
  )

  it('gates by feature, and admin-only modules by role', () => {
    expect(canOpen(registry.get('list')!, { module: 'list', params: {} }, viewerWith())).toBe(false)
    expect(canOpen(registry.get('list')!, { module: 'list', params: {} }, viewerWith('list'))).toBe(true)
    expect(canOpen(registry.get('console')!, { module: 'console', params: {} }, viewerWith('list'))).toBe(false)
    expect(canOpen(registry.get('console')!, { module: 'console', params: {} }, admin)).toBe(true)
  })

  it('fails closed when a module access check throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = mod({ id: 'broken', requires: () => { throw new Error('bug') } })
    expect(canOpen(broken, { module: 'broken', params: {} }, viewerWith('broken'))).toBe(false)
  })

  it('lands each viewer on the first rail module they may open', () => {
    expect(homeModule(registry, admin)?.id).toBe('list')
    expect(homeModule(registry, viewerWith())?.id).toBe('other')
  })

  it('resolves known modules, redirects retired segments and sends the rest home', () => {
    expect(resolveLocation(registry, { module: 'other', params: {} }, admin).location.module).toBe('other')
    expect(resolveLocation(registry, { module: 'old', params: { x: '7' } }, admin)).toEqual({
      location: { module: 'moved', params: { from: '7' } },
      redirected: true,
    })
    expect(resolveLocation(registry, { module: 'nope', params: {} }, viewerWith()).location.module).toBe('other')
    expect(resolveLocation(registry, { module: '', params: {} }, admin).location.module).toBe('list')
  })
})
