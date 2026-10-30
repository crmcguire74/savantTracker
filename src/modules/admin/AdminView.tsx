// 🧰 Admin: the PMO's upkeep page. What has gone quiet (filterable by how
// long and by PM), the running list of decisions waiting on leadership, the
// latest edits, and the monday.com sync once it is connected. Replaces the
// old Reports page; spreadsheets now download from Export in the account
// menu and the one-pager opens from the leadership brief.

import { useMemo, useState } from 'react'
import { ageLabel, Dot, PageHeader, pillarTitle, StatTile, Tag, usePlatform, Icon, daysSince, byStatusThenTitle, isStale, needsDecision, type Project } from '@sdk'

/** Age floors offered as stale filters, beyond the stale threshold itself. */
const AGE_STEPS = [30, 60, 90]
/** Days at which the age meter on a stale row reads full. */
const METER_FULL_DAYS = 120
const NO_PM = '__none'

/**
 * monday.com is not connected yet (action plan, phase 4). When the sync job
 * lands, this becomes its last-run record; the panel already reads from it.
 */
const MONDAY_SYNC: { connected: boolean; lastPullAt: string } = { connected: false, lastPullAt: '' }

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function AdminView() {
  const { tracker } = usePlatform()
  const { state, settings } = tracker
  const threshold = settings.staleThresholdDays
  const stale = useMemo(() => state.projects.filter((project) => isStale(project, threshold)), [state.projects, threshold])
  const decisions = useMemo(() => state.projects.filter(needsDecision), [state.projects])

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Portfolio upkeep"
        sub="What needs chasing: projects that have gone quiet, decisions waiting on leadership, and the latest edits."
      />

      <div className="admin-top">
        <StatTile
          label="Decisions waiting"
          tone="blue"
          value={decisions.length}
          sub="need an outcome"
          onClick={() => scrollTo('admin-decisions')}
        />
        <StatTile
          label="Stale"
          tone="amber"
          value={stale.length}
          sub={`no update in ${threshold}+ days`}
          onClick={() => scrollTo('admin-stale')}
        />
        <MondaySync />
      </div>

      <div className="admin-grid">
        <StaleProjects projects={stale} threshold={threshold} />
        <div className="stack">
          <DecisionList projects={decisions} />
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}

// ── stale projects ────────────────────────────────────────────────────────

function StaleProjects(props: { projects: Project[]; threshold: number }) {
  const { people, openProject, contextOf } = usePlatform()
  const steps = useMemo(() => [props.threshold, ...AGE_STEPS.filter((days) => days > props.threshold)], [props.threshold])
  const [minDays, setMinDays] = useState(props.threshold)
  const [pm, setPm] = useState('')
  const floor = steps.includes(minDays) ? minDays : props.threshold

  const ageOf = (project: Project) => daysSince(project.updatedAt) ?? 0
  const managed = useMemo(() => new Map(people.map((person) => [person.key, new Set(person.pm)])), [people])
  const anyPm = useMemo(() => new Set(people.flatMap((person) => person.pm)), [people])
  const byPm = (project: Project) =>
    !pm || (pm === NO_PM ? !anyPm.has(project.id) : (managed.get(pm)?.has(project.id) ?? false))

  // Counts on each control reflect the other filter, so the numbers always add up.
  const pmMatches = props.projects.filter(byPm)
  const ageCounts = steps.map((days) => pmMatches.filter((project) => isStale(project, days)).length)
  const aged = props.projects.filter((project) => isStale(project, floor))
  const managers = people
    .map((person) => ({ person, count: aged.filter((project) => person.pm.includes(project.id)).length }))
    .filter((row) => row.person.pm.length > 0)
    .sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name))
  const unmanaged = aged.filter((project) => !anyPm.has(project.id)).length

  const rows = aged.filter(byPm).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const filtered = floor !== props.threshold || pm !== ''

  return (
    <section className="card admin-stale" id="admin-stale" aria-labelledby="admin-stale-title">
      <div className="card-title-row">
        <h2 className="card-title" id="admin-stale-title">
          Stale projects
        </h2>
        <span className="muted small">Longest without an update first</span>
      </div>

      <div className="admin-filters">
        <div className="age-steps" role="radiogroup" aria-label="Stale for at least">
          <span className="admin-filter-label">Stale for</span>
          {steps.map((days, index) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={floor === days}
              className={`age-step${floor === days ? ' active' : ''}`}
              onClick={() => setMinDays(days)}
            >
              {days}+ days
              <span className="age-step-count">{ageCounts[index]}</span>
            </button>
          ))}
        </div>
        <label className={`chip chip-select${pm ? ' active' : ''}`}>
          <Icon.Person size={14} />
          <span className="sr-only">Project manager</span>
          <select value={pm} onChange={(event) => setPm(event.target.value)}>
            <option value="">Any PM</option>
            {managers.map(({ person, count }) => (
              <option key={person.key} value={person.key}>
                {person.name} ({count})
              </option>
            ))}
            <option value={NO_PM}>No PM set ({unmanaged})</option>
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMinDays(props.threshold)
              setPm('')
            }}
          >
            Clear
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="list-empty">
          {props.projects.length === 0 ? 'Every project has been updated recently.' : 'No stale projects match these filters.'}
        </div>
      ) : (
        <ul className="stale-list">
          {rows.map((project) => {
            const context = contextOf(project)
            const age = ageOf(project)
            return (
              <li key={project.id}>
                <button type="button" className="stale-row" onClick={() => openProject(project.id)}>
                  <Dot status={project.rag} size={9} />
                  <span className="stale-main">
                    <span className="plist-title">{project.title}</span>
                    <span className="plist-path">
                      {[context.pillar ? pillarTitle(context.pillar.title) : '', context.initiative?.title ?? ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`stale-pm${project.projectManager.trim() ? '' : ' unset'}`}>
                    {project.projectManager.trim() || 'No PM set'}
                  </span>
                  <span className="stale-age" title={`Last updated ${new Date(project.updatedAt).toLocaleDateString()}`}>
                    <span className="stale-age-value">{age} days</span>
                    <span className="age-meter" aria-hidden>
                      <span style={{ width: `${Math.min(100, (age / METER_FULL_DAYS) * 100)}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="card-foot muted small">
          Showing {rows.length} of {props.projects.length} stale project{props.projects.length === 1 ? '' : 's'}. The stale threshold is set in
          Settings.
        </div>
      )}
    </section>
  )
}

// ── decisions ─────────────────────────────────────────────────────────────

function DecisionList(props: { projects: Project[] }) {
  const { tracker, openProject, contextOf } = usePlatform()

  // When each decision was asked for: the latest edit that set the request.
  const askedAt = useMemo(() => {
    const ids = new Set(props.projects.map((project) => project.id))
    const asked = new Map<string, string>()
    for (const entry of tracker.log) {
      if (entry.fieldKey === 'decisionNeeded' && entry.newValue.trim() && ids.has(entry.projectId) && !asked.has(entry.projectId)) {
        asked.set(entry.projectId, entry.timestamp)
      }
    }
    return asked
  }, [tracker.log, props.projects])

  // Longest waiting first; requests the log no longer covers go last, worst status first.
  const rows = props.projects.slice().sort((a, b) => {
    const left = askedAt.get(a.id)
    const right = askedAt.get(b.id)
    if (left && right) return left.localeCompare(right)
    if (left) return -1
    if (right) return 1
    return byStatusThenTitle(a, b)
  })

  return (
    <section className="card" id="admin-decisions" aria-labelledby="admin-decisions-title">
      <div className="card-title-row">
        <h2 className="card-title" id="admin-decisions-title">
          Decisions needed
        </h2>
        <span className="muted small">{rows.length === 0 ? 'None waiting' : `${rows.length} waiting, longest first`}</span>
      </div>
      {rows.length === 0 ? (
        <div className="list-empty">No decisions are waiting on leadership.</div>
      ) : (
        <ul className="simple-list">
          {rows.map((project) => {
            const context = contextOf(project)
            const asked = askedAt.get(project.id)
            return (
              <li key={project.id}>
                <button type="button" className="simple-row decision-row" onClick={() => openProject(project.id)}>
                  <span className="simple-title">
                    <Dot status={project.rag} /> {project.title}
                  </span>
                  <span className="decision-ask">{project.decisionNeeded}</span>
                  <span className="simple-sub">
                    {[context.initiative?.title, asked ? `asked ${ageLabel(asked)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── activity ──────────────────────────────────────────────────────────────

function RecentActivity() {
  const { tracker, openProject, openChangeLog } = usePlatform()
  const { state, log } = tracker
  const recent = log.slice(0, 10)

  return (
    <section className="card" aria-labelledby="admin-activity-title">
      <div className="card-title-row">
        <h2 className="card-title" id="admin-activity-title">
          Recent activity
        </h2>
        <button type="button" className="link-btn" onClick={() => openChangeLog()}>
          Full change log
        </button>
      </div>
      {recent.length === 0 ? (
        <div className="list-empty">No edits logged yet.</div>
      ) : (
        <ul className="simple-list">
          {recent.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="simple-row"
                disabled={!state.projects.some((project) => project.id === entry.projectId)}
                onClick={() => openProject(entry.projectId)}
              >
                <span className="simple-title">{entry.projectTitle}</span>
                <span className="simple-sub">
                  {entry.field} · {entry.editedByName || 'Unknown'} · {ageLabel(entry.timestamp)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── monday.com ────────────────────────────────────────────────────────────

function MondaySync() {
  const { connected, lastPullAt } = MONDAY_SYNC
  const last = lastPullAt ? new Date(lastPullAt) : null

  return (
    <section className="card sync-card" aria-labelledby="sync-title">
      <div className="sync-head">
        <span className={`sync-light${connected ? ' on' : ''}`} aria-hidden />
        <h2 className="stat-label" id="sync-title">
          monday.com sync
        </h2>
        <Tag tone={connected ? 'green' : 'outline'}>{connected ? 'Connected' : 'Not connected'}</Tag>
      </div>
      <div className="sync-body">
        <div>
          <div className="sync-last">{last ? ageLabel(lastPullAt) : 'No pulls yet'}</div>
          <div className="stat-sub">
            {last
              ? `Last pull ${last.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
              : 'Pulls start once WiseTrack is linked to the PMO’s monday boards.'}
          </div>
        </div>
        <button type="button" className="btn btn-ghost sm" disabled={!connected} title={connected ? undefined : 'Available once monday.com is connected'}>
          <Icon.Sync size={15} /> Pull from monday
        </button>
      </div>
    </section>
  )
}
