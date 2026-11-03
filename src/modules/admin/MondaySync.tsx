// 🔄 monday.com sync: a status card on the Admin page and the dialog behind it.
//
// Works in every build. With a monday token on the server it pulls live. With no token (a test
// site, or the browser-only build) it replays a capture file or the bundled sample through the
// same code, so the whole flow can be tried before the service account exists.
//
// The flow is always: pick a source, Preview (writes nothing), read the result, Apply.
// Removing records monday does not have is a separate opt-in and needs the approval code.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ageLabel,
  downloadText,
  Icon,
  SyncRequestError,
  Tag,
  usePlatform,
  type BackupInfo,
  type ConnectionCheck,
  type MondayCapture,
  type SyncResult,
  type SyncStatus,
} from '@sdk'

type Source = 'monday' | 'file' | 'sample'

/** Minutes between automatic pulls. The server accepts 0 (off) or 5 to 1440. */
const INTERVAL_CHOICES: Array<[number, string]> = [
  [0, 'Off (pull on request only)'],
  [5, 'Every 5 minutes'],
  [15, 'Every 15 minutes'],
  [30, 'Every 30 minutes'],
  [60, 'Every hour'],
  [240, 'Every 4 hours'],
  [1440, 'Once a day'],
]
const intervalChoices = (current: number): Array<[number, string]> =>
  INTERVAL_CHOICES.some(([choice]) => choice === current)
    ? INTERVAL_CHOICES
    : [...INTERVAL_CHOICES, [current, `Every ${current} minutes`] as [number, string]].sort((a, b) => a[0] - b[0])

const SUMMARY_LABELS: Array<[string, string]> = [
  ['projectsSeen', 'Projects on monday'],
  ['projectsCreated', 'New projects'],
  ['projectsUpdated', 'Updated projects'],
  ['fieldsChanged', 'Fields changed'],
  ['linked', 'Linked to monday'],
  ['initiativesCreated', 'New initiatives'],
  ['pillarsCreated', 'New pillars'],
]

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : 'Something went wrong.')

function statusTag(status: SyncStatus | null, failed: boolean) {
  if (failed) return <Tag tone="outline">Unavailable</Tag>
  if (!status) return <Tag tone="outline">Checking</Tag>
  if (status.mode === 'live' && status.reachable && !status.reachable.ok) return <Tag tone="outline">Live, unreachable</Tag>
  if (status.mode === 'live') return <Tag tone="green">Live</Tag>
  return <Tag tone="outline">Test mode</Tag>
}

// ── card ──────────────────────────────────────────────────────────────────

export function MondaySyncCard() {
  const { tracker, isAdmin } = usePlatform()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(() => {
    tracker.mondaySync
      .status()
      .then((next) => {
        setStatus(next)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [tracker.mondaySync])

  useEffect(() => {
    if (isAdmin) refresh()
  }, [isAdmin, refresh])

  const last = status?.last?.ok ? status.last : null
  const lastFailed = status?.last && !status.last.ok ? status.last : null

  return (
    <section className="card sync-card" aria-labelledby="sync-title">
      <div className="sync-head">
        <span className={`sync-light${status?.mode === 'live' ? ' on' : ''}`} aria-hidden />
        <h2 className="stat-label" id="sync-title">
          monday.com sync
        </h2>
        {isAdmin ? statusTag(status, failed) : <Tag tone="outline">Admin only</Tag>}
      </div>
      <div className="sync-body">
        <div>
          <div className="sync-last">{last ? ageLabel(last.at) : 'No syncs yet'}</div>
          <div className="stat-sub">
            {!isAdmin
              ? 'An admin runs the monday sync.'
              : failed
                ? 'Could not read the sync status.'
                : status?.problem
                  ? status.problem
                  : status?.reachable && !status.reachable.ok
                    ? `${status.reachable.message} Use a capture file until it is back.`
                  : lastFailed
                  ? `Last run failed: ${lastFailed.error ?? 'unknown error'}`
                  : status?.where === 'browser'
                    ? 'Browser-only build. Syncs from a capture file.'
                    : status?.mode === 'live'
                      ? status.intervalMinutes > 0
                        ? `Checks monday every ${status.intervalMinutes} minutes and pulls when something changed.`
                        : 'Automatic pulls are off. Pulls on request.'
                      : 'No monday token yet. Syncs from a capture file.'}
          </div>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-ghost sm" onClick={() => setOpen(true)}>
            <Icon.Sync size={15} /> Open sync
          </button>
        )}
      </div>
      {open && (
        <SyncDialog
          status={status}
          onClose={() => {
            setOpen(false)
            refresh()
          }}
        />
      )}
    </section>
  )
}

// ── dialog ────────────────────────────────────────────────────────────────

function SyncDialog(props: { status: SyncStatus | null; onClose: () => void }) {
  const { tracker, ask } = usePlatform()
  const api = tracker.mondaySync
  const { status } = props
  const live = status?.mode === 'live' && status.reachable?.ok !== false

  const [source, setSource] = useState<Source>(live ? 'monday' : 'sample')
  const [capture, setCapture] = useState<{ name: string; data: MondayCapture } | null>(null)
  const [retire, setRetire] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState<'' | 'test' | 'preview' | 'apply' | 'capture' | 'restore' | 'schedule'>('')
  const [minutes, setMinutes] = useState(status?.intervalMinutes ?? 0)
  const [savedMinutes, setSavedMinutes] = useState(status?.intervalMinutes ?? 0)
  const [scheduleNote, setScheduleNote] = useState('')
  const [error, setError] = useState('')
  const [connection, setConnection] = useState<ConnectionCheck | null>(null)
  const [preview, setPreview] = useState<SyncResult | null>(null)
  const [done, setDone] = useState<SyncResult | null>(null)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, props])

  const loadBackups = useCallback(() => {
    if (status?.where !== 'server') return
    api.backups().then(setBackups).catch(() => setBackups([]))
  }, [api, status?.where])
  useEffect(loadBackups, [loadBackups])

  // Anything the preview was built from changing makes it stale.
  const reset = () => {
    setPreview(null)
    setDone(null)
    setReviewed(false)
    setError('')
  }

  const resolveCapture = async (): Promise<MondayCapture | undefined> => {
    if (source === 'monday') return undefined
    if (source === 'sample') return api.sample()
    if (!capture) throw new SyncRequestError('Pick a capture file first.', 400)
    return capture.data
  }

  const run = async (apply: boolean) => {
    setBusy(apply ? 'apply' : 'preview')
    setError('')
    try {
      const result = await api.run({
        apply,
        retire,
        approval: apply ? (preview?.retire?.approval ?? '') : '',
        capture: await resolveCapture(),
      })
      if (apply) {
        setDone(result)
        setPreview(null)
        loadBackups()
      } else {
        setPreview(result)
        setDone(null)
        setReviewed(false)
      }
    } catch (caught) {
      if (caught instanceof SyncRequestError && caught.status === 409 && caught.approval) {
        setError(`${caught.message} Preview again to get a fresh list.`)
        setPreview(null)
      } else {
        setError(messageOf(caught))
      }
    } finally {
      setBusy('')
    }
  }

  const testConnection = async () => {
    setBusy('test')
    setError('')
    try {
      setConnection(await api.testConnection())
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy('')
    }
  }

  const saveSchedule = async () => {
    setBusy('schedule')
    setError('')
    setScheduleNote('')
    try {
      const saved = await api.setSchedule(minutes)
      setSavedMinutes(saved.intervalMinutes)
      setScheduleNote(saved.intervalMinutes > 0 ? `Saved. The app checks monday every ${saved.intervalMinutes} minutes.` : 'Saved. Automatic pulls are off.')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy('')
    }
  }

  const saveCapture = async () => {
    setBusy('capture')
    setError('')
    try {
      const data = await api.captureLive()
      downloadText(`monday-capture-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(data, null, 2)}\n`, 'application/json')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy('')
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    reset()
    try {
      setCapture({ name: file.name, data: await api.readCaptureFile(file) })
      setSource('file')
    } catch (caught) {
      setCapture(null)
      setError(messageOf(caught))
    }
  }

  const restore = async (backup: BackupInfo) => {
    setBusy('restore')
    setError('')
    try {
      const dry = await api.restore(backup.key, false)
      const { summary } = dry
      ask({
        title: 'Restore this backup?',
        message: `This replaces the tracker with ${summary.projects} projects, ${summary.initiatives} initiatives and ${summary.pillars} pillars from ${summary.createdAt.slice(0, 16).replace('T', ' ')}. The current data is saved as its own backup first, so you can undo it.`,
        confirmLabel: 'Restore',
        onConfirm: () => {
          setBusy('restore')
          api
            .restore(backup.key, true)
            .then(() => {
              reset()
              loadBackups()
            })
            .catch((caught) => setError(messageOf(caught)))
            .finally(() => setBusy(''))
        },
      })
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy('')
    }
  }

  const plan = preview?.retire
  const needsReview = Boolean(preview && retire && plan && !plan.empty)
  const canApply = Boolean(preview) && !busy && (!needsReview || reviewed)

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="sync-dialog-title">
      <div className="modal sync-dialog">
        <div className="sync-dialog-head">
          <h2 id="sync-dialog-title">monday.com sync</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={props.onClose} disabled={Boolean(busy)}>
            <Icon.Close size={15} />
          </button>
        </div>
        <p className="sync-lede">
          monday.com is the source of truth for the project fields. Preview shows what would change and writes nothing.
        </p>

        {status?.mode === 'live' && !live && (
          <p className="login-error" role="status">
            monday.com is not reachable right now: {status.reachable && !status.reachable.ok ? status.reachable.message : ''} Pulling is off. Use the sample or a capture file.
          </p>
        )}
        {status?.mode === 'live' && (
          <div className="sync-row">
            <button type="button" className="btn btn-ghost sm" onClick={() => void testConnection()} disabled={Boolean(busy)}>
              Test connection
            </button>
            <button type="button" className="btn btn-ghost sm" onClick={() => void saveCapture()} disabled={Boolean(busy)}>
              <Icon.Download size={15} /> Save a capture file
            </button>
            {connection && (
              <span className={`sync-check ${connection.ok ? 'ok' : 'bad'}`} role="status">
                {connection.ok ? `Connected as ${connection.account}. Workspace: ${connection.workspace}.` : connection.message}
              </span>
            )}
          </div>
        )}

        {status?.mode === 'live' && status.where === 'server' && (
          <div className="sync-row sync-schedule">
            <label>
              Automatic pulls{' '}
              <select value={minutes} onChange={(event) => { setMinutes(Number(event.target.value)); setScheduleNote('') }} disabled={Boolean(busy)}>
                {intervalChoices(savedMinutes).map(([choice, label]) => (
                  <option key={choice} value={choice}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-ghost sm" onClick={() => void saveSchedule()} disabled={Boolean(busy) || minutes === savedMinutes}>
              {busy === 'schedule' ? 'Saving…' : 'Save'}
            </button>
            <span className="stat-sub">
              {scheduleNote ||
                'Applies to everyone. A pull only happens when monday changed, and it never removes records.'}
            </span>
          </div>
        )}

        <fieldset className="sync-source">
          <legend>Read from</legend>
          {live && (
            <label>
              <input type="radio" name="sync-source" checked={source === 'monday'} onChange={() => { setSource('monday'); reset() }} />
              monday.com (live)
            </label>
          )}
          <label>
            <input type="radio" name="sync-source" checked={source === 'sample'} onChange={() => { setSource('sample'); reset() }} />
            The sample data bundled with this build
          </label>
          <label>
            <input type="radio" name="sync-source" checked={source === 'file'} onChange={() => { setSource('file'); reset() }} />
            A capture file{capture ? `: ${capture.name}` : ''}
          </label>
          {source === 'file' && (
            <>
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void pickFile(event.target.files?.[0])} />
              <button type="button" className="btn btn-ghost sm" onClick={() => fileInput.current?.click()}>
                <Icon.Upload size={15} /> Choose file
              </button>
            </>
          )}
        </fieldset>

        <label className="sync-retire">
          <input type="checkbox" checked={retire} onChange={(event) => { setRetire(event.target.checked); reset() }} />
          <span>
            Also remove records monday.com does not have
            <small>Projects, initiatives and pillars with no monday link. A backup is saved first{status?.where === 'browser' ? ' (a file downloads)' : ''}.</small>
          </span>
        </label>

        <div className="sync-row">
          <button type="button" className="btn btn-ghost" onClick={() => void run(false)} disabled={Boolean(busy) || (source === 'file' && !capture)}>
            {busy === 'preview' ? 'Reading…' : 'Preview'}
          </button>
        </div>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        {preview && (
          <div className="sync-result" aria-live="polite">
            <h3>Preview</h3>
            <p className="stat-sub">
              {preview.capture
                ? `${preview.capture.boards} boards and ${preview.capture.items} items in the capture${preview.capture.capturedAt ? `, taken ${preview.capture.capturedAt.slice(0, 10)}` : ''}.`
                : `${preview.boardsFound} project boards read from monday.com.`}
            </p>
            <dl className="sync-counts">
              {SUMMARY_LABELS.map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{preview.summary[key] ?? 0}</dd>
                </div>
              ))}
            </dl>
            {preview.warnings.length > 0 && (
              <details>
                <summary>{preview.warnings.length} warning(s)</summary>
                <ul className="sync-list">
                  {preview.warnings.slice(0, 20).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                  {preview.warnings.length > 20 && <li>…and {preview.warnings.length - 20} more.</li>}
                </ul>
              </details>
            )}
            {preview.skipped.length > 0 && (
              <details>
                <summary>{preview.skipped.length} board(s) skipped</summary>
                <ul className="sync-list">
                  {preview.skipped.slice(0, 20).map((entry) => (
                    <li key={entry.board}>
                      {entry.board}: {entry.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {plan && (
              <div className="sync-retire-list">
                <h3>To remove</h3>
                {plan.empty ? (
                  <p className="stat-sub">Nothing to remove.</p>
                ) : (
                  <>
                    <p>
                      {plan.counts.projects} projects, {plan.counts.initiatives} initiatives, {plan.counts.pillars} pillars.
                    </p>
                    <ul className="sync-list">
                      {plan.projects.slice(0, 30).map((entry) => (
                        <li key={entry.id}>
                          {entry.title} <span className="stat-sub">({entry.reason})</span>
                        </li>
                      ))}
                      {plan.projects.length > 30 && <li>…and {plan.projects.length - 30} more projects.</li>}
                      {plan.initiatives.map((entry) => (
                        <li key={entry.id}>Initiative: {entry.title}</li>
                      ))}
                      {plan.pillars.map((entry) => (
                        <li key={entry.id}>Pillar: {entry.title}</li>
                      ))}
                    </ul>
                    {plan.adopted.length > 0 && (
                      <p className="stat-sub">
                        Issues, plan links and decision outcomes on {plan.adopted.length} of these move to the project with the same title.
                      </p>
                    )}
                    <label className="sync-retire">
                      <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                      <span>I read this list. Remove these records. Approval code: {plan.approval}</span>
                    </label>
                  </>
                )}
              </div>
            )}
            <div className="sync-row">
              <button type="button" className="btn btn-primary" onClick={() => void run(true)} disabled={!canApply}>
                {busy === 'apply' ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="sync-result ok" role="status">
            <h3>{done.written ? 'Sync applied' : 'Already up to date'}</h3>
            <p>
              {done.written
                ? `${done.summary.projectsCreated ?? 0} new, ${done.summary.projectsUpdated ?? 0} updated projects. ${done.logLines} change log lines.`
                : 'Nothing needed to change.'}
              {done.retire?.backupKey ? ` Backup: ${done.retire.backupKey}.` : ''}
            </p>
          </div>
        )}

        {backups.length > 0 && (
          <details className="sync-backups">
            <summary>Backups ({backups.length})</summary>
            <ul className="sync-list">
              {backups.slice(0, 10).map((backup) => (
                <li key={backup.key}>
                  <span>
                    {backup.createdAt ? ageLabel(backup.createdAt) : backup.key} <span className="stat-sub">{backup.reason}</span>
                  </span>
                  <button type="button" className="btn btn-ghost sm" onClick={() => void restore(backup)} disabled={Boolean(busy)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={props.onClose} disabled={Boolean(busy)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
