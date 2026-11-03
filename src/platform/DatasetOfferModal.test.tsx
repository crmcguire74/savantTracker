import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DatasetOffer } from '../data/dataset'
import { DatasetOfferModal } from './modals'

// Tells React these renders are driven by act(), which silences its warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let host: HTMLDivElement | undefined

const OFFER: DatasetOffer = {
  source: 'monday-sync-2026-11-10',
  exportedAt: '2026-11-10T15:00:00.000Z',
  bundledProjects: 27,
  localProjects: 43,
  untracked: true,
}

function render(offer: DatasetOffer, handlers: { onReplace?: () => Promise<boolean> } = {}) {
  const onReplace = handlers.onReplace ?? vi.fn(async () => true)
  const onKeep = vi.fn()
  const onLater = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(<DatasetOfferModal offer={offer} onReplace={onReplace} onKeep={onKeep} onLater={onLater} />))
  return { host, onReplace, onKeep, onLater }
}

const button = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
})

describe('dataset offer modal', () => {
  it('says what is on offer, what the browser holds, and that a backup comes first', () => {
    const { host: el } = render(OFFER)
    const text = el.textContent ?? ''
    expect(text).toContain('Newer monday.com data is available')
    expect(text).toContain('2026-11-10')
    expect(text).toContain('27 projects')
    expect(text).toContain('holds 43')
    expect(text).toContain('not loaded from monday.com')
    expect(text).toContain('backup of your current data downloads first')
  })

  it('leaves out the "not loaded from monday" note when the browser tracked its dataset', () => {
    const { host: el } = render({ ...OFFER, untracked: false })
    expect(el.textContent).not.toContain('not loaded from monday.com')
  })

  it('wires each button to its own action', async () => {
    const { host: el, onReplace, onKeep, onLater } = render(OFFER)
    act(() => button(el, 'Ask me later').click())
    act(() => button(el, 'Keep my data').click())
    expect(onLater).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onReplace).not.toHaveBeenCalled()

    await act(async () => button(el, 'Replace with monday data').click())
    expect(onReplace).toHaveBeenCalledTimes(1)
  })

  it('asks later on Escape', () => {
    const { onLater } = render(OFFER)
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onLater).toHaveBeenCalledTimes(1)
  })
})
