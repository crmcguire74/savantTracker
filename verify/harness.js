// 🔬 Browser test harness. Runs the storage layer against the real IndexedDB
// implementation in Chromium: no mocks, no fake-indexeddb, no bundler.
//
// Loaded by verify/index.html, results land on window.__RESULTS__.

import { IndexedDbAdapter, destroyLocalDatabase } from './out/storage/indexeddb.js'
import { MemoryAdapter } from './out/storage/memory.js'
import { createStorageProxy } from './out/storage/proxy.js'
import { VersionConflictError } from './out/storage/contract.js'
import { TrackerRepository, bundledSnapshot, DOC_KEYS } from './out/data/repository.js'
import { parseAppFile, createAppFile, serializeAppFile } from './out/data/appfile.js'
import { searchProjects, initiativeRollup, countByRag, isStale } from './out/lib/rollups.js'

const results = []

const record = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch((error) => results.push({ name, ok: false, error: error?.message ?? String(error) }))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} (expected ${expected}, got ${actual})`)
}

async function run() {
  await destroyLocalDatabase('savant-tracker-test')

  // ── 1. IndexedDB round-trip ────────────────────────────────────────
  await record('IndexedDB stores and reads a document', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: 'savant-tracker-test' })
    await adapter.open()
    const written = await adapter.put('tracker/state', { quarter: 'Q1', projects: [] })
    assertEqual(written.version, 1, 'first write is version 1')
    const read = await adapter.get('tracker/state')
    assertEqual(read.value.quarter, 'Q1', 'value survives the round-trip')
    assertEqual(read.version, 1, 'version survives the round-trip')
    await adapter.close()
  })

  // ── 2. Data survives a reopen (this is the persistence claim) ──────
  await record('Data survives closing and reopening the database', async () => {
    const first = new IndexedDbAdapter({ databaseName: 'savant-tracker-test' })
    await first.open()
    await first.put('tracker/persist', { marker: 'still-here' })
    await first.close()

    const second = new IndexedDbAdapter({ databaseName: 'savant-tracker-test' })
    await second.open()
    const read = await second.get('tracker/persist')
    assertEqual(read.value.marker, 'still-here', 'value is still present after reopen')
    await second.close()
  })

  // ── 3. Optimistic concurrency ──────────────────────────────────────
  await record('Stale writes are rejected with a version conflict', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: 'savant-tracker-test' })
    await adapter.open()
    const first = await adapter.put('tracker/lock', { n: 1 })
    await adapter.put('tracker/lock', { n: 2 }, { ifVersion: first.version })

    let threw = null
    try {
      await adapter.put('tracker/lock', { n: 3 }, { ifVersion: first.version })
    } catch (error) {
      threw = error
    }
    assert(threw instanceof VersionConflictError, 'a stale ifVersion throws VersionConflictError')
    const current = await adapter.get('tracker/lock')
    assertEqual(current.value.n, 2, 'the rejected write did not land')
    await adapter.close()
  })

  // ── 4. Subscriptions ───────────────────────────────────────────────
  await record('Subscribers are notified on write', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: 'savant-tracker-test' })
    await adapter.open()
    const seen = []
    const off = adapter.subscribe('tracker/watch', (doc) => seen.push(doc?.value?.tick))
    await adapter.put('tracker/watch', { tick: 1 })
    await adapter.put('tracker/watch', { tick: 2 })
    off()
    await adapter.put('tracker/watch', { tick: 3 })
    assertEqual(seen.join(','), '1,2', 'listener fired twice, then stopped after unsubscribe')
    await adapter.close()
  })

  // ── 5. The proxy forwards, swaps, and migrates ─────────────────────
  await record('Proxy swaps the backend and carries the data across', async () => {
    const proxy = createStorageProxy(new IndexedDbAdapter({ databaseName: 'savant-tracker-test' }))
    await proxy.open()
    await proxy.put('tracker/swap-me', { payload: 'abc' })
    assertEqual(proxy.status.driver, 'indexeddb', 'starts on IndexedDB')

    const report = await proxy.swap(new MemoryAdapter(), { migrate: true, prefix: 'tracker/' })
    assertEqual(proxy.status.driver, 'memory', 'driver switched')
    assert(report.copied.includes('tracker/swap-me'), 'the document was copied across')

    const afterSwap = await proxy.get('tracker/swap-me')
    assertEqual(afterSwap.value.payload, 'abc', 'the data reads back from the new backend')
    await proxy.close()
  })

  await record('Live subscriptions survive a backend swap', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    await proxy.put('tracker/live', { tick: 0 })

    const seen = []
    proxy.subscribe('tracker/live', (doc) => seen.push(doc?.value?.tick))
    await proxy.put('tracker/live', { tick: 1 })

    await proxy.swap(new MemoryAdapter(), { migrate: true })
    await proxy.put('tracker/live', { tick: 2 })

    assert(seen.includes(1), 'listener fired before the swap')
    assert(seen.includes(2), 'the same listener still fires after the swap')
    await proxy.close()
  })

  await record('A failed swap leaves the old backend mounted', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    await proxy.put('tracker/keep', { safe: true })

    const broken = {
      name: 'broken',
      capabilities: { realtime: false, optimisticLocking: false, multiUser: false },
      open: async () => {
        throw new Error('service unreachable')
      },
      close: async () => {},
      get: async () => null,
      put: async () => {
        throw new Error('nope')
      },
      remove: async () => {},
      list: async () => [],
      subscribe: () => () => {},
    }

    let threw = null
    try {
      await proxy.swap(broken, { migrate: true })
    } catch (error) {
      threw = error
    }
    assert(threw !== null, 'the swap surfaced the failure')
    assertEqual(proxy.status.driver, 'memory', 'the working backend is still mounted')
    const kept = await proxy.get('tracker/keep')
    assertEqual(kept.value.safe, true, 'data is still reachable after the failed swap')
    await proxy.close()
  })

  // ── 6. Migration snapshot ──────────────────────────────────────────
  await record('Bundled snapshot carries the live tracker data', async () => {
    const file = bundledSnapshot()
    assertEqual(file.state.pillars.length, 4, 'four pillars')
    assertEqual(file.state.initiatives.length, 28, 'twenty-eight initiatives')
    assertEqual(file.state.projects.length, 43, 'forty-three projects')
    assertEqual(file.log.length, 183, 'one hundred eighty-three log entries')

    const counts = countByRag(file.state.projects)
    assertEqual(counts.green + counts.amber + counts.red, 43, 'every project has a valid RAG value')

    const withLegacyName = file.state.projects.filter((p) => p.updatedByName !== '').length
    assertEqual(withLegacyName, 23, 'legacy updatedBy names were carried into updatedByName')
    assert(
      file.state.projects.every((p) => typeof p.decisionOutcome === 'string'),
      'every project has the decisionOutcome field the old schema lacked',
    )
    assert(
      file.state.projects.every((p) => Array.isArray(p.issues)),
      'every project has an issues array',
    )
  })

  await record('Referential integrity holds across the snapshot', async () => {
    const file = bundledSnapshot()
    const pillarIds = new Set(file.state.pillars.map((p) => p.id))
    const initiativeIds = new Set(file.state.initiatives.map((i) => i.id))
    const orphanInitiatives = file.state.initiatives.filter((i) => !pillarIds.has(i.pillarId))
    const orphanProjects = file.state.projects.filter((p) => !initiativeIds.has(p.initiativeId))
    assertEqual(orphanInitiatives.length, 0, 'no initiative points at a missing pillar')
    assertEqual(orphanProjects.length, 0, 'no project points at a missing initiative')
  })

  // ── 7. Repository bootstrap + seeding ──────────────────────────────
  await record('Cold start seeds the store from the snapshot', async () => {
    await destroyLocalDatabase('savant-tracker-boot')
    const proxy = createStorageProxy(new IndexedDbAdapter({ databaseName: 'savant-tracker-boot' }))
    await proxy.open()
    const repository = new TrackerRepository(proxy)

    const first = await repository.bootstrap()
    assertEqual(first.seeded, true, 'first boot seeds')
    assertEqual(first.state.projects.length, 43, 'all projects landed')
    assertEqual(first.log.length, 183, 'the change log landed')

    const second = await repository.bootstrap()
    assertEqual(second.seeded, false, 'second boot does not reseed')
    assertEqual(second.state.projects.length, 43, 'data is unchanged')
    await proxy.close()
  })

  await record('Edits persist through the repository and bump the version', async () => {
    const proxy = createStorageProxy(new IndexedDbAdapter({ databaseName: 'savant-tracker-boot' }))
    await proxy.open()
    const repository = new TrackerRepository(proxy)
    const boot = await repository.bootstrap()

    const target = boot.state.projects[0]
    const next = {
      ...boot.state,
      projects: boot.state.projects.map((p) => (p.id === target.id ? { ...p, progress: 77, rag: 'red' } : p)),
    }
    const saved = await repository.saveState(next)
    assertEqual(saved.ok, true, 'the save succeeded')

    const reread = await repository.readState()
    const changed = reread.projects.find((p) => p.id === target.id)
    assertEqual(changed.progress, 77, 'progress persisted')
    assertEqual(changed.rag, 'red', 'rag persisted')
    await proxy.close()
  })

  await record('A conflicting save is refused and returns the stored value', async () => {
    await destroyLocalDatabase('savant-tracker-conflict')
    const proxy = createStorageProxy(new IndexedDbAdapter({ databaseName: 'savant-tracker-conflict' }))
    await proxy.open()
    const repository = new TrackerRepository(proxy)
    await repository.bootstrap()
    const state = await repository.readState()

    // Simulate a second writer getting there first.
    await proxy.put(DOC_KEYS.state, { ...state, quarter: 'written by someone else' })

    const attempt = await repository.saveState({ ...state, quarter: 'my edit' })
    assertEqual(attempt.ok, false, 'the stale save was refused')
    assertEqual(attempt.theirs.quarter, 'written by someone else', 'the winning value came back')
    await proxy.close()
  })

  // ── 8. Export / import round-trip ──────────────────────────────────
  await record('Export and import round-trip without loss', async () => {
    await destroyLocalDatabase('savant-tracker-file')
    const proxy = createStorageProxy(new IndexedDbAdapter({ databaseName: 'savant-tracker-file' }))
    await proxy.open()
    const repository = new TrackerRepository(proxy)
    await repository.bootstrap()

    const exported = await repository.exportAll('test')
    const text = serializeAppFile(exported)
    const reparsed = parseAppFile(JSON.parse(text))

    assertEqual(reparsed.file.state.projects.length, 43, 'projects survive the round-trip')
    assertEqual(reparsed.file.log.length, 183, 'log entries survive the round-trip')
    assertEqual(
      JSON.stringify(reparsed.file.state),
      JSON.stringify(exported.state),
      'state is byte-identical after a round-trip',
    )

    // Now import a modified file over the top.
    const modified = createAppFile(
      { ...exported.state, quarter: 'imported quarter' },
      exported.log,
      exported.settings,
      'test-import',
    )
    await repository.replaceAll(parseAppFile(JSON.parse(serializeAppFile(modified))).file)
    const after = await repository.readState()
    assertEqual(after.quarter, 'imported quarter', 'the imported file replaced the stored state')
    await proxy.close()
  })

  await record('A legacy artifact export still imports', async () => {
    // The old tracker exported a bare state object using `updatedBy` for the
    // editor name and no decisionOutcome field at all.
    const legacy = {
      quarter: '2026 Enterprise Initiatives (Tier 0/1)',
      pillars: [{ id: 'obj-1', title: 'Pillar 1', owner: '' }],
      initiatives: [{ id: 'init-1', pillarId: 'obj-1', title: 'Initiative 1' }],
      projects: [
        {
          id: 'proj-1',
          initiativeId: 'init-1',
          title: 'Legacy project',
          rag: 'amber',
          progress: 45,
          updatedBy: 'Nate',
          updatedAt: '2026-09-02T00:00:00.000Z',
          issues: [{ id: 'iss-1', title: 'An issue', severity: 'medium', status: 'open' }],
        },
      ],
    }

    const parsed = parseAppFile(legacy)
    assertEqual(parsed.file.formatVersion, 1, 'upgraded to the current format version')
    assertEqual(parsed.file.state.projects[0].updatedByName, 'Nate', 'the legacy editor name was preserved')
    assertEqual(parsed.file.state.projects[0].decisionOutcome, '', 'the missing field was filled in')
    assertEqual(parsed.file.state.projects[0].phase, '', 'the missing phase defaulted safely')
    assert(parsed.warnings.length > 0, 'the repairs were reported as warnings')
  })

  await record('Junk files are rejected instead of wiping the tracker', async () => {
    let threw = null
    try {
      parseAppFile({ hello: 'world' })
    } catch (error) {
      threw = error
    }
    assert(threw !== null, 'a non-tracker file throws')
    assert(String(threw.message).includes('not a tracker export'), 'the message explains why')
  })

  await record('A file from a newer format version is refused', async () => {
    let threw = null
    try {
      parseAppFile({ formatVersion: 99, state: { pillars: [], projects: [], initiatives: [] } })
    } catch (error) {
      threw = error
    }
    assert(threw !== null, 'a future-format file throws rather than silently downgrading')
  })

  // ── 9. Derived numbers ─────────────────────────────────────────────
  await record('Search and rollups agree with the data', async () => {
    const file = bundledSnapshot()
    const counts = countByRag(file.state.projects)
    assertEqual(counts.amber, 18, 'amber count matches the live tracker')
    assertEqual(counts.green, 16, 'green count matches the live tracker')
    assertEqual(counts.red, 9, 'red count matches the live tracker')

    const red = searchProjects(file.state, { query: '', rag: 'red', staleOnly: false, decisionsOnly: false }, 30)
    assertEqual(red.length, 9, 'the red filter returns nine projects')
    assert(
      red.every((hit) => hit.project.rag === 'red'),
      'every hit really is red',
    )

    const named = searchProjects(
      file.state,
      { query: 'brent', rag: null, staleOnly: false, decisionsOnly: false },
      30,
    )
    assert(named.length > 0, 'an owner search finds projects')
    assert(
      named.every((hit) => hit.ownerMatch !== null || hit.project.title.toLowerCase().includes('brent')),
      'owner matches are labelled',
    )

    const firstInitiative = file.state.initiatives.find(
      (i) => file.state.projects.filter((p) => p.initiativeId === i.id).length > 1,
    )
    const rollup = initiativeRollup(file.state, firstInitiative.id)
    assert(rollup.avgProgress >= 0 && rollup.avgProgress <= 100, 'average progress is a percentage')
    assertEqual(
      rollup.total,
      file.state.projects.filter((p) => p.initiativeId === firstInitiative.id).length,
      'the rollup counts every project under the initiative',
    )

    const old = { ...file.state.projects[0], updatedAt: '2020-01-01T00:00:00.000Z' }
    assertEqual(isStale(old, 30), true, 'a 2020 timestamp is stale at a 30 day threshold')
  })

  // ── 10. Download path ──────────────────────────────────────────────
  await record('Export produces a downloadable JSON blob', async () => {
    const { downloadAppFile } = await import('./out/lib/file-io.js')
    const file = bundledSnapshot()

    let captured = null
    const originalCreate = URL.createObjectURL
    URL.createObjectURL = (blob) => {
      captured = blob
      return 'blob:stub'
    }
    const originalClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {}

    const name = downloadAppFile(file, 'harness')

    URL.createObjectURL = originalCreate
    HTMLAnchorElement.prototype.click = originalClick

    assert(name.startsWith('savant-initiatives-tracker-'), 'the file name is descriptive')
    assert(name.endsWith('-harness.json'), 'the tag is applied')
    assert(captured instanceof Blob, 'a Blob was handed to the browser')
    assertEqual(captured.type, 'application/json', 'the blob is typed as JSON')
    const text = await captured.text()
    assertEqual(JSON.parse(text).state.projects.length, 43, 'the blob holds the full dataset')
  })

  await destroyLocalDatabase('savant-tracker-test')
  return results
}

window.__RESULTS__ = run().then((all) => {
  document.title = all.every((r) => r.ok) ? 'PASS' : 'FAIL'
  return all
})
