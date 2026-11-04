import { describe, expect, it } from 'vitest'
import type { Pillar } from '../types'
import { hasOverride, mondayOrder, orderPillars, pillarNumber, toPillarOrder } from './pillarOrder'

const p = (id: string, title: string, mondayId?: string): Pillar => ({ id, title, owner: '', ...(mondayId ? { mondayId } : {}) })
const titles = (list: Pillar[]) => list.map((pillar) => pillar.title)

describe('pillar order', () => {
  it('reads the number in "Pillar N:" names', () => {
    expect(pillarNumber('Pillar 2: Build')).toBe(2)
    expect(pillarNumber('pillar 10 - Grow')).toBe(10)
    expect(pillarNumber('Accelerate Growth')).toBeNull()
  })

  it('sorts numbered pillars by number, then monday folder order, then tracker-only', () => {
    const list = [p('a', 'Local one'), p('b', 'Unnumbered late', '300'), p('c', 'Pillar 2: Two', '2'), p('d', 'Unnumbered early', '100'), p('e', 'Pillar 1: One', '9')]
    expect(titles(mondayOrder(list))).toEqual(['Pillar 1: One', 'Pillar 2: Two', 'Unnumbered early', 'Unnumbered late', 'Local one'])
  })

  it('gives the same default whatever order the list is stored in', () => {
    const list = [p('a', 'Pillar 3: C', '3'), p('b', 'Pillar 1: A', '1'), p('c', 'Pillar 2: B', '2')]
    expect(titles(mondayOrder([...list].reverse()))).toEqual(titles(mondayOrder(list)))
  })

  it('applies an override, and puts pillars missing from it last in the default order', () => {
    const list = [p('a', 'Pillar 1: A', '1'), p('b', 'Pillar 2: B', '2'), p('c', 'Pillar 3: C', '3')]
    const ordered = orderPillars(list, { ids: ['c', 'a'] })
    expect(ordered.map((pillar) => pillar.id)).toEqual(['c', 'a', 'b'])
  })

  it('ignores ids that no longer exist and treats an empty list as no override', () => {
    const list = [p('a', 'Pillar 1: A', '1'), p('b', 'Pillar 2: B', '2')]
    expect(orderPillars(list, { ids: ['gone', 'b'] }).map((pillar) => pillar.id)).toEqual(['b', 'a'])
    expect(orderPillars(list, { ids: [] }).map((pillar) => pillar.id)).toEqual(['a', 'b'])
    expect(hasOverride({ ids: [] })).toBe(false)
  })

  it('does not change its input', () => {
    const list = [p('b', 'Pillar 2: B', '2'), p('a', 'Pillar 1: A', '1')]
    const before = JSON.stringify(list)
    orderPillars(list, { ids: ['a'] })
    expect(JSON.stringify(list)).toBe(before)
  })

  it('reads a stored order and rejects junk', () => {
    expect(toPillarOrder({ ids: ['a', 3, 'b'], updatedAt: 't', updatedByName: 'Ada' })).toEqual({ ids: ['a', 'b'], updatedAt: 't', updatedByName: 'Ada' })
    expect(toPillarOrder({ ids: [] })).toBeNull()
    expect(toPillarOrder(null)).toBeNull()
    expect(toPillarOrder('x')).toBeNull()
  })
})
