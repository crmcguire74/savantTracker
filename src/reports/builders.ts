// 🏗️ Report builders: tracker data in, a finished file out. Pure, so each
// report can be tested without a browser. The printable one-pager is built
// by ./onepager.ts and drawn by the ReportPreview view.

import { FIELD_LABELS, RAG, SEVERITY, TREND, VALIDATION } from '../constants'
import { contextIndex, phaseLabel, pillarLabel, slipDays } from '../lib/insights'
import { attentionFor, projectPace, PACE_LABEL } from '../lib/pace'
import type { Person } from '../lib/people'
import { isStale, needsDecision } from '../lib/rollups'
import type { LogEntry, Project, Settings, TrackerState } from '../types'
import type { ReportId } from './catalog'
import { toCsv, type Cell } from './csv'

export interface ReportInput {
  state: TrackerState
  log: LogEntry[]
  settings: Settings
  people: Person[]
  now?: number
}

export interface ReportFile {
  filename: string
  text: string
  type: string
}

const DAY_MS = 24 * 60 * 60 * 1000

const stampName = (slug: string, now: number) => `wisetrack-${slug}-${new Date(now).toISOString().slice(0, 10)}.csv`

const ageDays = (iso: string, now: number): Cell => {
  const time = new Date(iso).getTime()
  return iso && !Number.isNaN(time) ? Math.floor((now - time) / DAY_MS) : ''
}

const validationLabel = (project: Project) => (project.validation ? VALIDATION[project.validation].label : '')

function pathColumns(input: ReportInput) {
  const contextOf = contextIndex(input.state)
  return (project: Project): Cell[] => {
    const context = contextOf(project)
    return [context.pillar ? pillarLabel(context.pillar, context.pillarIndex).title : '', context.initiative?.title ?? '']
  }
}

/** Projects in portfolio order: pillar, then initiative, then title. */
function ordered(state: TrackerState): Project[] {
  const initiativeOrder = new Map(state.initiatives.map((initiative, index) => [initiative.id, index]))
  const pillarOf = new Map(state.initiatives.map((initiative) => [initiative.id, initiative.pillarId]))
  const pillarOrder = new Map(state.pillars.map((pillar, index) => [pillar.id, index]))
  const rank = (project: Project) => [
    pillarOrder.get(pillarOf.get(project.initiativeId) ?? '') ?? 999,
    initiativeOrder.get(project.initiativeId) ?? 999,
  ]
  return state.projects.slice().sort((a, b) => {
    const [pa, ia] = rank(a)
    const [pb, ib] = rank(b)
    return pa - pb || ia - ib || a.title.localeCompare(b.title)
  })
}

function statusRegister(input: ReportInput, now: number): ReportFile {
  const path = pathColumns(input)
  const header = [
    'Pillar',
    'Initiative',
    'Project',
    'Status',
    FIELD_LABELS.trending,
    FIELD_LABELS.phase,
    FIELD_LABELS.validation,
    'Progress %',
    'Pace',
    FIELD_LABELS.businessOwner,
    FIELD_LABELS.executionOwner,
    FIELD_LABELS.projectManager,
    FIELD_LABELS.startDate,
    FIELD_LABELS.originalEndDate,
    FIELD_LABELS.forecastEndDate,
    'Slip (days)',
    FIELD_LABELS.nextMilestone,
    FIELD_LABELS.nextMilestoneDate,
    FIELD_LABELS.dependencies,
    FIELD_LABELS.keyRisk,
    FIELD_LABELS.decisionNeeded,
    FIELD_LABELS.decisionOutcome,
    'Open issues',
    FIELD_LABELS.scope,
    FIELD_LABELS.planLink,
    'Last updated',
    'Updated by',
    'Days since update',
  ]
  const rows = ordered(input.state).map((project) => [
    ...path(project),
    project.title,
    RAG[project.rag].label,
    TREND[project.trending].label,
    project.phase ? phaseLabel(project.phase) : '',
    validationLabel(project),
    project.progress,
    PACE_LABEL[projectPace(project, input.settings.staleThresholdDays, now).pace],
    project.businessOwner,
    project.executionOwner,
    project.projectManager,
    project.startDate,
    project.originalEndDate,
    project.forecastEndDate,
    slipDays(project) ?? '',
    project.nextMilestone,
    project.nextMilestoneDate,
    project.dependencies,
    project.keyRisk,
    project.decisionNeeded,
    project.decisionOutcome,
    project.issues
      .filter((issue) => issue.status === 'open')
      .map((issue) => `[${SEVERITY[issue.severity].label}] ${issue.title}`)
      .join('; '),
    project.scope,
    project.planLink,
    project.updatedAt.slice(0, 10),
    project.updatedByName,
    ageDays(project.updatedAt, now),
  ])
  return { filename: stampName('status-register', now), text: toCsv(header, rows), type: 'text/csv' }
}

function pmStatus(input: ReportInput, now: number): ReportFile {
  const path = pathColumns(input)
  const byId = new Map(input.state.projects.map((project) => [project.id, project]))
  const managed = new Set<string>()
  const rows: Cell[][] = []
  const line = (pm: string, project: Project): Cell[] => {
    const attention = attentionFor(project, input.settings.staleThresholdDays, now)
    return [
      pm,
      project.title,
      ...path(project),
      RAG[project.rag].label,
      project.phase ? phaseLabel(project.phase) : '',
      validationLabel(project),
      project.progress,
      project.nextMilestone,
      project.nextMilestoneDate,
      ageDays(project.updatedAt, now),
      isStale(project, input.settings.staleThresholdDays, now) ? 'Yes' : 'No',
      attention.level === 'healthy' ? 'Low' : attention.level === 'critical' ? 'Critical' : 'Watch',
      attention.reasons.join('; '),
    ]
  }
  const managers = input.people.filter((person) => person.pm.length > 0).sort((a, b) => a.name.localeCompare(b.name))
  for (const person of managers) {
    for (const id of person.pm) {
      const project = byId.get(id)
      if (!project) continue
      managed.add(id)
      rows.push(line(person.name, project))
    }
  }
  for (const project of ordered(input.state)) if (!managed.has(project.id)) rows.push(line('(No PM assigned)', project))
  const header = [
    'Project manager',
    'Project',
    'Pillar',
    'Initiative',
    'Status',
    'Phase',
    'Validation',
    'Progress %',
    'Next milestone',
    'Milestone date',
    'Days since update',
    'Stale',
    'Attention',
    'Why',
  ]
  return { filename: stampName('pm-status', now), text: toCsv(header, rows), type: 'text/csv' }
}

function attention(input: ReportInput, now: number): ReportFile {
  const path = pathColumns(input)
  const rows = input.state.projects
    .map((project) => ({ project, attention: attentionFor(project, input.settings.staleThresholdDays, now) }))
    .filter((entry) => entry.attention.level !== 'healthy')
    .sort((a, b) => b.attention.score - a.attention.score || a.project.title.localeCompare(b.project.title))
    .map(({ project, attention: result }) => [
      result.level === 'critical' ? 'Critical' : 'Watch',
      result.score,
      project.title,
      ...path(project),
      RAG[project.rag].label,
      project.projectManager,
      project.executionOwner,
      result.reasons.join('; '),
      project.keyRisk,
      project.dependencies,
      project.decisionNeeded && !project.decisionOutcome ? project.decisionNeeded : '',
    ])
  const header = ['Attention', 'Score', 'Project', 'Pillar', 'Initiative', 'Status', 'Project manager', 'Delivery owner', 'Why', 'Key risk / blocker', 'Dependencies', 'Decision waiting']
  return { filename: stampName('needs-attention', now), text: toCsv(header, rows), type: 'text/csv' }
}

function decisionLog(input: ReportInput, now: number): ReportFile {
  const path = pathColumns(input)
  const rows = ordered(input.state)
    .filter((project) => project.decisionNeeded.trim() || project.decisionOutcome.trim())
    .map((project) => [
      project.title,
      ...path(project),
      needsDecision(project) ? 'Waiting' : 'Decided',
      project.decisionNeeded,
      project.decisionOutcome,
      project.businessOwner,
      project.updatedAt.slice(0, 10),
    ])
  const header = ['Project', 'Pillar', 'Initiative', 'State', 'Decision needed', 'Decision made', 'Business owner', 'Last updated']
  return { filename: stampName('decision-log', now), text: toCsv(header, rows), type: 'text/csv' }
}

function changeLog(input: ReportInput, now: number): ReportFile {
  const rows = input.log.map((entry) => [
    entry.timestamp.replace('T', ' ').slice(0, 16),
    entry.projectTitle,
    entry.field,
    entry.oldValue,
    entry.newValue,
    entry.editedByName,
  ])
  return {
    filename: stampName('change-log', now),
    text: toCsv(['When (UTC)', 'Project', 'Field', 'From', 'To', 'Changed by'], rows),
    type: 'text/csv',
  }
}

const CSV_BUILDERS: Partial<Record<ReportId, (input: ReportInput, now: number) => ReportFile>> = {
  'status-register': statusRegister,
  'pm-status': pmStatus,
  attention,
  'decision-log': decisionLog,
  'change-log': changeLog,
}

export function buildCsvReport(id: ReportId, input: ReportInput): ReportFile | null {
  const build = CSV_BUILDERS[id]
  return build ? build(input, input.now ?? Date.now()) : null
}
