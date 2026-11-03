// 🕒 "monday data as of 2:35 PM". Everyone sees it, so nobody has to wonder how fresh the numbers are.
//
// `info.at` is the last time the app checked monday: a pull, or a check that found nothing new.
// Nothing shows until the server has synced at least once (browser-only builds never do).

import type { SyncInfo } from '../data/repository'

const DAY_MS = 24 * 60 * 60 * 1000

export const freshnessLabel = (at: string, now: Date = new Date()): string => {
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return ''
  const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return when.toDateString() === now.toDateString() ? time : `${when.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

export function SyncFreshness(props: { info: SyncInfo | null; now?: Date }) {
  const { info } = props
  if (!info) return null
  const label = freshnessLabel(info.at, props.now)
  if (!label) return null
  const now = props.now ?? new Date()
  const stale = !info.ok || now.getTime() - new Date(info.at).getTime() > DAY_MS
  const text = info.ok ? `monday data as of ${label}` : `monday sync failed ${label}`
  const detail = info.ok
    ? info.checkedUnchanged
      ? 'The app checked monday.com and nothing had changed.'
      : 'The app last pulled changes from monday.com.'
    : 'The last attempt to read monday.com failed. The numbers may be out of date. An admin can see why on the Admin screen.'
  return (
    <span className={`sync-fresh${stale ? ' stale' : ''}`} title={detail} role="status">
      {text}
    </span>
  )
}
