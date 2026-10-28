// ⏱️ Pace primitives. Schedule is the main reading (behind, on pace, ahead,
// no schedule) and each state has a shape as well as a color: ▼ behind,
// ● on pace, ▲ ahead, a dash for no schedule. Staleness is a separate
// signal, drawn as a hollow or dashed mark, so a quiet pillar still shows
// which way it leans.

import { PACE_LABEL, type Pace, type SchedulePace } from '../lib/pace'

export const PACE_TONE: Record<Pace, 'red' | 'amber' | 'accent' | 'green' | 'neutral'> = {
  behind: 'red',
  stale: 'amber',
  'on-pace': 'accent',
  ahead: 'green',
  unscheduled: 'neutral',
}

export const SCHEDULE_COLOR: Record<SchedulePace, string> = {
  behind: 'var(--red)',
  'on-pace': 'var(--accent)',
  ahead: 'var(--blue)',
  unscheduled: 'var(--text-dim)',
}

export const SCHEDULE_LABEL: Record<SchedulePace, string> = {
  behind: 'Behind plan',
  'on-pace': 'On pace',
  ahead: 'Ahead of plan',
  unscheduled: 'No schedule',
}

export function PaceTag({ pace }: { pace: Pace }) {
  return <span className={`pace-tag pace-${pace}`}>{PACE_LABEL[pace]}</span>
}

/** The shape that stands for a schedule state, for use beside text. */
export function ScheduleGlyph({ schedule, size = 10, hollow }: { schedule: SchedulePace; size?: number; hollow?: boolean }) {
  const color = SCHEDULE_COLOR[schedule]
  const paint = hollow ? { fill: 'none', stroke: color, strokeWidth: 1.6 } : { fill: color }
  return (
    <svg className="schedule-glyph" width={size} height={size} viewBox="0 0 10 10" aria-hidden>
      {schedule === 'behind' && <path d="M1 1.5h8L5 9z" {...paint} strokeLinejoin="round" />}
      {schedule === 'ahead' && <path d="M5 1l4 7.5H1z" {...paint} strokeLinejoin="round" />}
      {schedule === 'on-pace' && <circle cx="5" cy="5" r={hollow ? 3.4 : 4} {...paint} />}
      {schedule === 'unscheduled' && <rect x="1" y="4" width="8" height="2" rx="1" fill={color} />}
    </svg>
  )
}

/** Signed points, with a true minus sign. */
export const formatDelta = (delta: number | null) => (delta === null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`)

/**
 * Bar is work complete, needle is where the schedule says it should be today,
 * and the space between them is shaded by which way it leans.
 */
export function PaceTrack(props: { progress: number; expected: number | null; pace: Pace; compact?: boolean; label?: string }) {
  const progress = Math.max(0, Math.min(100, props.progress))
  const expected = props.expected === null ? null : Math.max(0, Math.min(100, props.expected))
  const gapFrom = expected === null ? 0 : Math.min(progress, expected)
  const gapTo = expected === null ? 0 : Math.max(progress, expected)
  const summary =
    expected === null
      ? `${progress}% complete; no schedule to compare against`
      : `${progress}% complete against ${expected}% expected by today: ${PACE_LABEL[props.pace].toLowerCase()}`

  return (
    <div className={`pace-track-wrap${props.compact ? ' compact' : ''}`}>
      <div className={`pace-track pace-${props.pace}`} role="img" aria-label={props.label ? `${props.label}: ${summary}` : summary}>
        <span className="pace-fill" style={{ width: `${progress}%` }} />
        {expected !== null && gapTo > gapFrom && (
          <span className={`pace-gap ${progress < expected ? 'short' : 'over'}`} style={{ left: `${gapFrom}%`, width: `${gapTo - gapFrom}%` }} />
        )}
        {expected !== null && <span className="pace-needle" style={{ left: `${expected}%` }} title={`Expected by today: ${expected}%`} />}
      </div>
    </div>
  )
}
