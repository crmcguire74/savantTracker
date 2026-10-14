// 🚀 Startup. Two modes, chosen by whether COSMOS_ENDPOINT is set.
//
//   Azure mode    COSMOS_ENDPOINT is set. Data lives in Cosmos DB, reached by
//                 the managed identity. Sign-in is enforced by App Service.
//
//   Local mode    No COSMOS_ENDPOINT. Data lives in one JSON file on this
//                 machine and there is NO sign-in. Use it to run a shared
//                 demo on a laptop. Everyone pointed at this machine sees the
//                 same tracker, which is the part the browser-only dev server
//                 cannot do.
//
// Local mode refuses to run with NODE_ENV=production, because an app with no
// front door should never be mistaken for a deployment.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'

const here = dirname(fileURLToPath(import.meta.url))
const port = process.env.PORT || 8080
const azureMode = Boolean(process.env.COSMOS_ENDPOINT)

if (!azureMode && process.env.NODE_ENV === 'production') {
  console.error('No COSMOS_ENDPOINT set but NODE_ENV=production. Refusing to start.')
  console.error('Set COSMOS_ENDPOINT, or unset NODE_ENV to run locally.')
  process.exit(1)
}

let store
let banner

if (azureMode) {
  store = await import('./cosmos.js')
  banner = [`  storage:  Cosmos DB at ${process.env.COSMOS_ENDPOINT}`, '  sign-in:  required (App Service authentication)']
} else {
  process.env.REQUIRE_AUTH = 'false'
  const { createFileStore } = await import('./file-store.js')
  const dataFile = resolve(process.env.TRACKER_DATA_FILE || join(here, '..', 'local-data', 'tracker.json'))
  store = createFileStore(dataFile)

  // An empty file is not useful to anyone. Put the migrated snapshot in.
  if (store.size === 0) {
    const snapshot = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'snapshot.json'), 'utf8'))
    const count = await store.seed(snapshot)
    console.log(`Seeded ${dataFile} with ${count} projects.`)
  }

  banner = [
    `  storage:  ${dataFile}`,
    '  sign-in:  NONE. Anyone who can reach this port can edit the tracker.',
    '            Everyone is treated as an editor. Do not leave it running.',
  ]
}

const app = createApp({ store })

app.listen(port, '0.0.0.0', () => {
  console.log('')
  console.log('Savant Strategic Initiatives Tracker')
  console.log(`  local:    http://localhost:${port}`)
  console.log(`  network:  http://<this-machine-ip>:${port}`)
  banner.forEach((line) => console.log(line))
  console.log('')
})
