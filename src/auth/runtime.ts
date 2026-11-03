// 🛰️ Start-up probe: is there a server, and does real sign-in stand behind it?
//
// Runs once before the app renders (src/main.tsx). The answer decides which sign-in the app uses,
// so the same build works on a laptop, on a test site and in Azure with no rebuild:
//
//   no server (browser-only build)        local test sign-in
//   server, sign-in off (local server)    local test sign-in
//   server, Entra sign-in (Azure)         Entra roles, no password screen
//
// It also learns whether the server syncs with monday live. When it does, monday owns the synced
// fields and the app stops offering to edit them (see useTracker).
//
// Any failure falls back to the local test sign-in. That is safe: the API enforces roles on its own.

import { authMode, setDetectedAuthMode, type AuthMode } from './session'

export interface RuntimeInfo {
  auth: AuthMode
  /** The server holds a monday token and pulls live. */
  mondayLive: boolean
  /** True once the probe has finished (or been skipped). */
  probed: boolean
}

let info: RuntimeInfo = { auth: 'local', mondayLive: false, probed: false }

export const runtimeInfo = (): RuntimeInfo => ({ ...info, auth: authMode() })

/** For tests. */
export function resetRuntime(): void {
  setDetectedAuthMode(null)
  info = { auth: 'local', mondayLive: false, probed: false }
}

export async function probeRuntime(options: {
  /** Only a rest driver has a server to ask. */
  driver: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<RuntimeInfo> {
  const base = (options.baseUrl ?? '/api').replace(/\/$/, '')
  if (options.driver !== 'rest') {
    info = { auth: 'local', mondayLive: false, probed: true }
    return runtimeInfo()
  }

  const impl = options.fetchImpl ?? (typeof fetch === 'undefined' ? undefined : fetch.bind(globalThis))
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? 5000) : undefined
  try {
    if (!impl) throw new Error('no fetch')
    const response = await impl(`${base}/me`, { credentials: 'same-origin', signal: controller?.signal })
    if (!response.ok) throw new Error(String(response.status))
    const me = (await response.json()) as { local?: boolean; mondayLive?: boolean }
    const auth: AuthMode = me.local === false ? 'entra' : 'local'
    setDetectedAuthMode(auth)
    info = { auth, mondayLive: me.mondayLive === true, probed: true }
  } catch {
    setDetectedAuthMode(null)
    info = { auth: 'local', mondayLive: false, probed: true }
  } finally {
    if (timer) clearTimeout(timer)
  }
  return runtimeInfo()
}
