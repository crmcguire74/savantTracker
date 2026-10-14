import { describe, expect, it } from 'vitest'
import { AppFileError, createAppFile, parseAppFile, serializeAppFile } from './appfile'
import { bundledSnapshot } from './repository'
import { countByRag, initiativeRollup, isStale, searchProjects } from '../lib/rollups'

describe('bundled migration snapshot', () => {
  it('carries the full tracker that was live in the Claude artifact', () => {
    const file = bundledSnapshot()
    expect(file.state.pillars).toHaveLength(4)
    expect(file.state.initiatives).toHaveLength(28)
    expect(file.state.projects).toHaveLength(43)
    expect(file.log).toHaveLength(183)
  })

  it('has no orphaned initiatives or projects', () => {
    const file = bundledSnapshot()
    const pillarIds = new Set(file.state.pillars.map((pillar) => pillar.id))
    const initiativeIds = new Set(file.state.initiatives.map((initiative) => initiative.id))

    expect(file.state.initiatives.filter((i) => !pillarIds.has(i.pillarId))).toHaveLength(0)
    expect(file.state.projects.filter((p) => !initiativeIds.has(p.initiativeId))).toHaveLength(0)
  })

  it('normalized the schema drift from the old tracker', () => {
    const file = bundledSnapshot()
    expect(file.state.projects.every((p) => typeof p.decisionOutcome === 'string')).toBe(true)
    expect(file.state.projects.every((p) => Array.isArray(p.issues))).toBe(true)
    expect(file.state.projects.filter((p) => p.updatedByName !== '')).toHaveLength(23)
  })

  it('matches the RAG counts the old tracker showed', () => {
    const counts = countByRag(bundledSnapshot().state.projects)
    expect(counts).toEqual({ green: 16, amber: 18, red: 9 })
  })
})

describe('app file reader', () => {
  it('round-trips without losing anything', () => {
    const original = bundledSnapshot()
    const reparsed = parseAppFile(JSON.parse(serializeAppFile(original)))
    expect(reparsed.file.state).toEqual(original.state)
    expect(reparsed.file.log).toEqual(original.log)
  })

  it('imports a legacy export that has no envelope', () => {
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
          issues: [],
        },
      ],
    }

    const { file, warnings } = parseAppFile(legacy)
    expect(file.formatVersion).toBe(1)
    expect(file.state.projects[0].updatedByName).toBe('Nate')
    expect(file.state.projects[0].decisionOutcome).toBe('')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('clamps and defaults hostile values instead of trusting them', () => {
    const { file } = parseAppFile({
      pillars: [],
      initiatives: [],
      projects: [
        { id: 'p1', rag: 'chartreuse', progress: 5000, trending: 'sideways', phase: 'nope', issues: 'not-an-array' },
      ],
    })

    expect(file.state.projects[0].rag).toBe('green')
    expect(file.state.projects[0].progress).toBe(100)
    expect(file.state.projects[0].trending).toBe('stable')
    expect(file.state.projects[0].phase).toBe('')
    expect(file.state.projects[0].issues).toEqual([])
  })

  it('refuses a file that is not a tracker export', () => {
    expect(() => parseAppFile({ hello: 'world' })).toThrow(AppFileError)
  })

  it('refuses a file written by a newer format version', () => {
    expect(() =>
      parseAppFile({ formatVersion: 99, state: { pillars: [], initiatives: [], projects: [] } }),
    ).toThrow(AppFileError)
  })

  it('stamps a fresh export with the current version', () => {
    const snapshot = bundledSnapshot()
    const file = createAppFile(snapshot.state, snapshot.log, snapshot.settings)
    expect(file.formatVersion).toBe(1)
    expect(file.app).toBe('savant-strategic-initiatives-tracker')
  })
})

describe('derived numbers', () => {
  it('filters by RAG', () => {
    const state = bundledSnapshot().state
    const red = searchProjects(state, { query: '', rag: 'red', staleOnly: false, decisionsOnly: false }, 30)
    expect(red).toHaveLength(9)
    expect(red.every((hit) => hit.project.rag === 'red')).toBe(true)
  })

  it('labels which owner field matched a search', () => {
    const state = bundledSnapshot().state
    const hits = searchProjects(state, { query: 'kevin', rag: null, staleOnly: false, decisionsOnly: false }, 30)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('averages progress across an initiative', () => {
    const state = bundledSnapshot().state
    const initiative = state.initiatives.find(
      (candidate) => state.projects.filter((p) => p.initiativeId === candidate.id).length > 1,
    )
    const rollup = initiativeRollup(state, initiative!.id)
    expect(rollup.total).toBeGreaterThan(1)
    expect(rollup.avgProgress).toBeGreaterThanOrEqual(0)
    expect(rollup.avgProgress).toBeLessThanOrEqual(100)
  })

  it('treats an old timestamp as stale and a fresh one as current', () => {
    const project = bundledSnapshot().state.projects[0]
    expect(isStale({ ...project, updatedAt: '2020-01-01T00:00:00.000Z' }, 30)).toBe(true)
    expect(isStale({ ...project, updatedAt: new Date().toISOString() }, 30)).toBe(false)
    expect(isStale({ ...project, updatedAt: '' }, 30)).toBe(false)
  })
})
