// 📈 Reports: the printable portfolio status. Headline numbers, status by
// pillar, the decision backlog, phase mix, stale projects and recent
// activity. Every row opens the project it is about.

import { useMemo } from 'react'
import { PHASE } from '../../constants'
import { byStatusThenTitle, pillarLabel, portfolioStats, summarizePillar } from '../../lib/insights'
import { isStale, needsDecision } from '../../lib/rollups'
import type { Phase } from '../../types'
import { ageLabel, Dot, PageHeader, ProjectList, RAG_KEYS, StackedBar, StatTile } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'

export function ReportsView() {
  const { tracker, openProject, navigate, setFilters, openChangeLog } = useApp()
  const { state, settings, log } = tracker
  const stats = portfolioStats(state, state.projects, settings.staleThresholdDays)
  const decisions = useMemo(() => state.projects.filter(needsDecision).sort(byStatusThenTitle), [state.projects])
  const stale = useMemo(
    () =>
      state.projects
        .filter((project) => isStale(project, settings.staleThresholdDays))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    [state.projects, settings.staleThresholdDays],
  )
  const phases = useMemo(() => {
    const keys: Phase[] = ['', ...(Object.keys(PHASE) as Exclude<Phase, ''>[])]
    return keys.map((phase) => ({ phase, count: state.projects.filter((project) => project.phase === phase).length }))
  }, [state.projects])
  const maxPhase = Math.max(1, ...phases.map((row) => row.count))
  const recent = log.slice(0, 8)

  const drill = (patch: Parameters<typeof setFilters>[0]) => {
    setFilters(() => ({ query: '', rag: [], stale: false, decisions: false }))
    setFilters(patch)
    navigate({ view: 'portfolio', layout: 'ledger' })
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Reports"
        title="Portfolio status"
        sub={`As of ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`}
        actions={
          <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>
            <Icon.Print size={16} /> Print
          </button>
        }
      />

      <div className="tiles">
        <StatTile label="Projects" value={stats.projects} sub={`${stats.initiatives} initiatives`} />
        <StatTile label="On track" tone="green" value={`${stats.onTrackPct}%`} sub={`${stats.counts.green} of ${stats.projects}`} onClick={() => drill({ rag: ['green'] })} />
        <StatTile label="Off track" tone="red" value={stats.counts.red} sub={`${stats.counts.amber} more at risk`} onClick={() => drill({ rag: ['red'] })} />
        <StatTile label="Decisions waiting" tone="blue" value={stats.decisions} sub="need an outcome" onClick={() => drill({ decisions: true })} />
        <StatTile label="Stale" tone="amber" value={stats.stale} sub={`no update in ${settings.staleThresholdDays}+ days`} onClick={() => drill({ stale: true })} />
      </div>

      <div className="report-grid">
        <div className="stack">
          <section className="card pad">
            <h2 className="card-title">Status by pillar</h2>
            <div className="bars">
              {state.pillars.map((pillar, index) => {
                const summary = summarizePillar(state, pillar, index, settings.staleThresholdDays)
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    className="bar-row"
                    onClick={() => navigate({ view: 'portfolio', layout: 'ledger', pillar: pillar.id })}
                  >
                    <span className="bar-label">{pillarLabel(pillar, index).title}</span>
                    <StackedBar counts={summary.counts} height={18} />
                    <span className="bar-value">{summary.projects.length}</span>
                  </button>
                )
              })}
            </div>
            <div className="legend">
              {RAG_KEYS.map((key) => (
                <span key={key}>
                  <Dot status={key} /> {key === 'green' ? 'On track' : key === 'amber' ? 'At risk' : 'Off track'}
                </span>
              ))}
            </div>
          </section>

          <section className="card pad">
            <h2 className="card-title">Projects by phase</h2>
            <div className="bars">
              {phases.map((row) => (
                <div key={row.phase || 'none'} className="bar-row static">
                  <span className="bar-label">{row.phase ? PHASE[row.phase].label : 'No phase'}</span>
                  <span className="phase-track">
                    <span style={{ width: `${(row.count / maxPhase) * 100}%` }} />
                  </span>
                  <span className="bar-value">{row.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Stale projects</h2>
              <span className="muted small">No update in {settings.staleThresholdDays}+ days, oldest first</span>
            </div>
            <ProjectList projects={stale.slice(0, 12)} empty="Every project has been updated recently." />
            {stale.length > 12 && (
              <div className="card-foot">
                <button type="button" className="link-btn" onClick={() => drill({ stale: true })}>
                  See all {stale.length} stale projects
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Decision backlog</h2>
              <span className="muted small">{decisions.length} waiting</span>
            </div>
            {decisions.length === 0 ? (
              <div className="list-empty">No decisions are waiting.</div>
            ) : (
              <ul className="simple-list">
                {decisions.map((project) => (
                  <li key={project.id}>
                    <button type="button" className="simple-row" onClick={() => openProject(project.id)}>
                      <span className="simple-title">
                        <Dot status={project.rag} /> {project.title}
                      </span>
                      <span className="simple-sub">{project.decisionNeeded}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Recent activity</h2>
              <button type="button" className="link-btn no-print" onClick={() => openChangeLog()}>
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
        </div>
      </div>
    </div>
  )
}
