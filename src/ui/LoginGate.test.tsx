import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { forgetUnlock, LoginGate } from './LoginGate'

// Tells React these renders are driven by act(), which silences its warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let host: HTMLDivElement | undefined

function render() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(<LoginGate><p id="app">inside</p></LoginGate>))
  return host
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function signIn(el: HTMLElement, username: string, password: string) {
  const [user, pass] = el.querySelectorAll('input')
  act(() => {
    type(user, username)
    type(pass, password)
  })
  act(() => el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  sessionStorage.clear()
})

describe('LoginGate', () => {
  it('keeps the app hidden until the right credentials are entered', () => {
    const el = render()
    expect(el.querySelector('#app')).toBeNull()
    signIn(el, 'savant', 'wrong')
    expect(el.querySelector('#app')).toBeNull()
    expect(el.querySelector('[role="alert"]')).not.toBeNull()
    signIn(el, 'savant', 'sw2026')
    expect(el.querySelector('#app')).not.toBeNull()
  })

  it('stays unlocked for the rest of the browser session', () => {
    sessionStorage.setItem('savant-tracker:unlocked', '1')
    expect(render().querySelector('#app')).not.toBeNull()
  })

  it('asks again after logging out', () => {
    sessionStorage.setItem('savant-tracker:unlocked', '1')
    forgetUnlock()
    expect(render().querySelector('#app')).toBeNull()
  })
})
