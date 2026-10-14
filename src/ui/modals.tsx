// 🪟 Confirm, conflict, and the storage panel that swaps the backend at
// runtime. The storage panel is the visible half of the proxy: it shows which
// driver is mounted and moves the data to another one on request.

import { useEffect, useState } from 'react'
import { FIELD_LABELS } from '../constants'
import { MemoryAdapter, RestAdapter, storage, type StorageStatus, type SwapReport } from '../storage'
import { IndexedDbAdapter } from '../storage/indexeddb'
import type { Conflict } from '../hooks/useTracker'
import { GhostButton, PrimaryButton } from './atoms'

export function ConfirmModal(props: {
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{props.title ?? 'Please confirm'}</h2>
        <p>{props.message}</p>
        <div className="modal-actions">
          <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
          <PrimaryButton danger onClick={props.onConfirm}>
            {props.confirmLabel ?? 'Confirm'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export function ConflictModal(props: {
  conflict: Conflict
  onResolve: (choice: 'mine' | 'theirs') => void
  onCancel: () => void
}) {
  const label = FIELD_LABELS[props.conflict.field] ?? props.conflict.field

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>That field changed while you were editing</h2>
        <p>
          "{label}" moved after you started. Pick which value to keep. The other one stays recoverable from the
          change log.
        </p>
        <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
          <div className="value-box">
            <div className="label">Your value</div>
            <div style={{ fontSize: 13.5 }}>{String(props.conflict.mine) || '(empty)'}</div>
          </div>
          <div className="value-box">
            <div className="label">Stored value</div>
            <div style={{ fontSize: 13.5 }}>{String(props.conflict.theirs) || '(empty)'}</div>
          </div>
        </div>
        <div className="modal-actions">
          <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
          <GhostButton onClick={() => props.onResolve('theirs')}>Keep stored</GhostButton>
          <PrimaryButton onClick={() => props.onResolve('mine')}>Keep mine</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export function StorageModal(props: { status: StorageStatus; onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState('')
  const [report, setReport] = useState<SwapReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const swap = async (build: () => Parameters<typeof storage.swap>[0], migrate: boolean) => {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      setReport(await storage.swap(build(), { migrate, prefix: 'tracker/', onCollision: 'overwrite' }))
    } catch (swapError) {
      setError(swapError instanceof Error ? swapError.message : String(swapError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Data storage</h2>
        <p>
          Everything in the app reads and writes through one proxy. Switching the driver here moves the live
          session onto a different store without a reload, and optionally copies the data across.
        </p>

        <div className="value-box" style={{ marginBottom: 14 }}>
          <div className="label">Mounted driver</div>
          <div style={{ fontSize: 13.5 }} className="mono">
            {props.status.driver}
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {props.status.multiUser ? 'Shared across people.' : 'Local to this browser.'}{' '}
            {props.status.realtime ? 'Live updates on.' : 'No live updates.'}
          </div>
        </div>

        <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
          <GhostButton onClick={() => void swap(() => new IndexedDbAdapter(), true)}>
            Use IndexedDB (this browser)
          </GhostButton>
          <GhostButton onClick={() => void swap(() => new MemoryAdapter(), true)}>
            Use memory (scratch session, nothing persists)
          </GhostButton>
        </div>

        <label className="field" style={{ marginBottom: 10 }}>
          <span>Service base URL</span>
          <input
            className="input"
            value={baseUrl}
            placeholder="https://api.example.com"
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <GhostButton
          onClick={() => {
            if (!baseUrl.trim()) {
              setError('Enter the base URL of the service first.')
              return
            }
            void swap(() => new RestAdapter({ baseUrl: baseUrl.trim() }), true)
          }}
          style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
        >
          Move data to this service
        </GhostButton>

        {busy && <div className="hint">Working…</div>}
        {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        {report && (
          <div className="hint" style={{ marginBottom: 10 }}>
            {report.from} → {report.to}: copied {report.copied.length}, skipped {report.skipped.length}, in{' '}
            {report.durationMs}ms.
          </div>
        )}

        <div className="modal-actions">
          <PrimaryButton onClick={props.onClose}>Done</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export function IdentityModal(props: {
  name: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(props.name)

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Who is editing?</h2>
        <p>
          Your name is attached to every change in the log. It is stored in this browser only and never leaves
          the machine until you export a file.
        </p>
        <input
          className="input"
          value={draft}
          placeholder="Your name"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              props.onSave(draft)
              props.onClose()
            }
          }}
        />
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <GhostButton onClick={props.onClose}>Cancel</GhostButton>
          <PrimaryButton
            onClick={() => {
              props.onSave(draft)
              props.onClose()
            }}
          >
            Save
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
