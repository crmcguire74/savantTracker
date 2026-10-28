// 🧪 In-memory document store with the same surface as server/cosmos.js.
// Used by the server tests and by `npm run start:local` when you want the
// API running without an Azure subscription attached.

export class ConflictError extends Error {
  constructor(currentVersion) {
    super('Version conflict')
    this.name = 'ConflictError'
    this.currentVersion = currentVersion
  }
}

export function createMemoryStore(seed = []) {
  const documents = new Map()
  seed.forEach((doc) => documents.set(doc.key, doc))

  return {
    ConflictError,

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
      return structuredClone(record)
    },

    async deleteDocument(key, ifVersion) {
      const existing = documents.get(key)
      if (!existing) return
      if (ifVersion !== undefined && ifVersion !== existing.version) {
        throw new ConflictError(existing.version)
      }
      documents.delete(key)
    },
  }
}
