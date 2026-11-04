// 🔀 Merge discovered monday projects into the tracker state.
//
// Rules, in plain words:
//   - Records are linked by `mondayId`. First run: existing records are matched
//     by title and get their `mondayId`. Nothing existing is duplicated.
//   - monday owns the fields in SYNCED_FIELDS. The tracker keeps `issues`,
//     `decisionOutcome` and `planLink`: monday has no column for them.
//   - A blank on monday never erases a value in the tracker.
//   - Nothing is ever deleted. A project that vanished from monday is reported.
//   - `updatedAt` takes monday's own timestamp, so a sync does not make a
//     stale project look freshly updated.
//
// Immutable on purpose: the input state is never touched, a new one comes back.
// Running it twice on the same data changes nothing the second time.

import { FIELD_LABELS, SYNCED_FIELDS, norm } from './mapping.js'

export const SYNC_ID = 'monday-sync'
export const SYNC_NAME = 'monday sync'
/** Mirrors LOG_LIMIT in src/constants.ts (a test keeps them equal). */
export const LOG_LIMIT = 300
const DEFAULT_MAX_FIELD_ENTRIES = 120

/** "Pillar 1: Accelerate Organic Growth" and "Accelerate Organic Growth" compare equal. */
const titleKey = (title) => norm(title).replace(/^pillar \d+ /, '')

const same = (a, b) => String(a) === String(b)

/** A real rename on monday. A change of only the "Pillar 1:" prefix is not one. */
const isRename = (current, name) => name !== '' && current !== name && titleKey(current) !== titleKey(name)

const pillarNo = (title) => {
  const match = String(title ?? '').match(/^\s*pillar\s*(\d+)\b/i)
  return match ? Number(match[1]) : null
}

/** A rename, or a new "Pillar N" number in monday's name. A name with no number never removes one. */
const isPillarRename = (current, name) => isRename(current, name) || (name !== '' && pillarNo(name) !== null && pillarNo(name) !== pillarNo(current))

const structureEntry = (field, oldValue, newValue) => ({
  kind: 'created',
  projectId: '',
  projectTitle: '(structure)',
  field,
  fieldKey: '',
  oldValue,
  newValue,
})

const replaceAt = (list, index, value) => list.map((entry, i) => (i === index ? value : entry))

const blankProject = (id, initiativeId, title, mondayId) => ({
  id,
  initiativeId,
  title,
  businessOwner: '',
  executionOwner: '',
  projectManager: '',
  scope: '',
  trending: 'stable',
  phase: '',
  validation: '',
  planLink: '',
  startDate: '',
  originalEndDate: '',
  forecastEndDate: '',
  nextMilestone: '',
  nextMilestoneDate: '',
  dependencies: '',
  keyRisk: '',
  decisionNeeded: '',
  decisionOutcome: '',
  rag: 'green',
  progress: 0,
  updatedAt: '',
  updatedById: '',
  updatedByName: '',
  issues: [],
  mondayId,
})

const addTo = (acc, patch) => ({
  ...acc,
  ...patch,
  counts: { ...acc.counts, ...(patch.counts ?? {}) },
})

const bump = (acc, key, by = 1) => ({ [key]: acc.counts[key] + by })

// ───────────────────────────── pillar / initiative ─────────────────────────────

function resolvePillar(acc, folder, pillarMap) {
  const mappedId = pillarMap[folder.id]
  const mapped = mappedId ? acc.pillars.findIndex((pillar) => pillar.id === mappedId) : -1
  const missingMap = mappedId && mapped === -1
  const byLink = acc.pillars.findIndex((pillar) => pillar.mondayId === folder.id)
  const byTitle = acc.pillars.findIndex(
    (pillar) => !pillar.mondayId && titleKey(pillar.title) === titleKey(folder.name),
  )
  const index = [mapped, byLink, byTitle].find((candidate) => candidate !== -1) ?? -1

  const warnings = missingMap
    ? [...acc.warnings, `pillarMap points folder "${folder.name}" at "${mappedId}", which is not in the tracker.`]
    : acc.warnings

  if (index === -1) {
    const created = { id: `obj-monday-${folder.id}`, title: folder.name, owner: '', mondayId: folder.id }
    return [
      addTo(acc, { pillars: [...acc.pillars, created], warnings, counts: bump(acc, 'pillarsCreated') }),
      created.id,
    ]
  }

  const found = acc.pillars[index]
  if (found.mondayId === folder.id) {
    if (!isPillarRename(found.title, folder.name)) return [addTo(acc, { warnings }), found.id]
    return [
      addTo(acc, {
        pillars: replaceAt(acc.pillars, index, { ...found, title: folder.name }),
        warnings,
        entries: [...acc.entries, structureEntry('Pillar renamed', found.title, folder.name)],
        counts: bump(acc, 'pillarsRenamed'),
      }),
      found.id,
    ]
  }
  return [
    addTo(acc, {
      pillars: replaceAt(acc.pillars, index, { ...found, mondayId: folder.id }),
      warnings,
      counts: bump(acc, 'linked'),
    }),
    found.id,
  ]
}

function resolveInitiative(acc, folder, pillarId) {
  const byLink = acc.initiatives.findIndex((initiative) => initiative.mondayId === folder.id)
  const byTitle = acc.initiatives.findIndex(
    (initiative) =>
      !initiative.mondayId && initiative.pillarId === pillarId && titleKey(initiative.title) === titleKey(folder.name),
  )
  const index = byLink !== -1 ? byLink : byTitle

  if (index === -1) {
    const created = {
      id: `init-monday-${folder.id}`,
      pillarId,
      title: folder.name,
      businessOwner: '',
      executionOwner: '',
      startQuarter: '',
      endQuarter: '',
      mondayId: folder.id,
    }
    return [
      addTo(acc, { initiatives: [...acc.initiatives, created], counts: bump(acc, 'initiativesCreated') }),
      created.id,
    ]
  }

  const found = acc.initiatives[index]
  const linkedAlready = found.mondayId === folder.id
  const renamed = linkedAlready && isRename(found.title, folder.name)
  const moved = linkedAlready && found.pillarId !== pillarId
  if (linkedAlready && !renamed && !moved) return [acc, found.id]
  if (linkedAlready) {
    return [
      addTo(acc, {
        initiatives: replaceAt(acc.initiatives, index, {
          ...found,
          pillarId,
          ...(renamed ? { title: folder.name } : {}),
        }),
        entries: [
          ...acc.entries,
          ...(renamed ? [structureEntry('Initiative renamed', found.title, folder.name)] : []),
        ],
        counts: {
          ...(renamed ? bump(acc, 'initiativesRenamed') : {}),
          ...(moved ? { linked: acc.counts.linked + 1 } : {}),
        },
      }),
      found.id,
    ]
  }
  return [
    addTo(acc, {
      initiatives: replaceAt(acc.initiatives, index, { ...found, mondayId: folder.id, pillarId }),
      counts: bump(acc, 'linked'),
    }),
    found.id,
  ]
}

// ───────────────────────────── project ─────────────────────────────

const logEntry = (kind, project, field, fieldKey, oldValue, newValue) => ({
  kind,
  projectId: project.id,
  projectTitle: project.title,
  field,
  fieldKey,
  oldValue: String(oldValue ?? ''),
  newValue: String(newValue ?? ''),
})

function mergeProject(acc, item, initiative, boardName, boardId) {
  const byLink = acc.projects.findIndex((project) => project.mondayId === item.mondayId)
  const byTitle = acc.projects.findIndex(
    (project) =>
      !project.mondayId && project.initiativeId === initiative.id && norm(project.title) === norm(item.title),
  )
  const index = byLink !== -1 ? byLink : byTitle

  const warnings = item.fields.rag
    ? acc.warnings
    : [...acc.warnings, `"${item.title}" (${boardName}) has no RAG status on monday.`]

  // New project: every synced value is a change from blank, but one line says it all.
  if (index === -1) {
    const fresh = { ...blankProject(`proj-monday-${item.mondayId}`, initiative.id, item.title, item.mondayId), mondayBoardId: boardId }
    const filled = {
      ...fresh,
      ...item.fields,
      updatedAt: item.updatedAt || acc.now,
      updatedById: SYNC_ID,
      updatedByName: SYNC_NAME,
    }
    return addTo(acc, {
      projects: [...acc.projects, filled],
      warnings,
      entries: [...acc.entries, logEntry('created', filled, 'Created', '', '', `Synced from monday (${boardName})`)],
      counts: bump(acc, 'projectsCreated'),
    })
  }

  const current = acc.projects[index]
  const changes = SYNCED_FIELDS.filter((field) => field in item.fields && !same(current[field], item.fields[field])).map(
    (field) => ({ field, from: current[field], to: item.fields[field] }),
  )

  const retitled = byLink !== -1 && item.title !== '' && item.title !== current.title
  const moved = byLink !== -1 && current.initiativeId !== initiative.id
  const linked = current.mondayId !== item.mondayId || (boardId && current.mondayBoardId !== boardId)
  const touched = changes.length > 0 || retitled || moved

  const updated = {
    ...current,
    ...Object.fromEntries(changes.map((change) => [change.field, change.to])),
    ...(retitled ? { title: item.title } : {}),
    ...(moved ? { initiativeId: initiative.id } : {}),
    ...(touched ? { updatedAt: item.updatedAt || acc.now, updatedById: SYNC_ID, updatedByName: SYNC_NAME } : {}),
    mondayId: item.mondayId,
    ...(boardId ? { mondayBoardId: boardId } : {}),
  }

  const entries = [
    ...changes.map((change) =>
      logEntry('field', updated, FIELD_LABELS[change.field], change.field, change.from, change.to),
    ),
    ...(retitled ? [logEntry('field', updated, 'Title', 'title', current.title, item.title)] : []),
    ...(moved ? [logEntry('field', updated, 'Initiative', 'initiativeId', current.initiativeId, initiative.id)] : []),
  ]

  return addTo(acc, {
    projects: replaceAt(acc.projects, index, updated),
    warnings,
    entries: [...acc.entries, ...entries],
    counts: {
      ...(touched ? bump(acc, 'projectsUpdated') : bump(acc, 'projectsUnchanged')),
      fieldsChanged: acc.counts.fieldsChanged + changes.length + (retitled ? 1 : 0) + (moved ? 1 : 0),
      linked: acc.counts.linked + (linked && !touched ? 1 : 0),
    },
  })
}

function mergeBoard(acc, board, pillarMap) {
  const [withPillar, pillarId] = resolvePillar(acc, board.pillar, pillarMap)
  const [withInitiative, initiativeId] = resolveInitiative(withPillar, board.initiative, pillarId)
  const initiative = { id: initiativeId }
  return board.projects.reduce((state, item) => mergeProject(state, item, initiative, board.board.name, board.board.id), withInitiative)
}

// ───────────────────────────── public ─────────────────────────────

/**
 * @param {import('../../src/types').TrackerState} state
 * @param {{ boards: Array }} discovered   result of discoverProjects()
 * @param {{ now?: string, pillarMap?: Record<string,string>, maxFieldEntries?: number }} [options]
 */
export function mergeMonday(state, discovered, options = {}) {
  const { now = new Date().toISOString(), pillarMap = {}, maxFieldEntries = DEFAULT_MAX_FIELD_ENTRIES } = options

  const seed = {
    now,
    pillars: state.pillars,
    initiatives: state.initiatives,
    projects: state.projects,
    entries: [],
    warnings: [],
    counts: {
      pillarsCreated: 0,
      pillarsRenamed: 0,
      initiativesCreated: 0,
      initiativesRenamed: 0,
      projectsCreated: 0,
      projectsUpdated: 0,
      projectsUnchanged: 0,
      fieldsChanged: 0,
      linked: 0,
    },
  }

  const merged = discovered.boards.reduce((acc, board) => mergeBoard(acc, board, pillarMap), seed)

  // Projects the tracker links to monday that no longer show up there.
  const seenItems = new Set(discovered.boards.flatMap((board) => board.projects.map((item) => item.mondayId)))
  const seenInitiatives = new Set(discovered.boards.map((board) => board.initiative.id))
  const initiativeLink = new Map(merged.initiatives.map((initiative) => [initiative.id, initiative.mondayId]))
  const gone = merged.projects.filter(
    (project) =>
      project.mondayId && !seenItems.has(project.mondayId) && seenInitiatives.has(initiativeLink.get(project.initiativeId)),
  )
  const warnings = [
    ...merged.warnings,
    ...gone.map((project) => `"${project.title}" is no longer on its monday board. Left in the tracker.`),
  ]

  // Log: always keep "created" lines, cap field lines so a first sync cannot bury history.
  const fieldLines = merged.entries.filter((entry) => entry.kind === 'field')
  const created = merged.entries.filter((entry) => entry.kind === 'created')
  const kept = fieldLines.slice(0, maxFieldEntries)
  const overflow = fieldLines.length - kept.length
  const summaryLine =
    overflow > 0
      ? [
          {
            kind: 'summary',
            projectId: '',
            projectTitle: SYNC_NAME,
            field: 'More changes',
            fieldKey: '',
            oldValue: '',
            newValue: `${overflow} more field changes were not listed`,
          },
        ]
      : []

  const logEntries = [...created, ...kept, ...summaryLine].map(({ kind: _kind, ...entry }, index) => ({
    id: `log-monday-${now}-${index}`,
    timestamp: now,
    ...entry,
    editedById: SYNC_ID,
    editedByName: SYNC_NAME,
  }))

  const c = merged.counts
  const changed =
    c.pillarsCreated + c.pillarsRenamed + c.initiativesCreated + c.initiativesRenamed + c.projectsCreated + c.projectsUpdated + c.linked > 0

  return {
    state: { ...state, pillars: merged.pillars, initiatives: merged.initiatives, projects: merged.projects },
    logEntries,
    summary: { ...c, projectsSeen: seenItems.size },
    warnings,
    changed,
  }
}

/** New entries first, history after, capped like the app caps it. */
export const prependLog = (existing, fresh) => [...fresh, ...existing].slice(0, LOG_LIMIT)
