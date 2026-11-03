// 🗑️ Retire: remove tracker records that monday does not have.
//
// monday is the source of truth. After a merge, anything in the tracker that is
// not linked to a monday record is a leftover from before the PMO restructure
// (or something someone typed into the tracker). Retiring removes it, with
// three safeguards:
//
//   1. A plan comes first. A dry run lists every record that would go, plus a
//      short approval code made from that exact list.
//   2. Applying needs that approval code. If the list changed since you
//      looked, the code no longer matches and nothing is removed.
//   3. A full copy of the state and log is saved under `tracker.backup.<time>`
//      before anything is removed (see sync.js). Restore puts it back.
//
// What counts as retired, on the merged state:
//   - a project with no `mondayId`
//   - a linked project that is gone from a monday board the sync did read
//   - an initiative or pillar with no `mondayId`, unless something that stays
//     still points at it (reported as a warning instead)
// A linked initiative or pillar is never retired here. A board the sync skipped
// looks the same as a deleted one, so removing them would be a guess.
//
// Tracker-only data is not thrown away when a same-titled project survives:
// issues, plan link and decision outcome move across (`adopted` in the plan).
//
// Pure functions, no I/O, input never mutated.

import { norm } from './mapping.js'
import { SYNC_ID, SYNC_NAME } from './merge.js'

/** Fields monday has no column for. They live only in the tracker. */
export const TRACKER_ONLY_FIELDS = Object.freeze(['issues', 'planLink', 'decisionOutcome'])

const hasValue = (project, field) =>
  field === 'issues' ? (project.issues?.length ?? 0) > 0 : Boolean(project[field])

export const emptyRetirePlan = (warnings = []) => ({
  empty: true,
  projects: [],
  initiatives: [],
  pillars: [],
  adopted: [],
  warnings,
  approval: '',
})

// cyrb53: a small public-domain string hash. Plain JavaScript on purpose, so the browser and the
// server compute the same code with no crypto dependency. The code guards against a stale list,
// it is not a security boundary.
export function hash64(text) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return [h2 >>> 0, h1 >>> 0].map((part) => part.toString(16).padStart(8, '0')).join('')
}

/** Short code over the exact list of ids. Same list, same code. Any change, new code. */
export const approvalCode = (projects, initiatives, pillars) => {
  const ids = (list) => list.map((entry) => entry.id).sort()
  return hash64(JSON.stringify([ids(projects), ids(initiatives), ids(pillars)])).slice(0, 12)
}

/**
 * @param {import('../../src/types').TrackerState} state  the MERGED state
 * @param {{ boards: Array }} discovered
 */
export function planRetire(state, discovered) {
  if (discovered.boards.length === 0) {
    return emptyRetirePlan(['monday returned no project boards, so nothing is retired.'])
  }

  const seenItems = new Set(discovered.boards.flatMap((board) => board.projects.map((item) => item.mondayId)))
  const seenInitiatives = new Set(discovered.boards.map((board) => board.initiative.id))
  const initiativeLink = new Map(state.initiatives.map((initiative) => [initiative.id, initiative.mondayId]))
  const unlinkedInitiativeIds = new Set(
    state.initiatives.filter((initiative) => !initiative.mondayId).map((initiative) => initiative.id),
  )

  const reasonFor = (project) => {
    if (!project.mondayId) return 'not on monday'
    if (!seenItems.has(project.mondayId) && seenInitiatives.has(initiativeLink.get(project.initiativeId))) {
      return 'removed from its monday board'
    }
    if (unlinkedInitiativeIds.has(project.initiativeId)) return 'its initiative is not on monday'
    return null
  }

  const projects = state.projects
    .map((project) => ({ id: project.id, title: project.title, reason: reasonFor(project) }))
    .filter((entry) => entry.reason !== null)
  const retiringProjectIds = new Set(projects.map((entry) => entry.id))
  const survivingProjects = state.projects.filter((project) => !retiringProjectIds.has(project.id))
  const warnings = []

  // An initiative only goes when no surviving project still sits in it.
  const holdsSurvivor = new Set(survivingProjects.map((project) => project.initiativeId))
  const initiatives = state.initiatives
    .filter((initiative) => !initiative.mondayId)
    .filter((initiative) => {
      if (!holdsSurvivor.has(initiative.id)) return true
      warnings.push(`Initiative "${initiative.title}" is not on monday but still holds projects that stay. Kept.`)
      return false
    })
    .map((initiative) => ({ id: initiative.id, title: initiative.title }))
  const retiringInitiativeIds = new Set(initiatives.map((initiative) => initiative.id))

  const survivingPillarIds = new Set(
    state.initiatives.filter((initiative) => !retiringInitiativeIds.has(initiative.id)).map((initiative) => initiative.pillarId),
  )
  const pillars = state.pillars
    .filter((pillar) => !pillar.mondayId)
    .filter((pillar) => {
      if (!survivingPillarIds.has(pillar.id)) return true
      warnings.push(`Pillar "${pillar.title}" is not on monday but still holds initiatives that stay. Kept.`)
      return false
    })
    .map((pillar) => ({ id: pillar.id, title: pillar.title }))

  // Tracker-only data follows a same-titled survivor instead of disappearing.
  const byId = new Map(state.projects.map((project) => [project.id, project]))
  const survivorByTitle = new Map(survivingProjects.map((project) => [norm(project.title), project]))
  const claimed = new Set()
  const adopted = projects.flatMap((entry) => {
    const from = byId.get(entry.id)
    const target = survivorByTitle.get(norm(from.title))
    if (!target) return []
    const fields = TRACKER_ONLY_FIELDS.filter(
      (field) => hasValue(from, field) && !hasValue(target, field) && !claimed.has(`${target.id}:${field}`),
    )
    fields.forEach((field) => claimed.add(`${target.id}:${field}`))
    return fields.length > 0 ? [{ fromId: from.id, toId: target.id, title: target.title, fields }] : []
  })

  const empty = projects.length + initiatives.length + pillars.length === 0
  return {
    empty,
    projects,
    initiatives,
    pillars,
    adopted,
    warnings,
    approval: empty ? '' : approvalCode(projects, initiatives, pillars),
  }
}

/** Returns a new state without the retired records. */
export function applyRetire(state, plan) {
  if (plan.empty) return state
  const gone = (list) => new Set(list.map((entry) => entry.id))
  const goneProjects = gone(plan.projects)
  const goneInitiatives = gone(plan.initiatives)
  const gonePillars = gone(plan.pillars)
  const byId = new Map(state.projects.map((project) => [project.id, project]))

  const adoptInto = (project) =>
    plan.adopted
      .filter((entry) => entry.toId === project.id)
      .reduce(
        (acc, entry) => ({
          ...acc,
          ...Object.fromEntries(entry.fields.map((field) => [field, byId.get(entry.fromId)[field]])),
        }),
        project,
      )

  return {
    ...state,
    pillars: state.pillars.filter((pillar) => !gonePillars.has(pillar.id)),
    initiatives: state.initiatives.filter((initiative) => !goneInitiatives.has(initiative.id)),
    projects: state.projects.filter((project) => !goneProjects.has(project.id)).map(adoptInto),
  }
}

/** Log lines: one per retired project, one summary line for the rest. */
export function retireLogEntries(plan, { now, backupKey }) {
  if (plan.empty) return []
  const base = { timestamp: now, editedById: SYNC_ID, editedByName: SYNC_NAME }
  const lines = [
    ...plan.projects.map((entry) => ({
      projectId: entry.id,
      projectTitle: entry.title,
      field: 'Retired',
      fieldKey: 'retired',
      oldValue: entry.title,
      newValue: `${entry.reason}. Removed from the tracker. Backup: ${backupKey}`,
    })),
    {
      projectId: '',
      projectTitle: SYNC_NAME,
      field: 'Retired',
      fieldKey: 'retired',
      oldValue: '',
      newValue:
        `${plan.projects.length} projects, ${plan.initiatives.length} initiatives and ${plan.pillars.length} pillars ` +
        `retired because monday does not have them. Backup: ${backupKey}`,
    },
  ]
  return lines.map((line, index) => ({ id: `log-retire-${now}-${index}`, ...base, ...line }))
}

export class RetireApprovalError extends Error {
  constructor(message, expected) {
    super(message)
    this.name = 'RetireApprovalError'
    this.expected = expected
  }
}
