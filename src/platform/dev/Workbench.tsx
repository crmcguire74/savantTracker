// 🧰 The module workbench: one module at a time inside the real platform
// (same provider, same sandbox, same SDK) without the production shell. Pick
// the module, the role and the theme from the bar; contained faults are
// listed under it as they happen, so a crash is visible, not just survived.

import { StrictMode, useEffect, useMemo, useState } from 'react'
import { ROLE_ORDER, ROLES, primaryRole } from '../../auth/roles'
import { usePlatform, useRegistry } from '../context'
import { onModuleFault, recentModuleFaults, type ModuleFault } from '../diagnostics'
import { CurrentModule } from '../ModuleHost'
import type { ModuleManifest } from '../module'
import { PlatformProvider } from '../PlatformProvider'
import { createRegistry } from '../registry'

export function Workbench(props: { modules: readonly ModuleManifest[]; isolated: boolean }) {
  // Strict here: a broken manifest should stop the workbench, loudly.
  const registry = useMemo(() => createRegistry(props.modules, { strict: true }), [props.modules])
  return (
    <StrictMode>
      <PlatformProvider registry={registry}>
        <div className="workbench">
          <WorkbenchBar isolated={props.isolated} />
          <Faults />
          <main className="workbench-main content" id="main-content">
            <CurrentModule />
          </main>
        </div>
      </PlatformProvider>
    </StrictMode>
  )
}

function WorkbenchBar(props: { isolated: boolean }) {
  const { location, navigate, roles, setTestRole, themePreference, setThemePreference, tracker } = usePlatform()
  const registry = useRegistry()
  const role = primaryRole(roles)

  return (
    <div className="workbench-bar">
      <span className="workbench-title">Module workbench</span>
      <label className="field">
        Module
        <select className="select" value={location.module} onChange={(event) => navigate({ module: event.target.value })}>
          {registry.modules.map((manifest) => (
            <option key={manifest.id} value={manifest.id}>
              {manifest.title} ({manifest.id}){manifest.navOrder === undefined ? ' · link only' : ''}
            </option>
          ))}
        </select>
      </label>
      {setTestRole && (
        <label className="field">
          Role
          <select className="select" value={role ?? ''} onChange={(event) => setTestRole(event.target.value as (typeof ROLE_ORDER)[number])}>
            {ROLE_ORDER.map((value) => (
              <option key={value} value={value}>
                {ROLES[value].label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        Theme
        <select className="select" value={themePreference} onChange={(event) => setThemePreference(event.target.value as typeof themePreference)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>
      <span className="muted small">
        {props.isolated ? 'Isolated: only this module is registered' : `${registry.modules.length} modules registered`} · storage:{' '}
        {tracker.storageStatus.driver} · <code>{window.location.hash || '#/'}</code>
      </span>
    </div>
  )
}

function Faults() {
  const [faults, setFaults] = useState<readonly ModuleFault[]>(recentModuleFaults)
  useEffect(() => onModuleFault(() => setFaults(recentModuleFaults())), [])
  if (!faults.length) return null
  return (
    <div className="workbench-faults" role="status">
      <strong>Contained faults this session</strong>
      <ul>
        {faults.map((fault, index) => (
          <li key={index}>
            <code>{fault.moduleId}</code> · {fault.phase} · {fault.error instanceof Error ? fault.error.message : String(fault.error)}
          </li>
        ))}
      </ul>
    </div>
  )
}
