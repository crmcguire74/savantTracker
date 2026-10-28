import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canRunReport, canUseFeature, type FeatureKey } from './auth/access'
import { isAdmin } from './auth/roles'
import type { ReportId } from './reports/catalog'
import { featureForRoute } from './ui/access'
import { NoAccess } from './ui/common'
import { AdminView } from './ui/views/AdminView'
import { ReportPreview } from './ui/views/ReportPreview'
import { useIdentity } from './hooks/useIdentity'
import { useMe } from './hooks/useMe'
import { useRoute } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import { useTracker } from './hooks/useTracker'
import { contextIndex, hasFilters, makeProjectFilter, noFilters, type ViewFilters } from './lib/insights'
import { buildPeople } from './lib/people'
import { ChangeLogDrawer } from './ui/ChangeLog'
import { AppContext, type AppContextValue, type ConfirmRequest } from './ui/context'
import { Icon } from './ui/icons'
import { ConfirmModal, ConflictModal, IdentityModal, StorageModal } from './ui/modals'
import { NavRail, TopBar, UpdatePrompt } from './ui/shell'
import { BoardView } from './ui/views/BoardView'
import { PortfolioView } from './ui/views/PortfolioView'
import { ProjectView } from './ui/views/ProjectView'
import { ReportsView } from './ui/views/ReportsView'
import { SettingsView } from './ui/views/SettingsView'
import { TimelineView } from './ui/views/TimelineView'
import { WorkloadView } from './ui/views/WorkloadView'
import { WorkView } from './ui/views/WorkView'

export default function App() {
  const { identity, roles, canWrite, source: identitySource, resolving: identityResolving, setName, setTestRole } = useIdentity()
  const admin = isAdmin(roles)
  const tracker = useTracker(identity, canWrite, admin)
  const { state, settings, loading, notice, conflict, storageStatus, actions } = tracker
  const { route, navigate } = useRoute()
  const { theme, preference, setPreference, toggle } = useTheme()

  const [filters, setFilterState] = useState<ViewFilters>(noFilters)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [showStorage, setShowStorage] = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)
  const [changeLog, setChangeLog] = useState<{ projectId?: string } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)

  const people = useMemo(() => buildPeople(state), [state])
  const { me, claimed, claim } = useMe(identity, people)
  const matches = useMemo(
    () => makeProjectFilter(state, filters, settings.staleThresholdDays, people),
    [state, filters, settings.staleThresholdDays, people],
  )
  const contextOf = useMemo(() => contextIndex(state), [state])

  // A new page starts at the top; a layout or selection change keeps scroll.
  const pageKey = route.view === 'project' ? `project:${route.id}` : route.view
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [pageKey])

  // Local mode with no name yet: ask once, so the change log has an author.
  useEffect(() => {
    if (!loading && !identityResolving && identitySource === 'local' && !identity.name) setShowIdentity(true)
  }, [loading, identityResolving, identitySource, identity.name])

  const setFilters = useCallback<AppContextValue['setFilters']>((patch) => {
    setFilterState((current) => (typeof patch === 'function' ? patch(current) : { ...current, ...patch }))
  }, [])

  const openProject = useCallback((id: string) => navigate({ view: 'project', id }), [navigate])

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

  const can = useCallback((feature: FeatureKey) => canUseFeature(tracker.access, roles, feature), [tracker.access, roles])
  const canReport = useCallback((id: ReportId) => canRunReport(tracker.access, roles, id), [tracker.access, roles])

  const value: AppContextValue = {
    tracker,
    identity,
    identitySource,
    canWrite,
    setName,
    roles,
    isAdmin: admin,
    can,
    canReport,
    setTestRole,
    route,
    navigate,
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
    <AppContext.Provider value={value}>
      <div className="app">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <TopBar />
        <div className="frame">
          <NavRail />
          <main className="content" id="main-content" ref={contentRef} tabIndex={-1}>
            {!canWrite && (
              <div className="banner info">
                You have view-only access. Ask an administrator for the Tracker.Editor role if you need to update projects.
              </div>
            )}
            {renderView()}
          </main>
        </div>

        {notice && (
          <div className={`toast ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span>{notice.message}</span>
            <button type="button" className="icon-btn sm" aria-label="Dismiss" onClick={actions.dismissNotice}>
              <Icon.Close size={15} />
            </button>
          </div>
        )}

        <UpdatePrompt />

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
      </div>
    </AppContext.Provider>
  )

  function renderView() {
    const feature = featureForRoute(route)
    if ((feature && !can(feature)) || (route.view === 'admin' && !admin)) return <NoAccess />

    switch (route.view) {
      case 'portfolio':
        return <PortfolioView layout={route.layout} pillar={route.pillar} initiative={route.initiative} />
      case 'board':
        return <BoardView layout={route.layout} />
      case 'timeline':
        return <TimelineView />
      case 'work':
        return <WorkView person={route.person} />
      case 'workload':
        return <WorkloadView layout={route.layout} />
      case 'reports':
        return route.report ? <ReportPreview report={route.report} pillar={route.pillar} /> : <ReportsView />
      case 'settings':
        return <SettingsView />
      case 'admin':
        return <AdminView />
      case 'project':
        return <ProjectView id={route.id} />
    }
  }
}
