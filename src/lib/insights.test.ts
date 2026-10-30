import { describe, expect, it } from 'vitest'
import { bundledSnapshot } from '../data/repository'
import { makeProject } from '../test-fixtures'
import type { TrackerState } from '../types'
import {
  groupByInitiative,
  makeProjectFilter,
  needsAttention,
  noFilters,
  pillarLabel,
  slipDays,
  timelinePosition,
  timelineWindow,
  workItems,
  worstStatus,
} from './insights'
import { buildPeople, extractNames, matchPerson } from './people'

const project = makeProject

describe('extractNames', () => {
  it.each([
    ['Padman / Daran', ['Padman', 'Daran']],
    ['Business owner: TBD', []],
    ['Kevin/Ahmed/Dennis', ['Kevin', 'Ahmed', 'Dennis']],
    ['Ashley, PM; technology delivery through Padman/Darren', ['Ashley', 'Padman', 'Darren']],
    ['Nicole from BridgeNext', ['Nicole']],
    ['Brent for vision; final business owner TBD', ['Brent']],
    ['Jonathan and Darren; Zach closely involved; PM: TBD', ['Jonathan', 'Darren', 'Zach']],
    ['Melissa / SABA leadership; confirm named owner', ['Melissa']],
    ['Michael Hannah & M&A Leadership', ['Michael Hannah']],
    ['Tom DiCristofaro/Tony Behrens?', ['Tom DiCristofaro', 'Tony Behrens']],
    ['Delivery owner / PM: TBD', []],
  ])('%s', (raw, expected) => {
    expect(extractNames(raw)).toEqual(expected)
  })
})

describe('buildPeople', () => {
  const state = {
    projects: [
      project({ id: 'a', businessOwner: 'Padman Perumal', executionOwner: 'Anthony Behrens' }),
      project({ id: 'b', businessOwner: 'Padman Permual', executionOwner: 'Tony Behrens' }),
      project({ id: 'c', executionOwner: 'Padman / Daran', projectManager: 'Padman' }),
    ],
  }
  const people = buildPeople(state)

  it('folds typos, nicknames and bare first names into one person', () => {
    const padman = people.find((person) => person.key === 'padman perumal')
    expect(padman?.projectIds.sort()).toEqual(['a', 'b', 'c'])
    expect(padman?.business.sort()).toEqual(['a', 'b'])
    expect(padman?.pm).toEqual(['c'])
    expect(people.find((person) => person.key === 'anthony behrens')?.projectIds.sort()).toEqual(['a', 'b'])
  })

  it('matches a signed-in name to a person', () => {
    expect(matchPerson(people, 'Padman Perumal')?.key).toBe('padman perumal')
    expect(matchPerson(people, 'Daran Smith')?.key).toBe('daran')
    expect(matchPerson(people, 'Tony Behrens')?.key).toBe('anthony behrens')
    expect(matchPerson(people, 'Somebody Else')).toBeNull()
    expect(matchPerson(people, '')).toBeNull()
  })

  it('produces a sensible directory from the migrated snapshot', () => {
    const directory = buildPeople(bundledSnapshot().state)
    const names = directory.map((person) => person.key)
    expect(names).toContain('padman perumal')
    expect(names).toContain('kevin')
    expect(names).not.toContain('tbd')
    expect(names).not.toContain('saba')
  })
})

describe('filters and attention', () => {
  const state: TrackerState = {
    quarter: '',
    pillars: [{ id: 'pl', title: 'Pillar 2: Build a Unified Platform', owner: '' }],
    initiatives: [{ id: 'i', pillarId: 'pl', title: 'WiseAnalytics', businessOwner: '', executionOwner: '', startQuarter: '', endQuarter: '' }],
    projects: [
      project({ id: 'g', rag: 'green' }),
      project({ id: 'a', rag: 'amber', decisionNeeded: 'Pick a vendor' }),
      project({ id: 'r', rag: 'red', executionOwner: 'Padman' }),
      project({ id: 'old', rag: 'green', updatedAt: '2020-01-01T00:00:00Z' }),
    ],
  }

  it('combines status, stale, decision and query filters', () => {
    const run = (patch: Partial<ReturnType<typeof noFilters>>) =>
      state.projects.filter(makeProjectFilter(state, { ...noFilters(), ...patch }, 30)).map((p) => p.id)
    expect(run({ rag: ['amber', 'red'] })).toEqual(['a', 'r'])
    expect(run({ stale: true })).toEqual(['old'])
    expect(run({ decisions: true })).toEqual(['a'])
    expect(run({ query: 'padman' })).toEqual(['r'])
    expect(run({ query: 'wiseanalytics' })).toHaveLength(4)
    expect(run({ pillar: 'pl' })).toHaveLength(4)
    expect(run({ pillar: 'elsewhere' })).toEqual([])
  })

  it('groups a ranked list by initiative without reordering it', () => {
    const rows = [
      { id: 'r1', initiative: 'b' },
      { id: 'a1', initiative: 'a' },
      { id: 'r2', initiative: 'b' },
      { id: 'x', initiative: '' },
    ]
    const groups = groupByInitiative(rows, (row) =>
      row.initiative ? { ...state.initiatives[0], id: row.initiative } : undefined,
    )
    expect(groups.map((group) => group.initiative?.id ?? null)).toEqual(['b', 'a', null])
    expect(groups[0].items.map((row) => row.id)).toEqual(['r1', 'r2'])
  })

  it('ranks off-track projects ahead of decisions', () => {
    expect(needsAttention(state.projects).map((p) => p.id)).toEqual(['r', 'a'])
    expect(worstStatus(state.projects)).toBe('red')
    expect(worstStatus([])).toBeNull()
  })

  it('splits the pillar eyebrow from its title', () => {
    expect(pillarLabel(state.pillars[0], 0)).toEqual({ eyebrow: 'Pillar 2', title: 'Build a Unified Platform' })
    expect(pillarLabel({ id: 'x', title: 'Growth', owner: '' }, 3)).toEqual({ eyebrow: 'Pillar 4', title: 'Growth' })
  })
})

describe('work items and schedule', () => {
  it('collects open decisions, open issues and milestones', () => {
    const items = workItems([
      project({
        id: 'p1',
        decisionNeeded: 'Approve budget',
        nextMilestone: 'UAT',
        nextMilestoneDate: '2026-11-01',
        issues: [
          { id: 'x', title: 'Low one', severity: 'low', status: 'open' },
          { id: 'y', title: 'High one', severity: 'high', status: 'open' },
          { id: 'z', title: 'Done', severity: 'high', status: 'resolved' },
        ],
      }),
      project({ id: 'p2', decisionNeeded: 'Asked', decisionOutcome: 'Answered' }),
    ])
    expect(items.decision.map((item) => item.text)).toEqual(['Approve budget'])
    expect(items.issue.map((item) => item.text)).toEqual(['High one', 'Low one'])
    expect(items.milestone[0].due).toBe('2026-11-01')
  })

  it('positions dates inside a twelve-month window', () => {
    const window = timelineWindow(0, new Date('2026-10-13T00:00:00Z'))
    expect(window.months[0].toISOString().slice(0, 7)).toBe('2026-07')
    expect(window.months[11].toISOString().slice(0, 7)).toBe('2027-06')
    expect(timelinePosition(window, '2026-07-01')).toBe(0)
    expect(timelinePosition(window, '2025-01-01')).toBeNull()
    expect(timelinePosition(window, '2025-01-01', true)).toBe(0)
    expect(timelinePosition(window, 'not a date')).toBeNull()
  })

  it('measures schedule slip', () => {
    expect(slipDays(project({ originalEndDate: '2026-09-30', forecastEndDate: '2026-10-10' }))).toBe(10)
    expect(slipDays(project({ originalEndDate: '2026-09-30' }))).toBeNull()
  })
})
