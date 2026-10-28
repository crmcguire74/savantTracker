// 🗄️ Cosmos DB access. No keys anywhere.
//
// DefaultAzureCredential picks up the App Service system-assigned managed
// identity in Azure and your `az login` session on a laptop. The Cosmos
// account has key-based auth disabled, so a leaked connection string is not
// a thing that exists to leak.
//
// The stored document mirrors the app's storage contract exactly:
//   { id, key, value, version, updatedAt }
// `version` is our own counter, which the browser uses for optimistic
// concurrency. Cosmos's own `_etag` is what makes the check atomic: the
// replace only lands if the document has not moved since we read it.

import { CosmosClient } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'

const DATABASE_ID = process.env.COSMOS_DATABASE || 'tracker'
const CONTAINER_ID = process.env.COSMOS_CONTAINER || 'documents'

let container = null

export function documentId(key) {
  // Cosmos ids cannot contain / ? # \, and document keys are paths.
  return key.replace(/\//g, '|')
}

export async function getContainer() {
  if (container) return container

  const endpoint = process.env.COSMOS_ENDPOINT
  if (!endpoint) throw new Error('COSMOS_ENDPOINT is not set.')

  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
    connectionPolicy: { requestTimeout: 15000 },
  })

  container = client.database(DATABASE_ID).container(CONTAINER_ID)
  return container
}

const toVersioned = (resource) => ({
  key: resource.key,
  value: resource.value,
  version: resource.version,
  updatedAt: resource.updatedAt,
})

export async function readDocument(key) {
  const store = await getContainer()
  try {
    const { resource } = await store.item(documentId(key), key).read()
    return resource ? { doc: toVersioned(resource), etag: resource._etag } : null
  } catch (error) {
    if (error.code === 404 || error.statusCode === 404 || error.code === 'NotFound') return null
    throw error
  }
}

export async function listDocuments(prefix = '') {
  const store = await getContainer()
  const { resources } = await store.items
    .query({
      query: 'SELECT * FROM c WHERE STARTSWITH(c.key, @prefix)',
      parameters: [{ name: '@prefix', value: prefix }],
    })
    .fetchAll()
  return resources.map(toVersioned)
}
export class ConflictError extends Error {
  constructor(currentVersion) {
    super('Version conflict')
    this.name = 'ConflictError'
    this.currentVersion = currentVersion
  }
}

/**
 * Writes a document. When `ifVersion` is supplied the write only lands if
 * the stored version still matches, and the Cosmos etag makes that check
 * atomic rather than a read-then-hope.
 */
export async function writeDocument(key, value, ifVersion) {
  const store = await getContainer()
  const existing = await readDocument(key)
  const currentVersion = existing?.doc.version ?? 0

  if (ifVersion !== undefined && ifVersion !== currentVersion) {
    throw new ConflictError(currentVersion)
  }

  const record = {
    id: documentId(key),
    key,
    value,
    version: currentVersion + 1,
    updatedAt: new Date().toISOString(),
  }

  try {
    if (existing) {
      const { resource } = await store
        .item(record.id, key)
        .replace(record, { accessCondition: { type: 'IfMatch', condition: existing.etag } })
      return toVersioned(resource)
    }
    const { resource } = await store.items.create(record)
    return toVersioned(resource)
  } catch (error) {
    // 412 = someone else replaced it between our read and our write.
    // 409 = someone else created it first.
    if ([412, 409].includes(error.code) || [412, 409].includes(error.statusCode)) {
      const latest = await readDocument(key)
      throw new ConflictError(latest?.doc.version ?? 0)
    }
    throw error
  }
}

export async function deleteDocument(key, ifVersion) {
  const store = await getContainer()
  const existing = await readDocument(key)
  if (!existing) return
  if (ifVersion !== undefined && ifVersion !== existing.doc.version) {
    throw new ConflictError(existing.doc.version)
  }
  await store
    .item(documentId(key), key)
    .delete({ accessCondition: { type: 'IfMatch', condition: existing.etag } })
}

/** Cheap health probe used by the startup check and the /api/health route. */
export async function ping() {
  const store = await getContainer()
  await store.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll()
  return true
}
