// ⏱️ Pace primitives. The track reads left to right as 0–100% complete:
// the bar is where the work is, the needle is where the schedule says it
// should be today, and the space between them is shaded by which way it
// leans. Child ticks under the track place each project on the same scale.

import { useMemo } from 'react'
import { PACE_LABEL, PACE_ORDER, type Pace, type ProjectPace } from '../lib/pace'

const TICK_LANE_PX = 13
/** Ticks closer than this many points share a column, so they stack instead of hiding each other. */
const TICK_GAP = 2.5
const MAX_LANES = 6

/**
 * Stacks ticks that would overlap into lanes below each other, worst pace on
 * top, so twelve projects at 0% read as twelve marks rather than one.
 */
function stackTicks(entries: ProjectPace[]) {
  const sorted = entries.slice().sort((a, b) => a.project.progress - b.project.progress || PACE_ORDER.indexOf(a.pace) - PACE_ORDER.indexOf(b.pace))
  const laneEnds: number[] = []
  const placed = sorted.map((entry) => {
    const x = entry.project.progress
    let lane = laneEnds.findIndex((end) => x - end >= TICK_GAP)
    if (lane === -1) lane = laneEnds.length < MAX_LANES ? laneEnds.length : laneEnds.indexOf(Math.min(...laneEnds))
    laneEnds[lane] = x
    return { entry, lane }
  })
  return { placed, count: Math.max(1, laneEnds.length) }
}

export const PACE_TONE: Record<Pace, 'red' | 'amber' | 'accent' | 'green' | 'neutral'> = {
  behind: 'red',
  stale: 'amber',
  'on-pace': 'accent',
  ahead: 'green',
  unscheduled: 'neutral',
}

export function PaceTag({ pace }: { pace: Pace }) {
  return <span className={`pace-tag pace-${pace}`}>{PACE_LABEL[pace]}</span>
}

export function PaceTrack(props: {
  progress: number
  expected: number | null
  pace: Pace
  /** Projects to place as ticks under the track. */
  children?: ProjectPace[]
  onTick?: (projectId: string) => void
  compact?: boolean
  label?: string
}) {
  const progress = Math.max(0, Math.min(100, props.progress))
  const expected = props.expected === null ? null : Math.max(0, Math.min(100, props.expected))
  const gapFrom = expected === null ? 0 : Math.min(progress, expected)
  const gapTo = expected === null ? 0 : Math.max(progress, expected)
  const lanes = useMemo(() => (props.children?.length ? stackTicks(props.children) : null), [props.children])
  const summary =
    expected === null
      ? `${progress}% complete; no schedule to compare against`
      : `${progress}% complete against ${expected}% expected by today: ${PACE_LABEL[props.pace].toLowerCase()}`

  return (
    <div className={`pace-track-wrap${props.compact ? ' compact' : ''}`}>
      <div className={`pace-track pace-${props.pace}`} role="img" aria-label={props.label ? `${props.label}: ${summary}` : summary}>
        <span className="pace-fill" style={{ width: `${progress}%` }} />
        {expected !== null && gapTo > gapFrom && (
          <span
            className={`pace-gap ${progress < expected ? 'short' : 'over'}`}
            style={{ left: `${gapFrom}%`, width: `${gapTo - gapFrom}%` }}
          />
        )}
        {expected !== null && <span className="pace-needle" style={{ left: `${expected}%` }} title={`Expected by today: ${expected}%`} />}
      </div>
      {lanes && (
        <div className="pace-ticks" aria-hidden={!props.onTick} style={{ height: `${lanes.count * TICK_LANE_PX + 4}px` }}>
          {lanes.placed.map(({ entry, lane }) => {
            const title = `${entry.project.title}: ${entry.project.progress}%${entry.expected === null ? '' : ` of ${entry.expected}% expected`} · ${PACE_LABEL[entry.pace]}`
            const style = { left: `${Math.max(0, Math.min(100, entry.project.progress))}%`, top: `${lane * TICK_LANE_PX + 2}px` }
            return props.onTick ? (
              <button
                key={entry.project.id}
                type="button"
                className={`pace-tick pace-${entry.pace}`}
                style={style}
                title={title}
                aria-label={title}
                onClick={() => props.onTick!(entry.project.id)}
              />
            ) : (
              <span key={entry.project.id} className={`pace-tick pace-${entry.pace}`} style={style} title={title} />
            )
          })}
        </div>
      )}
    </div>
  )
}

/** How to read the track, shown once per page. */
export function PaceLegend() {
  return (
    <div className="pace-legend" aria-label="How to read pace">
      <span className="pace-legend-item">
        <span className="pace-legend-fill" /> Work complete
      </span>
      <span className="pace-legend-item">
        <span className="pace-legend-needle" /> Where the schedule says it should be today
      </span>
      {(['behind', 'stale', 'on-pace', 'ahead', 'unscheduled'] as Pace[]).map((pace) => (
        <span key={pace} className="pace-legend-item">
          <span className={`pace-tick static pace-${pace}`} /> {PACE_LABEL[pace]}
        </span>
      ))}
    </div>
  )
}
