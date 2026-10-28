// ⏱️ Pace and attention. Two questions the portfolio keeps asking:
//
//   Pace       Is this group of projects as far along as its schedule says it
//              should be by today? Progress is compared with the share of the
//              planned window (start → original end) that has elapsed.
//   Attention  How urgently does one project need a person to look at it?
//              A score built from status, freshness, schedule, issues and
//              decisions, with the reasons kept so the UI can say why.
//
// Pure functions over plain data; `now` is a parameter so tests can pin it.

import type { Project } from '../types'
import { isOverdue, slipDays } from './insights'
import { isStale, needsDecision } from './rollups'

const DAY_MS = 24 * 60 * 60 * 1000

/** Points of progress either side of expected that still count as on pace. */
export const PACE_TOLERANCE = 10
/** Days of forecast slip past the original end before a project reads as behind. */
export const SLIP_TOLERANCE_DAYS = 14
/** Share of a group's projects that must be stale for the whole group to read as stale. */
export const STALE_SHARE = 0.5

export type Pace = 'behind' | 'stale' | 'on-pace' | 'ahead' | 'unscheduled'

export const PACE_LABEL: Record<Pace, string> = {
  behind: 'Behind schedule',
  stale: 'Stale',
  'on-pace': 'On pace',
  ahead: 'Ahead of schedule',
  unscheduled: 'No schedule',
}

/** Worst first: the order rows and legends use. */
export const PACE_ORDER: Pace[] = ['behind', 'stale', 'on-pace', 'ahead', 'unscheduled']

const parseDay = (value: string): number | null => {
  const trimmed = value?.trim?.() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null
  const time = Date.parse(trimmed.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(time) ? null : time
}

/**
 * Progress the schedule implies by `now`, 0–100, or null when the project has
 * no usable window. The original end is the baseline; the forecast end is
 * used only when no original was recorded.
 */
export function expectedProgress(project: Project, now = Date.now()): number | null {
  if (project.phase === 'closed') return 100
  const start = parseDay(project.startDate)
  const end = parseDay(project.originalEndDate) ?? parseDay(project.forecastEndDate)
  if (start === null || end === null || end <= start) return null
  const fraction = (now - start) / (end - start)
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100)
}

export interface ProjectPace {
  project: Project
  expected: number | null
  /** progress − expected, in points. Null when unscheduled. */
  delta: number | null
  slip: number | null
  stale: boolean
  pace: Pace
}

export function projectPace(project: Project, staleDays: number, now = Date.now()): ProjectPace {
  const expected = expectedProgress(project, now)
  const delta = expected === null ? null : project.progress - expected
  const slip = slipDays(project)
  const stale = project.phase !== 'closed' && isStale(project, staleDays, now)
  const behind = (delta !== null && delta < -PACE_TOLERANCE) || (slip !== null && slip > SLIP_TOLERANCE_DAYS)
  const pace: Pace = behind
    ? 'behind'
    : stale
      ? 'stale'
      : delta === null
        ? 'unscheduled'
        : delta > PACE_TOLERANCE
          ? 'ahead'
          : 'on-pace'
  return { project, expected, delta, slip, stale, pace }
}

export interface GroupPace {
  projects: ProjectPace[]
  /** Average progress across every project in the group. */
  progress: number
  /** Average expected progress across the scheduled projects, or null when none are. */
  expected: number | null
  /** Average progress − expected across the scheduled projects. */
  delta: number | null
  staleCount: number
  counts: Record<Pace, number>
  /** Most recent update across the group, ISO; empty when none. */
  lastUpdate: string
  pace: Pace
}

/**
 * Rolls children up into one reading for a pillar or an initiative. A group
 * where most projects have gone quiet reads as stale whatever its numbers
 * say, because those numbers can no longer be trusted.
 */
export function groupPace(projects: Project[], staleDays: number, now = Date.now()): GroupPace {
  const paces = projects.map((project) => projectPace(project, staleDays, now))
  const scheduled = paces.filter((entry) => entry.expected !== null)
  const average = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0)
  const counts = Object.fromEntries(PACE_ORDER.map((pace) => [pace, 0])) as Record<Pace, number>
  for (const entry of paces) counts[entry.pace] += 1

  const expected = scheduled.length ? average(scheduled.map((entry) => entry.expected!)) : null
  const delta = scheduled.length ? average(scheduled.map((entry) => entry.delta!)) : null
  const staleCount = paces.filter((entry) => entry.stale).length
  const lastUpdate = projects.reduce((latest, project) => (project.updatedAt > latest ? project.updatedAt : latest), '')
  // Behind if the average is behind, or if behind projects outnumber the rest.
  const mostlyBehind = counts.behind > paces.length / 2

  const pace: Pace =
    paces.length === 0
      ? 'unscheduled'
      : staleCount / paces.length >= STALE_SHARE
        ? 'stale'
        : (delta !== null && delta < -PACE_TOLERANCE) || mostlyBehind
          ? 'behind'
          : delta === null
            ? 'unscheduled'
            : delta > PACE_TOLERANCE
              ? 'ahead'
              : 'on-pace'

  return { projects: paces, progress: average(projects.map((p) => p.progress)), expected, delta, staleCount, counts, lastUpdate, pace }
}

// ── attention ─────────────────────────────────────────────────────────────

export type AttentionLevel = 'critical' | 'watch' | 'healthy'

export const ATTENTION_LABEL: Record<AttentionLevel, string> = {
  critical: 'Needs attention now',
  watch: 'Watch',
  healthy: 'Low',
}

export interface Attention {
  score: number
  level: AttentionLevel
  /** Plain-language reasons, most serious first. */
  reasons: string[]
}

export const CRITICAL_SCORE = 40
export const WATCH_SCORE = 20

export function attentionFor(project: Project, staleDays: number, now = Date.now()): Attention {
  const signals: Array<[number, string]> = []
  const days = (iso: string) => Math.floor((now - new Date(iso).getTime()) / DAY_MS)

  if (project.rag === 'red') signals.push([40, 'Off track'])
  else if (project.rag === 'amber') signals.push([20, 'At risk'])

  // A finished project only matters if it was closed in a bad state.
  if (project.phase !== 'closed') {
    const pace = projectPace(project, staleDays, now)
    if (pace.stale) signals.push([15, `No update in ${days(project.updatedAt)} days`])
    if (project.nextMilestoneDate && isOverdue(project.nextMilestoneDate, new Date(now))) signals.push([15, 'Milestone overdue'])
    if (pace.slip !== null && pace.slip > SLIP_TOLERANCE_DAYS) signals.push([10, `Forecast ${pace.slip} days late`])
    else if (pace.delta !== null && pace.delta < -PACE_TOLERANCE) signals.push([10, `${Math.abs(pace.delta)} pts behind schedule`])
    if (project.trending === 'declining') signals.push([10, 'Trending down'])
    const high = project.issues.filter((issue) => issue.status === 'open' && issue.severity === 'high').length
    if (high) signals.push([Math.min(20, high * 10), `${high} high-severity issue${high === 1 ? '' : 's'}`])
    if (needsDecision(project)) signals.push([10, 'Decision waiting'])
  }

  signals.sort((a, b) => b[0] - a[0])
  const score = signals.reduce((sum, [points]) => sum + points, 0)
  const level: AttentionLevel = score >= CRITICAL_SCORE ? 'critical' : score >= WATCH_SCORE ? 'watch' : 'healthy'
  return { score, level, reasons: signals.map(([, reason]) => reason) }
}
