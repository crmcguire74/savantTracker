// 🏛️ The base framework's state. One provider owns storage, identity, access,
// location, shared filters and the global overlays (toasts, confirm, conflict,
// change log, storage and identity panels), and publishes them as the
// platform API. The production shell and the module workbench both render
// inside it, so a module behaves the same in either.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { canRunReport, canUseFeature, normalizePolicy, type FeatureKey } from '../auth/access'
import { isAdmin } from '../auth/roles'
import type { ReportId } from '../reports/catalog'
import { useIdentity } from '../hooks/useIdentity'
import { useMe } from '../hooks/useMe'
import { useTheme } from '../hooks/useTheme'
import { useTracker, type TrackerApi } from '../hooks/useTracker'
import { contextIndex, hasFilters, makeProjectFilter, noFilters, type ViewFilters } from '../lib/insights'
import { buildPeople } from '../lib/people'
import { Icon } from '../ui/icons'
import { ChangeLogDrawer } from './ChangeLog'
import { PlatformContext, RegistryContext, type ConfirmRequest, type PlatformApi } from './context'
import { formatLocation, useLocation } from './location'
import { ConfirmModal, ConflictModal, IdentityModal, StorageModal } from './modals'
import type { LinkTo } from './module'
import { resolveLocation, type Registry } from './registry'

const DEV = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)

/**
 * Development only: freezes shared data so a module that mutates it in place
 * throws inside its own sandbox instead of silently corrupting every other
 * module's view. Production skips the walk.
 */
function deepFreeze<T>(value: T): T {
  if (!DEV || value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}

export function PlatformProvider(props: { registry: Registry; children: ReactNode }) {
  const { registry } = props
  const { identity, roles, canWrite, source: identitySource, resolving: identityResolving, setName, setTestRole } = useIdentity()
  const admin = isAdmin(roles)
  const raw = useTracker(identity, canWrite, admin)
  const { features } = registry

  // Modules see the access policy filled in for every registered feature, and
  // shared data frozen in development.
  const access = useMemo(() => normalizePolicy(raw.access, features), [raw.access, features])
  const tracker = useMemo<TrackerApi>(
    () => ({ ...raw, state: deepFreeze(raw.state), log: deepFreeze(raw.log), settings: deepFreeze(raw.settings), access }),
    [raw, access],
  )
  const { state, settings, loading, notice, conflict, storageStatus, actions } = tracker
  const { theme, preference, setPreference, toggle } = useTheme()

  const [filters, setFilterState] = useState<ViewFilters>(noFilters)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [showStorage, setShowStorage] = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)
  const [changeLog, setChangeLog] = useState<{ projectId?: string } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const can = useCallback((feature: FeatureKey) => canUseFeature(access, roles, feature, features), [access, roles, features])
  const canReport = useCallback((id: ReportId) => canRunReport(access, roles, id, features), [access, roles, features])

  const { location: rawLocation, navigate } = useLocation()
  const resolved = useMemo(() => resolveLocation(registry, rawLocation, { isAdmin: admin, can }), [registry, rawLocation, admin, can])
  const location = resolved.location

  // A retired URL is rewritten in place, so the address bar shows the new home.
  useEffect(() => {
    if (resolved.redirected) navigate(location, { replace: true })
  }, [resolved.redirected, location, navigate])

  const people = useMemo(() => buildPeople(state), [state])
  const { me, claimed, claim } = useMe(identity, people)
  const matches = useMemo(
    () => makeProjectFilter(state, filters, settings.staleThresholdDays, people),
    [state, filters, settings.staleThresholdDays, people],
  )
  const contextOf = useMemo(() => contextIndex(state), [state])

  // Local mode with no name yet: ask once, so the change log has an author.
  useEffect(() => {
    if (!loading && !identityResolving && identitySource === 'local' && !identity.name) setShowIdentity(true)
  }, [loading, identityResolving, identitySource, identity.name])

  const setFilters = useCallback<PlatformApi['setFilters']>((patch) => {
    setFilterState((current) => (typeof patch === 'function' ? patch(current) : { ...current, ...patch }))
  }, [])

  const goTo = useCallback(
    (to: LinkTo, options?: { replace?: boolean }) => {
      // A link to a module this build does not include is a programming error;
      // say so, and land somewhere real rather than on a blank page.
      if (!registry.get(to.module) && !registry.redirect({ module: to.module, params: {} })) {
        console.warn(`[platform] navigate: no module "${to.module}" is registered`)
      }
      navigate(to, options)
    },
    [registry, navigate],
  )

  const openProject = useCallback((id: string) => goTo({ module: 'project', id }), [goTo])

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      setConfirmRequest({
        title: 'Replace all tracker data?',
        message: `This replaces everything in the tracker with the contents of “${file.name}”. A backup of the current data downloads first.`,
        confirmLabel: 'Replace data',
        onConfirm: () =>
          void actions.importData(file).catch((error: unknown) =>
            window.alert(error instanceof Error ? error.message : 'That file could not be imported.'),
          ),
      })
    },
    [actions],
  )

  const value: PlatformApi = {
    tracker,
    identity,
    identitySource,
    canWrite,
    setName,
    roles,
    isAdmin: admin,
    can,
    canReport,
    features,
    setTestRole,
    location,
    navigate: goTo,
    hrefFor: formatLocation,
    openProject,
    filters,
    setFilters,
    matches,
    filtering: hasFilters(filters),
    people,
    me,
    meClaimed: claimed,
    claimMe: claim,
    contextOf,
    ask: setConfirmRequest,
    theme,
    themePreference: preference,
    setThemePreference: setPreference,
    toggleTheme: toggle,
    openStorage: () => setShowStorage(true),
    openIdentity: () => setShowIdentity(true),
    openChangeLog: (projectId) => setChangeLog({ projectId }),
    startImport: () => importInputRef.current?.click(),
  }

  if (loading || identityResolving) {
    return (
      <div className="boot">
        <Icon.Logo size={40} />
        <span>Loading tracker…</span>
      </div>
    )
  }

  return (
    <RegistryContext.Provider value={registry}>
      <PlatformContext.Provider value={value}>
        {props.children}

        {notice && (
          <div className={`toast ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span>{notice.message}</span>
            <button type="button" className="icon-btn sm" aria-label="Dismiss" onClick={actions.dismissNotice}>
              <Icon.Close size={15} />
            </button>
          </div>
        )}

        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />

        {changeLog && <ChangeLogDrawer projectId={changeLog.projectId} onClose={() => setChangeLog(null)} />}

        {conflict && (
          <ConflictModal
            conflict={conflict}
            onResolve={(choice) => void actions.resolveConflict(choice)}
            onCancel={actions.dismissConflict}
          />
        )}

        {confirmRequest && (
          <ConfirmModal
            title={confirmRequest.title}
            message={confirmRequest.message}
            confirmLabel={confirmRequest.confirmLabel}
            onConfirm={() => {
              confirmRequest.onConfirm()
              setConfirmRequest(null)
            }}
            onCancel={() => setConfirmRequest(null)}
          />
        )}

        {showStorage && <StorageModal status={storageStatus} onClose={() => setShowStorage(false)} />}
        {showIdentity && <IdentityModal name={identity.name} onSave={setName} onClose={() => setShowIdentity(false)} />}
      </PlatformContext.Provider>
    </RegistryContext.Provider>
  )
}
