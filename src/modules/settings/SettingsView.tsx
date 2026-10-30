// ⚙️ Settings: stale threshold, appearance, access, data and (local mode
// only) identity and storage driver. Local and Azure deployments share this
// page; the cards that only make sense locally are hidden under Entra.

import { Fragment, useEffect, useMemo, useState } from 'react'
import { PageHeader, usePlatform, Icon, primaryRole, ROLE_ORDER, ROLES, STALE_PRESETS, applyUpdate, checkForUpdate, promptInstall, usePwa, isStale } from '@sdk'

export const storageLabel = (driver: string, source: 'entra' | 'local'): string => {
  switch (driver) {
    case 'rest':
      return source === 'entra' ? 'Shared service · Azure Cosmos DB' : 'Local server · JSON file store'
    case 'indexeddb':
      return 'This browser · IndexedDB'
    case 'memory':
      return 'Memory only · lost when the tab closes'
    default:
      return driver
  }
}

export function SettingsView() {
  const app = usePlatform()
  const { tracker, canWrite, identity, identitySource, roles, themePreference, setThemePreference, startImport, openStorage, openIdentity, ask, me, openChangeLog } = app
  const role = primaryRole(roles)
  const { settings, actions, state, storageStatus, snapshotInfo } = tracker
  const [custom, setCustom] = useState(String(settings.staleThresholdDays))
  useEffect(() => setCustom(String(settings.staleThresholdDays)), [settings.staleThresholdDays])

  const staleCounts = useMemo(() => {
    const now = Date.now()
    const counts: Record<number, number> = {}
    for (const preset of STALE_PRESETS) counts[preset.value] = state.projects.filter((p) => isStale(p, preset.value, now)).length
    return counts
  }, [state.projects])
  const isPreset = STALE_PRESETS.some((preset) => preset.value === settings.staleThresholdDays)

  return (
    <div className="page">
      <PageHeader eyebrow="Settings" title="Tracker settings" />

      <div className="settings-grid">
        <section className="card pad">
          <h2 className="card-title">Stale threshold</h2>
          <p className="muted">Flag a project as stale when nobody has updated it for this many days.</p>
          <div className="radio-list" role="radiogroup" aria-label="Stale threshold">
            {STALE_PRESETS.map((preset) => (
              <label key={preset.value} className={`radio-row${settings.staleThresholdDays === preset.value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="stale"
                  checked={settings.staleThresholdDays === preset.value}
                  disabled={!canWrite}
                  onChange={() => void actions.setStaleThreshold(preset.value)}
                />
                <span>{preset.label}</span>
                <span className="muted small push-right">{staleCounts[preset.value]} stale</span>
              </label>
            ))}
            <label className={`radio-row${!isPreset ? ' active' : ''}`}>
              <input type="radio" name="stale" checked={!isPreset} disabled={!canWrite} onChange={() => undefined} />
              <span>Custom</span>
              <span className="push-right row-actions">
                <input
                  className="input num-input"
                  type="number"
                  min={1}
                  value={custom}
                  disabled={!canWrite}
                  aria-label="Custom stale threshold in days"
                  onChange={(event) => setCustom(event.target.value)}
                  onBlur={() => Number(custom) !== settings.staleThresholdDays && void actions.setStaleThreshold(Number(custom))}
                  onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                />
                <span className="muted small">days</span>
              </span>
            </label>
          </div>
          {!canWrite && <p className="hint">Only editors can change the shared threshold.</p>}
        </section>

        <div className="stack">
          <section className="card pad">
            <h2 className="card-title">Appearance</h2>
            <p className="muted">Kept in this browser only.</p>
            <div className="theme-picker" role="radiogroup" aria-label="Theme">
              {(['light', 'dark', 'system'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={themePreference === value}
                  className={`theme-option theme-${value}${themePreference === value ? ' active' : ''}`}
                  onClick={() => setThemePreference(value)}
                >
                  <span className="theme-swatch" aria-hidden>
                    <span />
                    <span />
                  </span>
                  {value === 'system' ? 'Match system' : value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <AppCard />

          <section className="card pad">
            <h2 className="card-title">Access</h2>
            <dl className="facts compact">
              {ROLE_ORDER.map((value) => (
                <Fragment key={value}>
                  <dt>{ROLES[value].label}</dt>
                  <dd>
                    {ROLES[value].description} {ROLES[value].appRole} app role.
                  </dd>
                </Fragment>
              ))}
            </dl>
            {identitySource === 'entra' ? (
              <div className="callout accent">
                You are signed in as <strong>{identity.name || 'an unnamed account'}</strong> with <strong>{role ? ROLES[role].label : 'no'}</strong> access.
                {!canWrite && ' Ask an administrator for Tracker.Editor to make changes.'}
              </div>
            ) : (
              <>
                <div className="callout amber">
                  <strong>Local mode.</strong> There is no real sign-in: you are testing as <strong>{role ? ROLES[role].label : 'no role'}</strong>,
                  picked at sign-in. Switch roles from the account menu. Use the Azure deployment for role-controlled access.
                </div>
                <div className="setting-line">
                  <span>
                    Your name on changes: <strong>{identity.name || 'not set'}</strong>
                  </span>
                  <button type="button" className="btn btn-ghost sm" onClick={openIdentity}>
                    {identity.name ? 'Change' : 'Set name'}
                  </button>
                </div>
              </>
            )}
            <div className="setting-line">
              <span>
                My work shows projects owned by: <strong>{me?.name ?? 'nobody matched yet'}</strong>
              </span>
              <button type="button" className="btn btn-ghost sm" onClick={() => app.navigate({ module: 'work' })}>
                Open my work
              </button>
            </div>
          </section>

          <section className="card pad">
            <h2 className="card-title">Data</h2>
            <p className="muted">
              Export the full tracker as a JSON file, or replace it from a backup. A backup downloads automatically before any import.
            </p>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => void actions.exportData()}>
                <Icon.Download size={16} /> Export file
              </button>
              {canWrite && (
                <button type="button" className="btn btn-ghost" onClick={startImport}>
                  <Icon.Upload size={16} /> Import file
                </button>
              )}
              <button type="button" className="btn btn-quiet" onClick={() => openChangeLog()}>
                <Icon.History size={16} /> Change log
              </button>
            </div>
            <div className="setting-line">
              <span className="muted small">
                Storage: <strong>{storageLabel(storageStatus.driver, identitySource)}</strong>
                {storageStatus.multiUser ? ' · shared' : ' · this device only'}
                {storageStatus.realtime ? ' · live updates' : ''}
              </span>
              {identitySource === 'local' && (
                <button type="button" className="btn btn-ghost sm" onClick={openStorage}>
                  Change storage
                </button>
              )}
            </div>
            {identitySource === 'local' && canWrite && (
              <div className="setting-line">
                <span className="muted small">
                  Bundled snapshot: {snapshotInfo.projects} projects, exported {snapshotInfo.exportedAt.slice(0, 10)}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet sm danger"
                  onClick={() =>
                    ask({
                      title: 'Reset to the bundled snapshot?',
                      message: 'This replaces all local tracker data with the migrated snapshot that ships with the app. Export first if you want to keep your changes.',
                      confirmLabel: 'Reset data',
                      onConfirm: () => void actions.resetToSnapshot(),
                    })
                  }
                >
                  Reset
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function AppCard() {
  const pwa = usePwa()
  const [result, setResult] = useState<string | null>(null)

  const status = pwa.standalone
    ? 'Running as an installed app.'
    : pwa.installable
      ? 'This browser can install the tracker as its own app window, with a desktop or Start menu shortcut.'
      : pwa.active
        ? 'To install, use the browser menu: in Edge or Chrome, the install icon in the address bar or ⋯ → Apps → Install. On iPhone or iPad, Share → Add to Home Screen.'
        : 'Install and offline support switch on in the deployed build (not the development server), over HTTPS or localhost.'

  return (
    <section className="card pad">
      <h2 className="card-title">App</h2>
      <div className="app-status">
        <img src="./icons/icon-192.png" alt="" />
        <p className="muted" style={{ margin: 0 }}>
          {status}
        </p>
      </div>
      {pwa.installable && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void promptInstall().then((outcome) => outcome === 'accepted' && setResult('Installed. Find it in your Start menu or app launcher.'))}
          >
            <Icon.Install size={16} /> Install app
          </button>
        </div>
      )}
      {pwa.active && (
        <div className="setting-line">
          <span className="muted small">
            Version <strong>{pwa.version ?? '…'}</strong>
            {pwa.updateReady
              ? ' · a newer version is ready'
              : pwa.lastChecked
                ? ` · checked ${new Date(pwa.lastChecked).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : ''}
          </span>
          {pwa.updateReady ? (
            <button type="button" className="btn btn-primary sm" onClick={applyUpdate}>
              Reload to update
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost sm"
              disabled={pwa.checking}
              onClick={() => void checkForUpdate().then(() => setResult(null))}
            >
              {pwa.checking ? 'Checking…' : 'Check for updates'}
            </button>
          )}
        </div>
      )}
      {result && <p className="hint" style={{ marginTop: 10 }}>{result}</p>}
      {pwa.active && (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          New versions download in the background whenever the tracker is deployed, and are offered here and at the bottom of the screen.
          Tracker data is never cached by the app: it always comes from the live store.
        </p>
      )}
    </section>
  )
}
