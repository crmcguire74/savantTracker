// 🗺️ Pace map. Across: how much of the plan's time has passed by today.
// Up: how much of the work is done. The diagonal is "on plan": anything
// below it is behind, anything above it is ahead, and the vertical distance
// to the line is the gap in points. A pillar sits at the average progress of
// its scheduled projects, so its height and its gap compare like with like.
// Pillars are the large numbered marks
// (sized by project count), projects the small dots. A dashed or hollow mark
// has gone stale, so read its position with caution.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { daysSince } from '../../lib/id'
import { PACE_TOLERANCE, type GroupPace, type ProjectPace } from '../../lib/pace'
import { formatDelta, SCHEDULE_COLOR, SCHEDULE_LABEL, ScheduleGlyph } from '../pace'

export interface MapPillar {
  id: string
  number: string
  title: string
  pace: GroupPace
}

const M = { top: 18, right: 22, bottom: 48, left: 56 }
const GRID = [0, 25, 50, 75, 100]

const radius = (pillar: MapPillar) => Math.min(30, 12 + 2.7 * Math.sqrt(pillar.pace.projects.length))

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Projects that land on the same spot fan out in a small spiral instead of hiding each other. */
function spread(entries: Array<{ key: string; x: number; y: number }>) {
  const seen = new Map<string, number>()
  return new Map(
    entries.map((entry) => {
      const cell = `${Math.round(entry.x / 7)}:${Math.round(entry.y / 7)}`
      const k = seen.get(cell) ?? 0
      seen.set(cell, k + 1)
      const angle = k * 2.4
      const radius = k === 0 ? 0 : 4.6 * Math.sqrt(k)
      return [
        entry.key,
        {
          x: entry.x + Math.cos(angle) * radius,
          y: entry.y + Math.sin(angle) * radius,
        },
      ]
    }),
  )
}

const shortTitle = (title: string) => (title.length > 30 ? `${title.slice(0, 29)}…` : title)

type Box = { x: number; y: number; w: number; h: number }
type Placement = { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/**
 * Puts each pillar's two-line label right, left, above or below its mark,
 * whichever collides least with other marks, labels, fixed obstacles (the
 * "On plan" caption, the focus gap) and the plot edge. Largest marks choose first.
 */
function placeLabels(items: Array<{ id: string; x: number; y: number; r: number; w: number }>, bounds: Box, obstacles: Box[]) {
  const marks = items.map((item) => ({
    id: item.id,
    box: {
      x: item.x - item.r,
      y: item.y - item.r,
      w: item.r * 2,
      h: item.r * 2,
    },
  }))
  const taken: Box[] = []
  const result = new Map<string, Placement>()
  for (const item of items.slice().sort((a, b) => b.r - a.r)) {
    const { x, y, r, w } = item
    const options: Array<Placement & { box: Box }> = [
      {
        dx: r + 9,
        dy: -1,
        anchor: 'start',
        box: { x: x + r + 6, y: y - 14, w, h: 32 },
      },
      {
        dx: -(r + 9),
        dy: -1,
        anchor: 'end',
        box: { x: x - r - 6 - w, y: y - 14, w, h: 32 },
      },
      {
        dx: 0,
        dy: -(r + 21),
        anchor: 'middle',
        box: { x: x - w / 2, y: y - r - 34, w, h: 32 },
      },
      {
        dx: 0,
        dy: r + 16,
        anchor: 'middle',
        box: { x: x - w / 2, y: y + r + 2, w, h: 32 },
      },
    ]
    const cost = (box: Box) => {
      let total = box.w * box.h - overlap(box, bounds)
      for (const mark of marks) if (mark.id !== item.id) total += overlap(box, mark.box)
      for (const other of taken) total += overlap(box, other) * 1.5
      for (const other of obstacles) total += overlap(box, other)
      return total
    }
    const best = options.reduce((winner, option) => (cost(option.box) < cost(winner.box) ? option : winner))
    taken.push(best.box)
    result.set(item.id, { dx: best.dx, dy: best.dy, anchor: best.anchor })
  }
  return result
}

type Tip =
  | { x: number; y: number; kind: 'pillar'; pillar: MapPillar }
  | {
      x: number
      y: number
      kind: 'project'
      entry: ProjectPace
      pillar: MapPillar
    }

export function PaceMap(props: {
  pillars: MapPillar[]
  focus: string | null
  hovered: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onProject: (id: string) => void
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const height = Math.round(Math.max(320, Math.min(520, width * 0.74)))
  const pw = Math.max(1, width - M.left - M.right)
  const ph = height - M.top - M.bottom
  const sx = (value: number) => M.left + (Math.max(0, Math.min(100, value)) / 100) * pw
  const sy = (value: number) => M.top + (1 - Math.max(0, Math.min(100, value)) / 100) * ph
  const active = props.hovered ?? props.focus
  const level = (pace: GroupPace) => pace.scheduledProgress ?? pace.progress
  // On a phone the numbered standings below carry the names; the map keeps just the numbers.
  const narrow = width < 520

  const dots = useMemo(() => {
    const raw = props.pillars.flatMap((pillar) =>
      pillar.pace.projects
        .filter((entry) => entry.expected !== null)
        .map((entry) => ({
          key: entry.project.id,
          pillar,
          entry,
          x: sx(entry.expected!),
          y: sy(entry.project.progress),
        })),
    )
    const placed = spread(raw)
    return raw.map((dot) => ({ ...dot, ...placed.get(dot.key)! }))
    // sx/sy only change with width and height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pillars, width, height])

  const plotted = props.pillars.filter((pillar) => pillar.pace.expected !== null && pillar.pace.projects.length > 0)
  const DIAGONAL_AT = 14
  const obstacles: Box[] = [{ x: sx(DIAGONAL_AT) - 28, y: sy(DIAGONAL_AT) - 26, w: 56, h: 28 }]
  const focused = plotted.find((pillar) => pillar.id === props.focus)
  if (focused && focused.pace.delta) {
    const x = sx(focused.pace.expected!)
    const [top, bottom] = [sy(level(focused.pace)), sy(focused.pace.expected!)].sort((a, b) => a - b)
    obstacles.push(
      { x: x - 4, y: top, w: 8, h: bottom - top },
      {
        x: focused.pace.expected! > 80 ? x - 110 : x,
        y: (top + bottom) / 2 - 10,
        w: 110,
        h: 20,
      },
    )
  }
  const labels = placeLabels(
    plotted.map((pillar) => ({
      id: pillar.id,
      x: sx(pillar.pace.expected!),
      y: sy(level(pillar.pace)),
      r: radius(pillar),
      w: Math.max(80, shortTitle(pillar.title).length * 6.9),
    })),
    { x: 0, y: M.top - 8, w: width, h: ph + 16 },
    obstacles,
  )
  const unplotted = props.pillars.filter((pillar) => pillar.pace.projects.length > 0 && pillar.pace.expected === null)
  const unscheduledProjects = props.pillars.reduce((sum, pillar) => sum + pillar.pace.projects.length - pillar.pace.scheduledCount, 0)
  // Draw the active pillar last so it sits on top.
  const order = plotted.slice().sort((a, b) => (a.id === active ? 1 : 0) - (b.id === active ? 1 : 0))
  const activePillar = plotted.find((pillar) => pillar.id === active) ?? null

  const band = (points: Array<[number, number]>) => points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')
  const T = PACE_TOLERANCE
  const slope = (Math.atan2(ph, pw) * 180) / Math.PI

  const keyed = (handler: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handler()
    }
  }
  const tipFor = (next: Tip | null) => setTip(next)

  return (
    <div className="pace-map" ref={wrapRef} onMouseLeave={() => (props.onHover(null), tipFor(null))}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className={settled ? 'settled' : ''}
          role="group"
          aria-label="Pace map: schedule elapsed against work complete for each pillar"
        >
          <defs>
            <clipPath id="pace-map-plot">
              <rect x={M.left} y={M.top} width={pw} height={ph} />
            </clipPath>
          </defs>

          <g clipPath="url(#pace-map-plot)">
            <polygon
              className="pm-zone ahead"
              points={band([
                [0, T],
                [0, 100],
                [100 - T, 100],
              ])}
            />
            <polygon
              className="pm-zone behind"
              points={band([
                [T, 0],
                [100, 0],
                [100, 100 - T],
              ])}
            />
            <polygon
              className="pm-zone band"
              points={band([
                [0, 0],
                [T, 0],
                [100, 100 - T],
                [100, 100],
                [100 - T, 100],
                [0, T],
              ])}
            />
          </g>

          {GRID.map((value) => (
            <g key={value}>
              <line className="pm-grid" x1={sx(value)} x2={sx(value)} y1={M.top} y2={M.top + ph} />
              <line className="pm-grid" x1={M.left} x2={M.left + pw} y1={sy(value)} y2={sy(value)} />
              <text className="pm-tick" x={sx(value)} y={M.top + ph + 16} textAnchor="middle">
                {value}%
              </text>
              <text className="pm-tick" x={M.left - 8} y={sy(value) + 4} textAnchor="end">
                {value}%
              </text>
            </g>
          ))}
          <text className="pm-axis" x={M.left + pw / 2} y={height - 6} textAnchor="middle">
            Schedule elapsed by today →
          </text>
          <text className="pm-axis" transform={`translate(14 ${M.top + ph / 2}) rotate(-90)`} textAnchor="middle">
            Work complete →
          </text>

          <line className="pm-diagonal" x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} />
          <text
            className="pm-diagonal-label"
            transform={`translate(${sx(DIAGONAL_AT)} ${sy(DIAGONAL_AT) - 7}) rotate(${-slope})`}
            textAnchor="middle"
          >
            On plan
          </text>
          <text className="pm-zone-label" x={sx(3)} y={sy(95)}>
            Ahead of plan
          </text>
          <text className="pm-zone-label" x={sx(97)} y={sy(4)} textAnchor="end">
            Behind plan
          </text>

          {/* The gap: from the focused pillar straight to the line, in points. */}
          {activePillar && activePillar.pace.delta !== null && Math.abs(activePillar.pace.delta) >= 1 && (
            <GapMarker
              x={sx(activePillar.pace.expected!)}
              from={sy(level(activePillar.pace))}
              to={sy(activePillar.pace.expected!)}
              delta={activePillar.pace.delta}
              r={radius(activePillar)}
              color={SCHEDULE_COLOR[activePillar.pace.schedule]}
              flip={activePillar.pace.expected! > 80}
              caption={!narrow}
            />
          )}

          <g className="pm-dots">
            {dots.map((dot) => {
              const on = !props.hovered || dot.pillar.id === props.hovered
              const color = SCHEDULE_COLOR[dot.entry.schedule]
              const label = `${dot.entry.project.title}: ${dot.entry.project.progress}% done of ${dot.entry.expected}% expected, ${SCHEDULE_LABEL[dot.entry.schedule].toLowerCase()}${dot.entry.stale ? ', stale' : ''}`
              return (
                <g
                  key={dot.key}
                  className={`pm-dot${on ? ' on' : ''}`}
                  style={{
                    transform: `translate(${settled ? dot.x : sx(0)}px, ${settled ? dot.y : sy(0)}px)`,
                  }}
                  tabIndex={on ? 0 : -1}
                  role="button"
                  aria-label={label}
                  onMouseEnter={() =>
                    tipFor({
                      x: dot.x,
                      y: dot.y,
                      kind: 'project',
                      entry: dot.entry,
                      pillar: dot.pillar,
                    })
                  }
                  onFocus={() =>
                    tipFor({
                      x: dot.x,
                      y: dot.y,
                      kind: 'project',
                      entry: dot.entry,
                      pillar: dot.pillar,
                    })
                  }
                  onBlur={() => tipFor(null)}
                  onClick={() => props.onProject(dot.entry.project.id)}
                  onKeyDown={keyed(() => props.onProject(dot.entry.project.id))}
                >
                  <circle r={10} className="pm-hit" />
                  <circle
                    r={4.4}
                    className={dot.entry.stale ? 'pm-dot-mark stale' : 'pm-dot-mark'}
                    style={dot.entry.stale ? { stroke: color } : { fill: color }}
                  />
                </g>
              )
            })}
          </g>

          {order.map((pillar) => {
            const r = radius(pillar)
            const x = sx(pillar.pace.expected!)
            const y = sy(level(pillar.pace))
            const color = SCHEDULE_COLOR[pillar.pace.schedule]
            const stale = pillar.pace.pace === 'stale'
            const isActive = pillar.id === active
            const isFocus = pillar.id === props.focus
            const label = labels.get(pillar.id)!
            const dimmed = props.hovered !== null && !isActive
            return (
              <g
                key={pillar.id}
                className={`pm-pillar${isActive ? ' active' : ''}${dimmed ? ' dimmed' : ''}`}
                style={{
                  transform: `translate(${settled ? x : sx(0)}px, ${settled ? y : sy(0)}px)`,
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isFocus}
                aria-label={`Pillar ${pillar.number}, ${pillar.title}: ${level(pillar.pace)}% done of ${pillar.pace.expected}% expected, ${formatDelta(pillar.pace.delta)} points, ${SCHEDULE_LABEL[pillar.pace.schedule].toLowerCase()}${stale ? ', stale' : ''}`}
                onMouseEnter={() => (props.onHover(pillar.id), tipFor({ x, y, kind: 'pillar', pillar }))}
                onMouseLeave={() => tipFor(null)}
                onFocus={() => (props.onHover(pillar.id), tipFor({ x, y, kind: 'pillar', pillar }))}
                onBlur={() => (props.onHover(null), tipFor(null))}
                onClick={() => props.onSelect(pillar.id)}
                onKeyDown={keyed(() => props.onSelect(pillar.id))}
              >
                {isFocus && <circle r={r + 6} className="pm-focus-ring" />}
                <circle r={r} className="pm-bubble-base" />
                <circle r={r} className={`pm-bubble${stale ? ' stale' : ''}`} style={{ fill: color }} />
                <text className="pm-bubble-num" y={4.5} textAnchor="middle">
                  {pillar.number}
                </text>
                {!narrow && (
                  <>
                    <text className="pm-bubble-label" x={label.dx} y={label.dy} textAnchor={label.anchor}>
                      {shortTitle(pillar.title)}
                    </text>
                    <text className="pm-bubble-sub" x={label.dx} y={label.dy + 15} textAnchor={label.anchor}>
                      {formatDelta(pillar.pace.delta)} pts
                      {stale ? ' · stale' : ''}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {tip && <MapTip tip={tip} width={width} />}

      <div className="pm-foot">
        <span className="pm-key">
          <span className="pm-key-item">
            <span className="pm-key-bubble" /> Pillar, sized by projects
          </span>
          {(['behind', 'on-pace', 'ahead'] as const).map((key) => (
            <span key={key} className="pm-key-item">
              <svg width="10" height="10" aria-hidden>
                <circle cx="5" cy="5" r="4" fill={SCHEDULE_COLOR[key]} />
              </svg>
              {SCHEDULE_LABEL[key]}
            </span>
          ))}
          <span className="pm-key-item">
            <svg width="10" height="10" aria-hidden>
              <circle cx="5" cy="5" r="3.6" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" />
            </svg>
            Hollow or dashed: stale
          </span>
        </span>
        {(unscheduledProjects > 0 || unplotted.length > 0) && (
          <span className="muted small">
            Not plotted: {unscheduledProjects} project
            {unscheduledProjects === 1 ? '' : 's'} without a start and end date
            {unplotted.length > 0 && `, and ${unplotted.map((pillar) => `Pillar ${pillar.number}`).join(', ')}, which has none scheduled`}.
          </span>
        )}
      </div>
    </div>
  )
}

function GapMarker(props: { x: number; from: number; to: number; delta: number; r: number; color: string; flip: boolean; caption: boolean }) {
  const behind = props.delta < 0
  // Start at the bubble's edge, end on the diagonal.
  const start = behind ? props.from - props.r : props.from + props.r
  if (behind ? start <= props.to : start >= props.to) return null
  const mid = (start + props.to) / 2
  const dx = props.flip ? -10 : 10
  return (
    <g className="pm-gap" aria-hidden>
      <line x1={props.x} x2={props.x} y1={start} y2={props.to} style={{ stroke: props.color }} />
      <line x1={props.x - 5} x2={props.x + 5} y1={props.to} y2={props.to} style={{ stroke: props.color }} />
      {props.caption && (
        <text x={props.x + dx} y={mid + 4} textAnchor={props.flip ? 'end' : 'start'} className="pm-gap-label">
          {Math.abs(props.delta)} pts {behind ? 'behind' : 'ahead'}
        </text>
      )}
    </g>
  )
}

function MapTip({ tip, width }: { tip: Tip; width: number }) {
  const left = Math.min(Math.max(tip.x, 130), width - 130)
  const above = tip.y > 150
  const style = above ? { left, top: tip.y - 18 } : { left, top: tip.y + 22 }
  if (tip.kind === 'pillar') {
    const { pace } = tip.pillar
    return (
      <div className={`pm-tip${above ? ' above' : ''}`} style={style} role="status">
        <div className="pm-tip-eyebrow">Pillar {tip.pillar.number}</div>
        <div className="pm-tip-title">{tip.pillar.title}</div>
        <div className="pm-tip-row">
          <ScheduleGlyph schedule={pace.schedule} /> {SCHEDULE_LABEL[pace.schedule]} · <strong>{formatDelta(pace.delta)} pts</strong>
        </div>
        <div className="pm-tip-row muted">
          {pace.scheduledProgress}% done of {pace.expected}% expected, across {pace.scheduledCount} dated project
          {pace.scheduledCount === 1 ? '' : 's'}
        </div>
        {pace.scheduledCount < pace.projects.length && (
          <div className="pm-tip-row muted">{pace.projects.length - pace.scheduledCount} more without dates are not counted</div>
        )}
        {pace.staleCount > 0 && (
          <div className="pm-tip-row muted">
            {pace.staleCount} of {pace.projects.length} stale
          </div>
        )}
        <div className="pm-tip-hint">Click to focus</div>
      </div>
    )
  }
  const { entry } = tip
  const age = daysSince(entry.project.updatedAt)
  return (
    <div className={`pm-tip${above ? ' above' : ''}`} style={style} role="status">
      <div className="pm-tip-eyebrow">Pillar {tip.pillar.number}</div>
      <div className="pm-tip-title">{entry.project.title}</div>
      <div className="pm-tip-row">
        <ScheduleGlyph schedule={entry.schedule} hollow={entry.stale} /> {SCHEDULE_LABEL[entry.schedule]} ·{' '}
        <strong>{formatDelta(entry.delta)} pts</strong>
      </div>
      <div className="pm-tip-row muted">
        {entry.project.progress}% done of {entry.expected}% expected
        {entry.slip !== null && entry.slip > 0 ? ` · forecast ${entry.slip}d late` : ''}
      </div>
      <div className="pm-tip-row muted">
        {entry.project.projectManager || 'No PM'}
        {age !== null && ` · updated ${age <= 0 ? 'today' : `${age}d ago`}`}
      </div>
      <div className="pm-tip-hint">Click to open</div>
    </div>
  )
}
