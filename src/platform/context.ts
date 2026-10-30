// 🔌 The platform API: everything a module may use from the base framework,
// in one read-mostly bundle. The provider owns every piece of state behind
// it, so a module never wires its own storage, identity or routing, and two
// modules never talk to each other except through what is here (shared data,
// shared filters, and links).

import { createContext, useContext } from 'react'
import type { FeatureInfo, FeatureKey } from '../auth/access'
import type { Role } from '../auth/roles'
import type { ReportId } from '../reports/catalog'
import type { ThemePreference, Theme } from '../hooks/useTheme'
import type { TrackerApi } from '../hooks/useTracker'
import type { ProjectContext, ViewFilters } from '../lib/insights'
import type { Person } from '../lib/people'
import type { Identity, Project } from '../types'
import type { LinkTo, Location } from './module'
import type { Registry } from './registry'

export interface ConfirmRequest {
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export interface PlatformApi {
  // ── data ───────────────────────────────────────────────────────────────
  /** Shared tracker data and every mutation. In development the data is frozen. */
  tracker: TrackerApi

  // ── identity and access ───────────────────────────────────────────────
  identity: Identity
  identitySource: 'entra' | 'local'
  canWrite: boolean
  setName: (name: string) => void
  roles: Role[]
  isAdmin: boolean
  /** True when the access policy lets the current roles use this feature. */
  can: (feature: FeatureKey) => boolean
  canReport: (id: ReportId) => boolean
  /** The access catalogue, assembled from every registered module. */
  features: readonly FeatureInfo[]
  /** Local testing only; null under Entra, where roles come from the account. */
  setTestRole: ((role: Role) => void) | null

  // ── navigation ────────────────────────────────────────────────────────
  /** The resolved location the app is showing. */
  location: Location
  navigate: (to: LinkTo, options?: { replace?: boolean }) => void
  /** The `#/…` href for a link, for anchors and copied URLs. */
  hrefFor: (to: LinkTo) => string
  openProject: (projectId: string) => void

  // ── shared view state ─────────────────────────────────────────────────
  filters: ViewFilters
  setFilters: (patch: Partial<ViewFilters> | ((current: ViewFilters) => ViewFilters)) => void
  /** Predicate built from `filters`; layouts that ignore filters skip it. */
  matches: (project: Project) => boolean
  filtering: boolean
  people: Person[]
  me: Person | null
  meClaimed: boolean
  claimMe: (personKey: string | null) => void
  contextOf: (project: Project) => ProjectContext

  // ── global UI services ────────────────────────────────────────────────
  ask: (request: ConfirmRequest) => void
  theme: Theme
  themePreference: ThemePreference
  setThemePreference: (preference: ThemePreference) => void
  toggleTheme: () => void
  openStorage: () => void
  openIdentity: () => void
  openChangeLog: (projectId?: string) => void
  startImport: () => void
}

export const PlatformContext = createContext<PlatformApi | null>(null)

export function usePlatform(): PlatformApi {
  const value = useContext(PlatformContext)
  if (!value) throw new Error('usePlatform must be used inside <PlatformProvider>')
  return value
}

/** Platform-internal: the registry the shell is built from. Not part of the SDK. */
export const RegistryContext = createContext<Registry | null>(null)

export function useRegistry(): Registry {
  const value = useContext(RegistryContext)
  if (!value) throw new Error('useRegistry must be used inside <PlatformProvider>')
  return value
}
