import { describe, expect, it } from 'vitest'
import { canRunReport, canUseFeature, defaultPolicy, normalizePolicy } from '../auth/access'
import { rolesFromClaims } from '../auth/roles'
import { buildPeople } from '../lib/people'
import { makeProject, makeState } from '../test-fixtures'
import type { LogEntry } from '../types'
import { buildCsvReport, type ReportInput } from './builders'
import { REPORT_IDS } from './catalog'
import { toCsv } from './csv'
import { buildOnePager } from './onepager'

const NOW = Date.parse('2026-07-01T00:00:00Z')

const input = (projects = [makeProject({})], log: LogEntry[] = []): ReportInput => {
  const state = makeState({ projects })
  return { state, log, settings: { staleThresholdDays: 30 }, people: buildPeople(state), now: NOW }
}

const lines = (text: string) => text.replace(/^﻿/, '').trimEnd().split('\r\n')

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks, and starts with a BOM for Excel', () => {
    const text = toCsv(['a', 'b'], [['x, y', 'say "hi"\nthere']])
    expect(text.startsWith('﻿')).toBe(true)
    expect(lines(text)[1]).toBe('"x, y","say ""hi""\nthere"')
  })

  it('defuses text that Excel would run as a formula', () => {
    expect(lines(toCsv(['a'], [['=HYPERLINK("x")']]))[1]).toBe(`"'=HYPERLINK(""x"")"`)
    expect(lines(toCsv(['a'], [[-5]]))[1]).toBe('-5')
  })
})

describe('CSV reports', () => {
  it('builds every CSV report in the catalog without throwing', () => {
    for (const id of REPORT_IDS) {
      const file = buildCsvReport(id, input())
      if (id === 'pillar-one-pager') expect(file).toBeNull()
      else expect(file?.filename).toMatch(/^wisetrack-.+-2026-07-01\.csv$/)
    }
  })

  it('carries the PMO fields in the status register', () => {
    const file = buildCsvReport('status-register', input([makeProject({ phase: 'review', validation: 'pending', dependencies: 'Vendor SSO' })]))!
    const [header, row] = lines(file.text)
    expect(header).toContain('Validation')
    expect(header.indexOf('Dependencies')).toBeLessThan(header.indexOf('Key risk / blocker'))
    expect(row).toContain('Review')
    expect(row).toContain('Pending')
    expect(row).toContain('Vendor SSO')
  })

  it('lists only projects that need attention, worst first', () => {
    const file = buildCsvReport(
      'attention',
      input([
        makeProject({ id: 'a', title: 'Calm', updatedAt: '2026-06-30T00:00:00Z' }),
        makeProject({ id: 'b', title: 'Burning', rag: 'red', updatedAt: '2026-06-30T00:00:00Z' }),
        makeProject({ id: 'c', title: 'Wobbly', rag: 'amber', updatedAt: '2026-06-30T00:00:00Z' }),
      ]),
    )!
    const rows = lines(file.text).slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Burning')
    expect(rows[1]).toContain('Wobbly')
  })

  it('groups the PM report by manager and keeps unassigned projects', () => {
    const file = buildCsvReport(
      'pm-status',
      input([makeProject({ id: 'a', title: 'Managed', projectManager: 'Nicole Ruiz' }), makeProject({ id: 'b', title: 'Orphan' })]),
    )!
    const rows = lines(file.text).slice(1)
    expect(rows[0].startsWith('Nicole Ruiz,Managed')).toBe(true)
    expect(rows[1].startsWith('(No PM assigned),Orphan')).toBe(true)
  })
})

describe('pillar one-pager', () => {
  it('assembles team, key results, dependencies and recent accomplishments', () => {
    const projects = [
      makeProject({ id: 'a', title: 'CRM cutover', projectManager: 'Nicole Ruiz', dependencies: 'Tamarac data feed', rag: 'red', keyRisk: 'Timelines slipping' }),
    ]
    const log: LogEntry[] = [
      { id: 'l1', timestamp: '2026-06-20T10:00:00Z', projectId: 'a', projectTitle: 'CRM cutover', field: 'Phase', fieldKey: 'phase', oldValue: 'review', newValue: 'launch', editedById: '', editedByName: '' },
      { id: 'l2', timestamp: '2025-01-01T10:00:00Z', projectId: 'a', projectTitle: 'CRM cutover', field: 'Phase', fieldKey: 'phase', oldValue: 'launch', newValue: 'closed', editedById: '', editedByName: '' },
    ]
    const state = makeState({ projects })
    const page = buildOnePager(state, log, state.pillars[0], 30, NOW)
    expect(page).toMatchObject({ eyebrow: 'Pillar 1', title: 'Grow', members: ['Nicole Ruiz'] })
    expect(page.keyResults).toHaveLength(1)
    expect(page.dependencies[0]).toEqual({ text: 'Tamarac data feed', meta: 'CRM cutover' })
    expect(page.accomplishments.map((bullet) => bullet.text)).toEqual(['CRM cutover moved to Launch'])
    expect(page.risks[0]).toMatchObject({ text: 'Timelines slipping', tone: 'red' })
  })
})

describe('access policy', () => {
  it('maps Entra claims to roles and ignores unknown ones', () => {
    expect(rolesFromClaims(['Tracker.Viewer', 'Tracker.Admin', 'Something.Else'])).toEqual(['admin', 'viewer'])
  })

  it('gives admins everything whatever the policy says', () => {
    const policy = normalizePolicy({ features: { workload: [] }, reports: { 'change-log': [] } })
    expect(canUseFeature(policy, ['admin'], 'workload')).toBe(true)
    expect(canRunReport(policy, ['admin'], 'change-log')).toBe(true)
    expect(policy.features.workload).toEqual(['admin'])
  })

  it('hides a layout when its parent view is hidden', () => {
    const policy = defaultPolicy()
    policy.features.workload = ['admin']
    expect(canUseFeature(policy, ['executive'], 'workload.pm-heatmap')).toBe(false)
  })

  it('hides every report when the Reports view is hidden', () => {
    const policy = defaultPolicy()
    policy.features.reports = ['admin']
    expect(canRunReport(policy, ['viewer'], 'status-register')).toBe(false)
  })

  it('fills in features and reports added after a policy was saved', () => {
    const policy = normalizePolicy({ features: { board: ['viewer'] } })
    expect(policy.features.board).toEqual(['admin', 'viewer'])
    expect(policy.features['portfolio.pace']).toEqual(defaultPolicy().features['portfolio.pace'])
    expect(Object.keys(policy.reports)).toEqual(REPORT_IDS)
  })
})
