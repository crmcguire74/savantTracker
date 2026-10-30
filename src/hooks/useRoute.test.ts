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
    { view: 'portfolio', layout: 'pace' },
    { view: 'workload', layout: 'people' },
    { view: 'workload', layout: 'pm-heatmap' },
    { view: 'onepager' },
    { view: 'onepager', pillar: 'obj-2' },
    { view: 'settings' },
    { view: 'admin' },
    { view: 'access' },
    { view: 'project', id: 'proj-1789-42' },
  ])('round-trips %o', (route) => {
    expect(parseRoute(formatRoute(route))).toEqual({ ...route })
  })

  it('falls back to the portfolio ledger for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ view: 'portfolio', layout: 'ledger', pillar: undefined, initiative: undefined })
    expect(parseRoute('#/nope')).toMatchObject({ view: 'portfolio', layout: 'ledger' })
    expect(parseRoute('#/project/')).toMatchObject({ view: 'portfolio' })
  })

  it('sends links from the old Reports page to their new homes', () => {
    expect(parseRoute('#/reports')).toEqual({ view: 'admin' })
    expect(parseRoute('#/reports?report=pillar-one-pager&pillar=obj-2')).toEqual({ view: 'onepager', pillar: 'obj-2' })
  })

  it('ignores unknown layout values', () => {
    expect(parseRoute('#/board?layout=weird')).toEqual({ view: 'board', layout: 'phase' })
  })
})
