// 🧰 The sync service: one object the API, the scheduler and the CLI all use.
//
// Two ways in, same rules after that:
//   live    the monday token is set. The service reads monday itself.
//   upload  no token needed. An admin supplies a capture file (see capture.js).
//
// The service never reads process.env directly, so tests pass their own env.

import { captureWorkspace, discoverFromCapture, fetchBoardStamps, DEFAULT_IGNORED_TITLES } from './discover.js'
import { validateCapture, describeCapture } from './capture.js'
import { MondayError } from './client.js'
import { applyDiscovered, listBackups, restoreBackup } from './sync.js'

export const SYNC_STATUS_KEY = 'tracker.sync'
/** Admin-set schedule. Stored in the app so an admin can change it without touching Azure settings. */
export const SYNC_CONFIG_KEY = 'tracker.syncconfig'
export const MIN_INTERVAL_MINUTES = 5
export const MAX_INTERVAL_MINUTES = 1440
/** Even when monday shows no change, do a full read at least this often as a safety net. */
export const FULL_PULL_MINUTES = 60

export class ScheduleError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ScheduleError'
  }
}

export class NotConfiguredError extends Error {
  constructor(message = 'monday is not connected. Set MONDAY_API_TOKEN and MONDAY_WORKSPACE_ID, or upload a capture file.') {
    super(message)
    this.name = 'NotConfiguredError'
  }
}

const list = (value) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

/** Reads the sync settings. Bad JSON in MONDAY_PILLAR_MAP throws here, at start-up, not at 3 a.m. */
export function readConfig(env) {
  const intervalMinutes = Number(env.MONDAY_SYNC_INTERVAL_MINUTES || 0)
  // App Service leaves a Key Vault reference as literal text when it cannot resolve it.
  const unresolved = /^@Microsoft\.KeyVault/i.test(env.MONDAY_API_TOKEN || '')
  return {
    token: Boolean(env.MONDAY_API_TOKEN) && !unresolved,
    tokenUnresolved: unresolved,
    workspaceId: env.MONDAY_WORKSPACE_ID || '',
    pillarMap: env.MONDAY_PILLAR_MAP ? JSON.parse(env.MONDAY_PILLAR_MAP) : {},
    projectGroupTitle: env.MONDAY_PROJECT_GROUP || undefined,
    ignoreTitles: env.MONDAY_IGNORE_TITLES === undefined ? [...DEFAULT_IGNORED_TITLES] : list(env.MONDAY_IGNORE_TITLES),
    intervalMinutes: Number.isFinite(intervalMinutes) && intervalMinutes >= 5 ? intervalMinutes : 0,
  }
}

const describeFailure = (error) => {
  if (error?.name === 'MondayError') {
    if (error.status === 401 || error.status === 403) {
      return { kind: 'auth', message: 'monday rejected the token. Check it is current and the account is still active.' }
    }
    if (/Cannot reach/i.test(error.message)) {
      return { kind: 'network', message: `${error.message} Check the app can reach api.monday.com.` }
    }
    return { kind: 'monday', message: error.message }
  }
  return { kind: 'error', message: error?.message ?? String(error) }
}

/**
 * @param {{ store: object, env?: object, makeClient?: () => { query: Function }, clock?: () => string }} args
 */
export function createSyncService({ store, env = process.env, makeClient, clock = () => new Date().toISOString() }) {
  const config = readConfig(env)
  const live = config.token && Boolean(config.workspaceId)
  const problem = config.tokenUnresolved
    ? 'MONDAY_API_TOKEN is a Key Vault reference that did not resolve. Check the secret exists and the app identity has Key Vault Secrets User.'
    : ''
  const client = () => {
    if (!live) throw new NotConfiguredError()
    return makeClient()
  }

  // The Admin card asks for status often. Probe monday at most once a minute.
  const PROBE_TTL_MS = 60_000
  let probed = { at: 0, result: null }

  const readLast = async () => (await store.readDocument(SYNC_STATUS_KEY))?.doc?.value ?? null

  // Bookkeeping must never break a sync that already succeeded.
  const remember = async (entry) => {
    try {
      const current = (await store.readDocument(SYNC_STATUS_KEY))?.doc
      await store.writeDocument(SYNC_STATUS_KEY, entry, current?.version ?? 0)
    } catch (error) {
      console.error('could not save sync status', error)
    }
  }

  const options = (request) => ({
    store,
    apply: request.apply === true,
    retire: request.retire === true,
    approval: typeof request.approval === 'string' ? request.approval : '',
    pillarMap: config.pillarMap,
    now: clock(),
  })

  const readSchedule = async () => (await store.readDocument(SYNC_CONFIG_KEY))?.doc?.value ?? null

  /** Minutes between scheduled pulls. The app setting wins over MONDAY_SYNC_INTERVAL_MINUTES. */
  const currentInterval = async () => {
    const stored = (await readSchedule())?.intervalMinutes
    return Number.isInteger(stored) ? stored : config.intervalMinutes
  }

  // fingerprint: monday's state when a full read began. fullAt: when that read happened. A skipped
  // check keeps both and only moves `at`, so "monday data as of" stays honest.
  const record = (request, source, trigger, report, error, extra = {}) => {
    const base = { at: clock(), source, trigger, ok: !error }
    return error
      ? { ...base, mode: request.apply ? 'apply' : 'dry-run', error: describeFailure(error).message }
      : { ...base, mode: report.mode, written: report.written, summary: report.summary, warnings: report.warnings.length, retired: report.retire?.counts ?? null, ...extra }
  }

  /** The fingerprint, or null when it cannot be read. A failure here never blocks the real pull. */
  const fingerprintOf = async () => {
    try {
      return await fetchBoardStamps(client(), config.workspaceId)
    } catch {
      return null
    }
  }

  const minutesSince = (iso) => (Date.parse(clock()) - Date.parse(iso)) / 60_000

  /** Runs a pull (live) or a replay (capture). Applied runs and failures are remembered. */
  async function run(request = {}) {
    const trigger = request.trigger ?? 'manual'
    const source = request.capture ? 'upload' : 'monday'
    try {
      // Live pulls note monday's fingerprint first. A scheduled pull stops here when nothing changed.
      const fingerprint = live && !request.capture && (request.apply === true || request.skipIfUnchanged) ? await fingerprintOf() : null
      if (request.skipIfUnchanged && fingerprint) {
        const last = await readLast()
        if (last?.ok && last.fingerprint === fingerprint && last.fullAt && minutesSince(last.fullAt) < FULL_PULL_MINUTES) {
          await remember({ ...last, at: clock(), trigger, checkedUnchanged: true })
          return { unchanged: true, source, mode: 'unchanged', written: false, reason: 'monday has not changed since the last pull' }
        }
      }
      const capture = request.capture ? validateCapture(request.capture) : await captureWorkspace(client(), { workspaceId: config.workspaceId })
      const discovered = discoverFromCapture(capture, { projectGroupTitle: config.projectGroupTitle, ignoreTitles: config.ignoreTitles })
      const report = await applyDiscovered({ ...options(request), discovered })
      if (request.apply === true) {
        const extra = source === 'monday' && fingerprint ? { fingerprint, fullAt: clock(), checkedUnchanged: false } : { fullAt: clock(), checkedUnchanged: false }
        await remember(record(request, source, trigger, report, null, extra))
      }
      return { ...report, source, capture: describeCapture(capture) }
    } catch (error) {
      if (request.apply === true || trigger === 'schedule') await remember(record(request, source, trigger, null, error))
      throw error
    }
  }

  return {
    config,
    live,
    run,
    currentInterval,
    lastRun: readLast,

    /** minutes: 0 turns the timer off, otherwise 5 to 1440. Saved in the app, so it holds across restarts. */
    async setSchedule(minutes) {
      if (!Number.isInteger(minutes) || (minutes !== 0 && (minutes < MIN_INTERVAL_MINUTES || minutes > MAX_INTERVAL_MINUTES))) {
        throw new ScheduleError(`Interval must be 0 (off) or a whole number from ${MIN_INTERVAL_MINUTES} to ${MAX_INTERVAL_MINUTES} minutes.`)
      }
      const current = (await store.readDocument(SYNC_CONFIG_KEY))?.doc
      await store.writeDocument(SYNC_CONFIG_KEY, { intervalMinutes: minutes, updatedAt: clock() }, current?.version ?? 0)
      return { intervalMinutes: minutes, intervalSource: 'app' }
    },

    async status() {
      let reachable = null
      if (live) {
        const nowMs = Date.parse(clock())
        if (!probed.result || nowMs - probed.at >= PROBE_TTL_MS) probed = { at: nowMs, result: await this.testConnection() }
        reachable = probed.result
      }
      return {
        reachable,
        mode: live ? 'live' : 'test',
        tokenSet: config.token,
        workspaceId: config.workspaceId,
        intervalMinutes: await currentInterval(),
        intervalSource: Number.isInteger((await readSchedule())?.intervalMinutes) ? 'app' : config.intervalMinutes > 0 ? 'env' : 'default',
        problem,
        last: await readLast(),
      }
    },

    /** Raw capture of the live workspace, for saving as a test file. */
    capture: () => captureWorkspace(client(), { workspaceId: config.workspaceId, now: clock() }),

    /** Cheap check that the token works and can see the workspace. Never throws for monday failures. */
    async testConnection() {
      if (problem) return { ok: false, kind: 'keyvault', message: problem }
      if (!live) throw new NotConfiguredError()
      try {
        const data = await client().query(
          'query ($ids: [ID!]) { me { name } workspaces(ids: $ids) { id name } }',
          { ids: [config.workspaceId] },
        )
        const workspace = data.workspaces?.[0]
        if (!workspace) {
          return { ok: false, kind: 'workspace', message: `Signed in as ${data.me?.name ?? 'the account'}, but workspace ${config.workspaceId} is not visible. Add the account to that workspace.` }
        }
        return { ok: true, account: data.me?.name ?? '', workspace: workspace.name }
      } catch (error) {
        const { kind, message } = describeFailure(error)
        return { ok: false, kind, message }
      }
    },

    listBackups: () => listBackups(store),
    restoreBackup: (request) => restoreBackup({ store, key: request.key, apply: request.apply === true, now: clock() }),
  }
}

export { MondayError }
