import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './useRoute'

describe('hash routes', () => {
  it.each<Route>([
    { view: 'portfolio', layout: 'ledger' },
    { view: 'portfolio', layout: 'heatmap' },
    { view: 'portfolio', layout: 'ledger', pillar: 'obj-2', initiative: 'init-1' },
    { view: 'board', layout: 'phase' },
    { view: 'board', layout: 'status' },
    { view: 'timeline' },
    { view: 'work' },
    { view: 'work', person: 'padman perumal' },
    { view: 'workload' },
    { view: 'reports' },
    { view: 'settings' },
    { view: 'project', id: 'proj-1789-42' },
  ])('round-trips %o', (route) => {
    expect(parseRoute(formatRoute(route))).toEqual({ ...route })
  })

  it('falls back to the portfolio ledger for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ view: 'portfolio', layout: 'ledger', pillar: undefined, initiative: undefined })
    expect(parseRoute('#/nope')).toMatchObject({ view: 'portfolio', layout: 'ledger' })
    expect(parseRoute('#/project/')).toMatchObject({ view: 'portfolio' })
  })

  it('ignores unknown layout values', () => {
    expect(parseRoute('#/board?layout=weird')).toEqual({ view: 'board', layout: 'phase' })
  })
})
