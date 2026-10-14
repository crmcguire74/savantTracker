import type { Phase, ProjectFieldKey, RagStatus, Severity, Trend } from './types'

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

export const PHASE: Record<Exclude<Phase, ''>, { label: string }> = {
  discovery: { label: 'Discovery' },
  design: { label: 'Design' },
  execution: { label: 'Execution' },
  build: { label: 'Build' },
  uat: { label: 'UAT' },
  launch: { label: 'Launch' },
  continuous_improvement: { label: 'Continuous Improvement' },
  close: { label: 'Close' },
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
  keyRisk: 'Key risk / blocker',
  decisionNeeded: 'Decision needed',
  decisionOutcome: 'Decision made',
  rag: 'RAG status',
  trending: 'Trend',
  phase: 'Phase',
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
