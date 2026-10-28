// ⏱️ Pillar pace: is each pillar as far along as its schedule says it should
// be by today? One row per pillar, rolled up from its projects. The bar is
// work done, the needle is where the plan says it should be, and every
// project sits as a tick on the same scale so a single laggard is visible
// inside an otherwise healthy average. Expand a pillar to see the same
// reading per initiative. Filters apply, so "Pillar pace for Nicole's
// projects" is one chip away.

import { useMemo, useState } from 'react'
import { daysSince } from '../../lib/id'
import { pillarLabel } from '../../lib/insights'
import { groupPace, PACE_TOLERANCE, type GroupPace } from '../../lib/pace'
import { projectsForInitiative, projectsForPillar } from '../../lib/rollups'
import type { Pillar } from '../../types'
import { EmptyState } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'
import { PaceLegend, PaceTag, PaceTrack } from '../pace'

export function PillarPace() {
  const { tracker, matches, filtering } = useApp()
  const { state, settings } = tracker
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => {
    const now = Date.now()
    return state.pillars.map((pillar, index) => ({
      pillar,
      index,
      pace: groupPace(projectsForPillar(state, pillar.id).filter(matches), settings.staleThresholdDays, now),
    }))
  }, [state, matches, settings.staleThresholdDays])

  if (state.pillars.length === 0) return <EmptyState title="No pillars yet">Pillar pace appears once pillars have projects.</EmptyState>

  const flagged = rows.filter((row) => row.pace.pace === 'behind' || row.pace.pace === 'stale')
  const named = (pace: 'behind' | 'stale') => {
    const names = rows.filter((row) => row.pace.pace === pace).map((row) => pillarLabel(row.pillar, row.index).eyebrow)
    if (names.length === 0) return null
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    const verb = names.length === 1 ? 'is' : 'are'
    return (
      <>
        <strong>{list}</strong> {verb} {pace === 'behind' ? 'behind schedule' : 'stale, with most projects not updated recently'}
      </>
    )
  }
  const behind = named('behind')
  const stale = named('stale')

  return (
    <div className="pace-view">
      <div className="card pad pace-summary">
        <p className="pace-headline">
          {flagged.length === 0 ? (
            <>No pillar is behind schedule or stale.</>
          ) : (
            <>
              {behind}
              {behind && stale && '; '}
              {stale}.
            </>
          )}
        </p>
        <p className="muted small">
          Expected progress is the share of each project’s planned window (start to original end) that has passed. Within{' '}
          {PACE_TOLERANCE} points counts as on pace; a pillar reads stale when half its projects have had no update in{' '}
          {settings.staleThresholdDays}+ days.{filtering && ' Only projects matching the filters are counted.'}
        </p>
        <PaceLegend />
      </div>

      <div className="card pace-rows">
        {rows.map((row) => (
          <PaceRow
            key={row.pillar.id}
            pillar={row.pillar}
            index={row.index}
            pace={row.pace}
            open={Boolean(open[row.pillar.id])}
            onToggle={() => setOpen((current) => ({ ...current, [row.pillar.id]: !current[row.pillar.id] }))}
          />
        ))}
      </div>
    </div>
  )
}

function PaceRow(props: { pillar: Pillar; index: number; pace: GroupPace; open: boolean; onToggle: () => void }) {
  const { tracker, matches, filtering, openProject, navigate } = useApp()
  const { state, settings } = tracker
  const label = pillarLabel(props.pillar, props.index)
  const initiatives = state.initiatives.filter((initiative) => initiative.pillarId === props.pillar.id)
  const panelId = `pace-${props.pillar.id}`

  return (
    <section className={`pace-row${props.open ? ' open' : ''}`} aria-label={label.title}>
      <div className="pace-row-main">
        <button type="button" className="pace-row-label" aria-expanded={props.open} aria-controls={panelId} onClick={props.onToggle}>
          <Icon.Chevron size={16} className="pace-chevron" />
          <span>
            <span className="pillar-eyebrow">{label.eyebrow}</span>
            <span className="pace-row-title">{label.title}</span>
          </span>
        </button>
        <div className="pace-row-track">
          <PaceTrack
            progress={props.pace.progress}
            expected={props.pace.expected}
            pace={props.pace.pace}
            label={label.title}
            onTick={openProject}
          >
            {props.pace.projects}
          </PaceTrack>
        </div>
        <PaceStats pace={props.pace} />
      </div>

      {props.open && (
        <div className="pace-children" id={panelId}>
          {initiatives.map((initiative) => {
            const pace = groupPace(projectsForInitiative(state, initiative.id).filter(matches), settings.staleThresholdDays)
            return (
              <div key={initiative.id} className="pace-row-main child">
                <button
                  type="button"
                  className="pace-row-label"
                  onClick={() => navigate({ view: 'portfolio', layout: 'ledger', pillar: props.pillar.id, initiative: initiative.id })}
                  title="Open in the ledger"
                >
                  <span className="pace-row-title">{initiative.title}</span>
                </button>
                <div className="pace-row-track">
                  {pace.projects.length ? (
                    <PaceTrack progress={pace.progress} expected={pace.expected} pace={pace.pace} label={initiative.title} onTick={openProject} compact>
                      {pace.projects}
                    </PaceTrack>
                  ) : (
                    <span className="muted small">{filtering ? 'No projects match the filters' : 'No projects yet'}</span>
                  )}
                </div>
                <PaceStats pace={pace} compact />
              </div>
            )
          })}
          {initiatives.length === 0 && <div className="list-empty">No initiatives in this pillar.</div>}
        </div>
      )}
    </section>
  )
}

function PaceStats({ pace, compact }: { pace: GroupPace; compact?: boolean }) {
  const age = pace.lastUpdate ? daysSince(pace.lastUpdate) : null
  const total = pace.projects.length
  return (
    <div className={`pace-stats${compact ? ' compact' : ''}`}>
      <PaceTag pace={pace.pace} />
      <span className="pace-numbers">
        <strong>{pace.progress}%</strong> done
        {pace.expected !== null && (
          <>
            {' '}
            of <strong>{pace.expected}%</strong> expected
            {pace.delta !== null && pace.delta !== 0 && (
              <span className={pace.delta < 0 ? 'tone-red' : 'tone-blue'}>
                {' '}
                ({pace.delta > 0 ? '+' : '−'}
                {Math.abs(pace.delta)} pts)
              </span>
            )}
          </>
        )}
      </span>
      {!compact && (
        <span className="muted small">
          {pace.staleCount} of {total} stale{age !== null ? ` · last update ${age <= 0 ? 'today' : `${age}d ago`}` : ''}
        </span>
      )}
    </div>
  )
}
