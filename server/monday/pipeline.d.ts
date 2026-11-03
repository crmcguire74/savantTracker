import type { LogEntry, TrackerState } from '../../src/types'

export interface RetireItem { id: string; title: string; reason?: string }
export interface RetireReport {
  empty: boolean
  approval: string
  counts: { projects: number; initiatives: number; pillars: number }
  projects: RetireItem[]
  initiatives: RetireItem[]
  pillars: RetireItem[]
  adopted: Array<{ fromId: string; toId: string; title: string; fields: string[] }>
  warnings: string[]
  backupKey: string | null
}
export interface SyncReport {
  mode: 'apply' | 'dry-run'
  written: boolean
  boardsFound: number
  skipped: Array<{ board: string; reason: string }>
  summary: Record<string, number>
  warnings: string[]
  logLines: number
  retire: RetireReport | null
}
export declare class RetireApprovalError extends Error { expected: string }
export interface DiscoveredProjects { boards: unknown[]; skipped: Array<{ board: string; reason: string }>; warnings: string[] }
export interface SyncOutcome {
  result: { state: TrackerState; logEntries: LogEntry[]; changed: boolean; summary: Record<string, number>; warnings: string[] }
  plan: { empty: boolean; approval: string; warnings: string[] } | null
  retiring: boolean
}
export declare function planSync(args: {
  state: TrackerState
  discovered: DiscoveredProjects
  pillarMap?: Record<string, string>
  now: string
  retire?: boolean
  apply?: boolean
  approval?: string
  backupKey: string
}): SyncOutcome
export declare function buildReport(args: {
  apply: boolean
  written: boolean
  discovered: DiscoveredProjects
  result: SyncOutcome['result']
  plan: SyncOutcome['plan']
  backupKey: string
}): SyncReport
export declare const stamp: (iso: string) => string
