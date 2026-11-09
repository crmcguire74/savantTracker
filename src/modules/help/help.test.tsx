import { afterEach, describe, expect, it } from 'vitest'
import { mountModule, type Mounted } from '@sdk/testing'
import { manifest } from './manifest'
import { FAQ, GLOSSARY, GUIDES, QUICK_START } from './content'

let app: Mounted | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

describe('help module', () => {
  it('renders for every role, including Viewer', async () => {
    app = await mountModule(manifest, { role: 'viewer' })
    expect(app.container.querySelector('h1')?.textContent).toBe('Help')
    expect(app.container.textContent).toContain('Six things to know')
  })

  it('shows the glossary and finds a term', async () => {
    app = await mountModule(manifest, { hash: '#/help?tab=glossary' })
    expect(app.container.textContent).toContain('Initiative')
    expect(app.container.textContent).toContain('RAG status')
  })

  it('shows the FAQ', async () => {
    app = await mountModule(manifest, { hash: '#/help?tab=faq' })
    expect(app.container.querySelectorAll('details').length).toBe(FAQ.length)
  })

  it('switches to the role workflows', async () => {
    app = await mountModule(manifest)
    await app.go('#/help?tab=roles&role=editor')
    expect(app.container.textContent).toContain('You can')
    expect(app.container.textContent).toContain('You cannot')
    expect(app.container.textContent).toContain('Update my projects')
  })
})

describe('help content', () => {
  it('has a guide for each of the four roles', () => {
    expect(GUIDES.map((guide) => guide.role).sort()).toEqual(['admin', 'editor', 'executive', 'viewer'])
  })

  it('has no empty workflow and no duplicate terms', () => {
    for (const guide of GUIDES) for (const workflow of guide.workflows) expect(workflow.steps.length).toBeGreaterThan(1)
    const terms = GLOSSARY.map((item) => item.term.toLowerCase())
    expect(new Set(terms).size).toBe(terms.length)
    expect(QUICK_START.length).toBeGreaterThan(3)
  })

  it('uses no em dashes', () => {
    const all = JSON.stringify({ FAQ, GLOSSARY, GUIDES, QUICK_START })
    expect(all.includes('—')).toBe(false)
  })
})
