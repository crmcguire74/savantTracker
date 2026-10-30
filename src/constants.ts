import type { LegacyPhase, Phase, ProjectFieldKey, RagStatus, Severity, Trend, Validation } from './types'

export const RAG: Record<RagStatus, { label: string; color: string; bg: string }> = {
  green: { label: 'On track', color: 'var(--green)', bg: 'var(--green-soft)' },
  amber: { label: 'At risk', color: 'var(--amber)', bg: 'var(--amber-soft)' },
  red: { label: 'Off track', color: 'var(--red)', bg: 'var(--red-soft)' },
}

export const SEVERITY: Record<Severity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'var(--text-muted)' },
  medium: { label: 'Medium', color: 'var(--amber)' },
  high: { label: 'High', color: 'var(--red)' },
}

export const TREND: Record<Trend, { label: string; symbol: string }> = {
  improving: { label: 'Improving', symbol: '↑' },
  stable: { label: 'Flat', symbol: '→' },
  declining: { label: 'Declining', symbol: '↓' },
}

// Key order is the order of the dropdown and the board columns.
export const PHASE: Record<Exclude<Phase, ''>, { label: string }> = {
  discovery: { label: 'Discovery' },
  planning: { label: 'Planning' },
  execution: { label: 'Execution' },
  review: { label: 'Review' },
  launch: { label: 'Launch' },
  stabilize: { label: 'Stabilize' },
  closed: { label: 'Closed' },
  multi_phase: { label: 'Multi-Phase (Release Based)' },
}

/** The linear lifecycle the phase stepper draws. Multi-phase sits outside it. */
export const PHASE_SEQUENCE: Exclude<Phase, '' | 'multi_phase'>[] = [
  'discovery',
  'planning',
  'execution',
  'review',
  'launch',
  'stabilize',
  'closed',
]

/** Where each retired phase lands in the PMO list. */
export const LEGACY_PHASE: Record<LegacyPhase, Exclude<Phase, ''>> = {
  design: 'planning',
  build: 'execution',
  uat: 'review',
  continuous_improvement: 'stabilize',
  close: 'closed',
}

export const VALIDATION: Record<Exclude<Validation, ''>, { label: string; tone: 'neutral' | 'blue' | 'amber' | 'green' | 'outline' }> = {
  not_started: { label: 'Not Started', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'amber' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  na: { label: 'N/A', tone: 'outline' },
}

export const FIELD_LABELS: Record<ProjectFieldKey, string> = {
  businessOwner: 'Business owner',
  executionOwner: 'Delivery owner',
  projectManager: 'Project manager',
  scope: 'Scope',
  planLink: 'Plan link',
  startDate: 'Start date',
  originalEndDate: 'Original end date',
  forecastEndDate: 'Forecast end date',
  nextMilestone: 'Next milestone',
  nextMilestoneDate: 'Next milestone date',
  dependencies: 'Dependencies',
  keyRisk: 'Key risk / blocker',
  decisionNeeded: 'Decision needed',
  decisionOutcome: 'Decision made',
  rag: 'RAG status',
  trending: 'Trend',
  phase: 'Phase',
  validation: 'Validation',
  progress: 'Progress',
}

export const STALE_PRESETS = [
  { label: 'Weekly (7 days)', value: 7 },
  { label: 'Biweekly (14 days)', value: 14 },
  { label: 'Monthly (30 days)', value: 30 },
  { label: 'Quarterly (90 days)', value: 90 },
] as const

export const RECENT_WINDOW_MS = 1000 * 60 * 10
export const LOG_LIMIT = 300

export const RAG_SORT: Record<RagStatus, number> = { red: 0, amber: 1, green: 2 }
