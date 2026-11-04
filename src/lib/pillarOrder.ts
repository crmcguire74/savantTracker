// 🔢 Pillar order. One rule, used everywhere the app lists pillars.
//
//   Default (monday order): pillars named "Pillar 1: ...", "Pillar 2: ..." sort by that number.
//     Then pillars linked to monday without a number, by monday folder id (the order monday made
//     them). Then pillars made in the tracker, in the order they were stored.
//   Override: an admin drags pillars into an order. The saved list wins. A pillar not on the
//     saved list (new in monday) goes after the listed ones, in the default order.
//   Removing the override returns to the default.
//
// The default depends only on the pillar names and ids, never on how the list happens to be
// stored, so removing the override always gives the same result.
//
// Pure functions. Inputs are never changed.

import type { Pillar, TrackerState } from '../types'

export interface PillarOrder {
  ids: string[]
  updatedAt: string
  updatedByName: string
}

/** "Pillar 2: Build a Unified Platform" gives 2. No prefix gives null. */
export const pillarNumber = (title: string): number | null => {
  const match = String(title ?? '').match(/^\s*pillar\s*(\d+)\b/i)
  return match ? Number(match[1]) : null
}

const folderNumber = (pillar: Pillar): number | null => {
  const value = Number(pillar.mondayId)
  return pillar.mondayId && Number.isFinite(value) ? value : null
}

/** The order monday defines: numbered names first, then monday's own order, then tracker-only. */
export function mondayOrder(pillars: readonly Pillar[]): Pillar[] {
  const rank = (pillar: Pillar, index: number): [number, number, number] => {
    const number = pillarNumber(pillar.title)
    if (number !== null) return [0, number, folderNumber(pillar) ?? index]
    if (pillar.mondayId) return [1, folderNumber(pillar) ?? Number.MAX_SAFE_INTEGER, index]
    return [2, index, index]
  }
  return pillars
    .map((pillar, index) => ({ pillar, key: rank(pillar, index), index }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index)
    .map((entry) => entry.pillar)
}

export const hasOverride = (order: Pick<PillarOrder, 'ids'> | null | undefined): boolean => Boolean(order && order.ids.length > 0)

export function orderPillars(pillars: readonly Pillar[], order?: Pick<PillarOrder, 'ids'> | null): Pillar[] {
  const base = mondayOrder(pillars)
  if (!hasOverride(order)) return base
  const rank = new Map(order!.ids.map((id, index) => [id, index]))
  const listed = base.filter((pillar) => rank.has(pillar.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  return [...listed, ...base.filter((pillar) => !rank.has(pillar.id))]
}

export const orderState = (state: TrackerState, order?: Pick<PillarOrder, 'ids'> | null): TrackerState => ({
  ...state,
  pillars: orderPillars(state.pillars, order),
})

/** Reads a stored order. Anything unusable, or an empty list, means "no override". */
export function toPillarOrder(value: unknown): PillarOrder | null {
  const found = value as Partial<PillarOrder> | null | undefined
  const ids = Array.isArray(found?.ids) ? found.ids.filter((id): id is string => typeof id === 'string') : []
  if (ids.length === 0) return null
  return {
    ids,
    updatedAt: typeof found?.updatedAt === 'string' ? found.updatedAt : '',
    updatedByName: typeof found?.updatedByName === 'string' ? found.updatedByName : '',
  }
}
