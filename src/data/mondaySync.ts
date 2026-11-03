// 🔄 The browser's handle on the monday sync.
//
// Two places the sync can run, same screen, same rules:
//
//   server   The tracker is backed by the API (Azure, or the local server). The API reads monday
//            with its own token, or replays an uploaded capture file, and writes the result.
//   browser  Browser-only build (IndexedDB). There is no token and no server, so a capture file
//            (or the bundled sample) is replayed right here through the same pure pipeline the
//            server uses. Retire downloads a backup file first; undo it with Import data.
//
// Nothing here talks to React. The hook wires it up (src/hooks/useTracker.ts).

import { describeCapture, validateCapture, type MondayCapture } from '../../server/monday/capture'
import { discoverFromCapture } from '../../server/monday/discover'
import { prependLog } from '../../server/monday/merge'
import { buildReport, planSync, stamp, type SyncReport } from '../../server/monday/pipeline'
import { readFileAsText } from '../lib/file-io'
import { createAppFile, type AppFile } from './appfile'
import { writeMarker } from './dataset'
import type { TrackerRepository } from './repository'

export type SyncWhere = 'server' | 'browser'

export interface SyncLast {
  at: string
  source: string
  trigger?: string
  ok: boolean
  mode?: string
  written?: boolean
  summary?: Record<string, number>
  warnings?: number
  error?: string
  /** A scheduled check that found monday unchanged. Only `at` moves. */
  checkedUnchanged?: boolean
  /** When the last full read of monday happened. */
  fullAt?: string
}

export interface SyncStatus {
  where: SyncWhere
  /** live: a monday token is set on the server. test: replaying capture files. */
  mode: 'live' | 'test'
  tokenSet: boolean
  workspaceId: string
  /** Minutes between automatic pulls. 0 is off. */
  intervalMinutes: number
  /** Where that number came from: set in the app, set in Azure, or never set. */
  intervalSource?: 'app' | 'env' | 'default'
  /** Why live mode is off even though a token was configured. Empty when nothing is wrong. */
  problem?: string
  /** Live mode only: the latest connection probe (cached for a minute). null when not live. */
  reachable?: ConnectionCheck | null
  last: SyncLast | null
}

export interface SyncRunRequest {
  apply?: boolean
  retire?: boolean
  approval?: string
  /** Replay this capture instead of reading monday. */
  capture?: MondayCapture
}

export interface SyncResult extends SyncReport {
  source: 'monday' | 'upload'
  capture?: ReturnType<typeof describeCapture>
}

export type ConnectionCheck = { ok: true; account: string; workspace: string } | { ok: false; kind: string; message: string }

export interface BackupInfo {
  key: string
  createdAt: string
  reason: string
}

export interface RestoreResult {
  mode: 'apply' | 'dry-run'
  written: boolean
  summary: { key: string; createdAt: string; pillars: number; initiatives: number; projects: number; logEntries: number }
  safetyKey: string | null
}

export class SyncRequestError extends Error {
  readonly status: number
  /** Set on a 409 that asks for the retire approval code. */
  readonly approval?: string
  constructor(message: string, status = 400, approval?: string) {
    super(message)
    this.name = 'SyncRequestError'
    this.status = status
    this.approval = approval
  }
}

export interface MondaySyncApi {
  status(): Promise<SyncStatus>
  testConnection(): Promise<ConnectionCheck>
  run(request: SyncRunRequest): Promise<SyncResult>
  /** Raw capture of live monday, for saving as a test file. Server with a token only. */
  captureLive(): Promise<MondayCapture>
  /** The capture bundled with this build, for trying the sync with no token and no file. */
  sample(): Promise<MondayCapture>
  /** Reads a picked capture file. Throws SyncRequestError with a plain reason when it is not one. */
  readCaptureFile(file: File): Promise<MondayCapture>
  backups(): Promise<BackupInfo[]>
  restore(key: string, apply: boolean): Promise<RestoreResult>
  /** Admin: pull every N minutes (0 turns it off, otherwise 5 to 1440). Server only. */
  setSchedule(minutes: number): Promise<{ intervalMinutes: number }>
}

export interface MondaySyncDeps {
  repository: Pick<TrackerRepository, 'exportAll' | 'replaceAll'>
  driver: () => string
  isAdmin: () => boolean
  apiBase?: string
  headers?: () => Record<string, string>
  fetchImpl?: typeof fetch
  /** Saves a backup file in the browser and returns its name. */
  download: (file: AppFile, tag: string) => string
  clock?: () => string
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

const LAST_KEY = 'savant-tracker:sync-last'
const BROWSER_SOURCE = 'monday-capture-upload'

export function createMondaySync(deps: MondaySyncDeps): MondaySyncApi {
  const clock = deps.clock ?? (() => new Date().toISOString())
  const apiBase = (deps.apiBase ?? '/api').replace(/\/$/, '')
  const where = (): SyncWhere => (deps.driver() === 'rest' ? 'server' : 'browser')

  const store = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
    if (deps.storage !== undefined) return deps.storage
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      return null
    }
  }
  const readLast = (): SyncLast | null => {
    try {
      const raw = store()?.getItem(LAST_KEY)
      return raw ? (JSON.parse(raw) as SyncLast) : null
    } catch {
      return null
    }
  }
  const writeLast = (last: SyncLast): void => {
    try {
      store()?.setItem(LAST_KEY, JSON.stringify(last))
    } catch {
      // Cosmetic. A browser that refuses storage just shows no last run.
    }
  }

  async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
    const impl = deps.fetchImpl ?? fetch.bind(globalThis)
    let response: Response
    try {
      response = await impl(`${apiBase}/admin/sync/${path}`, {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(deps.headers?.() ?? {}) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    } catch {
      throw new SyncRequestError('Cannot reach the tracker server.', 0)
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string; approval?: string }
    if (!response.ok) {
      throw new SyncRequestError(body.error ?? `The server answered ${response.status}.`, response.status, body.approval)
    }
    return body as T
  }

  const requireAdmin = (): void => {
    if (!deps.isAdmin()) throw new SyncRequestError('Only a tracker admin can run the monday sync.', 403)
  }

  const checkCapture = (capture: unknown): MondayCapture => {
    try {
      return validateCapture(capture)
    } catch (error) {
      throw new SyncRequestError(error instanceof Error ? error.message : 'That is not a capture file.', 400)
    }
  }

  async function runInBrowser(request: SyncRunRequest): Promise<SyncResult> {
    requireAdmin()
    if (!request.capture) {
      throw new SyncRequestError('This build has no monday token. Pick a capture file, or use the sample data.', 400)
    }
    const capture = checkCapture(request.capture)
    const discovered = discoverFromCapture(capture)
    const apply = request.apply === true
    const now = clock()
    const before = await deps.repository.exportAll('app-export')
    const backupKey = `browser-${stamp(now)}`

    let outcome: ReturnType<typeof planSync>
    try {
      outcome = planSync({
        state: before.state,
        discovered,
        now,
        retire: request.retire === true,
        apply,
        approval: request.approval ?? '',
        backupKey,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'RetireApprovalError') {
        throw new SyncRequestError(error.message, 409, (error as Error & { expected?: string }).expected)
      }
      throw error
    }

    const written = apply && outcome.result.changed
    let backupName: string | null = null
    if (written) {
      // Save what is about to change, before changing it.
      if (outcome.retiring) backupName = deps.download(before, 'backup-before-monday-retire')
      const next: AppFile = {
        ...createAppFile(
          outcome.result.state,
          prependLog(before.log, outcome.result.logEntries),
          before.settings,
          BROWSER_SOURCE,
        ),
        exportedAt: now,
      }
      await deps.repository.replaceAll(next)
      if (deps.driver() === 'indexeddb') writeMarker({ source: next.source, exportedAt: next.exportedAt })
    }

    const report = buildReport({ apply, written, discovered, result: outcome.result, plan: outcome.plan, backupKey: backupName ?? backupKey })
    if (written) {
      writeLast({ at: now, source: 'upload', trigger: 'manual', ok: true, mode: report.mode, written: true, summary: report.summary, warnings: report.warnings.length })
    }
    return { ...report, source: 'upload', capture: describeCapture(capture) }
  }

  return {
    async status() {
      if (where() === 'server') {
        const status = await call<Omit<SyncStatus, 'where'>>('status')
        return { ...status, where: 'server' }
      }
      return { where: 'browser', mode: 'test', tokenSet: false, workspaceId: '', intervalMinutes: 0, last: readLast() }
    },

    async testConnection() {
      if (where() !== 'server') {
        return { ok: false, kind: 'browser', message: 'This build runs in the browser only. It has no connection to monday.' }
      }
      try {
        return await call<ConnectionCheck>('test', { body: {} })
      } catch (error) {
        if (error instanceof SyncRequestError && error.status === 501) {
          return { ok: false, kind: 'not-configured', message: 'No monday token is set on the server yet.' }
        }
        throw error
      }
    },

    async run(request) {
      if (where() === 'browser') return runInBrowser(request)
      const { capture, ...rest } = request
      return capture
        ? call<SyncResult>('upload', { body: { ...rest, capture: checkCapture(capture) } })
        : call<SyncResult>('monday', { body: rest })
    },

    async captureLive() {
      if (where() !== 'server') throw new SyncRequestError('Saving a capture needs the server and a monday token.', 400)
      return call<MondayCapture>('capture', { body: {} })
    },

    async sample() {
      const module = (await import('./monday-capture.sample.json')) as { default: unknown }
      return checkCapture(module.default)
    },

    async readCaptureFile(file) {
      let parsed: unknown
      try {
        parsed = JSON.parse(await readFileAsText(file))
      } catch {
        throw new SyncRequestError('That file is not valid JSON.', 400)
      }
      return checkCapture(parsed)
    },

    async backups() {
      return where() === 'server' ? call<BackupInfo[]>('backups') : []
    },

    async setSchedule(minutes) {
      if (where() !== 'server') throw new SyncRequestError('Automatic pulls need the server and a monday token.', 400)
      return call<{ intervalMinutes: number }>('schedule', { body: { intervalMinutes: minutes } })
    },

    async restore(key, apply) {
      if (where() !== 'server') {
        throw new SyncRequestError('Backups in this build are files. Use Import data with the backup file to undo.', 400)
      }
      return call<RestoreResult>('restore', { body: { key, apply } })
    },
  }
}
