// 📄 Pillar one-pager: the leadership slide, assembled from tracker data.
// Mirrors the OKR page the PMO already presents (objective, team, key
// results, goals, dependencies, accomplishments, next steps, risks) so the
// export can drop straight into the deck. Pure: data in, sections out.

import { PHASE } from '../constants'
import { pillarLabel } from '../lib/insights'
import { groupPace, PACE_LABEL, type Pace } from '../lib/pace'
import { buildPeople, extractNames } from '../lib/people'
import { countByRag, projectsForInitiative, type RagCounts } from '../lib/rollups'
import type { LogEntry, Pillar, Project, RagStatus, TrackerState } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
/** How far back "recent accomplishments" looks. */
export const ACCOMPLISHMENT_WINDOW_DAYS = 45
/** How far ahead "next steps" looks for milestones. */
export const NEXT_STEP_WINDOW_DAYS = 60
const LIST_LIMIT = 6
const GOAL_LIMIT = 8

const RAG_RANK: Record<RagStatus, number> = { red: 0, amber: 1, green: 2 }
const rankOf = (rag: RagStatus) => RAG_RANK[rag]

export interface KeyResult {
  title: string
  target: string
  progress: number
  expected: number | null
  pace: Pace
  paceLabel: string
  counts: RagCounts
  projects: number
}

export interface Bullet {
  text: string
  /** Optional emphasis, e.g. a date or a project name. */
  meta?: string
  tone?: RagStatus
}

export interface OnePager {
  pillar: Pillar
  eyebrow: string
  title: string
  owner: string
  members: string[]
  pace: Pace
  paceLabel: string
  progress: number
  counts: RagCounts
  keyResults: KeyResult[]
  initiatives: number
  projects: number
  goals: Bullet[]
  /** Open projects left off the goals list for space. */
  moreGoals: number
  dependencies: Bullet[]
  accomplishments: Bullet[]
  nextSteps: Bullet[]
  risks: Bullet[]
  asOf: string
}

const fmt = (iso: string) => {
  const time = Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(time)
    ? iso
    : new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "Q4 2026", else the latest original end among its projects, else blank. */
function targetFor(endQuarter: string, projects: Project[]): string {
  if (endQuarter.trim()) return endQuarter.trim()
  const ends = projects.map((project) => project.originalEndDate || project.forecastEndDate).filter((value) => /^\d{4}-\d{2}-\d{2}/.test(value))
  return ends.length ? fmt(ends.sort().at(-1)!) : ''
}

function accomplishmentsFrom(log: LogEntry[], ids: Set<string>, now: number): Bullet[] {
  const since = now - ACCOMPLISHMENT_WINDOW_DAYS * DAY_MS
  const seen = new Set<string>()
  const bullets: Bullet[] = []
  for (const entry of log) {
    if (!ids.has(entry.projectId) || new Date(entry.timestamp).getTime() < since) continue
    let text = ''
    if (entry.fieldKey === 'phase' && ['launch', 'stabilize', 'closed'].includes(entry.newValue)) {
      text = `${entry.projectTitle} moved to ${PHASE[entry.newValue as keyof typeof PHASE].label}`
    } else if (entry.fieldKey === 'validation' && entry.newValue === 'completed') {
      text = `${entry.projectTitle} completed validation`
    } else if (entry.fieldKey === 'decisionOutcome' && entry.newValue.trim()) {
      text = `Decision made on ${entry.projectTitle}: ${entry.newValue.trim()}`
    } else if (entry.fieldKey === 'progress' && Number(entry.newValue) === 100) {
      text = `${entry.projectTitle} reached 100%`
    } else if (entry.field === 'Issue status' && entry.newValue === 'resolved') {
      text = `Resolved an issue on ${entry.projectTitle}`
    }
    // The log is newest first, so the first sighting of a line is the latest.
    if (text && !seen.has(text)) {
      seen.add(text)
      bullets.push({ text, meta: fmt(entry.timestamp) })
    }
  }
  return bullets.slice(0, LIST_LIMIT)
}

export function buildOnePager(state: TrackerState, log: LogEntry[], pillar: Pillar, staleDays: number, now = Date.now()): OnePager {
  const index = state.pillars.indexOf(pillar)
  const label = pillarLabel(pillar, index)
  const initiatives = state.initiatives.filter((initiative) => initiative.pillarId === pillar.id)
  const projects = initiatives.flatMap((initiative) => projectsForInitiative(state, initiative.id))
  const ids = new Set(projects.map((project) => project.id))
  const overall = groupPace(projects, staleDays, now)

  // Through the people directory, so "Padman" and "Padman Perumal" are one member.
  const ownerNames = new Set(extractNames(pillar.owner).map((name) => name.toLowerCase()))
  const members = buildPeople(state)
    .filter((person) => person.projectIds.some((id) => ids.has(id)) && !ownerNames.has(person.key))
    .map((person) => person.name)
    .sort((a, b) => a.localeCompare(b))

  const keyResults: KeyResult[] = initiatives.map((initiative) => {
    const children = projectsForInitiative(state, initiative.id)
    const pace = groupPace(children, staleDays, now)
    return {
      title: initiative.title,
      target: targetFor(initiative.endQuarter, children),
      progress: pace.progress,
      expected: pace.expected,
      pace: pace.pace,
      paceLabel: PACE_LABEL[pace.pace],
      counts: countByRag(children),
      projects: children.length,
    }
  })

  // Titles only: a slide has room for names, not scope paragraphs.
  const goals: Bullet[] = projects
    .filter((project) => project.phase !== 'closed')
    .sort((a, b) => rankOf(a.rag) - rankOf(b.rag) || b.progress - a.progress || a.title.localeCompare(b.title))
    .slice(0, GOAL_LIMIT)
    .map((project) => ({
      text: project.title,
      meta: [project.phase ? PHASE[project.phase].label : '', `${project.progress}%`].filter(Boolean).join(', '),
      tone: project.rag,
    }))
  const moreGoals = Math.max(0, projects.filter((project) => project.phase !== 'closed').length - GOAL_LIMIT)

  const dependencies: Bullet[] = projects
    .filter((project) => project.dependencies.trim())
    .map((project) => ({ text: project.dependencies.trim(), meta: project.title }))
    .slice(0, LIST_LIMIT)

  const horizon = now + NEXT_STEP_WINDOW_DAYS * DAY_MS
  const nextSteps: Bullet[] = projects
    .filter((project) => project.nextMilestone.trim() && project.phase !== 'closed')
    .map((project) => ({ project, due: Date.parse(project.nextMilestoneDate.slice(0, 10) + 'T00:00:00Z') }))
    .filter((entry) => Number.isNaN(entry.due) || entry.due <= horizon)
    .sort((a, b) => (Number.isNaN(a.due) ? 1 : Number.isNaN(b.due) ? -1 : a.due - b.due))
    .slice(0, LIST_LIMIT)
    .map(({ project }) => ({
      text: `${project.nextMilestone.trim()} (${project.title})`,
      meta: project.nextMilestoneDate ? fmt(project.nextMilestoneDate) : undefined,
    }))

  const risks: Bullet[] = [
    ...projects
      .filter((project) => project.keyRisk.trim() && project.rag !== 'green')
      .sort((a, b) => rankOf(a.rag) - rankOf(b.rag))
      .map((project) => ({ text: project.keyRisk.trim(), meta: project.title, tone: project.rag })),
    ...projects.flatMap((project) =>
      project.issues
        .filter((issue) => issue.status === 'open' && issue.severity === 'high')
        .map((issue) => ({ text: issue.title, meta: project.title, tone: 'red' as const })),
    ),
  ].slice(0, LIST_LIMIT)

  return {
    pillar,
    eyebrow: label.eyebrow,
    title: label.title,
    owner: pillar.owner,
    members,
    pace: overall.pace,
    paceLabel: PACE_LABEL[overall.pace],
    progress: overall.progress,
    counts: countByRag(projects),
    keyResults,
    initiatives: initiatives.length,
    projects: projects.length,
    goals,
    moreGoals,
    dependencies,
    accomplishments: accomplishmentsFrom(log, ids, now),
    nextSteps,
    risks,
    asOf: new Date(now).toISOString().slice(0, 10),
  }
}
