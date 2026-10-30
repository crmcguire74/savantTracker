// ⏱️ Pillar pace: is each pillar as far along as its schedule says it should
// be by today? One visual grammar at every level: a row per pillar,
// initiative or project, where the hollow ring is where the schedule says
// the work should be today, the solid dot is where it is, and the bar
// between them is the gap. Every row shares one 0–100% axis, so the eye can
// run straight down the page from pillar to initiative to project.
//
// Schedule and freshness are read separately: a stale pillar still shows
// whether it leans behind or ahead, with its age called out beside it.
// Filters apply, so "pillar pace for Nicole's projects" is one chip away.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState, Segmented, usePlatform, Icon, formatDelta, SCHEDULE_LABEL, ScheduleGlyph, daysSince, pillarLabel, groupPace, PACE_TOLERANCE, projectsForInitiative, projectsForPillar, type GroupPace, type SchedulePace } from '@sdk'
import { PaceMap, type MapPillar } from './PaceMap'

const AXIS = [0, 25, 50, 75, 100]
/** Values closer than this many points share one label, so the two never collide. */
const LABEL_GAP = 9

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)
const ago = (iso: string) => {
  const days = daysSince(iso)
  return days === null ? 'never updated' : days <= 0 ? 'updated today' : `updated ${days}d ago`
}
const asOf = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function PillarPace() {
  const { tracker, matches, filtering, openProject } = usePlatform()
  const { state, settings } = tracker
  const [picked, setPicked] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [mode, setMode] = useState<'ranked' | 'map'>('ranked')

  const { pillars, portfolio } = useMemo(() => {
    const now = Date.now()
    const pillars: MapPillar[] = state.pillars.map((pillar, index) => {
      const label = pillarLabel(pillar, index)
      return {
        id: pillar.id,
        number: label.eyebrow.replace(/\D/g, '') || String(index + 1),
        title: label.title,
        pace: groupPace(projectsForPillar(state, pillar.id).filter(matches), settings.staleThresholdDays, now),
      }
    })
    return { pillars, portfolio: groupPace(state.projects.filter(matches), settings.staleThresholdDays, now) }
  }, [state, matches, settings.staleThresholdDays])

  const ranked = useMemo(
    () => pillars.filter((pillar) => pillar.pace.projects.length > 0).sort((a, b) => (a.pace.delta ?? Infinity) - (b.pace.delta ?? Infinity)),
    [pillars],
  )

  if (state.pillars.length === 0) return <EmptyState title="No pillars yet">Pillar pace appears once pillars have projects.</EmptyState>
  if (ranked.length === 0)
    return (
      <EmptyState title={filtering ? 'No projects match these filters' : 'No projects yet'}>
        {filtering ? 'Clear a filter to see pillar pace.' : 'Pillar pace appears once pillars have projects.'}
      </EmptyState>
    )

  const focus = ranked.find((pillar) => pillar.id === picked) ?? ranked[0]

  return (
    <div className="pace-view">
      <section className="card pace-hero" aria-label="Pillar pace">
        <header className="pace-hero-head">
          <div className="pace-hero-copy">
            <span className="pace-eyebrow">Pillar pace · {asOf.format(new Date())}</span>
            <Headline pillars={ranked} portfolio={portfolio} staleDays={settings.staleThresholdDays} filtering={filtering} />
          </div>
          <Segmented
            value={mode}
            options={[
              { value: 'ranked', label: 'Ranked' },
              { value: 'map', label: 'Map' },
            ]}
            onChange={setMode}
          />
        </header>

        {mode === 'ranked' ? (
          <div className="pace-chart">
            <ChartKey />
            <AxisRow label="Pillar" />
            {ranked.map((pillar, index) => (
              <PaceRow
                key={pillar.id}
                size="lg"
                index={index}
                badge={pillar.number}
                title={pillar.title}
                meta={<GroupMeta pace={pillar.pace} staleDays={settings.staleThresholdDays} />}
                pace={{ ...pillar.pace, progress: pillar.pace.scheduledProgress ?? pillar.pace.progress }}
                selected={pillar.id === focus.id}
                onClick={() => setPicked(pillar.id)}
              />
            ))}
          </div>
        ) : (
          <div className="pace-map-wrap">
            <PaceMap pillars={ranked} focus={focus.id} hovered={hovered} onHover={setHovered} onSelect={setPicked} onProject={openProject} />
          </div>
        )}

        <footer className="pace-hero-foot">
          <Coverage portfolio={portfolio} />
          <details className="pace-method">
            <summary>How pace is measured</summary>
            <p>
              <strong>Expected</strong> is the share of each project’s planned window (start to original end date) that has passed by
              today. A pillar’s expected and done figures are averages over its <em>dated</em> projects, so the two compare like with
              like. The <strong>gap</strong> is done minus expected, in percentage points: within ±{PACE_TOLERANCE} counts as on pace,
              and a forecast that has slipped more than two weeks counts as behind whatever the numbers say.
            </p>
            <p>
              <strong>Stale</strong> is read separately: a project is stale after {settings.staleThresholdDays} days without an update,
              and a pillar when half or more of its projects are. Its position is still shown, but treat it as provisional.
            </p>
          </details>
        </footer>
      </section>

      <FocusPanel pillar={focus} />
    </div>
  )
}

function Headline({ pillars, portfolio, staleDays, filtering }: { pillars: MapPillar[]; portfolio: GroupPace; staleDays: number; filtering: boolean }) {
  const name = (pillar: MapPillar) => `Pillar ${pillar.number}`
  const behind = pillars.filter((pillar) => pillar.pace.schedule === 'behind')
  const ahead = pillars.filter((pillar) => pillar.pace.schedule === 'ahead')
  const total = portfolio.projects.length
  const verb = (count: number) => (count === 1 ? 'is' : 'are')

  const lead =
    behind.length === pillars.length
      ? 'Every pillar is behind plan.'
      : behind.length
        ? `${list(behind.map(name))} ${verb(behind.length)} behind plan${ahead.length ? `; ${list(ahead.map(name))} ${verb(ahead.length)} ahead` : ''}.`
        : ahead.length
          ? `Nothing is behind plan, and ${list(ahead.map(name))} ${verb(ahead.length)} ahead.`
          : 'Every pillar is on pace.'

  const parts: ReactNode[] = []
  if (portfolio.delta !== null)
    parts.push(
      portfolio.delta === 0 ? (
        'Dated work is exactly where its schedules say it should be today.'
      ) : (
        <span key="gap">
          Dated work is <strong>{Math.abs(portfolio.delta)} points {portfolio.delta < 0 ? 'short of' : 'ahead of'}</strong> where its
          schedules say it should be today.
        </span>
      ),
    )
  if (total && portfolio.staleCount / total >= 0.25)
    parts.push(
      portfolio.staleCount === total
        ? ` No project has been updated in ${staleDays}+ days, so read this as provisional.`
        : ` ${portfolio.staleCount} of ${total} projects have gone ${staleDays}+ days without an update.`,
    )
  if (filtering) parts.push(' Only projects matching the filters are counted.')

  return (
    <>
      <h2 className="pace-headline">{lead}</h2>
      <p className="pace-dek">{parts}</p>
    </>
  )
}

function ChartKey() {
  return (
    <div className="pace-key" aria-label="How to read the chart">
      <span>
        <span className="key-expected" /> Expected by today
      </span>
      <span>
        <span className="key-done" /> Done
      </span>
      <span>
        <span className="key-bar behind" /> Behind
      </span>
      <span>
        <span className="key-bar within" /> On pace
      </span>
      <span>
        <span className="key-bar ahead" /> Ahead
      </span>
    </div>
  )
}

function AxisRow({ label }: { label: string }) {
  return (
    <div className="pace-grid pace-axis" aria-hidden>
      <span className="pace-axis-label">{label}</span>
      <span className="pace-axis-scale">
        {AXIS.map((value) => (
          <span key={value} style={{ left: `${value}%` }}>
            {value}%
          </span>
        ))}
      </span>
      <span className="pace-axis-label end">Gap</span>
    </div>
  )
}

function GroupMeta({ pace, staleDays }: { pace: GroupPace; staleDays: number }) {
  const total = pace.projects.length
  const age = pace.lastUpdate ? daysSince(pace.lastUpdate) : null
  return (
    <>
      <span>
        {pace.scheduledCount} of {total} dated
      </span>
      {pace.pace === 'stale' ? (
        <span className="meta-stale">
          <span className="stale-ring" aria-hidden /> Stale{age !== null && age >= staleDays ? ` · ${age}d` : ''}
        </span>
      ) : (
        pace.staleCount > 0 && <span>{pace.staleCount} stale</span>
      )}
    </>
  )
}

/**
 * One row of the chart: label, the ring-and-dot track, and the gap. Used for
 * pillars (lg), initiatives (md) and projects (sm) so they line up on one axis.
 */
function PaceRow(props: {
  size: 'lg' | 'md' | 'sm'
  index: number
  badge?: string
  title: string
  meta: ReactNode
  pace: { progress: number; expected: number | null; delta: number | null; schedule: SchedulePace }
  selected?: boolean
  expanded?: boolean
  onClick?: () => void
}) {
  const { pace } = props
  const done = Math.max(0, Math.min(100, pace.progress))
  const expected = pace.expected === null ? null : Math.max(0, Math.min(100, pace.expected))
  const direction = pace.delta === null ? 'none' : Math.abs(pace.delta) <= PACE_TOLERANCE ? 'within' : pace.delta < 0 ? 'behind' : 'ahead'
  const from = expected === null ? done : Math.min(done, expected)
  const to = expected === null ? done : Math.max(done, expected)
  const together = expected !== null && Math.abs(done - expected) < LABEL_GAP
  const summary =
    expected === null
      ? `${props.title}: ${done}% done; no dated projects to compare against`
      : `${props.title}: ${done}% done against ${expected}% expected by today, ${formatDelta(pace.delta)} points, ${SCHEDULE_LABEL[pace.schedule].toLowerCase()}`
  const style = { '--i': props.index, '--from': `${expected ?? done}%` } as CSSProperties

  const body = (
    <>
      <span className="pace-row-label">
        {props.badge && <span className="pace-num">{props.badge}</span>}
        {props.expanded !== undefined && <Icon.Chevron size={14} className="pace-chevron" />}
        <span className="pace-row-text">
          <span className="pace-row-title">{props.title}</span>
          <span className="pace-row-meta">{props.meta}</span>
        </span>
      </span>
      <span className="pace-row-track" role="img" aria-label={summary}>
        <span className="pace-gridlines" aria-hidden>
          {AXIS.map((value) => (
            <span key={value} style={{ left: `${value}%` }} />
          ))}
        </span>
        {expected !== null && to > from && (
          <span className={`pace-bar ${direction}${done < expected ? ' back' : ''}`} style={{ left: `${from}%`, width: `${to - from}%` }} />
        )}
        {expected !== null && <span className="pace-expected" style={{ left: `${expected}%` }} />}
        <span className={`pace-done ${direction}`} style={{ left: `${done}%` }} />
        <span className={`pace-val done${expected !== null && done < expected ? ' left' : ''}`} style={{ left: `${done}%` }}>
          {done}%
        </span>
        {expected !== null && !together && (
          <span className={`pace-val expected${done < expected ? '' : ' left'}`} style={{ left: `${expected}%` }}>
            {expected}%
          </span>
        )}
      </span>
      <span className={`pace-gap-cell ${direction}`}>
        {pace.delta === null ? (
          <span className="pace-gap-none">No dates</span>
        ) : (
          <>
            <span className="pace-gap-num">
              <ScheduleGlyph schedule={pace.schedule} size={props.size === 'sm' ? 8 : 10} />
              {formatDelta(pace.delta)}
            </span>
            {props.size !== 'sm' && <span className="pace-gap-unit">{direction === 'within' ? 'pts · on pace' : `pts ${direction}`}</span>}
          </>
        )}
      </span>
    </>
  )

  const className = `pace-grid pace-row ${props.size}${props.selected ? ' selected' : ''}${props.expanded ? ' expanded' : ''}`
  return props.onClick ? (
    <button type="button" className={className} style={style} onClick={props.onClick} aria-pressed={props.selected} aria-expanded={props.expanded}>
      {body}
    </button>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  )
}

/** How much of the portfolio can be measured at all: pace needs a start and an end date. */
function Coverage({ portfolio }: { portfolio: GroupPace }) {
  const { navigate } = usePlatform()
  const total = portfolio.projects.length
  const dated = portfolio.scheduledCount
  const missing = total - dated
  return (
    <div className="pace-coverage">
      <span className="pace-coverage-meter" role="img" aria-label={`${dated} of ${total} projects have a start and end date`}>
        {portfolio.projects
          .slice()
          .sort((a, b) => Number(b.expected !== null) - Number(a.expected !== null))
          .map((entry) => (
            <span key={entry.project.id} className={entry.expected === null ? '' : 'on'} />
          ))}
      </span>
      <span className="pace-coverage-text">
        Measured on <strong>{dated}</strong> of {total} projects.
        {missing > 0 && (
          <>
            {' '}
            {missing} {missing === 1 ? 'has' : 'have'} no start or original end date.{' '}
            <button type="button" className="link-btn" onClick={() => navigate({ module: 'portfolio' })}>
              Add dates in the ledger
            </button>
          </>
        )}
      </span>
    </div>
  )
}

function FocusPanel({ pillar }: { pillar: MapPillar }) {
  const { tracker, matches, filtering, openProject } = usePlatform()
  const { state, settings } = tracker
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const { pace } = pillar

  const initiatives = useMemo(() => {
    const now = Date.now()
    return state.initiatives
      .filter((initiative) => initiative.pillarId === pillar.id)
      .map((initiative) => ({ initiative, pace: groupPace(projectsForInitiative(state, initiative.id).filter(matches), settings.staleThresholdDays, now) }))
      .filter((row) => !filtering || row.pace.projects.length > 0)
      .sort((a, b) => (a.pace.delta ?? Infinity) - (b.pace.delta ?? Infinity))
  }, [state, pillar.id, matches, filtering, settings.staleThresholdDays])

  const gaps = pace.projects
    .filter((entry) => entry.schedule === 'behind')
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0) || (b.slip ?? 0) - (a.slip ?? 0))
    .slice(0, 4)

  return (
    <section className="card pace-focus" aria-label={`Pillar ${pillar.number} detail`}>
      <header className="pace-focus-head">
        <span className="pace-num lg">{pillar.number}</span>
        <div className="pace-focus-title">
          <span className="pace-eyebrow">Pillar {pillar.number} in detail</span>
          <h3>{pillar.title}</h3>
        </div>
        <dl className="pace-focus-stats">
          <div>
            <dt>Overall done</dt>
            <dd>{pace.progress}%</dd>
          </div>
          <div>
            <dt>Dated work</dt>
            <dd>
              {pace.expected === null ? '—' : `${pace.scheduledProgress}%`}
              {pace.expected !== null && <small>of {pace.expected}%</small>}
            </dd>
          </div>
          <div>
            <dt>Gap</dt>
            <dd>
              {formatDelta(pace.delta)}
              {pace.delta !== null && <small>pts</small>}
            </dd>
          </div>
          <div>
            <dt>Stale</dt>
            <dd>
              {pace.staleCount}
              <small>of {pace.projects.length}</small>
            </dd>
          </div>
        </dl>
      </header>

      {gaps.length > 0 && (
        <div className="pace-gaps">
          <h4 className="pace-section-title">Biggest gaps</h4>
          <ol>
            {gaps.map((entry) => {
              const byPoints = entry.delta !== null && entry.delta < -PACE_TOLERANCE
              return (
                <li key={entry.project.id}>
                  <button type="button" className="gap-card" onClick={() => openProject(entry.project.id)}>
                    <span className="gap-card-num">
                      {byPoints ? formatDelta(entry.delta) : `+${entry.slip}`}
                      <small>{byPoints ? 'pts behind' : 'days late'}</small>
                    </span>
                    <span className="gap-card-title">{entry.project.title}</span>
                    <span className="gap-card-meta">
                      {entry.project.projectManager || 'No PM'}
                      <span className={entry.stale ? 'meta-stale' : ''}>
                        {entry.stale && <span className="stale-ring" aria-hidden />} {ago(entry.project.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className="pace-chart detail">
        <AxisRow label="Initiative" />
        {initiatives.length === 0 && <div className="list-empty">No initiatives in this pillar.</div>}
        {initiatives.map(({ initiative, pace: ip }, index) => {
          const isOpen = Boolean(open[initiative.id])
          return (
            <div key={initiative.id} className={`pace-branch${isOpen ? ' open' : ''}`}>
              <PaceRow
                size="md"
                index={index}
                title={initiative.title}
                meta={
                  <>
                    <span>
                      {ip.projects.length} project{ip.projects.length === 1 ? '' : 's'}
                    </span>
                    {ip.projects.length > 0 && <span>{ip.scheduledCount} dated</span>}
                  </>
                }
                pace={{ ...ip, progress: ip.scheduledProgress ?? ip.progress }}
                expanded={ip.projects.length ? isOpen : undefined}
                onClick={ip.projects.length ? () => setOpen((current) => ({ ...current, [initiative.id]: !current[initiative.id] })) : undefined}
              />
              {isOpen &&
                ip.projects
                  .slice()
                  .sort((a, b) => (a.delta ?? Infinity) - (b.delta ?? Infinity))
                  .map((entry, i) => (
                    <PaceRow
                      key={entry.project.id}
                      size="sm"
                      index={i}
                      title={entry.project.title}
                      meta={
                        <>
                          <span>{entry.project.projectManager || 'No PM'}</span>
                          <span className={entry.stale ? 'meta-stale' : ''}>
                            {entry.stale && <span className="stale-ring" aria-hidden />} {ago(entry.project.updatedAt)}
                          </span>
                        </>
                      }
                      pace={{ progress: entry.project.progress, expected: entry.expected, delta: entry.delta, schedule: entry.schedule }}
                      onClick={() => openProject(entry.project.id)}
                    />
                  ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
