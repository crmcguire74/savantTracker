// 🗂️ Repository: the tracker's vocabulary (state, log, settings) expressed in
// terms of the storage contract. Components call these methods; they never
// touch document keys, versions, or adapters.
//
// Versions are tracked here so optimistic concurrency survives the move to a
// shared backend. Against IndexedDB a conflict is nearly impossible (one
// browser, one writer). Against a service it is routine, and the same code
// path handles it.

import {
  isVersionConflict,
  type StorageProxy,
  type Unsubscribe,
  type Versioned,
} from '../storage'
import { normalizePolicy, type AccessPolicy } from '../auth/access'
import { LOG_LIMIT } from '../constants'
import type { LogEntry, Settings, TrackerState } from '../types'
import { APP_FILE_ID, createAppFile, parseAppFile, upgradeState, type AppFile } from './appfile'
import rawSnapshot from './snapshot.json'

export const DOC_KEYS = {
  state: 'tracker.state',
  log: 'tracker.log',
  settings: 'tracker.settings',
  /** Who sees which views and reports. Admin-only writes, enforced by the API. */
  access: 'tracker.access',
} as const

export interface Bootstrap {
  state: TrackerState
  log: LogEntry[]
  settings: Settings
  /** True when the local store was empty and the bundled snapshot was written. */
  seeded: boolean
  warnings: string[]
}

export interface LogDocument {
  entries: LogEntry[]
}

/** The bundled migration snapshot, parsed through the same reader as an import. */
export function bundledSnapshot(): AppFile {
  return parseAppFile(rawSnapshot).file
}

export class TrackerRepository {
  #storage: StorageProxy
  #versions = new Map<string, number>()

  constructor(storage: StorageProxy) {
    this.#storage = storage
  }

  version(key: string): number | undefined {
    return this.#versions.get(key)
  }

  #remember<T>(doc: Versioned<T> | null, key: string): T | null {
    if (!doc) {
      this.#versions.delete(key)
      return null
    }
    this.#versions.set(key, doc.version)
    return doc.value
  }

  /**
   * Loads everything, seeding from the bundled snapshot on a cold start.
   * Idempotent: a second call on a populated store changes nothing.
   */
  async bootstrap(): Promise<Bootstrap> {
    const warnings: string[] = []
    let state = this.#remember(await this.#storage.get<TrackerState>(DOC_KEYS.state), DOC_KEYS.state)
    let seeded = false

    if (!state) {
      const parsed = parseAppFile(rawSnapshot)
      warnings.push(...parsed.warnings)
      await this.replaceAll(parsed.file)
      seeded = true
      state = this.#remember(await this.#storage.get<TrackerState>(DOC_KEYS.state), DOC_KEYS.state)
    }

    const logDoc = this.#remember(await this.#storage.get<LogDocument>(DOC_KEYS.log), DOC_KEYS.log)
    const settings = this.#remember(await this.#storage.get<Settings>(DOC_KEYS.settings), DOC_KEYS.settings)

    return {
      state: state ? upgradeState(state) : { quarter: '', pillars: [], initiatives: [], projects: [] },
      log: logDoc?.entries ?? [],
      settings: settings ?? { staleThresholdDays: 30 },
      seeded,
      warnings,
    }
  }

  async readState(): Promise<TrackerState | null> {
    const state = this.#remember(await this.#storage.get<TrackerState>(DOC_KEYS.state), DOC_KEYS.state)
    return state && upgradeState(state)
  }

  /**
   * Writes state, pinned to the version last read. On conflict the caller
   * gets `null` plus the winning value so it can decide, which is what drives
   * the conflict dialog.
   */
  async saveState(next: TrackerState): Promise<{ ok: true } | { ok: false; theirs: TrackerState | null }> {
    try {
      const written = await this.#storage.put(DOC_KEYS.state, next, {
        ifVersion: this.#versions.get(DOC_KEYS.state),
      })
      this.#versions.set(DOC_KEYS.state, written.version)
      return { ok: true }
    } catch (error) {
      if (!isVersionConflict(error)) throw error
      const theirs = await this.readState()
      return { ok: false, theirs }
    }
  }

  async appendLog(entry: LogEntry): Promise<LogEntry[]> {
    const current = this.#remember(await this.#storage.get<LogDocument>(DOC_KEYS.log), DOC_KEYS.log)
    const entries = [entry, ...(current?.entries ?? [])].slice(0, LOG_LIMIT)
    const written = await this.#storage.put<LogDocument>(DOC_KEYS.log, { entries })
    this.#versions.set(DOC_KEYS.log, written.version)
    return entries
  }

  async saveSettings(settings: Settings): Promise<void> {
    const written = await this.#storage.put(DOC_KEYS.settings, settings)
    this.#versions.set(DOC_KEYS.settings, written.version)
  }

  /** The stored policy, upgraded to the current catalog; defaults when none was ever saved. */
  async readAccess(): Promise<AccessPolicy> {
    return normalizePolicy(this.#remember(await this.#storage.get<AccessPolicy>(DOC_KEYS.access), DOC_KEYS.access))
  }

  /** Last write wins: access is edited by a handful of admins, rarely at once. */
  async saveAccess(policy: AccessPolicy): Promise<void> {
    const written = await this.#storage.put(DOC_KEYS.access, policy)
    this.#versions.set(DOC_KEYS.access, written.version)
  }

  subscribeAccess(listener: (policy: AccessPolicy) => void): Unsubscribe {
    return this.#storage.subscribe<AccessPolicy>(DOC_KEYS.access, (doc) => {
      listener(normalizePolicy(this.#remember(doc, DOC_KEYS.access)))
    })
  }

  subscribeState(listener: (state: TrackerState | null) => void): Unsubscribe {
    return this.#storage.subscribe<TrackerState>(DOC_KEYS.state, (doc) => {
      const state = this.#remember(doc, DOC_KEYS.state)
      listener(state && upgradeState(state))
    })
  }

  subscribeLog(listener: (entries: LogEntry[]) => void): Unsubscribe {
    return this.#storage.subscribe<LogDocument>(DOC_KEYS.log, (doc) => {
      listener(this.#remember(doc, DOC_KEYS.log)?.entries ?? [])
    })
  }

  subscribeSettings(listener: (settings: Settings) => void): Unsubscribe {
    return this.#storage.subscribe<Settings>(DOC_KEYS.settings, (doc) => {
      const value = this.#remember(doc, DOC_KEYS.settings)
      if (value) listener(value)
    })
  }

  /** Everything currently stored, as a file ready to download. */
  async exportAll(source = 'app-export'): Promise<AppFile> {
    const state = (await this.readState()) ?? { quarter: '', pillars: [], initiatives: [], projects: [] }
    const log = this.#remember(await this.#storage.get<LogDocument>(DOC_KEYS.log), DOC_KEYS.log)?.entries ?? []
    const settings =
      this.#remember(await this.#storage.get<Settings>(DOC_KEYS.settings), DOC_KEYS.settings) ??
      ({ staleThresholdDays: 30 } as Settings)
    return createAppFile(state, log, settings, source)
  }

  /** Replaces all three documents. Used by import, seeding, and reset. */
  async replaceAll(file: AppFile): Promise<void> {
    const state = await this.#storage.put(DOC_KEYS.state, file.state)
    const log = await this.#storage.put<LogDocument>(DOC_KEYS.log, { entries: file.log })
    const settings = await this.#storage.put(DOC_KEYS.settings, file.settings)
    this.#versions.set(DOC_KEYS.state, state.version)
    this.#versions.set(DOC_KEYS.log, log.version)
    this.#versions.set(DOC_KEYS.settings, settings.version)
  }

  async resetToSnapshot(): Promise<AppFile> {
    const file = bundledSnapshot()
    await this.replaceAll(file)
    return file
  }
}

export { APP_FILE_ID }
