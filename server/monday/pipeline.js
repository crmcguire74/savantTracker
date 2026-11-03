// 🧮 The pure middle of a sync: merge, retire plan, approval check, report.
//
// No I/O, no clock, no node imports. The server runs it against Cosmos or the data file, and the
// browser runs the same functions against IndexedDB, so an uploaded test capture is handled by the
// same rules as a live read.

import { mergeMonday } from './merge.js'
import { applyRetire, planRetire, retireLogEntries, RetireApprovalError } from './retire.js'

/**
 * @param {{ state: object, discovered: object, pillarMap?: object, now: string,
 *           retire?: boolean, apply?: boolean, approval?: string, backupKey: string }} args
 * Throws RetireApprovalError when applying a retire without the current approval code.
 */
export function planSync({ state, discovered, pillarMap = {}, now, retire = false, apply = false, approval = '', backupKey }) {
  const merged = mergeMonday(state, discovered, { pillarMap, now })
  const plan = retire ? planRetire(merged.state, discovered) : null
  const retiring = plan !== null && !plan.empty

  if (apply && retiring && approval !== plan.approval) {
    throw new RetireApprovalError(
      approval
        ? `The retire list changed since you reviewed it. Run a dry run again and approve code ${plan.approval}.`
        : `Retiring needs approval. Run a dry run, read the list, then apply with approval code ${plan.approval}.`,
      plan.approval,
    )
  }

  const nextState = retiring ? applyRetire(merged.state, plan) : merged.state
  const logEntries = retiring
    ? [...merged.logEntries, ...retireLogEntries(plan, { now, backupKey })]
    : merged.logEntries
  return { result: { ...merged, state: nextState, logEntries, changed: merged.changed || retiring }, plan, retiring }
}

const retireReport = (plan, backupKey, written) =>
  plan === null
    ? null
    : {
        empty: plan.empty,
        approval: plan.approval,
        counts: { projects: plan.projects.length, initiatives: plan.initiatives.length, pillars: plan.pillars.length },
        projects: plan.projects,
        initiatives: plan.initiatives,
        pillars: plan.pillars,
        adopted: plan.adopted,
        warnings: plan.warnings,
        backupKey: written && !plan.empty ? backupKey : null,
      }

/** The report the CLI, the API and the Admin screen all show. */
export function buildReport({ apply, written, discovered, result, plan, backupKey }) {
  return {
    mode: apply ? 'apply' : 'dry-run',
    written,
    boardsFound: discovered.boards.length,
    skipped: discovered.skipped,
    summary: result.summary,
    warnings: [...discovered.warnings, ...result.warnings, ...(plan?.warnings ?? [])],
    logLines: result.logEntries.length,
    retire: retireReport(plan, backupKey, written),
  }
}

/** "2026-11-03T14:30:00.000Z" -> "20261103T143000000Z", safe inside a document key. */
export const stamp = (iso) => iso.replace(/[-:.]/g, '')
