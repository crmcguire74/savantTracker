// 📊 Pure derivations. No state, no storage, no React. Every number the UI
// shows comes from here, which makes the counts testable on their own.

import { RAG_SORT, RECENT_WINDOW_MS } from '../constants'
import type { Initiative, Project, RagStatus, TrackerState } from '../types'

export type RagCounts = Record<RagStatus, number>

export const emptyCounts = (): RagCounts => ({ green: 0, amber: 0, red: 0 })

export const countByRag = (projects: Project[]): RagCounts =>
  projects.reduce((counts, project) => {
    counts[project.rag] += 1
    return counts
  }, emptyCounts())

export const openIssueCount = (projects: Project[]): number =>
  projects.reduce((total, project) => total + project.issues.filter((i) => i.status === 'open').length, 0)

export const needsDecision = (project: Project): boolean =>
  project.decisionNeeded.trim() !== '' && project.decisionOutcome.trim() === ''

export const hasDecisionRecord = (project: Project): boolean => project.decisionNeeded.trim() !== ''

export const isDecisionResolved = (project: Project): boolean =>
  hasDecisionRecord(project) && project.decisionOutcome.trim() !== ''

export const isStale = (project: Project, thresholdDays: number, now = Date.now()): boolean => {
  if (!project.updatedAt) return false
  const updated = new Date(project.updatedAt).getTime()
  if (Number.isNaN(updated)) return false
  return now - updated > thresholdDays * 24 * 60 * 60 * 1000
}

export const isRecentlyEdited = (project: Project, now = Date.now()): boolean => {
  if (!project.updatedAt) return false
  const updated = new Date(project.updatedAt).getTime()
  return !Number.isNaN(updated) && now - updated < RECENT_WINDOW_MS
}

export const byRag = (a: Project, b: Project): number => RAG_SORT[a.rag] - RAG_SORT[b.rag]

export const projectsForInitiative = (state: TrackerState, initiativeId: string): Project[] =>
  state.projects.filter((project) => project.initiativeId === initiativeId)

export const initiativesForPillar = (state: TrackerState, pillarId: string): Initiative[] =>
  state.initiatives.filter((initiative) => initiative.pillarId === pillarId)

export const projectsForPillar = (state: TrackerState, pillarId: string): Project[] => {
  const ids = new Set(initiativesForPillar(state, pillarId).map((initiative) => initiative.id))
  return state.projects.filter((project) => ids.has(project.initiativeId))
}

export interface InitiativeRollup {
  counts: RagCounts
  total: number
  avgProgress: number
  openIssues: number
  decisions: number
}

export const initiativeRollup = (state: TrackerState, initiativeId: string): InitiativeRollup => {
  const projects = projectsForInitiative(state, initiativeId)
  const progressSum = projects.reduce((sum, project) => sum + project.progress, 0)
  return {
    counts: countByRag(projects),
    total: projects.length,
    avgProgress: projects.length ? Math.round(progressSum / projects.length) : 0,
    openIssues: openIssueCount(projects),
    decisions: projects.filter(needsDecision).length,
  }
}

export const pillarRollup = (state: TrackerState, pillarId: string) => {
  const projects = projectsForPillar(state, pillarId)
  return { counts: countByRag(projects), total: projects.length }
}

export interface SearchFilters {
  query: string
  rag: RagStatus | null
  staleOnly: boolean
  decisionsOnly: boolean
}

export interface SearchHit {
  project: Project
  ownerMatch: string | null
}

export const emptyFilters = (): SearchFilters => ({
  query: '',
  rag: null,
  staleOnly: false,
  decisionsOnly: false,
})

export const isFiltering = (filters: SearchFilters): boolean =>
  filters.query.trim() !== '' || filters.rag !== null || filters.staleOnly || filters.decisionsOnly

export function searchProjects(
  state: TrackerState,
  filters: SearchFilters,
  staleThresholdDays: number,
): SearchHit[] {
  const query = filters.query.trim().toLowerCase()

  return state.projects
    .filter((project) => (filters.rag ? project.rag === filters.rag : true))
    .filter((project) => (filters.staleOnly ? isStale(project, staleThresholdDays) : true))
    .filter((project) => (filters.decisionsOnly ? hasDecisionRecord(project) : true))
    .map((project): SearchHit | null => {
      if (!query) return { project, ownerMatch: null }
      const roles = [
        project.businessOwner.toLowerCase().includes(query) && 'Business owner',
        project.executionOwner.toLowerCase().includes(query) && 'Delivery owner',
        project.projectManager.toLowerCase().includes(query) && 'Project manager',
      ].filter((role): role is string => Boolean(role))
      const title = project.title.toLowerCase().includes(query)
      const scope = project.scope.toLowerCase().includes(query)
      if (roles.length === 0 && !title && !scope) return null
      return { project, ownerMatch: roles.length ? roles.join(' & ') : null }
    })
    .filter((hit): hit is SearchHit => hit !== null)
    .sort((a, b) => byRag(a.project, b.project))
}
