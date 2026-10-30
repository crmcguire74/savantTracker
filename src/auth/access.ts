// 🚦 Access policy: which roles see which views and reports. Admins edit it
// in the admin console; it is stored as its own document (tracker.access)
// so changing access never touches project data.
//
// Admin always sees everything, whatever the policy says, so no edit can
// lock the last admin out of the console that would undo it.
//
// This decides what the interface offers. The tracker's data is one shared
// document, so a role that cannot open a view can still, in principle, read
// the data behind it through the API. Per-record restrictions would need the
// server to filter; see the action plan.

import { REPORT_CATALOG, REPORT_IDS, type ReportId } from '../reports/catalog'
import { isRole, ROLE_ORDER, type Role } from './roles'

export type FeatureKey =
  | 'portfolio'
  | 'portfolio.heatmap'
  | 'portfolio.brief'
  | 'portfolio.pace'
  | 'board'
  | 'timeline'
  | 'work'
  | 'workload'
  | 'workload.pm-heatmap'
  | 'admin'

export interface FeatureInfo {
  key: FeatureKey
  label: string
  /** The view a layout belongs to; absent for a top-level view. */
  parent?: FeatureKey
  defaultRoles: Role[]
}

const EVERYONE: Role[] = ['admin', 'editor', 'executive', 'viewer']
const LEADERSHIP: Role[] = ['admin', 'editor', 'executive']

export const FEATURE_CATALOG: FeatureInfo[] = [
  { key: 'portfolio', label: 'Portfolio', defaultRoles: EVERYONE },
  { key: 'portfolio.heatmap', label: 'Initiative heatmap', parent: 'portfolio', defaultRoles: EVERYONE },
  { key: 'portfolio.brief', label: 'Leadership brief', parent: 'portfolio', defaultRoles: LEADERSHIP },
  { key: 'portfolio.pace', label: 'Pillar pace', parent: 'portfolio', defaultRoles: LEADERSHIP },
  { key: 'board', label: 'Board', defaultRoles: EVERYONE },
  { key: 'timeline', label: 'Timeline', defaultRoles: EVERYONE },
  { key: 'work', label: 'My work', defaultRoles: ['admin', 'editor'] },
  { key: 'workload', label: 'Workload', defaultRoles: LEADERSHIP },
  { key: 'workload.pm-heatmap', label: 'PM heat map', parent: 'workload', defaultRoles: LEADERSHIP },
  // Replaced the old Reports view; a fresh key so grants made for Reports
  // don't carry over to a page built for the PMO.
  { key: 'admin', label: 'Admin page', defaultRoles: ['admin', 'editor'] },
]

export interface AccessPolicy {
  features: Record<FeatureKey, Role[]>
  reports: Record<ReportId, Role[]>
  updatedAt: string
  updatedByName: string
}

export function defaultPolicy(): AccessPolicy {
  return {
    features: Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, [...f.defaultRoles]])) as AccessPolicy['features'],
    reports: Object.fromEntries(REPORT_CATALOG.map((r) => [r.id, [...r.defaultRoles]])) as AccessPolicy['reports'],
    updatedAt: '',
    updatedByName: '',
  }
}

const cleanRoles = (value: unknown, fallback: Role[]): Role[] => {
  if (!Array.isArray(value)) return [...fallback]
  const roles = new Set(value.filter(isRole))
  roles.add('admin')
  return ROLE_ORDER.filter((role) => roles.has(role))
}

/**
 * Reads a stored policy of any age. Features or reports added since it was
 * saved get their defaults; ones that no longer exist are dropped.
 */
export function normalizePolicy(raw: unknown): AccessPolicy {
  const base = defaultPolicy()
  const source = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof AccessPolicy, unknown>>) : {}
  const features = (source.features && typeof source.features === 'object' ? source.features : {}) as Record<string, unknown>
  const reports = (source.reports && typeof source.reports === 'object' ? source.reports : {}) as Record<string, unknown>
  for (const feature of FEATURE_CATALOG) base.features[feature.key] = cleanRoles(features[feature.key], feature.defaultRoles)
  for (const id of REPORT_IDS) base.reports[id] = cleanRoles(reports[id], base.reports[id])
  base.updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : ''
  base.updatedByName = typeof source.updatedByName === 'string' ? source.updatedByName : ''
  return base
}

const holds = (allowed: readonly Role[], roles: readonly Role[]): boolean =>
  roles.includes('admin') || roles.some((role) => allowed.includes(role))

/** A layout needs its parent view too, so hiding Workload hides the PM heat map. */
export function canUseFeature(policy: AccessPolicy, roles: readonly Role[], key: FeatureKey): boolean {
  const info = FEATURE_CATALOG.find((feature) => feature.key === key)
  if (info?.parent && !canUseFeature(policy, roles, info.parent)) return false
  return holds(policy.features[key] ?? [], roles)
}

/**
 * Spreadsheets download from the account menu, so they need nothing else. The
 * one-pager is printed from the leadership brief, so it needs the brief too.
 */
export function canRunReport(policy: AccessPolicy, roles: readonly Role[], id: ReportId): boolean {
  if (id === 'pillar-one-pager' && !canUseFeature(policy, roles, 'portfolio.brief')) return false
  return holds(policy.reports[id] ?? [], roles)
}
