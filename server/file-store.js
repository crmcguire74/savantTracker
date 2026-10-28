// 🗃️ File-backed document store. Same surface as server/cosmos.js.
//
// This is what makes a local run genuinely shared. The browser's IndexedDB
// lives in one person's browser, so two people hitting the same dev server
// still see two different datasets. This store keeps the documents in one
// JSON file on the machine running the server, so everybody pointed at that
// machine sees the same tracker and edits land in one place.
//
// Not a production store. One process, one file, no replication. It exists
// so a demo on a laptop behaves like the Azure deployment will.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export class ConflictError extends Error {
  constructor(currentVersion) {
    super('Version conflict')
    this.name = 'ConflictError'
    this.currentVersion = currentVersion
  }
}

export function createFileStore(filePath) {
  let documents = new Map()

  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
      Object.values(parsed.documents ?? {}).forEach((doc) => documents.set(doc.key, doc))
    } catch (error) {
      throw new Error(`${filePath} exists but could not be read as JSON: ${error.message}`)
    }
  } else {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  // Writes are serialized through one promise chain. Two people saving at the
  // same moment then queue rather than racing each other onto disk.
  let queue = Promise.resolve()
  const serialize = (task) => {
    queue = queue.then(task, task)
    return queue
  }

  // Write to a temporary file and rename. A crash mid-write leaves the old
  // file intact instead of a half-written one.
  const flush = () => {
    const payload = { savedAt: new Date().toISOString(), documents: Object.fromEntries(documents) }
    const temporary = `${filePath}.tmp`
    writeFileSync(temporary, JSON.stringify(payload, null, 2))
    renameSync(temporary, filePath)
  }

  return {
    ConflictError,
    filePath,

    async ping() {
      return true
    },

    async readDocument(key) {
      const doc = documents.get(key)
      return doc ? { doc: structuredClone(doc), etag: `"${doc.version}"` } : null
    },

    async listDocuments(prefix = '') {
      return [...documents.values()]
        .filter((doc) => doc.key.startsWith(prefix))
        .map((doc) => structuredClone(doc))
    },

    async writeDocument(key, value, ifVersion) {
      return serialize(async () => {
        const currentVersion = documents.get(key)?.version ?? 0
        if (ifVersion !== undefined && ifVersion !== currentVersion) {
          throw new ConflictError(currentVersion)
        }
        const record = {
          key,
          value: structuredClone(value),
          version: currentVersion + 1,
          updatedAt: new Date().toISOString(),
        }
        documents.set(key, record)
        flush()
        return structuredClone(record)
      })
    },

    async deleteDocument(key, ifVersion) {
      return serialize(async () => {
        const existing = documents.get(key)
        if (!existing) return
        if (ifVersion !== undefined && ifVersion !== existing.version) {
          throw new ConflictError(existing.version)
        }
        documents.delete(key)
        flush()
      })
    },

    /** Loads an app file, used to put the starting data in place. */
    async seed(appFile) {
      const state = appFile.state ?? appFile
      const log = Array.isArray(appFile.log) ? appFile.log : (appFile.log?.entries ?? [])
      const settings = appFile.settings ?? { staleThresholdDays: 30 }
      await this.writeDocument('tracker/state', state)
      await this.writeDocument('tracker/log', { entries: log })
      await this.writeDocument('tracker/settings', settings)
      return state.projects?.length ?? 0
    },

    get size() {
      return documents.size
    },
  }
}
