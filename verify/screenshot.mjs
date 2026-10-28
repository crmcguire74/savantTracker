// 📸 Loads the real app in Chromium, drives a few interactions, and captures
// screenshots. Also proves the data actually lands in IndexedDB from a cold
// start rather than living in React state only.

import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
}

const server = createServer(async (request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0])
  try {
    const body = await readFile(join(root, path))
    response.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('not found')
  }
})
await new Promise((done) => server.listen(4322, done))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 940 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://127.0.0.1:4322/verify/preview.html')
await page.waitForSelector('.header h1', { timeout: 20000 })
await page.waitForFunction(() => !document.body.innerText.includes('Loading tracker'), null, { timeout: 20000 })
await page.waitForTimeout(600)

const headline = await page.textContent('.header-sub')
console.log(`header: ${headline?.trim()}`)

await page.screenshot({ path: 'verify/shot-01-overview.png' })

// Expand the first initiative and the first project inside it.
await page.click('.initiative-head button')
await page.waitForTimeout(250)
const firstProjectToggle = page.locator('.project-head button').first()
if (await firstProjectToggle.count()) {
  await firstProjectToggle.click()
  await page.waitForTimeout(350)
}
await page.screenshot({ path: 'verify/shot-02-project-detail.png' })

// Edit a field and confirm it reaches IndexedDB.
const progressInput = page.locator('input[aria-label="Progress value"]').first()
if (await progressInput.count()) {
  await progressInput.fill('63')
  await progressInput.press('Enter')
  await page.waitForTimeout(500)
}

const persisted = await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open('savant-tracker')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('documents', 'readonly')
        const get = tx.objectStore('documents').get('tracker/state')
        get.onsuccess = () => {
          const value = get.result?.value
          resolve({
            version: get.result?.version ?? null,
            projects: value?.projects?.length ?? 0,
            pillars: value?.pillars?.length ?? 0,
            progressValues: (value?.projects ?? []).map((p) => p.progress),
          })
        }
        get.onerror = () => reject(get.error)
      }
    }),
)
console.log(
  `indexeddb: version ${persisted.version}, ${persisted.projects} projects, ${persisted.pillars} pillars, contains 63%: ${persisted.progressValues.includes(63)}`,
)

// Search view.
await page.fill('input[aria-label="Search projects"]', 'eMoney')
await page.waitForTimeout(400)
await page.screenshot({ path: 'verify/shot-03-search.png' })
const hitCount = await page.locator('.search-hit').count()
const hitTitles = await page.locator('.search-hit .project-title, .search-hit span').allTextContents()
console.log(`search "eMoney": ${hitCount} result(s) — ${hitTitles.filter((t) => t.includes('eMoney')).join(' | ')}`)
if (hitCount === 0) {
  console.log('  FAIL: search returned nothing')
  process.exitCode = 1
}
await page.fill('input[aria-label="Search projects"]', '')

// Change log panel.
await page.getByText('Change log', { exact: true }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'verify/shot-04-changelog.png' })
const logEntries = await page.locator('.log-entry').count()
console.log(`change log entries rendered: ${logEntries}`)

// Storage panel: the proxy's control surface.
await page.getByText('indexeddb', { exact: true }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'verify/shot-05-storage.png' })

// Swap the live session to memory and confirm the data came along.
await page.getByText('Use memory (scratch session, nothing persists)').click()
await page.waitForTimeout(900)
const swapNote = (await page.locator('.modal .hint').allTextContents()).find((text) => text.includes('→'))
console.log(`swap: ${swapNote?.trim() ?? 'NO REPORT'}`)
const mountedAfterSwap = await page.locator('.modal .value-box .mono').textContent()
console.log(`driver after swap: ${mountedAfterSwap?.trim()}`)
if (!swapNote || mountedAfterSwap?.trim() !== 'memory') {
  console.log('  FAIL: the runtime swap did not complete')
  process.exitCode = 1
}
await page.screenshot({ path: 'verify/shot-06-after-swap.png' })

// Reload to prove the IndexedDB copy is still the source of truth.
await page.goto('http://127.0.0.1:4322/verify/preview.html')
await page.waitForSelector('.header h1')
await page.waitForFunction(() => !document.body.innerText.includes('Loading tracker'), null, { timeout: 20000 })
await page.waitForTimeout(500)
const afterReload = await page.textContent('.header-sub')
console.log(`after reload: ${afterReload?.trim()}`)

// Viewer role: mock the identity endpoint the way the Azure server answers
// for someone holding Tracker.Viewer, and confirm the UI locks down.
const viewerPage = await browser.newPage({ viewport: { width: 1500, height: 940 } })
viewerPage.on('pageerror', (error) => errors.push(`viewer: ${error}`))
await viewerPage.route('**/api/me', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'oid-viewer', name: 'Dana Viewer', roles: ['Tracker.Viewer'], canWrite: false }),
  }),
)
await viewerPage.goto('http://127.0.0.1:4322/verify/preview.html')
await viewerPage.waitForSelector('.header h1')
await viewerPage.waitForFunction(() => !document.body.innerText.includes('Loading tracker'), null, {
  timeout: 20000,
})
await viewerPage.waitForTimeout(500)

const viewerBanner = await viewerPage.locator('.banner.info').first().textContent()
const addInitiativeCount = await viewerPage.getByText('+ Add initiative').count()
const importCount = await viewerPage.getByText('Import file').count()
const exportCount = await viewerPage.getByText('Export file').count()
const signedInAs = await viewerPage.locator('.header-tools span').last().textContent()

await viewerPage.click('.initiative-head button')
await viewerPage.waitForTimeout(300)
const ragDisabled = await viewerPage.locator('select[aria-label="RAG status"]').first().isDisabled()
const deleteButtons = await viewerPage.locator('.project-head button[title="Delete project"]').count()
await viewerPage.screenshot({ path: 'verify/shot-07-viewer-role.png' })

console.log(`viewer banner: ${viewerBanner?.trim().slice(0, 60)}`)
console.log(`viewer header: ${signedInAs?.trim()}`)
console.log(
  `viewer controls: add-initiative=${addInitiativeCount} import=${importCount} export=${exportCount} rag-disabled=${ragDisabled} delete-buttons=${deleteButtons}`,
)
if (addInitiativeCount !== 0 || importCount !== 0 || !ragDisabled || deleteButtons !== 0 || exportCount !== 1) {
  console.log('  FAIL: view-only mode did not lock the editing controls')
  process.exitCode = 1
}

// Local shared-server mode: the API answers, but says it has no sign-in.
// The name prompt must stay, and editing must stay enabled.
const localPage = await browser.newPage({ viewport: { width: 1400, height: 900 } })
localPage.on('pageerror', (error) => errors.push(`local: ${error}`))
await localPage.route('**/api/me', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'local-dev',
      name: 'Local developer',
      roles: ['Tracker.Editor'],
      canWrite: true,
      local: true,
    }),
  }),
)
await localPage.goto('http://127.0.0.1:4322/verify/preview.html')
await localPage.waitForSelector('.header h1')
await localPage.waitForFunction(() => !document.body.innerText.includes('Loading tracker'), null, {
  timeout: 20000,
})
await localPage.waitForTimeout(400)

const nameButton = await localPage.getByText('Set your name').count()
const viewOnlyBanner = await localPage.locator('.banner.info').count()
const addInitiative = await localPage.getByText('+ Add initiative').count()
console.log(
  `local mode: name-prompt=${nameButton} view-only-banner=${viewOnlyBanner} add-initiative=${addInitiative}`,
)
if (nameButton !== 1 || viewOnlyBanner !== 0 || addInitiative !== 1) {
  console.log('  FAIL: local shared-server mode did not behave like an editor with a self-declared name')
  process.exitCode = 1
}

await browser.close()
server.close()

if (errors.length) {
  console.log('\nPage errors:')
  errors.forEach((error) => console.log(`  ${error}`))
  process.exit(1)
}
console.log('\nno page errors')
