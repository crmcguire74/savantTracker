// 🖥️ Run a sync from the command line.
//
//   npm run sync:monday                              dry run: prints what would change, writes nothing
//   npm run sync:monday -- --apply                   writes the changes
//   npm run sync:monday -- --retire                  dry run that also lists records to retire
//   npm run sync:monday -- --retire --apply --approve=<code>
//                                                    retires them (saves a backup first)
//   npm run sync:monday -- --backups                 lists saved backups
//   npm run sync:monday -- --restore=<backup key>    dry run of a restore; add --apply to do it
//   npm run sync:monday -- --file=capture.json       replays a capture file, no token needed
//   npm run sync:monday -- --save-capture=out.json   saves a raw capture of live monday to a file
//   npm run sync:monday -- --test                    checks the token and workspace access
//
// Live runs need MONDAY_API_TOKEN and MONDAY_WORKSPACE_ID. Backups, restore and --file need neither.
// Uses Cosmos when COSMOS_ENDPOINT is set, otherwise the local data file (same rule as
// server/index.js).

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMondayClient } from './client.js'
import { createSyncService, NotConfiguredError } from './service.js'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const valueOf = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? ''

const apply = flag('apply')
const retire = flag('retire')
const approval = valueOf('approve')

const store = process.env.COSMOS_ENDPOINT
  ? await import('../cosmos.js')
  : (await import('../file-store.js')).createFileStore(
      resolve(process.env.TRACKER_DATA_FILE || join(here, '..', '..', 'local-data', 'tracker.json')),
    )

const service = createSyncService({ store, env: process.env, makeClient: () => createMondayClient() })

if (flag('backups')) {
  const backups = await service.listBackups()
  if (backups.length === 0) console.log('No backups saved yet.')
  backups.forEach((backup) => console.log(`${backup.key}  ${backup.createdAt}  ${backup.reason}`))
  process.exit(0)
}

const restoreKey = valueOf('restore')
if (restoreKey) {
  const restored = await service.restoreBackup({ key: restoreKey, apply })
  console.log(`\nrestore (${restored.mode})`)
  console.log(`  backup: ${JSON.stringify(restored.summary)}`)
  if (restored.written) console.log(`  current data saved first as: ${restored.safetyKey}`)
  if (!apply) console.log('\nDry run only. Re-run with --apply to restore.')
  process.exit(0)
}

try {
  if (flag('test')) {
    const check = await service.testConnection()
    console.log(check.ok ? `OK. Signed in as ${check.account}, workspace "${check.workspace}".` : `Failed (${check.kind}): ${check.message}`)
    process.exit(check.ok ? 0 : 1)
  }

  const savePath = valueOf('save-capture')
  if (savePath) {
    const capture = await service.capture()
    await writeFile(resolve(savePath), `${JSON.stringify(capture, null, 2)}\n`)
    console.log(`Saved ${capture.boards.length} boards to ${resolve(savePath)}.`)
    process.exit(0)
  }
} catch (error) {
  if (error instanceof NotConfiguredError) {
    console.error('Set MONDAY_API_TOKEN and MONDAY_WORKSPACE_ID first.')
    process.exit(1)
  }
  throw error
}

const file = valueOf('file')
let report
try {
  const capture = file ? JSON.parse(await readFile(resolve(file), 'utf8')) : undefined
  report = await service.run({ apply, retire, approval, capture, trigger: 'cli' })
} catch (error) {
  if (error?.name === 'RetireApprovalError') {
    console.error(`\n${error.message}`)
    process.exit(2)
  }
  if (error instanceof NotConfiguredError) {
    console.error('Set MONDAY_API_TOKEN and MONDAY_WORKSPACE_ID first, or pass --file=<capture.json>.')
    process.exit(1)
  }
  if (error?.name === 'CaptureError') {
    console.error(`\nThat capture file cannot be used: ${error.message}`)
    process.exit(1)
  }
  throw error
}

console.log(`\nmonday sync (${report.mode}, ${report.source === 'upload' ? 'capture file' : 'live'})`)
console.log(`  project boards found: ${report.boardsFound}`)
console.log(`  summary: ${JSON.stringify(report.summary)}`)
console.log(`  written: ${report.written}`)
if (report.skipped.length > 0) {
  console.log(`\nSkipped ${report.skipped.length} board(s):`)
  report.skipped.forEach((entry) => console.log(`  - ${entry.board}: ${entry.reason}`))
}
if (report.warnings.length > 0) {
  console.log(`\nWarnings (${report.warnings.length}):`)
  report.warnings.forEach((warning) => console.log(`  - ${warning}`))
}

if (report.retire) {
  const { counts } = report.retire
  console.log(
    `\nRetire list: ${counts.projects} projects, ${counts.initiatives} initiatives, ${counts.pillars} pillars` +
      (report.written && report.retire.backupKey ? ` (removed, backup ${report.retire.backupKey})` : ''),
  )
  report.retire.projects.forEach((entry) => console.log(`  - project: ${entry.title} (${entry.reason})`))
  report.retire.initiatives.forEach((entry) => console.log(`  - initiative: ${entry.title}`))
  report.retire.pillars.forEach((entry) => console.log(`  - pillar: ${entry.title}`))
  if (report.retire.adopted.length > 0) {
    console.log('\nKept from retiring projects (moved to the same-titled project):')
    report.retire.adopted.forEach((entry) => console.log(`  - ${entry.title}: ${entry.fields.join(', ')}`))
  }
  if (!apply && !report.retire.empty) {
    console.log(`\nTo remove these: npm run sync:monday -- --retire --apply --approve=${report.retire.approval}`)
  }
}

if (!apply) console.log('\nDry run only. Re-run with --apply to write.')
