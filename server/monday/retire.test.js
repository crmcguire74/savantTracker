// 🧪 Retire step: plan, approval code, backup, restore.
import { describe, expect, it } from 'vitest'
import { FIELD_COLUMNS, mapItem, resolveColumns, SYNCED_FIELDS } from './mapping.js'
import { mergeMonday } from './merge.js'
import { applyRetire, approvalCode, planRetire, retireLogEntries, TRACKER_ONLY_FIELDS } from './retire.js'
import { BACKUP_PREFIX, listBackups, LOG_KEY, restoreBackup, runMondaySync, STATE_KEY } from './sync.js'
import { createMemoryStore } from '../memory-store.js'

const NOW = '2026-11-03T14:30:00.000Z'

// ───────────────────────────── fixtures ─────────────────────────────

const oldProject = (over = {}) => ({
  id: 'p-legacy',
  initiativeId: 'i-old',
  title: 'Legacy project',
  businessOwner: '',
  executionOwner: '',
  projectManager: '',
  scope: '',
  trending: 'stable',
  phase: '',
  validation: '',
  planLink: '',
  startDate: '',
  originalEndDate: '',
  forecastEndDate: '',
  nextMilestone: '',
  nextMilestoneDate: '',
  dependencies: '',
  keyRisk: '',
  decisionNeeded: '',
  decisionOutcome: '',
  rag: 'green',
  progress: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
  updatedById: 'u1',
  updatedByName: 'Chris',
  issues: [],
  ...over,
})

const ISSUE = { id: 'iss1', title: 'Vendor late', severity: 'high', status: 'open' }

const oldState = () => ({
  quarter: 'Q',
  pillars: [{ id: 'obj-1', title: 'Pillar 1: Old Pillar', owner: '' }],
  initiatives: [
    { id: 'i-old', pillarId: 'obj-1', title: 'Old initiative', businessOwner: '', executionOwner: '', startQuarter: '', endQuarter: '' },
  ],
  projects: [
    oldProject(),
    oldProject({
      id: 'p-owl-old',
      title: 'Project Owl 2.0',
      planLink: 'https://plan.example/owl',
      decisionOutcome: 'Approved by SteerCo',
      issues: [ISSUE],
    }),
  ],
})

const item = (mondayId, title, fields = {}) => ({ mondayId, title, updatedAt: '2026-10-30T15:00:00Z', fields })
const discoveredWith = (projects) => ({
  boards: [
    {
      pillar: { id: '1', name: 'Accelerate Advisory Organic Growth' },
      initiative: { id: '2', name: 'Growth Intelligence' },
      board: { id: '101', name: 'Growth Intelligence' },
      projects,
    },
  ],
})
const DISCOVERED = discoveredWith([item('9001', 'Project Owl 2.0', { rag: 'amber', progress: 50 })])

const mergedOld = () => mergeMonday(oldState(), DISCOVERED, { now: NOW }).state

// A fake monday that serves the same data as DISCOVERED, in the shapes discover.js asks for.
const REGISTER_COLUMNS = SYNCED_FIELDS.map((field) => ({ id: `c_${field}`, title: FIELD_COLUMNS[field][0], type: 'text' }))
const cells = (values) => Object.entries(values).map(([field, text]) => ({ id: `c_${field}`, type: 'text', text }))
const OWL_ROW = {
  id: 9001,
  name: 'Project Owl 2.0',
  updated_at: '2026-10-30T15:00:00Z',
  group: { id: 'g1', title: 'Projects' },
  column_values: cells({ rag: 'At risk', progress: '50', businessOwner: 'Stephanie Kaminski', executionOwner: 'Daran Becker' }),
}
const fakeClient = (rows = [OWL_ROW]) => ({
  async query(gql, variables) {
    if (gql.includes('folders(')) {
      return {
        folders: [
          { id: 1, name: 'Accelerate Advisory Organic Growth', parent: null, sub_folders: [{ id: 2 }], children: [] },
          { id: 2, name: 'Growth Intelligence', parent: { id: 1 }, sub_folders: [], children: [{ id: 101, name: 'Growth Intelligence' }] },
        ],
      }
    }
    if (gql.includes('columns { id title type }')) {
      return { boards: variables.ids.map((id) => ({ id, name: `b${id}`, columns: REGISTER_COLUMNS })) }
    }
    if (gql.includes('next_items_page')) return { next_items_page: { cursor: null, items: [] } }
    if (gql.includes('items_page')) return { boards: [{ items_page: { cursor: null, items: rows } }] }
    throw new Error(`unexpected query: ${gql.slice(0, 40)}`)
  },
})

const seedStore = () =>
  createMemoryStore([
    { key: STATE_KEY, value: oldState(), version: 4, updatedAt: '' },
    { key: LOG_KEY, value: { entries: [{ id: 'old', timestamp: 'x', projectId: '', projectTitle: '', field: 'f', fieldKey: '', oldValue: '', newValue: '', editedById: '', editedByName: '' }] }, version: 2, updatedAt: '' },
  ])

const syncArgs = (store, extra = {}) => ({ store, client: fakeClient(), workspaceId: '7', now: NOW, ...extra })

const attemptApply = async (args) => {
  try {
    return { report: await runMondaySync(args) }
  } catch (error) {
    return { error }
  }
}

// ───────────────────────────── plan ─────────────────────────────

describe('retire plan', () => {
  it('lists records monday does not have and leaves what monday created', () => {
    const plan = planRetire(mergedOld(), DISCOVERED)
    expect(plan.empty).toBe(false)
    expect(plan.projects.map((entry) => entry.id).sort()).toEqual(['p-legacy', 'p-owl-old'])
    expect(plan.projects.every((entry) => entry.reason === 'not on monday')).toBe(true)
    expect(plan.initiatives.map((entry) => entry.id)).toEqual(['i-old'])
    expect(plan.pillars.map((entry) => entry.id)).toEqual(['obj-1'])
  })

  it('moves tracker-only data to the same-titled project that stays', () => {
    const merged = mergedOld()
    const plan = planRetire(merged, DISCOVERED)
    expect(plan.adopted).toEqual([
      { fromId: 'p-owl-old', toId: 'proj-monday-9001', title: 'Project Owl 2.0', fields: ['issues', 'planLink', 'decisionOutcome'] },
    ])
    const after = applyRetire(merged, plan)
    const owl = after.projects.find((project) => project.mondayId === '9001')
    expect(owl.issues).toEqual([ISSUE])
    expect(owl.planLink).toBe('https://plan.example/owl')
    expect(owl.decisionOutcome).toBe('Approved by SteerCo')
    expect(TRACKER_ONLY_FIELDS).toEqual(['issues', 'planLink', 'decisionOutcome'])
  })

  it('does not overwrite tracker-only data the surviving project already has', () => {
    const merged = mergedOld()
    const withOwn = {
      ...merged,
      projects: merged.projects.map((project) => (project.mondayId === '9001' ? { ...project, planLink: 'https://mine' } : project)),
    }
    const plan = planRetire(withOwn, DISCOVERED)
    expect(plan.adopted[0].fields).toEqual(['issues', 'decisionOutcome'])
    const owl = applyRetire(withOwn, plan).projects.find((project) => project.mondayId === '9001')
    expect(owl.planLink).toBe('https://mine')
  })

  it('leaves only what monday has after applying, with nothing orphaned', () => {
    const after = applyRetire(mergedOld(), planRetire(mergedOld(), DISCOVERED))
    expect(after.projects.map((project) => project.mondayId)).toEqual(['9001'])
    expect(after.initiatives).toHaveLength(1)
    expect(after.pillars).toHaveLength(1)
    const pillarIds = new Set(after.pillars.map((pillar) => pillar.id))
    expect(after.initiatives.every((initiative) => pillarIds.has(initiative.pillarId))).toBe(true)
    expect(after.projects.every((project) => after.initiatives.some((initiative) => initiative.id === project.initiativeId))).toBe(true)
  })

  it('does not touch its input', () => {
    const merged = mergedOld()
    const frozen = JSON.stringify(merged)
    applyRetire(merged, planRetire(merged, DISCOVERED))
    expect(JSON.stringify(merged)).toBe(frozen)
  })

  it('retires nothing, and says so, when monday returned no boards', () => {
    const plan = planRetire(oldState(), { boards: [] })
    expect(plan.empty).toBe(true)
    expect(plan.approval).toBe('')
    expect(plan.warnings[0]).toContain('no project boards')
    expect(applyRetire(oldState(), plan)).toEqual(oldState())
  })

  it('retires a linked project that left a board the sync read, and keeps one on a board it did not read', () => {
    const base = mergedOld()
    const linkedGone = oldProject({ id: 'p-gone', title: 'Went away', mondayId: '5555', initiativeId: base.initiatives.find((i) => i.mondayId === '2').id })
    const linkedElsewhere = oldProject({ id: 'p-else', title: 'Other board', mondayId: '6666', initiativeId: 'i-unseen' })
    const state = {
      ...base,
      initiatives: [
        ...base.initiatives,
        { id: 'i-unseen', pillarId: base.pillars[base.pillars.length - 1].id, title: 'Skipped board', businessOwner: '', executionOwner: '', startQuarter: '', endQuarter: '', mondayId: '77' },
      ],
      projects: [...base.projects, linkedGone, linkedElsewhere],
    }
    const plan = planRetire(state, DISCOVERED)
    expect(plan.projects.find((entry) => entry.id === 'p-gone').reason).toBe('removed from its monday board')
    expect(plan.projects.some((entry) => entry.id === 'p-else')).toBe(false)
    expect(plan.initiatives.some((entry) => entry.id === 'i-unseen')).toBe(false)
  })

  it('keeps a pillar that a surviving initiative still points at, with a warning', () => {
    const base = mergedOld()
    const state = {
      ...base,
      initiatives: base.initiatives.map((initiative) => (initiative.mondayId === '2' ? { ...initiative, pillarId: 'obj-1' } : initiative)),
    }
    const plan = planRetire(state, DISCOVERED)
    expect(plan.pillars).toEqual([])
    expect(plan.warnings.some((warning) => warning.includes('Old Pillar'))).toBe(true)
  })
})

describe('approval code', () => {
  it('is the same for the same list and different when the list changes', () => {
    const a = approvalCode([{ id: 'p1' }, { id: 'p2' }], [{ id: 'i1' }], [])
    expect(approvalCode([{ id: 'p2' }, { id: 'p1' }], [{ id: 'i1' }], [])).toBe(a)
    expect(approvalCode([{ id: 'p1' }], [{ id: 'i1' }], [])).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('retire log lines', () => {
  it('writes one line per project and one summary, each naming the backup', () => {
    const plan = planRetire(mergedOld(), DISCOVERED)
    const lines = retireLogEntries(plan, { now: NOW, backupKey: 'tracker.backup.X' })
    expect(lines).toHaveLength(plan.projects.length + 1)
    expect(lines.every((line) => line.field === 'Retired' && line.newValue.includes('tracker.backup.X'))).toBe(true)
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length)
    expect(retireLogEntries({ empty: true }, { now: NOW, backupKey: 'k' })).toEqual([])
  })
})

// ───────────────────────────── sync run ─────────────────────────────

describe('sync run with retire', () => {
  it('a dry run lists the retire plan and writes nothing, not even a backup', async () => {
    const store = seedStore()
    const report = await runMondaySync(syncArgs(store, { retire: true }))
    expect(report.written).toBe(false)
    expect(report.retire.counts).toEqual({ projects: 2, initiatives: 1, pillars: 1 })
    expect(report.retire.approval).toMatch(/^[0-9a-f]{12}$/)
    expect(report.retire.backupKey).toBeNull()
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(4)
    expect(await store.listDocuments(BACKUP_PREFIX)).toHaveLength(0)
  })

  it('refuses to apply without the approval code, and removes nothing', async () => {
    const store = seedStore()
    const { error } = await attemptApply(syncArgs(store, { retire: true, apply: true }))
    expect(error.name).toBe('RetireApprovalError')
    expect(error.message).toContain('needs approval')
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(4)
  })

  it('refuses a wrong approval code', async () => {
    const store = seedStore()
    const { error } = await attemptApply(syncArgs(store, { retire: true, apply: true, approval: 'deadbeef0000' }))
    expect(error.name).toBe('RetireApprovalError')
    expect(error.message).toContain('changed since you reviewed')
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(4)
  })

  it('applies with the right code: backs up first, retires, logs, keeps tracker-only data', async () => {
    const store = seedStore()
    const dry = await runMondaySync(syncArgs(store, { retire: true }))
    const report = await runMondaySync(syncArgs(store, { retire: true, apply: true, approval: dry.retire.approval }))

    expect(report.written).toBe(true)
    expect(report.retire.backupKey).toBe(`${BACKUP_PREFIX}20261103T143000000Z`)

    const backup = (await store.readDocument(report.retire.backupKey)).doc.value
    expect(backup.state).toEqual(oldState())
    expect(backup.log).toHaveLength(1)

    const state = (await store.readDocument(STATE_KEY)).doc.value
    expect(state.projects.map((project) => project.mondayId)).toEqual(['9001'])
    expect(state.projects[0].issues).toEqual([ISSUE])
    expect(state.initiatives).toHaveLength(1)
    expect(state.pillars).toHaveLength(1)

    const log = (await store.readDocument(LOG_KEY)).doc.value.entries
    expect(log.some((entry) => entry.field === 'Retired' && entry.projectId === 'p-legacy')).toBe(true)
    expect(log[log.length - 1].id).toBe('old')
  })

  it('a second retire run finds nothing to retire and writes nothing', async () => {
    const store = seedStore()
    const dry = await runMondaySync(syncArgs(store, { retire: true }))
    await runMondaySync(syncArgs(store, { retire: true, apply: true, approval: dry.retire.approval }))
    const version = (await store.readDocument(STATE_KEY)).doc.version
    const again = await runMondaySync(syncArgs(store, { retire: true, apply: true }))
    expect(again.written).toBe(false)
    expect(again.retire.empty).toBe(true)
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(version)
    expect(await store.listDocuments(BACKUP_PREFIX)).toHaveLength(1)
  })

  it('without the retire flag an apply keeps every old record, as before', async () => {
    const store = seedStore()
    const report = await runMondaySync(syncArgs(store, { apply: true }))
    expect(report.retire).toBeNull()
    const state = (await store.readDocument(STATE_KEY)).doc.value
    expect(state.projects.some((project) => project.id === 'p-legacy')).toBe(true)
    expect(await store.listDocuments(BACKUP_PREFIX)).toHaveLength(0)
  })

  it('refuses when someone added a record after the list was approved', async () => {
    const store = seedStore()
    const dry = await runMondaySync(syncArgs(store, { retire: true }))
    const current = (await store.readDocument(STATE_KEY)).doc
    await store.writeDocument(
      STATE_KEY,
      { ...current.value, projects: [...current.value.projects, oldProject({ id: 'p-new-by-hand', title: 'Added by hand' })] },
      current.version,
    )
    const { error } = await attemptApply(syncArgs(store, { retire: true, apply: true, approval: dry.retire.approval }))
    expect(error.name).toBe('RetireApprovalError')
    const state = (await store.readDocument(STATE_KEY)).doc.value
    expect(state.projects.some((project) => project.id === 'p-new-by-hand')).toBe(true)
  })

  it('removes nothing when monday returns no project rows', async () => {
    const store = seedStore()
    const noBoards = { async query() { return { folders: [] } } }
    const report = await runMondaySync(syncArgs(store, { client: noBoards, retire: true, apply: true }))
    expect(report.retire.empty).toBe(true)
    expect(report.written).toBe(false)
    expect((await store.readDocument(STATE_KEY)).doc.value.projects).toHaveLength(2)
  })
})

// ───────────────────────────── backups ─────────────────────────────

describe('backups and restore', () => {
  const retired = async () => {
    const store = seedStore()
    const dry = await runMondaySync(syncArgs(store, { retire: true }))
    const done = await runMondaySync(syncArgs(store, { retire: true, apply: true, approval: dry.retire.approval }))
    return { store, key: done.retire.backupKey }
  }

  it('lists backups, newest first', async () => {
    const { store, key } = await retired()
    const backups = await listBackups(store)
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatchObject({ key, createdAt: NOW, reason: 'before monday retire' })
  })

  it('a dry-run restore reports what it would bring back and changes nothing', async () => {
    const { store, key } = await retired()
    const before = (await store.readDocument(STATE_KEY)).doc.version
    const result = await restoreBackup({ store, key })
    expect(result).toMatchObject({ mode: 'dry-run', written: false })
    expect(result.summary).toMatchObject({ pillars: 1, initiatives: 1, projects: 2 })
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(before)
  })

  it('restores the old state and saves the current one first', async () => {
    const { store, key } = await retired()
    const result = await restoreBackup({ store, key, apply: true, now: '2026-11-03T15:00:00.000Z' })
    expect(result.written).toBe(true)

    const state = (await store.readDocument(STATE_KEY)).doc.value
    expect(state).toEqual(oldState())
    expect((await store.readDocument(LOG_KEY)).doc.value.entries).toHaveLength(1)

    const safety = (await store.readDocument(result.safetyKey)).doc.value
    expect(safety.state.projects.map((project) => project.mondayId)).toEqual(['9001'])
    expect(safety.reason).toContain(key)
  })

  it('rejects a key that is not a backup and a backup that does not exist', async () => {
    const store = seedStore()
    await expect(restoreBackup({ store, key: STATE_KEY })).rejects.toThrow('Backup keys start with')
    await expect(restoreBackup({ store, key: `${BACKUP_PREFIX}nope` })).rejects.toThrow('No backup named')
  })
})

// ───────────────────────────── placeholder rows ─────────────────────────────

describe('placeholder rows', () => {
  const row = (id, name) => ({ ...OWL_ROW, id, name })
  const rows = [OWL_ROW, row(9101, 'Rename'), row(9102, 'test'), row(9103, ' RENAME ')]

  it('ignores template "Rename" and "test" rows and says how many', async () => {
    const report = await runMondaySync(syncArgs(seedStore(), { client: fakeClient(rows) }))
    expect(report.summary.projectsSeen).toBe(1)
    expect(report.warnings.some((warning) => warning.includes('Ignored 3 placeholder row(s)'))).toBe(true)
  })

  it('takes a different ignore list when given one', async () => {
    const report = await runMondaySync(syncArgs(seedStore(), { client: fakeClient(rows), ignoreTitles: [] }))
    expect(report.summary.projectsSeen).toBe(4)
  })
})

describe('phase "N/A"', () => {
  it('reads as not set: no value, no warning, and validation "N/A" still counts', () => {
    const columns = resolveColumns(REGISTER_COLUMNS)
    const row = { id: 1, name: 'DAP Platinum', updated_at: '', column_values: cells({ phase: 'N/A', validation: 'N/A' }) }
    const mapped = mapItem(row, columns)
    expect('phase' in mapped.fields).toBe(false)
    expect(mapped.fields.validation).toBe('na')
    expect(mapped.warnings).toEqual([])
  })
})
