// ▶️ Serves verify/ and drives Chromium through the harness.

import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' }

const server = createServer(async (request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0])
  const file = join(root, path === '/' ? 'verify/index.html' : path)
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('not found')
  }
})

await new Promise((done) => server.listen(4321, done))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', (error) => consoleErrors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

await page.goto('http://127.0.0.1:4321/verify/index.html')
await page
  .waitForFunction(() => Boolean(window.__RESULTS__), undefined, { timeout: 20000 })
  .catch(() => {
    console.log('Harness never started. Page errors:')
    consoleErrors.forEach((error) => console.log(`  ${error}`))
  })
const results = (await page.evaluate(async () => (window.__RESULTS__ ? await window.__RESULTS__ : null))) ?? []

await browser.close()
server.close()

let failed = 0
for (const result of results) {
  if (result.ok) {
    console.log(`  PASS  ${result.name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${result.name}\n        ${result.error}`)
  }
}
if (consoleErrors.length) {
  console.log('\nPage errors:')
  consoleErrors.forEach((error) => console.log(`  ${error}`))
}
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed > 0 || consoleErrors.length > 0 ? 1 : 0)
