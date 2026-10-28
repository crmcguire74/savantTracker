// 🔥 PM heat map: every project as a tile in its project manager's row,
// heated by how urgently it needs a person to look at it. Rows with the most
// critical work rise to the top, so the question "whose projects need help
// right now?" is answered before anything is read. Each tile says why it is
// hot; hover for the full list, click to open the project.

import { useMemo, useState } from 'react'
import { attentionFor, ATTENTION_LABEL, CRITICAL_SCORE, WATCH_SCORE, type Attention, type AttentionLevel } from '../../lib/pace'
import type { Project } from '../../types'
import { Avatar, Dot, EmptyState, StatTile } from '../common'
import { useApp } from '../context'

const LEVELS: AttentionLevel[] = ['critical', 'watch', 'healthy']

interface Tile {
  project: Project
  attention: Attention
}

interface Row {
  key: string
  name: string
  initials: string
  tiles: Tile[]
  counts: Record<AttentionLevel, number>
  score: number
}

const UNASSIGNED = '__none__'

export function PmHeatmap() {
  const { tracker, people, openProject, navigate } = useApp()
  const { state, settings } = tracker
  const [shown, setShown] = useState<Record<AttentionLevel, boolean>>({ critical: true, watch: true, healthy: true })

  const rows = useMemo<Row[]>(() => {
    const now = Date.now()
    const tileOf = new Map(state.projects.map((project) => [project.id, { project, attention: attentionFor(project, settings.staleThresholdDays, now) }]))
    const assigned = new Set<string>()
    const build = (key: string, name: string, initials: string, ids: string[]): Row => {
      const tiles = ids
        .map((id) => tileOf.get(id))
        .filter((tile): tile is Tile => Boolean(tile))
        .sort((a, b) => b.attention.score - a.attention.score || a.project.title.localeCompare(b.project.title))
      const counts = { critical: 0, watch: 0, healthy: 0 }
      for (const tile of tiles) counts[tile.attention.level] += 1
      return { key, name, initials, tiles, counts, score: tiles.reduce((sum, tile) => sum + tile.attention.score, 0) }
    }
    const result = people
      .filter((person) => person.pm.length > 0)
      .map((person) => {
        person.pm.forEach((id) => assigned.add(id))
        return build(person.key, person.name, person.initials, person.pm)
      })
    const orphans = state.projects.filter((project) => !assigned.has(project.id)).map((project) => project.id)
    if (orphans.length) result.push(build(UNASSIGNED, 'No PM assigned', '?', orphans))
    // Unassigned work is a staffing question, not a PM's row; it goes last.
    return result.sort((a, b) => Number(a.key === UNASSIGNED) - Number(b.key === UNASSIGNED) || b.counts.critical - a.counts.critical || b.score - a.score || a.name.localeCompare(b.name))
  }, [state.projects, people, settings.staleThresholdDays])

  const totals = useMemo(() => {
    const counts = { critical: 0, watch: 0, healthy: 0 }
    const seen = new Set<string>()
    for (const row of rows) {
      for (const tile of row.tiles) {
        // A project with two PMs is one project, not two.
        if (seen.has(tile.project.id)) continue
        seen.add(tile.project.id)
        counts[tile.attention.level] += 1
      }
    }
    return counts
  }, [rows])
  const unassigned = rows.find((row) => row.key === UNASSIGNED)?.tiles.length ?? 0
  const pmsWithCritical = rows.filter((row) => row.key !== UNASSIGNED && row.counts.critical > 0).length

  if (state.projects.length === 0) return <EmptyState title="No projects yet">The heat map fills in as projects are added.</EmptyState>

  const toggle = (level: AttentionLevel) => setShown((current) => ({ ...current, [level]: !current[level] }))

  return (
    <div className="pm-heat">
      <div className="tiles four">
        <StatTile label="Critical" tone="red" value={totals.critical} sub={ATTENTION_LABEL.critical} active={shown.critical && !shown.watch && !shown.healthy} onClick={() => setShown({ critical: true, watch: false, healthy: false })} />
        <StatTile label="Watch" tone="amber" value={totals.watch} sub="one or two warning signs" active={!shown.critical && shown.watch && !shown.healthy} onClick={() => setShown({ critical: false, watch: true, healthy: false })} />
        <StatTile label="Low" tone="green" value={totals.healthy} sub={`under ${WATCH_SCORE} points`} active={!shown.critical && !shown.watch && shown.healthy} onClick={() => setShown({ critical: false, watch: false, healthy: true })} />
        <StatTile label="PMs with critical work" value={pmsWithCritical} sub={`of ${rows.filter((row) => row.key !== UNASSIGNED).length} PMs${unassigned ? ` · ${unassigned} projects have no PM` : ''}`} />
      </div>

      <div className="pm-heat-controls" role="group" aria-label="Show projects">
        {LEVELS.map((level) => (
          <button key={level} type="button" className={`chip${shown[level] ? ' active' : ''}`} aria-pressed={shown[level]} onClick={() => toggle(level)}>
            <span className={`heat-swatch heat-${level}`} aria-hidden />
            {level === 'critical' ? 'Critical' : level === 'watch' ? 'Watch' : 'Low'}
          </button>
        ))}
        <span className="muted small">
          Heat adds up: off track {CRITICAL_SCORE}, at risk {WATCH_SCORE}, no recent update or an overdue milestone 15, slipping, trending down or a
          waiting decision 10, each high-severity issue 10. {CRITICAL_SCORE}+ is critical, {WATCH_SCORE}+ is watch.
        </span>
      </div>

      <div className="card pm-heat-grid">
        {rows.map((row) => {
          const visible = row.tiles.filter((tile) => shown[tile.attention.level])
          return (
            <div key={row.key} className={`pm-heat-row${row.key === UNASSIGNED ? ' unassigned' : ''}`}>
              <div className="pm-heat-person">
                {row.key === UNASSIGNED ? (
                  <span className="pm-heat-name">{row.name}</span>
                ) : (
                  <button type="button" className="pm-heat-name-btn" onClick={() => navigate({ view: 'work', person: row.key })} title={`Open ${row.name}’s work`}>
                    <Avatar initials={row.initials} size={30} />
                    <span className="pm-heat-name">{row.name}</span>
                  </button>
                )}
                <span className="pm-heat-counts">
                  {LEVELS.map((level) =>
                    row.counts[level] ? (
                      <span key={level} className={`pm-heat-count ${level}`}>
                        {row.counts[level]} {level === 'healthy' ? 'low' : level}
                      </span>
                    ) : null,
                  )}
                </span>
              </div>
              <div className="pm-heat-tiles">
                {visible.map(({ project, attention }) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`pm-tile heat-${attention.level}`}
                    onClick={() => openProject(project.id)}
                    title={`${project.title}\n${ATTENTION_LABEL[attention.level]}${attention.reasons.length ? `:\n• ${attention.reasons.join('\n• ')}` : ''}`}
                  >
                    <span className="pm-tile-title">
                      <Dot status={project.rag} size={8} /> {project.title}
                    </span>
                    <span className="pm-tile-why">{attention.reasons[0] ?? 'Nothing flagged'}</span>
                    {attention.reasons.length > 1 && <span className="pm-tile-more">+{attention.reasons.length - 1} more</span>}
                  </button>
                ))}
                {visible.length === 0 && <span className="muted small pm-heat-empty">None at the selected levels.</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
