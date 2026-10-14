// 🔭 View-level derivations on top of rollups.ts: filters shared by every
// layout, worst-status heat, leadership attention, per-person work items and
// timeline geometry. Pure functions only, so each one is testable alone.

import { PHASE, RAG_SORT } from '../constants'
import type { Initiative, Issue, Phase, Pillar, Project, RagStatus, TrackerState } from '../types'
import { countByRag, isStale, needsDecision, projectsForInitiative, projectsForPillar, type RagCounts } from './rollups'
import type { Person } from './people'

// ── filters ───────────────────────────────────────────────────────────────

export interface ViewFilters {
  query: string
  rag: RagStatus[]
  stale: boolean
  decisions: boolean
}

export const noFilters = (): ViewFilters => ({ query: '', rag: [], stale: false, decisions: false })

export const hasFilters = (filters: ViewFilters): boolean =>
  filters.query.trim() !== '' || filters.rag.length > 0 || filters.stale || filters.decisions

export function projectMatchesQuery(project: Project, query: string, initiative?: Initiative): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [
    project.title,
    project.businessOwner,
    project.executionOwner,
    project.projectManager,
    project.scope,
    initiative?.title ?? '',
  ].some((value) => value.toLowerCase().includes(needle))
}

/** One predicate every layout shares, so a chip means the same thing everywhere. */
export function makeProjectFilter(state: TrackerState, filters: ViewFilters, staleDays: number) {
  const initiatives = new Map(state.initiatives.map((initiative) => [initiative.id, initiative]))
  const now = Date.now()
  return (project: Project): boolean =>
    (filters.rag.length === 0 || filters.rag.includes(project.rag)) &&
    (!filters.stale || isStale(project, staleDays, now)) &&
    (!filters.decisions || needsDecision(project)) &&
    projectMatchesQuery(project, filters.query, initiatives.get(project.initiativeId))
}

export const byStatusThenTitle = (a: Project, b: Project): number =>
  RAG_SORT[a.rag] - RAG_SORT[b.rag] || a.title.localeCompare(b.title)

// ── labels and lookups ────────────────────────────────────────────────────

/** "Pillar 2: Build a Unified Platform" → { eyebrow: "Pillar 2", title: "Build a Unified Platform" } */
export function pillarLabel(pillar: Pillar, index: number): { eyebrow: string; title: string } {
  const match = pillar.title.match(/^\s*(pillar\s*\d+)\s*[:.\-–—]\s*(.+)$/i)
  if (match) return { eyebrow: match[1].replace(/\s+/, ' ').replace(/^p/, 'P'), title: match[2].trim() }
  return { eyebrow: `Pillar ${index + 1}`, title: pillar.title }
}

export interface ProjectContext {
  initiative?: Initiative
  pillar?: Pillar
  pillarIndex: number
}

export function contextIndex(state: TrackerState): (project: Project) => ProjectContext {
  const initiatives = new Map(state.initiatives.map((initiative) => [initiative.id, initiative]))
  const pillars = new Map(state.pillars.map((pillar, index) => [pillar.id, { pillar, index }]))
  return (project) => {
    const initiative = initiatives.get(project.initiativeId)
    const found = initiative ? pillars.get(initiative.pillarId) : undefined
    return { initiative, pillar: found?.pillar, pillarIndex: found?.index ?? -1 }
  }
}

export const phaseLabel = (phase: Phase): string => (phase ? (PHASE[phase]?.label ?? phase) : 'No phase')

// ── heat and attention ────────────────────────────────────────────────────

/** Worst status across a set of projects, or null when there are none. */
export function worstStatus(projects: Project[]): RagStatus | null {
  if (projects.length === 0) return null
  return projects.reduce<RagStatus>((worst, project) => (RAG_SORT[project.rag] < RAG_SORT[worst] ? project.rag : worst), 'green')
}

export interface PillarSummary {
  pillar: Pillar
  index: number
  projects: Project[]
  initiatives: number
  counts: RagCounts
  avgProgress: number
  decisions: number
  stale: number
  offTrack: number
}

export function summarizePillar(
  state: TrackerState,
  pillar: Pillar,
  index: number,
  staleDays: number,
  include: (project: Project) => boolean = () => true,
): PillarSummary {
  const projects = projectsForPillar(state, pillar.id).filter(include)
  const now = Date.now()
  return {
    pillar,
    index,
    projects,
    initiatives: state.initiatives.filter((initiative) => initiative.pillarId === pillar.id).length,
    counts: countByRag(projects),
    avgProgress: projects.length ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
    decisions: projects.filter(needsDecision).length,
    stale: projects.filter((project) => isStale(project, staleDays, now)).length,
    offTrack: projects.filter((project) => project.rag === 'red').length,
  }
}

export interface PortfolioStats {
  projects: number
  initiatives: number
  counts: RagCounts
  onTrackPct: number
  decisions: number
  stale: number
  openIssues: number
}

export function portfolioStats(state: TrackerState, projects: Project[], staleDays: number): PortfolioStats {
  const counts = countByRag(projects)
  const now = Date.now()
  const initiativeIds = new Set(projects.map((project) => project.initiativeId))
  return {
    projects: projects.length,
    initiatives: projects.length === state.projects.length ? state.initiatives.length : initiativeIds.size,
    counts,
    onTrackPct: projects.length ? Math.round((counts.green / projects.length) * 100) : 0,
    decisions: projects.filter(needsDecision).length,
    stale: projects.filter((project) => isStale(project, staleDays, now)).length,
    openIssues: projects.reduce((sum, p) => sum + p.issues.filter((issue) => issue.status === 'open').length, 0),
  }
}

/** Off track or waiting on a decision, worst first. */
export function needsAttention(projects: Project[]): Project[] {
  return projects
    .filter((project) => project.rag === 'red' || needsDecision(project))
    .sort((a, b) => RAG_SORT[a.rag] - RAG_SORT[b.rag] || Number(needsDecision(b)) - Number(needsDecision(a)))
}

export function initiativeHeat(state: TrackerState, initiative: Initiative, include: (project: Project) => boolean) {
  const all = projectsForInitiative(state, initiative.id)
  const projects = all.filter(include)
  return {
    initiative,
    projects,
    total: all.length,
    status: worstStatus(projects),
    avgProgress: projects.length ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
  }
}

// ── work items ────────────────────────────────────────────────────────────

export type WorkKind = 'decision' | 'issue' | 'milestone'

export interface WorkItem {
  id: string
  kind: WorkKind
  text: string
  project: Project
  issue?: Issue
  /** ISO date, when the item has one. */
  due: string
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

const byDueThenTitle = (a: WorkItem, b: WorkItem): number => {
  if (a.due && b.due) return a.due.localeCompare(b.due)
  if (a.due) return -1
  if (b.due) return 1
  return RAG_SORT[a.project.rag] - RAG_SORT[b.project.rag] || a.project.title.localeCompare(b.project.title)
}

/** Open decisions, open issues and upcoming milestones across a set of projects. */
export function workItems(projects: Project[]): Record<WorkKind, WorkItem[]> {
  const decisions: WorkItem[] = []
  const issues: WorkItem[] = []
  const milestones: WorkItem[] = []

  for (const project of projects) {
    if (needsDecision(project)) {
      decisions.push({ id: `d-${project.id}`, kind: 'decision', text: project.decisionNeeded, project, due: '' })
    }
    for (const issue of project.issues) {
      if (issue.status !== 'open') continue
      issues.push({ id: `i-${issue.id}`, kind: 'issue', text: issue.title, project, issue, due: '' })
    }
    if (project.nextMilestone.trim()) {
      const due = ISO_DAY.test(project.nextMilestoneDate) ? project.nextMilestoneDate.slice(0, 10) : ''
      milestones.push({ id: `m-${project.id}`, kind: 'milestone', text: project.nextMilestone, project, due })
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const
  issues.sort(
    (a, b) =>
      severityRank[a.issue!.severity] - severityRank[b.issue!.severity] || byDueThenTitle(a, b),
  )
  return { decision: decisions.sort(byDueThenTitle), issue: issues, milestone: milestones.sort(byDueThenTitle) }
}

export function projectsOf(state: TrackerState, person: Person | null): Project[] {
  if (!person) return []
  const ids = new Set(person.projectIds)
  return state.projects.filter((project) => ids.has(project.id))
}

export function isOverdue(isoDay: string, now = new Date()): boolean {
  if (!ISO_DAY.test(isoDay)) return false
  const today = now.toISOString().slice(0, 10)
  return isoDay.slice(0, 10) < today
}

// ── timeline ──────────────────────────────────────────────────────────────

export interface TimelineWindow {
  start: Date
  months: Date[]
}

/** Twelve months starting `offset` months from three months before today. */
export function timelineWindow(offset: number, now = new Date(), span = 12): TimelineWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3 + offset, 1))
  const months = Array.from({ length: span }, (_, index) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)))
  return { start, months }
}

const parseDay = (value: string): number | null => {
  if (!ISO_DAY.test(value?.trim?.() ?? '')) return null
  const time = Date.parse(value.trim().slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(time) ? null : time
}

/** Position of a date within the window as a 0–1 fraction, or null when outside or unset. */
export function timelinePosition(window: TimelineWindow, value: string, clamp = false): number | null {
  const time = parseDay(value)
  if (time === null) return null
  const startMs = window.start.getTime()
  const last = window.months[window.months.length - 1]
  const endMs = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)
  const fraction = (time - startMs) / (endMs - startMs)
  if (clamp) return Math.max(0, Math.min(1, fraction))
  return fraction < 0 || fraction > 1 ? null : fraction
}

export function hasSchedule(project: Project): boolean {
  return [project.startDate, project.forecastEndDate, project.originalEndDate, project.nextMilestoneDate].some(
    (value) => parseDay(value) !== null,
  )
}

/** Days the forecast end has slipped past the original end; negative when ahead. */
export function slipDays(project: Project): number | null {
  const original = parseDay(project.originalEndDate)
  const forecast = parseDay(project.forecastEndDate)
  if (original === null || forecast === null) return null
  return Math.round((forecast - original) / (24 * 60 * 60 * 1000))
}
