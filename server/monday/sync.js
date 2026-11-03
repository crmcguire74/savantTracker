// 🔄 One sync run: discover on monday, merge into the tracker, write back.
//
// Dry run is the default. A dry run reads everything, merges in memory and
// returns the report, but writes nothing. Pass `apply: true` to write.
//
// Retire (opt-in with `retire: true`) also removes tracker records monday does
// not have. It needs the approval code from a dry run, and it saves a full
// backup first. See retire.js for the rules.
//
// Writes use the same optimistic concurrency as the browser: the state
// document is written pinned to the version we read. If an editor saved in
// the meantime, we re-read, re-merge (the merge is idempotent) and try again.

import { discoverProjects } from './discover.js'
import { prependLog } from './merge.js'
import { buildReport, planSync, stamp } from './pipeline.js'

export const STATE_KEY = 'tracker.state'
export const LOG_KEY = 'tracker.log'
export const BACKUP_PREFIX = 'tracker.backup.'
const MAX_ATTEMPTS = 3

export class BackupError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackupError'
  }
}

const isConflict = (error) => error?.name === 'ConflictError'

async function readState(store) {
  const found = await store.readDocument(STATE_KEY)
  if (!found) {
    throw new Error('The tracker has no data yet. Open the app once so it seeds itself, then sync.')
  }
  return found.doc
}

async function attempt(store, discovered, run) {
  const { apply, retire, approval, backupKey, pillarMap, now } = run
  const stateDoc = await readState(store)
  const { result, plan, retiring } = planSync({
    state: stateDoc.value,
    discovered,
    pillarMap,
    now,
    retire,
    apply,
    approval,
    backupKey,
  })

  if (!apply || !result.changed) return { result, plan, written: false }

  const logDoc = (await store.readDocument(LOG_KEY))?.doc

  if (retiring) {
    // Save what we are about to change before changing it. Unconditional write: a retry after a
    // conflict replaces this copy with the newer state, which is the right one to keep.
    await store.writeDocument(backupKey, {
      createdAt: now,
      reason: 'before monday retire',
      approval: plan.approval,
      state: stateDoc.value,
      log: logDoc?.value?.entries ?? [],
    })
  }

  await store.writeDocument(STATE_KEY, result.state, stateDoc.version)

  if (result.logEntries.length > 0) {
    const entries = prependLog(logDoc?.value?.entries ?? [], result.logEntries)
    await store.writeDocument(LOG_KEY, { entries }, logDoc?.version ?? 0)
  }
  return { result, plan, written: true }
}

/**
 * Merges already-discovered monday data into the stored tracker. The shared back half of a live
 * pull and an uploaded capture.
 */
export async function applyDiscovered({
  store,
  discovered,
  apply = false,
  retire = false,
  approval = '',
  pillarMap = {},
  now = new Date().toISOString(),
}) {
  const backupKey = `${BACKUP_PREFIX}${stamp(now)}`
  const run = { apply, retire, approval, backupKey, pillarMap, now }

  const go = async (tries) => {
    try {
      return await attempt(store, discovered, run)
    } catch (error) {
      if (isConflict(error) && tries < MAX_ATTEMPTS) return go(tries + 1)
      throw error
    }
  }

  const { result, plan, written } = await go(1)
  return buildReport({ apply, written, discovered, result, plan, backupKey })
}

/** Live read from monday, then applyDiscovered. */
export async function runMondaySync({
  store,
  client,
  workspaceId,
  apply = false,
  retire = false,
  approval = '',
  pillarMap = {},
  projectGroupTitle,
  ignoreTitles,
  now = new Date().toISOString(),
}) {
  const discovered = await discoverProjects(client, { workspaceId, projectGroupTitle, ignoreTitles })
  return applyDiscovered({ store, discovered, apply, retire, approval, pillarMap, now })
}

/** Saved backups, newest first. */
export async function listBackups(store) {
  const docs = await store.listDocuments(BACKUP_PREFIX)
  return docs
    .map((doc) => ({ key: doc.key, createdAt: doc.value?.createdAt ?? '', reason: doc.value?.reason ?? '' }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

/**
 * Puts a backup back. Dry run by default. Before it overwrites anything it
 * saves the current state as its own backup, so a restore can be undone too.
 */
export async function restoreBackup({ store, key, apply = false, now = new Date().toISOString() }) {
  if (!key.startsWith(BACKUP_PREFIX)) throw new BackupError(`Backup keys start with "${BACKUP_PREFIX}".`)
  const backup = await store.readDocument(key)
  if (!backup) throw new BackupError(`No backup named ${key}.`)

  const { state, log = [], createdAt = '' } = backup.doc.value
  const summary = {
    key,
    createdAt,
    pillars: state.pillars.length,
    initiatives: state.initiatives.length,
    projects: state.projects.length,
    logEntries: log.length,
  }
  if (!apply) return { mode: 'dry-run', written: false, summary, safetyKey: null }

  const current = await readState(store)
  const currentLog = (await store.readDocument(LOG_KEY))?.doc
  const safetyKey = `${BACKUP_PREFIX}${stamp(now)}-before-restore`
  await store.writeDocument(safetyKey, {
    createdAt: now,
    reason: `before restoring ${key}`,
    state: current.value,
    log: currentLog?.value?.entries ?? [],
  })
  await store.writeDocument(STATE_KEY, state, current.version)
  await store.writeDocument(LOG_KEY, { entries: log }, currentLog?.version ?? 0)
  return { mode: 'apply', written: true, summary, safetyKey }
}

/** Reads the sync settings from the environment, or returns null when not configured. */
export function syncFromEnv(store, env = process.env, makeClient) {
  if (!env.MONDAY_API_TOKEN || !env.MONDAY_WORKSPACE_ID) return null
  const pillarMap = env.MONDAY_PILLAR_MAP ? JSON.parse(env.MONDAY_PILLAR_MAP) : {}
  return ({ apply = false, retire = false, approval = '' } = {}) =>
    runMondaySync({
      store,
      client: makeClient(),
      workspaceId: env.MONDAY_WORKSPACE_ID,
      apply,
      retire,
      approval,
      pillarMap,
      projectGroupTitle: env.MONDAY_PROJECT_GROUP || undefined,
      ignoreTitles:
        env.MONDAY_IGNORE_TITLES === undefined
          ? undefined
          : env.MONDAY_IGNORE_TITLES.split(',').map((title) => title.trim()).filter(Boolean),
    })
}
