// 🌱 Loads an app file into Cosmos DB.
//
//   export COSMOS_ENDPOINT=https://cosmos-savant-tracker-ab12cd.documents.azure.com:443/
//   az login
//   npm run seed                          # loads the bundled migration snapshot
//   npm run seed -- ./my-export.json      # or any export you have
//
// Authentication is your own Entra account through `az login`, so this only
// works while your account holds the Cosmos data contributor role and while
// Cosmos is still reachable from where you are running it. Do this before
// infra/lockdown.sh closes public access.
//
// It refuses to overwrite a container that already holds tracker data unless
// you pass --force. Reseeding over live edits is not something to do by
// accident.

import { CosmosClient } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const force = args.includes('--force')
const fileArg = args.find((arg) => !arg.startsWith('--'))
const sourcePath = fileArg ? resolve(fileArg) : join(here, '..', 'src', 'data', 'snapshot.json')

const endpoint = process.env.COSMOS_ENDPOINT
const databaseId = process.env.COSMOS_DATABASE || 'tracker'
const containerId = process.env.COSMOS_CONTAINER || 'documents'

if (!endpoint) {
  console.error('COSMOS_ENDPOINT is not set.')
  console.error('  export COSMOS_ENDPOINT=https://<your-account>.documents.azure.com:443/')
  process.exit(1)
}

const file = JSON.parse(readFileSync(sourcePath, 'utf8'))
const state = file.state ?? file
const log = Array.isArray(file.log) ? file.log : (file.log?.entries ?? [])
const settings = file.settings ?? { staleThresholdDays: 30 }

if (!Array.isArray(state.projects) || !Array.isArray(state.pillars)) {
  console.error(`${sourcePath} does not look like a tracker export.`)
  process.exit(1)
}

console.log(`Source: ${sourcePath}`)
console.log(
  `  ${state.pillars.length} pillars, ${state.initiatives?.length ?? 0} initiatives, ` +
    `${state.projects.length} projects, ${log.length} log entries`,
)
console.log(`Target: ${endpoint} -> ${databaseId}/${containerId}`)

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() })
const container = client.database(databaseId).container(containerId)

const documentId = (key) => key.replace(/\//g, '|')

async function read(key) {
  try {
    const { resource } = await container.item(documentId(key), key).read()
    return resource ?? null
  } catch (error) {
    if (error.code === 404) return null
    throw error
  }
}

async function write(key, value) {
  const existing = await read(key)
  const record = {
    id: documentId(key),
    key,
    value,
    version: (existing?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(record)
  return record.version
}

const existingState = await read('tracker.state')
if (existingState && !force) {
  const count = existingState.value?.projects?.length ?? 0
  console.error(
    `\nRefusing to seed: tracker.state already exists with ${count} projects (version ${existingState.version}).`,
  )
  console.error('Export it from the app first if you want to keep it, then re-run with --force.')
  process.exit(1)
}

console.log('')
console.log(`tracker.state    -> version ${await write('tracker.state', state)}`)
console.log(`tracker.log      -> version ${await write('tracker.log', { entries: log })}`)
console.log(`tracker.settings -> version ${await write('tracker.settings', settings)}`)

const check = await read('tracker.state')
console.log(`\nVerified: ${check.value.projects.length} projects are in Cosmos.`)
