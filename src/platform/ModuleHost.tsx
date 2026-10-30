// 🛡️ The module sandbox. Every module renders inside one ModuleHost, which
// gives it four walls:
//
// 1. Access: a module the viewer may not open is never even downloaded.
// 2. Loading: the bundle loads on first visit behind a local spinner, and a
//    stale chunk after a deploy triggers one guarded reload (lazyModule.ts).
// 3. Faults: an error thrown while rendering is caught at this boundary,
//    reported with the module's id, and replaced by a recoverable panel. The
//    rail, top bar and every other module keep working.
// 4. Recovery: "Try again" re-imports and remounts the module from scratch;
//    navigating anywhere else clears the fault automatically.
//
// What a boundary cannot catch (React's own limits): errors in event
// handlers, timers and promises. Those do not unmount anything, so the page
// stays up; tracker actions report their own failures as toasts.

import { Component, Suspense, useState, type ErrorInfo, type ReactNode } from 'react'
import { primaryRole, ROLES } from '../auth/roles'
import { EmptyState } from '../ui/common'
import { usePlatform, useRegistry } from './context'
import { reportModuleFault } from './diagnostics'
import { forgetModule, lazyModule, ModuleLoadError } from './lazyModule'
import { formatLocation } from './location'
import type { Location, ModuleManifest } from './module'
import { canOpen, homeModule } from './registry'

/** The module for the current location, sandboxed; nothing when none is open to the viewer. */
export function CurrentModule() {
  const { location } = usePlatform()
  const manifest = useRegistry().get(location.module)
  if (!manifest) return <NoModules />
  // Keyed by module so leaving one discards its state, including a fault.
  return <ModuleHost key={manifest.id} manifest={manifest} location={location} />
}

function NoModules() {
  return (
    <div className="page">
      <EmptyState title="Nothing to show">No module in this build is open to your role.</EmptyState>
    </div>
  )
}

export function ModuleHost(props: { manifest: ModuleManifest; location: Location }) {
  const { manifest, location } = props
  const platform = usePlatform()
  // Bumped by "Try again" so the module remounts with fresh state.
  const [attempt, setAttempt] = useState(0)

  if (!canOpen(manifest, location, platform)) return <NoAccess />

  const Entry = lazyModule(manifest)
  return (
    <section className="module-host" data-module={manifest.id}>
      <ModuleBoundary
        manifest={manifest}
        resetKey={formatLocation(location)}
        onRetry={() => {
          forgetModule(manifest.id)
          setAttempt((current) => current + 1)
        }}
      >
        <Suspense fallback={<ModuleLoading title={manifest.title} />}>
          <Entry key={attempt} location={location} />
        </Suspense>
      </ModuleBoundary>
    </section>
  )
}

interface BoundaryProps {
  manifest: ModuleManifest
  /** When this changes while a fault is showing, the fault clears. */
  resetKey: string
  onRetry: () => void
  children: ReactNode
}

export class ModuleBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportModuleFault({
      moduleId: this.props.manifest.id,
      phase: error instanceof ModuleLoadError ? 'load' : 'render',
      error,
      componentStack: info.componentStack ?? undefined,
    })
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <ModuleFault
        title={this.props.manifest.title}
        error={error}
        onRetry={() => {
          this.props.onRetry()
          this.setState({ error: null })
        }}
      />
    )
  }
}

function ModuleFault(props: { title: string; error: Error; onRetry: () => void }) {
  const loadFailed = props.error instanceof ModuleLoadError
  return (
    <div className="page module-fault" role="alert">
      <EmptyState title={loadFailed ? `${props.title} couldn’t load` : `${props.title} hit a problem`}>
        <p>
          {loadFailed
            ? 'Its code could not be downloaded. Check the connection, then try again; reloading picks up the latest version.'
            : 'This page stopped working. The rest of the tracker is unaffected, and nothing you saved is lost.'}
        </p>
        <p className="module-fault-detail">{props.error.message}</p>
        <div className="module-fault-actions">
          <button type="button" className="btn btn-primary" onClick={props.onRetry}>
            Try again
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            Reload the app
          </button>
        </div>
      </EmptyState>
    </div>
  )
}

function ModuleLoading(props: { title: string }) {
  return (
    <div className="module-loading" role="status">
      <span className="module-spinner" aria-hidden />
      Loading {props.title}…
    </div>
  )
}

/** Shown in place of a module the current role may not open. */
export function NoAccess() {
  const platform = usePlatform()
  const registry = useRegistry()
  const { navigate, roles, setTestRole } = platform
  const role = primaryRole(roles)
  const home = homeModule(registry, platform)
  return (
    <div className="page">
      <EmptyState title="This page isn’t available to your role">
        <p>
          {role ? `Your ${ROLES[role].label.toLowerCase()} role` : 'Your account'} doesn’t include this view. Ask a tracker
          admin to grant it in the admin console{setTestRole ? ', or sign in as a different role to test it' : ''}.
        </p>
        {home && (
          <button type="button" className="btn btn-primary" onClick={() => navigate({ module: home.id }, { replace: true })}>
            Go to a page you can open
          </button>
        )}
      </EmptyState>
    </div>
  )
}
