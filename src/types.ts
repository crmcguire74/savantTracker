// 🧱 Domain model. Every shape here is plain data: no class instances, no
// methods, nothing that survives a JSON round-trip badly. That is what makes
// the export file and the storage adapters interchangeable.

export type RagStatus = 'green' | 'amber' | 'red'
export type Trend = 'improving' | 'stable' | 'declining'
export type Severity = 'low' | 'medium' | 'high'
export type IssueStatus = 'open' | 'resolved'
export type Phase =
  | ''
  | 'discovery'
  | 'planning'
  | 'execution'
  | 'review'
  | 'launch'
  | 'stabilize'
  | 'closed'
  /** Release-based delivery: several phases run at once, so it sits off the sequence. */
  | 'multi_phase'

/** Phase values written before the PMO phase list (Oct 2026). Migrated on load. */
export type LegacyPhase = 'design' | 'build' | 'uat' | 'continuous_improvement' | 'close'

export type Validation = '' | 'not_started' | 'pending' | 'in_progress' | 'completed' | 'na'

export interface Issue {
  id: string
  title: string
  severity: Severity
  status: IssueStatus
}

export interface Project {
  id: string
  initiativeId: string
  title: string
  businessOwner: string
  executionOwner: string
  projectManager: string
  scope: string
  trending: Trend
  phase: Phase
  validation: Validation
  planLink: string
  startDate: string
  originalEndDate: string
  forecastEndDate: string
  nextMilestone: string
  nextMilestoneDate: string
  /** Free text: the teams, vendors or projects this one is waiting on. */
  dependencies: string
  keyRisk: string
  decisionNeeded: string
  decisionOutcome: string
  rag: RagStatus
  progress: number
  updatedAt: string
  /** Opaque identity id of the last editor. Empty when edited offline. */
  updatedById: string
  /** Display name of the last editor, cached so the log reads without a lookup. */
  updatedByName: string
  issues: Issue[]
}

export interface Initiative {
  id: string
  pillarId: string
  title: string
  businessOwner: string
  executionOwner: string
  startQuarter: string
  endQuarter: string
}

export interface Pillar {
  id: string
  title: string
  owner: string
}

export interface TrackerState {
  quarter: string
  pillars: Pillar[]
  initiatives: Initiative[]
  projects: Project[]
}

export interface LogEntry {
  id: string
  timestamp: string
  projectId: string
  projectTitle: string
  /** Human label, e.g. "Forecast end date". */
  field: string
  /** Machine key, e.g. "forecastEndDate". Empty for structural events. */
  fieldKey: string
  oldValue: string
  newValue: string
  editedById: string
  editedByName: string
}

export interface Settings {
  staleThresholdDays: number
}

/** Editable project fields, derived from the model so the two cannot drift. */
export type ProjectFieldKey = Extract<
  keyof Project,
  | 'businessOwner'
  | 'executionOwner'
  | 'projectManager'
  | 'scope'
  | 'planLink'
  | 'startDate'
  | 'originalEndDate'
  | 'forecastEndDate'
  | 'nextMilestone'
  | 'nextMilestoneDate'
  | 'dependencies'
  | 'keyRisk'
  | 'decisionNeeded'
  | 'decisionOutcome'
  | 'rag'
  | 'trending'
  | 'phase'
  | 'validation'
  | 'progress'
>

export type ProjectFieldValue = string | number

export interface Identity {
  id: string
  name: string
}
