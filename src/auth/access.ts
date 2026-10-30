// 🚦 Access policy: which roles see which views and reports. Admins edit it
// in the admin console; it is stored as its own document (tracker.access)
// so changing access never touches project data.
//
// Features are not listed here. Each module declares the features it adds in
// its manifest, and the platform hands the assembled catalogue to these
// functions. A stored grant for a feature this build does not know is kept,
// not dropped, so removing a module and adding it back loses nothing.
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

/** A module-declared key such as `board` or `portfolio.brief`. */
export type FeatureKey = string

export interface FeatureInfo {
  key: FeatureKey
  label: string
  /** The view a layout belongs to; absent for a top-level view. */
  parent?: FeatureKey
  defaultRoles: Role[]
}

export type FeatureCatalog = readonly FeatureInfo[]

export interface AccessPolicy {
  features: Record<FeatureKey, Role[]>
  reports: Record<ReportId, Role[]>
  updatedAt: string
  updatedByName: string
}

const cleanRoles = (value: unknown, fallback: readonly Role[]): Role[] => {
  const roles = new Set(Array.isArray(value) ? value.filter(isRole) : fallback)
  roles.add('admin')
  return ROLE_ORDER.filter((role) => roles.has(role))
}

export function defaultPolicy(catalog: FeatureCatalog = []): AccessPolicy {
  return {
    features: Object.fromEntries(catalog.map((f) => [f.key, cleanRoles(undefined, f.defaultRoles)])),
    reports: Object.fromEntries(REPORT_CATALOG.map((r) => [r.id, cleanRoles(undefined, r.defaultRoles)])) as AccessPolicy['reports'],
    updatedAt: '',
    updatedByName: '',
  }
}

/**
 * Reads a stored policy of any age. Features in the catalogue that it never
 * saved get their defaults; features outside the catalogue are kept as saved.
 */
export function normalizePolicy(raw: unknown, catalog: FeatureCatalog = []): AccessPolicy {
  const base = defaultPolicy(catalog)
  const source = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof AccessPolicy, unknown>>) : {}
  const features = (source.features && typeof source.features === 'object' ? source.features : {}) as Record<string, unknown>
  const reports = (source.reports && typeof source.reports === 'object' ? source.reports : {}) as Record<string, unknown>
  for (const [key, value] of Object.entries(features)) base.features[key] = cleanRoles(value, base.features[key] ?? [])
  for (const id of REPORT_IDS) base.reports[id] = cleanRoles(reports[id], base.reports[id])
  base.updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : ''
  base.updatedByName = typeof source.updatedByName === 'string' ? source.updatedByName : ''
  return base
}

const holds = (allowed: readonly Role[], roles: readonly Role[]): boolean =>
  roles.includes('admin') || roles.some((role) => allowed.includes(role))

/** The roles a feature is open to: the saved grant, else the declared default. */
export function featureRoles(policy: AccessPolicy, key: FeatureKey, catalog: FeatureCatalog = []): Role[] {
  return policy.features[key] ?? catalog.find((feature) => feature.key === key)?.defaultRoles ?? []
}

/** A layout needs its parent view too, so hiding Workload hides the PM heat map. */
export function canUseFeature(policy: AccessPolicy, roles: readonly Role[], key: FeatureKey, catalog: FeatureCatalog = []): boolean {
  const info = catalog.find((feature) => feature.key === key)
  if (info?.parent && !canUseFeature(policy, roles, info.parent, catalog)) return false
  return holds(featureRoles(policy, key, catalog), roles)
}

/**
 * Spreadsheets download from the account menu, so they need nothing else. A
 * report printed from a view (the one-pager, from the leadership brief) needs
 * that view too.
 */
export function canRunReport(policy: AccessPolicy, roles: readonly Role[], id: ReportId, catalog: FeatureCatalog = []): boolean {
  const needs = REPORT_CATALOG.find((report) => report.id === id)?.requiresFeature
  if (needs && !canUseFeature(policy, roles, needs, catalog)) return false
  return holds(policy.reports[id] ?? [], roles)
}
