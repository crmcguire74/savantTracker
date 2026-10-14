// 👤 Identity and role.
//
// In Azure the server knows who you are: App Service Easy Auth validates the
// Entra token and the API reports the result at /api/me, including whether
// your account holds the editor role. The browser asks once at startup.
//
// Running locally against IndexedDB there is no server and no Entra, so the
// app falls back to a name you type once, kept in this browser. Nothing here
// is a security boundary. The API enforces the role on every write; this
// only decides which buttons are worth showing.

import { useCallback, useEffect, useState } from 'react'
import type { Identity } from '../types'
import { uid } from '../lib/id'

const STORAGE_KEY = 'savant-tracker:identity'

export interface IdentityState {
  identity: Identity
  roles: string[]
  canWrite: boolean
  /** 'entra' when the server vouched for it, 'local' when self-declared. */
  source: 'entra' | 'local'
  /** True until the server has answered, so the UI does not flash view-only. */
  resolving: boolean
  setName: (name: string) => void
}

const readStored = (): Identity | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Identity>
    if (typeof parsed?.id !== 'string') return null
    return { id: parsed.id, name: typeof parsed.name === 'string' ? parsed.name : '' }
  } catch {
    return null
  }
}

const writeStored = (identity: Identity): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // Private windows throw. An unsaved name is cosmetic.
  }
}

interface MeResponse {
  id?: string
  name?: string
  roles?: string[]
  canWrite?: boolean
  /** The server is running without sign-in, so names stay self-declared. */
  local?: boolean
}

export function useIdentity(): IdentityState {
  const [identity, setIdentity] = useState<Identity>(() => readStored() ?? { id: uid('local'), name: '' })
  const [roles, setRoles] = useState<string[]>([])
  const [canWrite, setCanWrite] = useState(true)
  const [source, setSource] = useState<'entra' | 'local'>('local')
  const [resolving, setResolving] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'same-origin' })
        if (!response.ok) throw new Error(String(response.status))
        const me = (await response.json()) as MeResponse
        if (cancelled) return

        const stored = readStored()
        // A server with no sign-in cannot tell us who you are, so the name
        // you typed in this browser is still the best answer.
        const name = me.local ? (stored?.name ?? '') : (me.name || '')
        setIdentity({ id: me.id || stored?.id || uid('local'), name })
        setRoles(me.roles ?? [])
        setCanWrite(me.canWrite !== false)
        setSource(me.local ? 'local' : 'entra')
      } catch {
        // No server, or not signed in. Local mode: you are the only writer.
        if (cancelled) return
        setSource('local')
        setCanWrite(true)
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (source === 'local') writeStored(identity)
  }, [identity, source])

  const setName = useCallback(
    (name: string) => {
      // Entra owns the name when Entra is in play.
      if (source === 'entra') return
      setIdentity((current) => ({ ...current, name: name.trim() }))
    },
    [source],
  )

  return { identity, roles, canWrite, source, resolving, setName }
}
