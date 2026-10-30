import { describe, expect, it } from 'vitest'
import { formatLocation, parseLocation } from './location'
import type { LinkTo } from './module'

describe('module locations', () => {
  it.each<LinkTo>([
    { module: 'portfolio' },
    { module: 'portfolio', params: { layout: 'heatmap' } },
    { module: 'portfolio', params: { pillar: 'obj-2', initiative: 'init-1' } },
    { module: 'board', params: { layout: 'status' } },
    { module: 'work', params: { person: 'padman perumal' } },
    { module: 'project', id: 'proj-1789-42' },
    { module: 'project', id: 'needs/escaping & more' },
  ])('round-trips %o', (to) => {
    expect(parseLocation(formatLocation(to))).toEqual({ module: to.module, ...(to.id ? { id: to.id } : {}), params: to.params ?? {} })
  })

  it('keeps the hash format the app has always used', () => {
    expect(formatLocation({ module: 'portfolio', params: { layout: 'brief', pillar: 'obj-2' } })).toBe('#/portfolio?layout=brief&pillar=obj-2')
    expect(formatLocation({ module: 'project', id: 'proj-1' })).toBe('#/project/proj-1')
  })

  it('drops empty params so default layouts keep short URLs', () => {
    expect(formatLocation({ module: 'board', params: { layout: undefined, person: '' } })).toBe('#/board')
  })

  it('reads an empty or bare hash as no module', () => {
    expect(parseLocation('')).toEqual({ module: '', params: {} })
    expect(parseLocation('#/')).toEqual({ module: '', params: {} })
    expect(parseLocation('#/project/')).toEqual({ module: 'project', params: {} })
  })
})
