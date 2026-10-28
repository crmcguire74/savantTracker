import { describe, expect, it } from 'vitest'
import { makeProject } from '../test-fixtures'
import { attentionFor, expectedProgress, groupPace, projectPace } from './pace'

const NOW = Date.parse('2026-07-01T00:00:00Z')
const FRESH = '2026-06-30T12:00:00Z'
const OLD = '2026-01-01T00:00:00Z'

// Half way through a January–December window on July 1st.
const scheduled = (patch: Parameters<typeof makeProject>[0]) =>
  makeProject({ startDate: '2026-01-01', originalEndDate: '2026-12-31', updatedAt: FRESH, ...patch })

describe('expectedProgress', () => {
  it('is the elapsed share of the planned window', () => {
    expect(expectedProgress(scheduled({}), NOW)).toBe(50)
  })

  it('is null without a usable window, and 100 once closed', () => {
    expect(expectedProgress(makeProject({ startDate: '2026-01-01' }), NOW)).toBeNull()
    expect(expectedProgress(makeProject({ startDate: '2026-05-01', originalEndDate: '2026-04-01' }), NOW)).toBeNull()
    expect(expectedProgress(makeProject({ phase: 'closed' }), NOW)).toBe(100)
  })

  it('falls back to the forecast end when no original end was recorded', () => {
    expect(expectedProgress(makeProject({ startDate: '2026-01-01', forecastEndDate: '2026-12-31' }), NOW)).toBe(50)
  })
})

describe('projectPace', () => {
  it('reads ahead, on pace and behind against the tolerance', () => {
    expect(projectPace(scheduled({ progress: 70 }), 30, NOW).pace).toBe('ahead')
    expect(projectPace(scheduled({ progress: 45 }), 30, NOW).pace).toBe('on-pace')
    expect(projectPace(scheduled({ progress: 20 }), 30, NOW).pace).toBe('behind')
  })

  it('reads behind when the forecast has slipped, whatever the progress', () => {
    expect(projectPace(scheduled({ progress: 60, forecastEndDate: '2027-02-01' }), 30, NOW).pace).toBe('behind')
  })

  it('flags stale before unscheduled, and behind before stale', () => {
    expect(projectPace(makeProject({ updatedAt: OLD }), 30, NOW).pace).toBe('stale')
    expect(projectPace(scheduled({ progress: 10, updatedAt: OLD }), 30, NOW).pace).toBe('behind')
    expect(projectPace(makeProject({ updatedAt: FRESH }), 30, NOW).pace).toBe('unscheduled')
  })
})

describe('groupPace', () => {
  it('averages children and reads the group from the average', () => {
    const group = groupPace([scheduled({ progress: 30 }), scheduled({ progress: 40 })], 30, NOW)
    expect(group).toMatchObject({ progress: 35, expected: 50, delta: -15, pace: 'behind' })
  })

  it('reads stale when half or more of the children have gone quiet', () => {
    const group = groupPace([scheduled({ progress: 50 }), scheduled({ progress: 50, updatedAt: OLD })], 30, NOW)
    expect(group.pace).toBe('stale')
    expect(group.staleCount).toBe(1)
  })

  it('treats an empty group as unscheduled rather than on pace', () => {
    expect(groupPace([], 30, NOW).pace).toBe('unscheduled')
  })
})

describe('attentionFor', () => {
  it('is critical for an off-track project and says why', () => {
    const result = attentionFor(scheduled({ rag: 'red', progress: 50 }), 30, NOW)
    expect(result.level).toBe('critical')
    expect(result.reasons[0]).toBe('Off track')
  })

  it('adds up quieter signals into a watch', () => {
    const result = attentionFor(scheduled({ progress: 50, decisionNeeded: 'Pick a vendor', trending: 'declining' }), 30, NOW)
    expect(result).toMatchObject({ score: 20, level: 'watch' })
  })

  it('leaves a healthy, current project alone', () => {
    expect(attentionFor(scheduled({ progress: 50 }), 30, NOW)).toMatchObject({ score: 0, level: 'healthy', reasons: [] })
  })

  it('ignores staleness and schedule once a project is closed', () => {
    expect(attentionFor(makeProject({ phase: 'closed', updatedAt: OLD }), 30, NOW).level).toBe('healthy')
  })
})
