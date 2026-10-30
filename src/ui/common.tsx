// 🧱 Shared view primitives: page header, segmented control, status chips,
// stacked bars, stat tiles, the drawer, and the project list every filtered
// view falls back to. Colors come from CSS tokens so both themes just work.

import { useEffect, useRef, type ReactNode } from 'react'
import { primaryRole, ROLES } from '../auth/roles'
import { firstAllowedRoute } from './access'
import { RAG, TREND, VALIDATION } from '../constants'
import { daysSince } from '../lib/id'
import { noFilters, phaseLabel, type ViewFilters } from '../lib/insights'
import { isStale, type RagCounts } from '../lib/rollups'
import type { Project, RagStatus, Trend, Validation } from '../types'
import { useApp } from './context'
import { Icon } from './icons'

export const RAG_KEYS: RagStatus[] = ['green', 'amber', 'red']

export function Dot({ status, size = 8 }: { status: RagStatus | 'none' | 'blue'; size?: number }) {
  return <span className={`dot dot-${status}`} style={{ width: size, height: size }} aria-hidden />
}

export function StatusTag({ status }: { status: RagStatus | null }) {
  if (!status) return <span className="tag tag-neutral">No projects</span>
  return <span className={`tag tag-${status}`}>{RAG[status].label}</span>
}

export function Tag(props: { tone?: 'neutral' | 'blue' | 'amber' | 'red' | 'green' | 'accent' | 'outline'; children: ReactNode; title?: string }) {
  return (
    <span className={`tag tag-${props.tone ?? 'neutral'}`} title={props.title}>
      {props.children}
    </span>
  )
}

export function PageHeader(props: { eyebrow: string; title: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <div className="eyebrow">{props.eyebrow}</div>
        <h1 className="page-title">{props.title}</h1>
        {props.sub && <div className="page-sub">{props.sub}</div>}
      </div>
      {props.actions && <div className="page-actions">{props.actions}</div>}
    </div>
  )
}

export function Segmented<T extends string>(props: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented-wrap">
      {props.label && <span className="segmented-label">{props.label}</span>}
      <div className="segmented" role="tablist" aria-label={props.label}>
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={option.value === props.value}
            className={option.value === props.value ? 'active' : ''}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The pillar / status / stale / decisions chip row. Shared by every filterable view. */
export function FilterChips(props: { count?: number; noun?: string }) {
  const { filters, setFilters, filtering, tracker, people } = useApp()
  const managers = people.filter((person) => person.pm.length > 0).sort((a, b) => a.name.localeCompare(b.name))
  const toggleRag = (key: RagStatus) =>
    setFilters((current: ViewFilters) => ({
      ...current,
      rag: current.rag.includes(key) ? current.rag.filter((value) => value !== key) : [...current.rag, key],
    }))

  return (
    <div className="chip-row" role="group" aria-label="Filters">
      {tracker.state.pillars.length > 1 && (
        <>
          <label className={`chip chip-select${filters.pillar ? ' active' : ''}`}>
            <Icon.Portfolio size={14} />
            <span className="sr-only">Pillar</span>
            <select value={filters.pillar} onChange={(event) => setFilters({ pillar: event.target.value })}>
              <option value="">All pillars</option>
              {tracker.state.pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillarTitle(pillar.title)}
                </option>
              ))}
            </select>
          </label>
          <span className="chip-divider" aria-hidden />
        </>
      )}
      {RAG_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={`chip${filters.rag.includes(key) ? ' active' : ''}`}
          aria-pressed={filters.rag.includes(key)}
          onClick={() => toggleRag(key)}
        >
          <Dot status={key} />
          {RAG[key].label}
        </button>
      ))}
      <button
        type="button"
        className={`chip${filters.stale ? ' active' : ''}`}
        aria-pressed={filters.stale}
        onClick={() => setFilters({ stale: !filters.stale })}
        title={`No update in more than ${tracker.settings.staleThresholdDays} days`}
      >
        <Dot status="amber" />
        Stale ({tracker.settings.staleThresholdDays}d+)
      </button>
      <button
        type="button"
        className={`chip${filters.decisions ? ' active' : ''}`}
        aria-pressed={filters.decisions}
        onClick={() => setFilters({ decisions: !filters.decisions })}
        title="Waiting on a leadership decision"
      >
        <Dot status="blue" />
        Decisions
      </button>
      {managers.length > 0 && (
        <label className={`chip chip-select${filters.pm ? ' active' : ''}`}>
          <Icon.Person size={14} />
          <span className="sr-only">Project manager</span>
          <select value={filters.pm} onChange={(event) => setFilters({ pm: event.target.value })}>
            <option value="">Any PM</option>
            {managers.map((person) => (
              <option key={person.key} value={person.key}>
                PM: {person.name} ({person.pm.length})
              </option>
            ))}
          </select>
        </label>
      )}
      {filters.query.trim() && (
        <span className="chip active query-chip">
          “{filters.query.trim()}”
          <button type="button" aria-label="Clear search" onClick={() => setFilters({ query: '' })}>
            <Icon.Close size={13} />
          </button>
        </span>
      )}
      {filtering && (
        <>
          <button type="button" className="link-btn" onClick={() => setFilters(noFilters)}>
            Clear
          </button>
          {props.count !== undefined && (
            <span className="chip-count">
              {props.count} {props.noun ?? 'matching'}
            </span>
          )}
        </>
      )}
    </div>
  )
}

export function StackedBar({ counts, height = 8, showEmpty = true }: { counts: RagCounts; height?: number; showEmpty?: boolean }) {
  const total = counts.green + counts.amber + counts.red
  if (!total) return showEmpty ? <div className="stacked empty" style={{ height }} /> : null
  return (
    <div
      className="stacked"
      style={{ height }}
      role="img"
      aria-label={`${counts.green} on track, ${counts.amber} at risk, ${counts.red} off track`}
    >
      {RAG_KEYS.map((key) =>
        counts[key] ? <span key={key} className={`seg seg-${key}`} style={{ flexGrow: counts[key] }} /> : null,
      )}
    </div>
  )
}

export function RagCountRow({ counts }: { counts: RagCounts }) {
  return (
    <span className="rag-counts">
      {RAG_KEYS.map((key) => (
        <span key={key} className="rag-count" title={RAG[key].label}>
          <Dot status={key} />
          {counts[key]}
        </span>
      ))}
    </span>
  )
}

export function Progress({ value, status }: { value: number; status?: RagStatus }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={status ? `fill-${status}` : ''} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function StatTile(props: {
  label: string
  value: ReactNode
  sub: ReactNode
  tone?: 'green' | 'red' | 'blue' | 'amber'
  onClick?: () => void
  active?: boolean
}) {
  const Tag = props.onClick ? 'button' : 'div'
  return (
    <Tag
      type={props.onClick ? 'button' : undefined}
      className={`card stat-tile${props.onClick ? ' clickable' : ''}${props.active ? ' active' : ''}`}
      onClick={props.onClick}
    >
      <div className="stat-label">{props.label}</div>
      <div className={`stat-value${props.tone ? ` tone-${props.tone}` : ''}`}>{props.value}</div>
      <div className="stat-sub">{props.sub}</div>
    </Tag>
  )
}

export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </span>
  )
}

export function EmptyState(props: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{props.title}</div>
      {props.children && <div className="empty-body">{props.children}</div>}
    </div>
  )
}

/** Shown in place of a page the current role may not open. */
export function NoAccess() {
  const { navigate, can, roles, setTestRole } = useApp()
  const role = primaryRole(roles)
  return (
    <div className="page">
      <EmptyState title="This page isn’t available to your role">
        <p>
          {role ? `Your ${ROLES[role].label.toLowerCase()} role` : 'Your account'} doesn’t include this view. Ask a tracker
          admin to grant it in the admin console{setTestRole ? ', or sign in as a different role to test it' : ''}.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate(firstAllowedRoute(can), { replace: true })}>
          Go to a page you can open
        </button>
      </EmptyState>
    </div>
  )
}

export function Drawer(props: { onClose: () => void; label: string; header?: ReactNode; actions?: ReactNode; footer?: ReactNode; children: ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onClose = props.onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className="drawer-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`drawer${props.wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        tabIndex={-1}
      >
        <div className="drawer-top">
          <div className="drawer-header">{props.header}</div>
          <div className="drawer-top-actions">
            {props.actions}
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon.Close />
            </button>
          </div>
        </div>
        <div className="drawer-body">{props.children}</div>
        {props.footer && <div className="drawer-foot">{props.footer}</div>}
      </div>
    </div>
  )
}

export function ageLabel(iso: string): string {
  const age = daysSince(iso)
  if (age === null) return '—'
  if (age <= 0) return 'today'
  return `${age}d ago`
}

/** Owner summary for one line: delivery owner first, then business. */
export function ownerLine(project: Project): string {
  const parts = [project.executionOwner, project.businessOwner].map((value) => value.trim()).filter(Boolean)
  return parts[0] ?? 'Owners not set'
}

/** Table-style list of projects. Used for filtered results and lists in reports. */
export function ProjectList(props: { projects: Project[]; showPath?: boolean; empty?: string }) {
  const { openProject, contextOf, tracker } = useApp()
  const staleDays = tracker.settings.staleThresholdDays
  const now = Date.now()

  if (props.projects.length === 0) {
    return <div className="list-empty">{props.empty ?? 'No projects match.'}</div>
  }

  return (
    <ul className="plist">
      {props.projects.map((project) => {
        const context = contextOf(project)
        const stale = isStale(project, staleDays, now)
        return (
          <li key={project.id}>
            <button type="button" className="plist-row" onClick={() => openProject(project.id)}>
              <Dot status={project.rag} size={9} />
              <span className="plist-main">
                <span className="plist-title">{project.title}</span>
                {props.showPath !== false && (
                  <span className="plist-path">
                    {[context.pillar ? pillarTitle(context.pillar.title) : '', context.initiative?.title ?? '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </span>
              <span className="plist-owner">{ownerLine(project)}</span>
              <span className="plist-phase">{phaseLabel(project.phase)}</span>
              <span className="plist-progress">
                <Progress value={project.progress} />
                <span>{project.progress}%</span>
              </span>
              <span className={`plist-age${stale ? ' stale' : ''}`}>{ageLabel(project.updatedAt)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Human text for a logged value: "amber" → "At risk", "uat" → "UAT", "45" → "45%". */
export function formatLogValue(fieldKey: string, value: string): string {
  if (!value) return value
  switch (fieldKey) {
    case 'rag':
      return RAG[value as RagStatus]?.label ?? value
    case 'phase':
      return phaseLabel(value as Project['phase'])
    case 'validation':
      return VALIDATION[value as Exclude<Validation, ''>]?.label ?? value
    case 'trending':
      return TREND[value as Trend]?.label ?? value
    case 'progress':
      return `${value}%`
    default:
      return value
  }
}

export const pillarTitle = (title: string): string => title.replace(/^\s*pillar\s*\d+\s*[:.\-–—]\s*/i, '')
