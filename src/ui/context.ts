// 🔌 One context for the views. App.tsx owns every piece of state and hands
// the views a read-mostly bundle, so a view never wires its own storage,
// identity or routing.

import { createContext, useContext } from 'react'
import type { Route } from '../hooks/useRoute'
import type { ThemePreference, Theme } from '../hooks/useTheme'
import type { TrackerApi } from '../hooks/useTracker'
import type { ProjectContext, ViewFilters } from '../lib/insights'
import type { Person } from '../lib/people'
import type { Identity, Project } from '../types'

export interface ConfirmRequest {
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export interface AppContextValue {
  tracker: TrackerApi
  identity: Identity
  identitySource: 'entra' | 'local'
  canWrite: boolean
  setName: (name: string) => void

  route: Route
  navigate: (route: Route, options?: { replace?: boolean }) => void
  openProject: (projectId: string) => void

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

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>')
  return value
}
