// 📦 The app file: one JSON document that holds everything the tracker needs
// to stand itself up on a different machine, a different browser, or a
// different backend. Export writes it, import reads it, and the bundled
// migration snapshot IS one, so there is exactly one format to maintain.
//
// It also absorbs history. The Claude artifact exported a bare state object
// with no envelope and a `updatedBy` field that held a display name; those
// files still import cleanly and get normalized on the way in.

import type {
  Initiative,
  Issue,
  LogEntry,
  Phase,
  Pillar,
  Project,
  RagStatus,
  Settings,
  Severity,
  TrackerState,
  Trend,
} from '../types'

export const APP_FILE_VERSION = 1
export const APP_FILE_ID = 'savant-strategic-initiatives-tracker'

export interface AppFile {
  app: string
  formatVersion: number
  exportedAt: string
  source: string
  settings: Settings
  state: TrackerState
  log: LogEntry[]
}

export class AppFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppFileError'
  }
}

export interface ParseResult {
  file: AppFile
  /** Non-fatal repairs applied while reading. Worth showing the user. */
  warnings: string[]
}

const RAG_VALUES: RagStatus[] = ['green', 'amber', 'red']
const TREND_VALUES: Trend[] = ['improving', 'stable', 'declining']
const SEVERITY_VALUES: Severity[] = ['low', 'medium', 'high']
const PHASE_VALUES: Phase[] = [
  '',
  'discovery',
  'design',
  'execution',
  'build',
  'uat',
  'launch',
  'continuous_improvement',
  'close',
]

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value)

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function normalizeIssue(raw: unknown, index: number): Issue {
  const source = asRecord(raw)
  return {
    id: str(source.id) || `iss-import-${index}`,
    title: str(source.title),
    severity: oneOf(source.severity, SEVERITY_VALUES, 'medium'),
    status: source.status === 'resolved' ? 'resolved' : 'open',
  }
}

function normalizeProject(raw: unknown, index: number, warnings: string[]): Project {
  const source = asRecord(raw)
  const legacyName = str(source.updatedByName) || str(source.updatedBy)
  if (!('decisionOutcome' in source)) {
    warnings.push(`Project "${str(source.title) || index}" predates the decision-outcome field; set to empty.`)
  }
  return {
    id: str(source.id) || `proj-import-${index}`,
    initiativeId: str(source.initiativeId),
    title: str(source.title),
    businessOwner: str(source.businessOwner),
    executionOwner: str(source.executionOwner),
    projectManager: str(source.projectManager),
    scope: str(source.scope),
    trending: oneOf(source.trending, TREND_VALUES, 'stable'),
    phase: oneOf(source.phase, PHASE_VALUES, ''),
    planLink: str(source.planLink),
    startDate: str(source.startDate),
    originalEndDate: str(source.originalEndDate),
    forecastEndDate: str(source.forecastEndDate),
    nextMilestone: str(source.nextMilestone),
    nextMilestoneDate: str(source.nextMilestoneDate),
    keyRisk: str(source.keyRisk),
    decisionNeeded: str(source.decisionNeeded),
    decisionOutcome: str(source.decisionOutcome),
    rag: oneOf(source.rag, RAG_VALUES, 'green'),
    progress: Math.max(0, Math.min(100, Math.round(num(source.progress)))),
    updatedAt: str(source.updatedAt),
    updatedById: str(source.updatedById),
    updatedByName: legacyName,
    issues: arr(source.issues).map(normalizeIssue),
  }
}

function normalizeInitiative(raw: unknown, index: number): Initiative {
  const source = asRecord(raw)
  return {
    id: str(source.id) || `init-import-${index}`,
    pillarId: str(source.pillarId),
    title: str(source.title),
    businessOwner: str(source.businessOwner),
    executionOwner: str(source.executionOwner),
    startQuarter: str(source.startQuarter),
    endQuarter: str(source.endQuarter),
  }
}

function normalizePillar(raw: unknown, index: number): Pillar {
  const source = asRecord(raw)
  return {
    id: str(source.id) || `obj-import-${index}`,
    title: str(source.title),
    owner: str(source.owner),
  }
}

function normalizeLogEntry(raw: unknown, index: number): LogEntry {
  const source = asRecord(raw)
  return {
    id: str(source.id) || `log-import-${index}`,
    timestamp: str(source.timestamp),
    projectId: str(source.projectId),
    projectTitle: str(source.projectTitle),
    field: str(source.field),
    fieldKey: str(source.fieldKey),
    oldValue: str(source.oldValue),
    newValue: str(source.newValue),
    editedById: str(source.editedById),
    editedByName: str(source.editedByName),
  }
}

/**
 * Accepts any historical shape and returns the current one.
 *
 * Recognised inputs:
 *   - v1 app file: `{ app, formatVersion: 1, state, log, settings }`
 *   - legacy artifact export: a bare `{ quarter, pillars, initiatives, projects }`
 *   - raw artifact db pair: `{ state: {...}, log: { entries: [...] } }`
 */
export function parseAppFile(input: unknown): ParseResult {
  const warnings: string[] = []
  const root = asRecord(input)

  const looksLikeBareState = 'projects' in root && 'pillars' in root && !('state' in root)
  if (looksLikeBareState) {
    warnings.push('Read a legacy export with no envelope; wrapped it in the current app-file format.')
  }

  const stateSource = asRecord(looksLikeBareState ? root : root.state)
  if (!Array.isArray(stateSource.projects) || !Array.isArray(stateSource.pillars)) {
    throw new AppFileError('That file is not a tracker export: no pillars or projects were found.')
  }

  const formatVersion = num(root.formatVersion, looksLikeBareState ? 0 : 1)
  if (formatVersion > APP_FILE_VERSION) {
    throw new AppFileError(
      `That file was written by a newer version of the tracker (format ${formatVersion}). Update the app first.`,
    )
  }

  const rawLog = Array.isArray(root.log) ? root.log : arr(asRecord(root.log).entries)

  const state: TrackerState = {
    quarter: str(stateSource.quarter),
    pillars: arr(stateSource.pillars).map(normalizePillar),
    initiatives: arr(stateSource.initiatives).map(normalizeInitiative),
    projects: arr(stateSource.projects).map((project, index) => normalizeProject(project, index, warnings)),
  }

  const pillarIds = new Set(state.pillars.map((pillar) => pillar.id))
  const initiativeIds = new Set(state.initiatives.map((initiative) => initiative.id))
  const orphanInitiatives = state.initiatives.filter((initiative) => !pillarIds.has(initiative.pillarId))
  const orphanProjects = state.projects.filter((project) => !initiativeIds.has(project.initiativeId))
  if (orphanInitiatives.length > 0) {
    warnings.push(`${orphanInitiatives.length} initiative(s) point at a pillar that is not in the file.`)
  }
  if (orphanProjects.length > 0) {
    warnings.push(`${orphanProjects.length} project(s) point at an initiative that is not in the file.`)
  }

  const settings: Settings = {
    staleThresholdDays: Math.max(1, Math.round(num(asRecord(root.settings).staleThresholdDays, 30))),
  }

  return {
    file: {
      app: str(root.app) || APP_FILE_ID,
      formatVersion: APP_FILE_VERSION,
      exportedAt: str(root.exportedAt) || new Date().toISOString(),
      source: str(root.source) || (looksLikeBareState ? 'legacy-export' : 'app-file'),
      settings,
      state,
      log: rawLog.map(normalizeLogEntry),
    },
    warnings,
  }
}

export function createAppFile(
  state: TrackerState,
  log: LogEntry[],
  settings: Settings,
  source = 'app-export',
): AppFile {
  return {
    app: APP_FILE_ID,
    formatVersion: APP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    source,
    settings,
    state,
    log,
  }
}

export const serializeAppFile = (file: AppFile): string => JSON.stringify(file, null, 2)
