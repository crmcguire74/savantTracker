// 🔒 Server-side lock for records that monday owns.
//
// While the server pulls live from monday, a write to the tracker state may not change:
//   - the 17 synced fields on a linked project,
//   - a linked project's title or initiative,
//   - a linked initiative's title or pillar,
//   - a linked pillar's title,
//   - the existence of any linked pillar, initiative or project,
//   - the list of pillars, initiatives or projects (nothing new without a monday link).
// The sync itself writes straight to the store, so it never passes through this check.
// The browser already declines these edits; this is the check that holds when it does not.
//
// Pure function, no I/O, inputs never touched.

import { SYNCED_FIELDS } from './mapping.js'

const text = (value) => String(value ?? '')

const byId = (list = []) => new Map(list.map((record) => [record.id, record]))

/**
 * @param {{ pillars?: any[], initiatives?: any[], projects?: any[] } | undefined} current stored state
 * @param {{ pillars?: any[], initiatives?: any[], projects?: any[] } | undefined} next    proposed state
 * @returns {string[]} plain-language reasons the write is refused. Empty means allowed.
 */
export function lockViolations(current, next) {
  if (!current) return []
  if (!next || !Array.isArray(next.pillars) || !Array.isArray(next.initiatives) || !Array.isArray(next.projects)) {
    return ['The tracker data is not in the expected shape.']
  }

  const problems = []

  const check = (label, before, after, same) => {
    const nextById = byId(after)
    const beforeById = byId(before)
    before
      .filter((record) => record.mondayId)
      .forEach((record) => {
        const found = nextById.get(record.id)
        if (!found) problems.push(`${label} "${record.title}" comes from monday.com and cannot be removed here.`)
        else same(record, found).forEach((what) => problems.push(`${label} "${record.title}": ${what} comes from monday.com.`))
      })
    after
      .filter((record) => !beforeById.has(record.id))
      .forEach((record) => problems.push(`${label} "${record.title}" cannot be added here. Add it in monday.com.`))
  }

  check('Pillar', current.pillars ?? [], next.pillars, (a, b) => (text(a.title) !== text(b.title) ? ['the name'] : []))
  check('Initiative', current.initiatives ?? [], next.initiatives, (a, b) => [
    ...(text(a.title) !== text(b.title) ? ['the name'] : []),
    ...(text(a.pillarId) !== text(b.pillarId) ? ['the pillar'] : []),
  ])
  check('Project', current.projects ?? [], next.projects, (a, b) => [
    ...(text(a.title) !== text(b.title) ? ['the title'] : []),
    ...(text(a.initiativeId) !== text(b.initiativeId) ? ['the initiative'] : []),
    ...SYNCED_FIELDS.filter((field) => text(a[field]) !== text(b[field])).map((field) => `the ${field} field`),
  ])

  return problems
}
