// 🧭 The frame around every view: top bar (status counts, omnibox search,
// theme toggle, account menu) and the left navigation rail.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RAG } from '../constants'
import { applyUpdate, promptInstall, usePwa } from '../hooks/usePwa'
import type { View } from '../hooks/useRoute'
import { projectMatchesQuery } from '../lib/insights'
import { countByRag } from '../lib/rollups'
import { initialsOf } from '../lib/people'
import { Avatar, Dot, pillarTitle, RAG_KEYS } from './common'
import { useApp } from './context'
import { Icon } from './icons'
import { forgetUnlock, lockApp } from './LoginGate'

const NAV: Array<{ view: View; label: string; icon: (p: { size?: number }) => JSX.Element }> = [
  { view: 'portfolio', label: 'Portfolio', icon: Icon.Portfolio },
  { view: 'board', label: 'Board', icon: Icon.Board },
  { view: 'timeline', label: 'Timeline', icon: Icon.Timeline },
  { view: 'work', label: 'My work', icon: Icon.Person },
  { view: 'workload', label: 'Workload', icon: Icon.People },
  { view: 'reports', label: 'Reports', icon: Icon.Reports },
  { view: 'settings', label: 'Settings', icon: Icon.Settings },
]

export function NavRail() {
  const { route, navigate, me } = useApp()
  // A project page belongs to the portfolio; someone else's work belongs to Workload.
  const active: View =
    route.view === 'project' ? 'portfolio' : route.view === 'work' && route.person && route.person !== me?.key ? 'workload' : route.view

  return (
    <nav className="rail" aria-label="Main">
      {NAV.map((item) => {
        const ItemIcon = item.icon
        const isActive = item.view === active
        return (
          <button
            key={item.view}
            type="button"
            className={`rail-item${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              switch (item.view) {
                case 'portfolio':
                  return navigate({ view: 'portfolio', layout: 'ledger' })
                case 'board':
                  return navigate({ view: 'board', layout: 'phase' })
                default:
                  return navigate({ view: item.view } as Parameters<typeof navigate>[0])
              }
            }}
          >
            <span className="rail-icon">
              <ItemIcon size={22} />
            </span>
            <span className="rail-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function TopBar() {
  const { tracker, navigate, setFilters, route, identitySource, canWrite, theme, toggleTheme } = useApp()
  const counts = useMemo(() => countByRag(tracker.state.projects), [tracker.state.projects])

  const showStatus = (key: (typeof RAG_KEYS)[number]) => {
    setFilters({ rag: [key] })
    if (route.view !== 'portfolio' && route.view !== 'board' && route.view !== 'timeline') {
      navigate({ view: 'portfolio', layout: 'ledger' })
    }
  }

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => navigate({ view: 'portfolio', layout: 'ledger' })}>
        <span className="brand-mark">
          <Icon.Logo size={28} />
        </span>
        <span className="brand-text">
          <span className="brand-title">WiseTrack</span>
          <span className="brand-sub">Strategic Initiatives</span>
        </span>
      </button>

      {identitySource === 'local' && (
        <span className="env-badge" title="Local mode: no sign-in, data stays on this machine or local server">
          Local · {driverShort(tracker.storageStatus.driver)}
        </span>
      )}
      {!canWrite && <span className="env-badge viewer">View only</span>}

      <div className="topbar-spacer" />

      <div className="topbar-counts" aria-label="Portfolio status">
        {RAG_KEYS.map((key) => (
          <button key={key} type="button" className="topbar-count" onClick={() => showStatus(key)} title={`Show ${RAG[key].label.toLowerCase()} projects`}>
            <Dot status={key} />
            <strong>{counts[key]}</strong>
            <span>{RAG[key].label}</span>
          </button>
        ))}
      </div>

      <Omnibox />

      <button
        type="button"
        className="icon-btn theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
      </button>

      <AccountMenu />
    </header>
  )
}

export const driverShort = (driver: string): string =>
  driver === 'indexeddb' ? 'Browser' : driver === 'rest' ? 'Server' : driver === 'memory' ? 'Memory' : driver

type Result =
  | { kind: 'project'; id: string; title: string; sub: string; status: 'green' | 'amber' | 'red' }
  | { kind: 'initiative'; id: string; pillarId: string; title: string; sub: string }
  | { kind: 'person'; key: string; title: string; sub: string; initials: string }
  | { kind: 'filter'; title: string }

function Omnibox() {
  const { tracker, people, navigate, openProject, setFilters, route } = useApp()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [])

  const results = useMemo<Result[]>(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const { state } = tracker
    const initiatives = new Map(state.initiatives.map((initiative) => [initiative.id, initiative]))
    const projects = state.projects
      .filter((project) => projectMatchesQuery(project, needle, undefined))
      .slice(0, 6)
      .map<Result>((project) => ({
        kind: 'project',
        id: project.id,
        title: project.title,
        sub: initiatives.get(project.initiativeId)?.title ?? '',
        status: project.rag,
      }))
    const pillars = new Map(state.pillars.map((pillar) => [pillar.id, pillar]))
    const inits = state.initiatives
      .filter((initiative) => initiative.title.toLowerCase().includes(needle))
      .slice(0, 3)
      .map<Result>((initiative) => ({
        kind: 'initiative',
        id: initiative.id,
        pillarId: initiative.pillarId,
        title: initiative.title,
        sub: pillarTitle(pillars.get(initiative.pillarId)?.title ?? ''),
      }))
    const folks = people
      .filter((person) => person.name.toLowerCase().includes(needle))
      .slice(0, 3)
      .map<Result>((person) => ({
        kind: 'person',
        key: person.key,
        title: person.name,
        sub: `${person.projectIds.length} project${person.projectIds.length === 1 ? '' : 's'}`,
        initials: person.initials,
      }))
    return [...projects, ...inits, ...folks, { kind: 'filter', title: query.trim() }]
  }, [query, tracker, people])

  useEffect(() => setCursor(0), [query])

  const choose = (result: Result) => {
    setOpen(false)
    switch (result.kind) {
      case 'project':
        openProject(result.id)
        break
      case 'initiative':
        navigate({ view: 'portfolio', layout: 'ledger', pillar: result.pillarId, initiative: result.id })
        break
      case 'person':
        navigate({ view: 'work', person: result.key })
        break
      case 'filter':
        setFilters({ query: result.title })
        if (route.view !== 'portfolio' && route.view !== 'board' && route.view !== 'timeline') {
          navigate({ view: 'portfolio', layout: 'ledger' })
        }
        break
    }
    setQuery('')
    inputRef.current?.blur()
  }

  const groups: Array<{ label: string; kind: Result['kind'] }> = [
    { label: 'Projects', kind: 'project' },
    { label: 'Initiatives', kind: 'initiative' },
    { label: 'People', kind: 'person' },
  ]

  return (
    <div className="omnibox" ref={wrapRef}>
      <Icon.Search size={16} className="omnibox-icon" />
      <input
        ref={inputRef}
        className="omnibox-input"
        value={query}
        placeholder="Search projects, owners, scope"
        aria-label="Search projects, owners, scope"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="omnibox-results"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor((current) => Math.min(results.length - 1, current + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor((current) => Math.max(0, current - 1))
          } else if (event.key === 'Enter' && results[cursor]) {
            event.preventDefault()
            choose(results[cursor])
          } else if (event.key === 'Escape') {
            setQuery('')
            setOpen(false)
            event.currentTarget.blur()
          }
        }}
      />
      {!query && <kbd className="omnibox-kbd">/</kbd>}
      {open && results.length > 0 && (
        <div className="omnibox-results" id="omnibox-results" role="listbox">
          {groups.map((group) => {
            const items = results.filter((result) => result.kind === group.kind)
            if (!items.length) return null
            return (
              <div key={group.kind} className="omnibox-group">
                <div className="omnibox-group-label">{group.label}</div>
                {items.map((result) => {
                  const index = results.indexOf(result)
                  return (
                    <OmniItem key={index} active={index === cursor} onHover={() => setCursor(index)} onChoose={() => choose(result)}>
                      {result.kind === 'project' && <Dot status={result.status} size={9} />}
                      {result.kind === 'person' && <Avatar initials={result.initials} size={22} />}
                      {result.kind === 'initiative' && <Icon.Portfolio size={15} />}
                      <span className="omni-text">
                        <span className="omni-title">{result.title}</span>
                        {'sub' in result && result.sub && <span className="omni-sub">{result.sub}</span>}
                      </span>
                    </OmniItem>
                  )
                })}
              </div>
            )
          })}
          {(() => {
            const index = results.length - 1
            return (
              <OmniItem active={index === cursor} onHover={() => setCursor(index)} onChoose={() => choose(results[index])} footer>
                <Icon.Search size={15} />
                <span className="omni-text">
                  <span className="omni-title">Filter all views by “{query.trim()}”</span>
                </span>
                <kbd>↵</kbd>
              </OmniItem>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function OmniItem(props: { active: boolean; onHover: () => void; onChoose: () => void; children: ReactNode; footer?: boolean }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={props.active}
      className={`omni-item${props.active ? ' active' : ''}${props.footer ? ' footer' : ''}`}
      onMouseEnter={props.onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={props.onChoose}
    >
      {props.children}
    </button>
  )
}

function AccountMenu() {
  const { identity, identitySource, canWrite, navigate, me, openIdentity, openStorage, openChangeLog, themePreference, setThemePreference, tracker } = useApp()
  const pwa = usePwa()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = identity.name ? initialsOf(identity.name) : '?'
  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${identity.name || 'name not set'}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Avatar initials={initials} size={36} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="menu-name">{identity.name || 'Name not set'}</div>
            <div className="menu-meta">
              {canWrite ? 'Editor' : 'Viewer'} · {identitySource === 'entra' ? 'Signed in with Microsoft' : 'Local mode'}
            </div>
            {me && <div className="menu-meta">Tracked as {me.name}</div>}
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={act(() => navigate({ view: 'work' }))}>
            <Icon.Person size={16} /> My work
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={act(() => openChangeLog())}>
            <Icon.History size={16} /> Change log
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={act(() => void tracker.actions.exportData())}>
            <Icon.Download size={16} /> Export backup
          </button>
          {identitySource === 'local' && (
            <>
              <button type="button" role="menuitem" className="menu-item" onClick={act(openIdentity)}>
                <Icon.Edit size={16} /> {identity.name ? 'Change your name' : 'Set your name'}
              </button>
              <button type="button" role="menuitem" className="menu-item" onClick={act(openStorage)}>
                <Icon.Database size={16} /> Storage · {driverShort(tracker.storageStatus.driver)}
              </button>
            </>
          )}
          {pwa.installable && (
            <button type="button" role="menuitem" className="menu-item" onClick={act(() => void promptInstall())}>
              <Icon.Install size={16} /> Install app
            </button>
          )}
          {pwa.updateReady && (
            <button type="button" role="menuitem" className="menu-item" onClick={act(applyUpdate)}>
              <Icon.Download size={16} /> Reload to update
            </button>
          )}
          <div className="menu-sep" />
          <div className="menu-label">Theme</div>
          <div className="menu-theme">
            {(['light', 'dark', 'system'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={themePreference === value}
                className={themePreference === value ? 'active' : ''}
                onClick={() => setThemePreference(value)}
              >
                {value === 'light' ? <Icon.Sun size={15} /> : value === 'dark' ? <Icon.Moon size={15} /> : null}
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" onClick={act(() => navigate({ view: 'settings' }))}>
            <Icon.Settings size={16} /> Settings
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={act(lockApp)}>
            <Icon.Lock size={16} /> Log out
          </button>
          {identitySource === 'entra' && (
            <a role="menuitem" className="menu-item" href="/.auth/logout" onClick={forgetUnlock}>
              <Icon.Logout size={16} /> Sign out of Microsoft
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/** Offers the waiting version. "Later" hides it until the next new version arrives. */
export function UpdatePrompt() {
  const pwa = usePwa()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  if (!pwa.updateReady || dismissedFor === (pwa.version ?? 'pending')) return null
  return (
    <div className="update-prompt" role="status">
      <Icon.Download size={18} />
      <span>
        <strong>A new version is available.</strong> Reload to update; anything you have saved is kept.
      </span>
      <button type="button" className="btn btn-primary sm" onClick={applyUpdate}>
        Reload
      </button>
      <button type="button" className="btn btn-quiet sm" onClick={() => setDismissedFor(pwa.version ?? 'pending')}>
        Later
      </button>
    </div>
  )
}
