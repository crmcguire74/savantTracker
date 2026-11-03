// @vitest-environment node
// 🧪 monday sync tests. No network: the monday client is a stub that answers
// the same queries the real one sends, with data shaped like the "Deliver
// WiseOS Advisor Workspace" project register.

import { describe, expect, it } from 'vitest'
import { FIELD_LABELS as TS_LABELS, LOG_LIMIT as TS_LOG_LIMIT } from '../../src/constants.ts'
import { createMondayClient, MondayError } from './client.js'
import { discoverProjects } from './discover.js'
import { LOG_LIMIT, mergeMonday, SYNC_ID } from './merge.js'
import { FIELD_COLUMNS, FIELD_LABELS, isProjectRegister, mapItem, PARSERS, resolveColumns, SYNCED_FIELDS } from './mapping.js'
import { createMemoryStore } from '../memory-store.js'
import { runMondaySync, LOG_KEY, STATE_KEY } from './sync.js'

// ───────────────────────────── fixtures ─────────────────────────────

const REGISTER_COLUMNS = SYNCED_FIELDS.map((field) => ({
  id: `c_${field}`,
  title: FIELD_COLUMNS[field][0],
  type: 'text',
}))
const TASK_COLUMNS = ['Owner', 'Item Type', 'Status', 'Workstream', 'Release'].map((title, i) => ({
  id: `t${i}`,
  title,
  type: 'text',
}))

const cells = (values) => Object.entries(values).map(([field, text]) => ({ id: `c_${field}`, type: 'text', text }))

const OWL = {
  id: 9001,
  name: 'WiseOS MVP Portfolio',
  updated_at: '2026-10-30T15:00:00Z',
  group: { id: 'g1', title: 'Projects' },
  column_values: cells({
    businessOwner: 'Daran Becker',
    executionOwner: 'Elite Workflow',
    projectManager: 'Ashley Fitch',
    rag: 'At risk',
    trending: 'Improving',
    phase: 'Multi-Phase (Release Based)',
    validation: 'In Progress',
    progress: '50%',
    startDate: '2026-10-20',
    originalEndDate: '2026-11-17',
    forecastEndDate: '2026-11-17',
    keyRisk: 'Final requirements for enhancements',
    dependencies: 'Write API from DAP',
    decisionNeeded: 'Agreement on enhancements',
    nextMilestone: 'Confirm data availability',
    nextMilestoneDate: '2026-11-17',
  }),
}
const COACH = {
  id: 9002,
  name: 'Apollo — wiseCoach',
  updated_at: '2026-10-29T10:00:00Z',
  group: { id: 'g1', title: 'Projects' },
  column_values: cells({
    businessOwner: 'Dom Anzevino',
    executionOwner: 'Elite Workflow',
    rag: 'At risk',
    trending: 'Declining',
    phase: 'Multi-Phase (Release Based)',
    validation: 'In Progress',
    progress: '75',
  }),
}
const STRAY_TASK = {
  id: 9003,
  name: 'Some task row',
  group: { id: 'g2', title: 'Tasks' },
  column_values: [],
}

const FOLDERS = [
  { id: 1, name: 'Accelerate Advisory Organic Growth', parent: null, sub_folders: [{ id: 2 }], children: [] },
  {
    id: 2,
    name: 'Growth Intelligence & Performance Optimization',
    parent: { id: 1 },
    sub_folders: [],
    children: [
      { id: 101, name: 'Growth Intelligence & Performance Optimization' },
      { id: 102, name: 'Project Owl 2.0' },
    ],
  },
  { id: 4, name: 'Unify the Enterprise Operating Platform', parent: null, sub_folders: [{ id: 5 }], children: [{ id: 109, name: 'Loose board' }] },
  {
    id: 5,
    name: 'Deliver WiseOS Advisor Workspace',
    parent: { id: 4 },
    sub_folders: [{ id: 6 }],
    children: [{ id: 105, name: 'Deliver WiseOS Advisor Workspace' }],
  },
  { id: 6, name: 'Nested deeper', parent: { id: 5 }, sub_folders: [], children: [{ id: 106, name: 'Nested register' }] },
]

const BOARD_COLUMNS = {
  101: REGISTER_COLUMNS,
  102: TASK_COLUMNS,
  105: REGISTER_COLUMNS,
  106: REGISTER_COLUMNS,
  109: TASK_COLUMNS,
}
const BOARD_ITEMS = { 101: [], 105: [OWL, COACH, STRAY_TASK], 106: [] }

/** Answers the queries discover.js sends. Records every query for assertions. */
const fakeClient = (overrides = {}) => {
  const calls = []
  return {
    calls,
    async query(gql, variables) {
      calls.push(gql)
      if (gql.includes('folders(')) return { folders: overrides.folders ?? FOLDERS }
      if (gql.includes('columns { id title type }')) {
        return {
          boards: variables.ids.map((id) => ({ id, name: `b${id}`, columns: (overrides.columns ?? BOARD_COLUMNS)[id] ?? [] })),
        }
      }
      if (gql.includes('next_items_page')) return { next_items_page: { cursor: null, items: overrides.page2 ?? [] } }
      if (gql.includes('items_page')) {
        const id = variables.ids[0]
        const items = (overrides.items ?? BOARD_ITEMS)[id] ?? []
        return { boards: [{ items_page: { cursor: overrides.cursor ?? null, items } }] }
      }
      throw new Error(`unexpected query: ${gql.slice(0, 40)}`)
    },
  }
}

const emptyState = () => ({ quarter: 'Q', pillars: [], initiatives: [], projects: [] })

const trackerProject = (over = {}) => ({
  id: 'init-2-2',
  initiativeId: 'i1',
  title: 'WiseOS MVP Portfolio',
  businessOwner: 'old owner',
  executionOwner: '',
  projectManager: '',
  scope: '',
  trending: 'stable',
  phase: '',
  validation: '',
  planLink: 'https://plan.example/owl',
  startDate: '',
  originalEndDate: '',
  forecastEndDate: '',
  nextMilestone: '',
  nextMilestoneDate: '',
  dependencies: '',
  keyRisk: '',
  decisionNeeded: '',
  decisionOutcome: 'Approved by SteerCo',
  rag: 'green',
  progress: 10,
  updatedAt: '2026-09-02T00:00:00.000Z',
  updatedById: 'u1',
  updatedByName: 'Chris',
  issues: [{ id: 'iss1', title: 'Local issue', severity: 'high', status: 'open' }],
  ...over,
})

const existingState = () => ({
  quarter: 'Q',
  pillars: [{ id: 'obj-1', title: 'Pillar 1: Accelerate Advisory Organic Growth', owner: '' }],
  initiatives: [
    {
      id: 'i1',
      pillarId: 'obj-1',
      title: 'Growth Intelligence & Performance Optimization',
      businessOwner: '',
      executionOwner: '',
      startQuarter: '',
      endQuarter: '',
    },
  ],
  projects: [],
})

const board = (projects) => ({
  pillar: { id: '1', name: 'Accelerate Advisory Organic Growth' },
  initiative: { id: '2', name: 'Growth Intelligence & Performance Optimization' },
  board: { id: '101', name: 'Growth Intelligence & Performance Optimization' },
  projects,
})

const mapped = (item) => mapItem(item, resolveColumns(REGISTER_COLUMNS))

// ───────────────────────────── mapping ─────────────────────────────

describe('column and value mapping', () => {
  it('finds columns by title, including short aliases, case and punctuation insensitive', () => {
    const resolved = resolveColumns([
      { id: 'a', title: 'rag status' },
      { id: 'b', title: 'KEY RISK / BLOCKER' },
      { id: 'c', title: 'Original End Date' },
    ])
    expect(resolved).toEqual({ rag: 'a', keyRisk: 'b', originalEndDate: 'c' })
  })

  it('treats only boards with the project columns as project registers', () => {
    expect(isProjectRegister(REGISTER_COLUMNS)).toBe(true)
    expect(isProjectRegister(TASK_COLUMNS)).toBe(false)
  })

  it('maps a full project row to tracker values', () => {
    const item = mapped(OWL)
    expect(item.mondayId).toBe('9001')
    expect(item.fields.rag).toBe('amber')
    expect(item.fields.trending).toBe('improving')
    expect(item.fields.phase).toBe('multi_phase')
    expect(item.fields.validation).toBe('in_progress')
    expect(item.fields.progress).toBe(50)
    expect(item.fields.forecastEndDate).toBe('2026-11-17')
    expect(item.fields.businessOwner).toBe('Daran Becker')
  })

  it('reads every RAG, trend, phase and validation label', () => {
    expect(['On track', 'At risk', 'Off track'].map(PARSERS.rag)).toEqual(['green', 'amber', 'red'])
    expect(['Improving', 'Flat', 'Declining'].map(PARSERS.trending)).toEqual(['improving', 'stable', 'declining'])
    expect(['Discovery', 'Planning', 'Execution', 'Review', 'Launch', 'Stabilize', 'Closed'].map(PARSERS.phase)).toEqual([
      'discovery', 'planning', 'execution', 'review', 'launch', 'stabilize', 'closed',
    ])
    expect(['Design', 'Build', 'UAT', 'Continuous Improvement', 'Close'].map(PARSERS.phase)).toEqual([
      'planning', 'execution', 'review', 'stabilize', 'closed',
    ])
    expect(['Not Started', 'Pending', 'In Progress', 'Completed', 'N/A'].map(PARSERS.validation)).toEqual([
      'not_started', 'pending', 'in_progress', 'completed', 'na',
    ])
  })

  it('clamps progress and reads dates with a time part', () => {
    expect(PARSERS.progress('150%')).toBe(100)
    expect(PARSERS.progress('0')).toBe(0)
    expect(PARSERS.progress('n/a')).toBeUndefined()
    expect(PARSERS.startDate('2026-10-20 14:00')).toBe('2026-10-20')
    expect(PARSERS.startDate('Oct 20')).toBeUndefined()
  })

  it('leaves blank cells out and warns on unreadable ones', () => {
    const item = mapItem(
      { id: 1, name: 'X', column_values: cells({ rag: 'Purple', scope: '   ', progress: '' }) },
      resolveColumns(REGISTER_COLUMNS),
    )
    expect(item.fields).toEqual({})
    expect(item.warnings).toHaveLength(1)
  })

  it('keeps the tracker constants and the sync constants in step', () => {
    SYNCED_FIELDS.forEach((field) => expect(FIELD_LABELS[field]).toBe(TS_LABELS[field]))
    expect(LOG_LIMIT).toBe(TS_LOG_LIMIT)
  })
})

describe('shapes captured from the live monday API (Nov 2026)', () => {
  // Real column ids and titles from the "Deliver WiseOS Advisor Workspace" register.
  const LIVE_COLUMNS = [
    ['portfolio_project_owner', 'Project Manager'],
    ['portfolio_project_rag', 'RAG Status'],
    ['portfolio_project_progress', 'Not Needed'],
    ['portfolio_project_scope', 'Scope'],
    ['text_mm84hqk0', 'Business Owner'],
    ['text_mm84a9vv', 'Delivery Owner'],
    ['color_mm822fw', 'Trend'],
    ['color_mm82491d', 'Phase'],
    ['color_mm82jy3b', 'Validation'],
    ['numeric_mm89svd3', 'Project Progress'],
    ['date_mm82hhgp', 'Start Date'],
    ['date_mm82drmt', 'Original End Date'],
    ['date_mm82r49n', 'Forecast End Date'],
    ['text_mm82v19p', 'Key Risk / Blocker'],
    ['text_mm89chd2', 'Dependencies'],
    ['text_mm82mwtt', 'Decision Needed'],
    ['text_mm82kq65', 'Next Milestone'],
    ['date_mm822mwy', 'Next Milestone Date'],
  ].map(([id, title]) => ({ id, title, type: 'x' }))

  const LIVE_ITEM = {
    id: '13271079004',
    name: 'WiseOS MVP Portfolio',
    updated_at: '2026-10-30T22:01:39Z',
    group: { id: 'topics', title: 'Projects' },
    column_values: [
      { id: 'portfolio_project_owner', type: 'people', text: 'Ashley Flitter' },
      { id: 'portfolio_project_rag', type: 'status', text: 'At risk' },
      { id: 'portfolio_project_progress', type: 'mirror', text: null, display_value: 'Completed in UAT, Not Started' },
      { id: 'text_mm84hqk0', type: 'text', text: 'Daran Becker' },
      { id: 'text_mm84a9vv', type: 'text', text: 'Elite Workflow' },
      { id: 'color_mm822fw', type: 'status', text: 'Improving' },
      { id: 'color_mm82491d', type: 'status', text: 'Multi-Phase (Release Based)' },
      { id: 'color_mm82jy3b', type: 'status', text: 'In Progress' },
      { id: 'numeric_mm89svd3', type: 'numbers', text: '50' },
      { id: 'date_mm82hhgp', type: 'date', text: '2026-10-20' },
      { id: 'date_mm82drmt', type: 'date', text: '2026-11-17' },
      { id: 'date_mm82r49n', type: 'date', text: '2026-11-17' },
      { id: 'text_mm82v19p', type: 'text', text: 'Final requirements for enhancements' },
      { id: 'text_mm89chd2', type: 'text', text: 'Write API from DAP' },
      { id: 'text_mm82mwtt', type: 'text', text: 'Agreement on enhancements' },
      { id: 'text_mm82kq65', type: 'text', text: 'Confirm data availability' },
      { id: 'date_mm822mwy', type: 'date', text: '2026-11-17' },
    ],
  }

  it('recognizes the real register and reads a real row end to end', () => {
    expect(isProjectRegister(LIVE_COLUMNS)).toBe(true)
    const item = mapItem(LIVE_ITEM, resolveColumns(LIVE_COLUMNS))
    expect(item.warnings).toHaveLength(0)
    expect(item.fields).toEqual({
      projectManager: 'Ashley Flitter',
      rag: 'amber',
      businessOwner: 'Daran Becker',
      executionOwner: 'Elite Workflow',
      trending: 'improving',
      phase: 'multi_phase',
      validation: 'in_progress',
      progress: 50,
      startDate: '2026-10-20',
      originalEndDate: '2026-11-17',
      forecastEndDate: '2026-11-17',
      keyRisk: 'Final requirements for enhancements',
      dependencies: 'Write API from DAP',
      decisionNeeded: 'Agreement on enhancements',
      nextMilestone: 'Confirm data availability',
      nextMilestoneDate: '2026-11-17',
    })
  })

  it('does not map the rollup mirror column titled "Not Needed"', () => {
    const resolved = resolveColumns(LIVE_COLUMNS)
    expect(Object.values(resolved).includes('portfolio_project_progress')).toBe(false)
  })

  it('reads monday\'s "Project Health" placeholder as blank, without a warning', () => {
    const item = mapItem(
      { id: 1, name: 'X', column_values: [{ id: 'portfolio_project_rag', type: 'status', text: 'Project Health' }] },
      resolveColumns(LIVE_COLUMNS),
    )
    expect(item.fields).toEqual({})
    expect(item.warnings).toHaveLength(0)
  })
})

// ───────────────────────────── client ─────────────────────────────

describe('monday client', () => {
  const response = (status, body, headers = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  })

  it('refuses to start without a token', () => {
    expect(() => createMondayClient({ token: '' })).toThrow('MONDAY_API_TOKEN')
  })

  it('sends the token and version headers and returns data', async () => {
    let seen
    const client = createMondayClient({
      token: 'tok',
      apiVersion: '2026-04',
      fetchImpl: async (url, init) => {
        seen = { url, init }
        return response(200, { data: { ok: true } })
      },
    })
    expect(await client.query('{ me { id } }')).toEqual({ ok: true })
    expect(seen.init.headers.Authorization).toBe('tok')
    expect(seen.init.headers['API-Version']).toBe('2026-04')
  })

  it('retries a 429 after the wait monday asks for, then succeeds', async () => {
    const waits = []
    const replies = [response(429, {}, { 'retry-after': '2' }), response(200, { data: { n: 1 } })]
    const client = createMondayClient({
      token: 't',
      fetchImpl: async () => replies.shift(),
      sleep: async (ms) => waits.push(ms),
    })
    expect(await client.query('q')).toEqual({ n: 1 })
    expect(waits).toEqual([2000])
  })

  it('gives up after the attempt limit and says why', async () => {
    const client = createMondayClient({ token: 't', maxAttempts: 2, fetchImpl: async () => response(503, {}), sleep: async () => {} })
    let error
    try {
      await client.query('q')
    } catch (caught) {
      error = caught
    }
    expect(error instanceof MondayError).toBe(true)
    expect(error.status).toBe(503)
  })

  it('surfaces GraphQL errors without retrying', async () => {
    let calls = 0
    const client = createMondayClient({
      token: 't',
      fetchImpl: async () => {
        calls += 1
        return response(200, { errors: [{ message: 'Field not found' }] })
      },
    })
    let error
    try {
      await client.query('q')
    } catch (caught) {
      error = caught
    }
    expect(error.message).toContain('Field not found')
    expect(calls).toBe(1)
  })
})

// ───────────────────────────── discovery ─────────────────────────────

describe('discovery', () => {
  it('finds project registers and skips everything else with a reason', async () => {
    const found = await discoverProjects(fakeClient(), { workspaceId: '7' })
    const names = found.boards.map((entry) => entry.board.name)
    expect(names).toEqual(['Growth Intelligence & Performance Optimization', 'Deliver WiseOS Advisor Workspace', 'Nested register'])
    const skipped = found.skipped.map((entry) => entry.board)
    expect(skipped).toContain('Project Owl 2.0')
    expect(skipped).toContain('Loose board')
  })

  it('names the pillar and initiative from the folder path, and rolls deeper folders up', async () => {
    const found = await discoverProjects(fakeClient(), { workspaceId: '7' })
    const deliver = found.boards.find((entry) => entry.board.name === 'Deliver WiseOS Advisor Workspace')
    expect(deliver.pillar.name).toBe('Unify the Enterprise Operating Platform')
    expect(deliver.initiative.name).toBe('Deliver WiseOS Advisor Workspace')
    const nested = found.boards.find((entry) => entry.board.name === 'Nested register')
    expect(nested.initiative.name).toBe('Deliver WiseOS Advisor Workspace')
  })

  it('keeps only rows in the Projects group', async () => {
    const found = await discoverProjects(fakeClient(), { workspaceId: '7' })
    const deliver = found.boards.find((entry) => entry.board.name === 'Deliver WiseOS Advisor Workspace')
    expect(deliver.projects.map((project) => project.title)).toEqual(['WiseOS MVP Portfolio', 'Apollo — wiseCoach'])
  })

  it('follows the item cursor to later pages', async () => {
    const later = { ...COACH, id: 9100, name: 'Page two project' }
    const client = fakeClient({ cursor: 'abc', page2: [later] })
    const found = await discoverProjects(client, { workspaceId: '7' })
    const deliver = found.boards.find((entry) => entry.board.name === 'Deliver WiseOS Advisor Workspace')
    expect(deliver.projects.map((project) => project.title)).toContain('Page two project')
  })

  it('requires a workspace id', async () => {
    let error
    try {
      await discoverProjects(fakeClient(), {})
    } catch (caught) {
      error = caught
    }
    expect(error.message).toContain('MONDAY_WORKSPACE_ID')
  })
})

// ───────────────────────────── merge ─────────────────────────────

describe('merge into tracker state', () => {
  const NOW = '2026-11-02T16:00:00.000Z'

  it('creates pillar, initiative and projects when nothing matches', () => {
    const result = mergeMonday(emptyState(), { boards: [board([mapped(OWL)])] }, { now: NOW })
    expect(result.state.pillars).toHaveLength(1)
    expect(result.state.initiatives).toHaveLength(1)
    expect(result.state.projects).toHaveLength(1)
    const project = result.state.projects[0]
    expect(project.mondayId).toBe('9001')
    expect(project.rag).toBe('amber')
    expect(project.updatedAt).toBe('2026-10-30T15:00:00Z')
    expect(project.updatedById).toBe(SYNC_ID)
    expect(result.summary.projectsCreated).toBe(1)
    expect(result.logEntries).toHaveLength(1)
  })

  it('matches existing records by title across "Pillar 1:" prefixes and dash styles', () => {
    const state = { ...existingState(), projects: [trackerProject({ title: 'WiseOS  MVP portfolio' })] }
    const result = mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW })
    expect(result.state.pillars).toHaveLength(1)
    expect(result.state.initiatives).toHaveLength(1)
    expect(result.state.projects).toHaveLength(1)
    expect(result.state.projects[0].id).toBe('init-2-2')
    expect(result.state.projects[0].mondayId).toBe('9001')
    expect(result.summary.pillarsCreated).toBe(0)
  })

  it('overwrites synced fields but keeps what only the tracker holds', () => {
    const state = { ...existingState(), projects: [trackerProject()] }
    const project = mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW }).state.projects[0]
    expect(project.businessOwner).toBe('Daran Becker')
    expect(project.progress).toBe(50)
    expect(project.issues).toEqual([{ id: 'iss1', title: 'Local issue', severity: 'high', status: 'open' }])
    expect(project.decisionOutcome).toBe('Approved by SteerCo')
    expect(project.planLink).toBe('https://plan.example/owl')
  })

  it('never lets a blank on monday erase a tracker value', () => {
    const state = { ...existingState(), projects: [trackerProject({ keyRisk: 'Typed in tracker' })] }
    const blankRisk = mapped({ ...OWL, column_values: cells({ rag: 'On track', businessOwner: 'Daran Becker', keyRisk: '' }) })
    const project = mergeMonday(state, { boards: [board([blankRisk])] }, { now: NOW }).state.projects[0]
    expect(project.keyRisk).toBe('Typed in tracker')
  })

  it('does not touch the input state', () => {
    const state = { ...existingState(), projects: [trackerProject()] }
    const before = JSON.stringify(state)
    mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW })
    expect(JSON.stringify(state)).toBe(before)
  })

  it('is idempotent: a second run on the same data changes nothing', () => {
    const state = { ...existingState(), projects: [trackerProject()] }
    const discovered = { boards: [board([mapped(OWL), mapped(COACH)])] }
    const first = mergeMonday(state, discovered, { now: NOW })
    const second = mergeMonday(first.state, discovered, { now: '2026-11-03T00:00:00.000Z' })
    expect(second.changed).toBe(false)
    expect(second.logEntries).toHaveLength(0)
    expect(second.state).toEqual(first.state)
  })

  it('logs each changed field with old and new value', () => {
    const state = { ...existingState(), projects: [trackerProject()] }
    const result = mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW })
    const rag = result.logEntries.find((entry) => entry.fieldKey === 'rag')
    expect(rag.oldValue).toBe('green')
    expect(rag.newValue).toBe('amber')
    expect(rag.editedByName).toBe('monday sync')
    expect(rag.field).toBe('RAG status')
  })

  it('caps field lines in the log and says how many were left out', () => {
    const state = { ...existingState(), projects: [trackerProject()] }
    const result = mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW, maxFieldEntries: 3 })
    expect(result.logEntries).toHaveLength(4)
    expect(result.logEntries[3].newValue).toContain('more field changes')
  })

  it('moves a linked project when its monday board changes initiative', () => {
    const linked = { ...existingState(), projects: [trackerProject({ mondayId: '9001' })] }
    const other = {
      pillar: { id: '4', name: 'Unify the Enterprise Operating Platform' },
      initiative: { id: '5', name: 'Deliver WiseOS Advisor Workspace' },
      board: { id: '105', name: 'Deliver WiseOS Advisor Workspace' },
      projects: [mapped(OWL)],
    }
    const result = mergeMonday(linked, { boards: [other] }, { now: NOW })
    expect(result.state.projects).toHaveLength(1)
    expect(result.state.projects[0].initiativeId).toBe('init-monday-5')
  })

  it('reports a linked project that left monday and keeps it', () => {
    const state = { ...existingState(), projects: [trackerProject({ mondayId: '9999' })] }
    const linkedState = {
      ...state,
      initiatives: [{ ...state.initiatives[0], mondayId: '2' }],
    }
    const result = mergeMonday(linkedState, { boards: [board([mapped(OWL)])] }, { now: NOW })
    expect(result.state.projects).toHaveLength(2)
    expect(result.warnings.some((warning) => warning.includes('no longer on its monday board'))).toBe(true)
  })

  it('lets a pillarMap point a monday folder at an existing tracker pillar', () => {
    const state = {
      ...existingState(),
      pillars: [{ id: 'obj-1', title: 'Pillar 1: Grow Organically', owner: '' }],
      initiatives: [],
    }
    const result = mergeMonday(state, { boards: [board([mapped(OWL)])] }, { now: NOW, pillarMap: { 1: 'obj-1' } })
    expect(result.state.pillars).toHaveLength(1)
    expect(result.state.pillars[0].mondayId).toBe('1')
    expect(result.state.initiatives[0].pillarId).toBe('obj-1')
  })
})

// ───────────────────────────── sync run ─────────────────────────────

describe('sync run', () => {
  const seedStore = () =>
    createMemoryStore([
      { key: STATE_KEY, value: { ...existingState(), projects: [trackerProject()] }, version: 4, updatedAt: '' },
      { key: LOG_KEY, value: { entries: [{ id: 'old', timestamp: 'x', projectId: '', projectTitle: '', field: 'f', fieldKey: '', oldValue: '', newValue: '', editedById: '', editedByName: '' }] }, version: 2, updatedAt: '' },
    ])

  const args = (store, extra = {}) => ({ store, client: fakeClient(), workspaceId: '7', pillarMap: { 4: 'obj-x' }, ...extra })

  it('writes nothing on a dry run but reports what would change', async () => {
    const store = seedStore()
    const report = await runMondaySync(args(store))
    expect(report.mode).toBe('dry-run')
    expect(report.written).toBe(false)
    expect(report.summary.projectsCreated + report.summary.projectsUpdated).toBeGreaterThan(0)
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(4)
  })

  it('applies: writes state and prepends to the existing log', async () => {
    const store = seedStore()
    const report = await runMondaySync(args(store, { apply: true }))
    expect(report.written).toBe(true)
    const state = (await store.readDocument(STATE_KEY)).doc
    expect(state.version).toBe(5)
    expect(state.value.projects.some((project) => project.mondayId === '9001')).toBe(true)
    const log = (await store.readDocument(LOG_KEY)).doc.value.entries
    expect(log[log.length - 1].id).toBe('old')
    expect(log.length).toBeGreaterThan(1)
  })

  it('a second apply writes nothing', async () => {
    const store = seedStore()
    await runMondaySync(args(store, { apply: true }))
    const version = (await store.readDocument(STATE_KEY)).doc.version
    const again = await runMondaySync(args(store, { apply: true }))
    expect(again.written).toBe(false)
    expect((await store.readDocument(STATE_KEY)).doc.version).toBe(version)
  })

  it('retries when an editor saved in the meantime', async () => {
    const store = seedStore()
    const write = store.writeDocument.bind(store)
    let bumped = false
    store.writeDocument = async (key, value, ifVersion) => {
      if (key === STATE_KEY && !bumped) {
        bumped = true
        const current = (await store.readDocument(STATE_KEY)).doc
        await write(STATE_KEY, { ...current.value, quarter: 'edited meanwhile' }, current.version)
      }
      return write(key, value, ifVersion)
    }
    const report = await runMondaySync(args(store, { apply: true }))
    expect(report.written).toBe(true)
    const state = (await store.readDocument(STATE_KEY)).doc.value
    expect(state.quarter).toBe('edited meanwhile')
    expect(state.projects.some((project) => project.mondayId === '9001')).toBe(true)
  })

  it('explains an empty tracker instead of writing into nothing', async () => {
    let error
    try {
      await runMondaySync(args(createMemoryStore()))
    } catch (caught) {
      error = caught
    }
    expect(error.message).toContain('no data yet')
  })
})
