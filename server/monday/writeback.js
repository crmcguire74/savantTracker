// ✍️ Write-back: structure changes made in WiseTrack that monday.com must also see.
//
// monday stays the source of truth. WiseTrack never keeps a pillar, initiative or project that
// monday does not have while the sync is live, so every change here goes to monday FIRST and only
// lands in the tracker after monday said yes. That one rule is what keeps the sync free of
// duplicates:
//
//   create   monday makes the folder / board / item, hands back its id, and the tracker record is
//            written already linked (`mondayId`). Its tracker id is the same id the sync would give
//            it (`obj-monday-<folder>`, `init-monday-<folder>`, `proj-monday-<item>`), so a pull
//            that lands at the same moment updates the same record instead of adding a second one.
//   match    before creating, look for the same name under the same parent, in the tracker and in
//            monday. Already in the tracker: refuse and say where it is. Only in monday: link to
//            it instead of creating a second copy (the next pull fills in its data).
//   rename   update the monday folder name, then the tracker title. The next pull finds the same
//            name and changes nothing.
//   move     an initiative to another pillar moves its monday folder under the new pillar folder.
//
// If monday succeeds and the tracker write fails, nothing is lost: the next pull brings the record
// in from monday, once. If monday fails, nothing is written anywhere.
//
// Fields monday has no property for (pillar owner; initiative scope statement, owners, start and
// end quarter) are stored only in the tracker document (Cosmos DB in Azure), for everyone.
//
// What maps to monday:
//   pillar title            top-level folder name                 update_folder(name)
//   initiative title        sub-folder name                       update_folder(name)
//   initiative pillar       sub-folder parent                     update_folder(parent_folder_id)
//   new pillar              top-level folder                      create_folder
//   new initiative          sub-folder + project register board   create_folder + duplicate_board
//   new project             item in the register's Projects group create_item
//   new project owners      "Business Owner" / "Delivery Owner"   create_item column_values

import { fetchColumns, fetchFolders, fetchItems, DEFAULT_IGNORED_TITLES } from './discover.js'
import { isProjectRegister, norm, resolveColumns } from './mapping.js'
import { LOG_LIMIT } from './merge.js'

export const STATE_KEY = 'tracker.state'
export const LOG_KEY = 'tracker.log'
const MAX_ATTEMPTS = 3

export class StructureError extends Error {
  /** status: the HTTP status the API answers with. */
  constructor(message, status = 400) {
    super(message)
    this.name = 'StructureError'
    this.status = status
  }
}

// ───────────────────────────── pure helpers ─────────────────────────────

/** "Pillar 1: Accelerate Organic Growth" and "accelerate organic growth" compare equal. */
export const titleKey = (title) => norm(title).replace(/^pillar \d+ /, '')

const clean = (value) => String(value ?? '').trim()

/** Fields the tracker keeps for each level that monday has no property for. */
export const TRACKER_FIELDS = Object.freeze({
  pillar: ['owner'],
  initiative: ['scope', 'businessOwner', 'executionOwner', 'startQuarter', 'endQuarter'],
})

/** Fields that also change monday when the record is linked. */
export const MONDAY_FIELDS = Object.freeze({
  pillar: ['title'],
  initiative: ['title', 'pillarId'],
})

const pick = (input, keys) =>
  Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, clean(input[key])]))

/** Same name under the same parent, already in the tracker. */
export function findInTracker(state, kind, title, parentId) {
  const key = kind === 'project' ? norm(title) : titleKey(title)
  if (kind === 'pillar') return state.pillars.find((pillar) => titleKey(pillar.title) === key) ?? null
  if (kind === 'initiative') {
    return state.initiatives.find((initiative) => initiative.pillarId === parentId && titleKey(initiative.title) === key) ?? null
  }
  return state.projects.find((project) => project.initiativeId === parentId && norm(project.title) === key) ?? null
}

const structureLine = (field, oldValue, newValue, identity, now, index = 0, project = null) => ({
  id: `log-structure-${now}-${index}`,
  timestamp: now,
  projectId: project?.id ?? '',
  projectTitle: project?.title ?? '(structure)',
  field,
  fieldKey: '',
  oldValue: String(oldValue ?? ''),
  newValue: String(newValue ?? ''),
  editedById: identity?.id ?? '',
  editedByName: identity?.name ?? '',
})

/** Adds `record` unless one with the same id or monday link is there; then merges into that one. */
export function upsert(list, record) {
  const index = list.findIndex((entry) => entry.id === record.id || (record.mondayId && entry.mondayId === record.mondayId))
  if (index === -1) return { list: [...list, record], id: record.id, added: true }
  const merged = { ...list[index], ...Object.fromEntries(Object.entries(record).filter(([key, value]) => key !== 'id' && value !== '')) }
  return { list: list.map((entry, i) => (i === index ? merged : entry)), id: list[index].id, added: false }
}

export const blankInitiative = (id, pillarId, title, mondayId) => ({
  id,
  pillarId,
  title,
  scope: '',
  businessOwner: '',
  executionOwner: '',
  startQuarter: '',
  endQuarter: '',
  ...(mondayId ? { mondayId } : {}),
})

export const blankProject = (id, initiativeId, title, now, identity, extra = {}) => ({
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
  updatedAt: now,
  updatedById: identity?.id ?? '',
  updatedByName: identity?.name ?? '',
  issues: [],
  ...extra,
})

// ───────────────────────────── monday GraphQL ─────────────────────────────

// Optional arguments are left out of the mutation rather than sent as null, so monday never reads
// a null as "clear this".
export const createFolderMutation = (withParent) => `
  mutation ($name: String!, $workspaceId: ID!${withParent ? ', $parent: ID!' : ''}) {
    create_folder(name: $name, workspace_id: $workspaceId${withParent ? ', parent_folder_id: $parent' : ''}) { id name }
  }`

export const updateFolderMutation = ({ name, parent }) => `
  mutation ($id: ID!${name ? ', $name: String!' : ''}${parent ? ', $parent: ID!' : ''}) {
    update_folder(folder_id: $id${name ? ', name: $name' : ''}${parent ? ', parent_folder_id: $parent' : ''}) { id name }
  }`

const createFolder = (api, workspaceId, name, parent) =>
  api.query(createFolderMutation(Boolean(parent)), { name, workspaceId: String(workspaceId), ...(parent ? { parent: String(parent) } : {}) }).then((data) => data.create_folder)

const updateFolder = (api, id, { name, parent }) =>
  api.query(updateFolderMutation({ name, parent }), { id: String(id), ...(name ? { name } : {}), ...(parent ? { parent: String(parent) } : {}) })

export const DUPLICATE_BOARD = `
  mutation ($board: ID!, $name: String!, $workspaceId: ID!, $folder: ID!) {
    duplicate_board(board_id: $board, duplicate_type: duplicate_board_with_structure, board_name: $name,
      workspace_id: $workspaceId, folder_id: $folder, keep_subscribers: false) { board { id name } }
  }`

export const BOARD_SHAPE = `
  query ($ids: [ID!]) { boards(ids: $ids) { id name columns { id title type } groups { id title } } }`

export const createItemMutation = (withGroup) => `
  mutation ($board: ID!, $name: String!, $values: JSON${withGroup ? ', $group: String!' : ''}) {
    create_item(board_id: $board, item_name: $name, column_values: $values${withGroup ? ', group_id: $group' : ''}) { id name }
  }`

// ───────────────────────────── service ─────────────────────────────

/**
 * @param {{ store: object, client: () => { query: Function }, workspaceId: string, live: boolean,
 *           projectGroupTitle?: string, ignoreTitles?: string[], templateBoardId?: string,
 *           clock?: () => string }} args
 */
export function createWriteback({
  store,
  client,
  workspaceId,
  live,
  projectGroupTitle = 'Projects',
  ignoreTitles = DEFAULT_IGNORED_TITLES,
  templateBoardId = '',
  clock = () => new Date().toISOString(),
}) {
  const ignored = new Set(ignoreTitles.map(norm))

  const readState = async () => {
    const found = await store.readDocument(STATE_KEY)
    if (!found) throw new StructureError('The tracker has no data yet. Open the app once so it seeds itself.', 409)
    return found.doc
  }

  /**
   * Re-reads, applies `change` (pure: state -> { state, lines, result }) and writes pinned to the
   * version read. Retries when someone, or the sync, saved in between.
   */
  async function commit(change) {
    const go = async (tries) => {
      const doc = await readState()
      const { state, lines, result } = change(doc.value)
      try {
        await store.writeDocument(STATE_KEY, state, doc.version)
      } catch (error) {
        if (error?.name === 'ConflictError' && tries < MAX_ATTEMPTS) return go(tries + 1)
        throw error
      }
      if (lines.length > 0) {
        try {
          const log = (await store.readDocument(LOG_KEY))?.doc
          const entries = [...lines, ...(log?.value?.entries ?? [])].slice(0, LOG_LIMIT)
          await store.writeDocument(LOG_KEY, { entries }, log?.version ?? 0)
        } catch (error) {
          // The data is saved. A lost log line must not turn a good save into an error.
          console.error('could not write structure log lines', error)
        }
      }
      return result
    }
    return go(1)
  }

  const requireLive = () => {
    if (!live) throw new StructureError('monday.com is not connected, so this change is saved in the tracker only.', 501)
  }

  const requireTitle = (title, what) => {
    if (!title) throw new StructureError(`${what} needs a name.`)
    if (ignored.has(norm(title))) throw new StructureError(`"${title}" is a name the sync ignores. Pick another name.`)
  }

  const folders = async () =>
    (await fetchFolders(client(), workspaceId)).map((folder) => ({
      id: String(folder.id),
      name: folder.name,
      parent: folder.parent ? String(folder.parent.id) : null,
      boards: (folder.children ?? []).map((board) => String(board.id)),
    }))

  /** The register board in a monday folder, or null. */
  async function registerIn(folder) {
    if (!folder || folder.boards.length === 0) return null
    const boards = await fetchColumns(client(), folder.boards)
    return boards.find((board) => isProjectRegister(board.columns ?? []))?.id ?? null
  }

  /**
   * A project register the new initiative can copy: MONDAY_REGISTER_TEMPLATE_BOARD_ID, else a board a
   * linked project sits on, else the first register found in an initiative folder on monday.
   */
  async function templateFor(state, tree) {
    const known =
      templateBoardId ||
      state.projects.find((project) => project.mondayBoardId)?.mondayBoardId ||
      state.initiatives.find((initiative) => initiative.mondayBoardId)?.mondayBoardId
    if (known) return String(known)
    const candidates = tree.filter((folder) => folder.parent !== null).flatMap((folder) => folder.boards).slice(0, 50)
    if (candidates.length === 0) return ''
    const boards = await fetchColumns(client(), candidates)
    return String(boards.find((board) => isProjectRegister(board.columns ?? []))?.id ?? '')
  }

  async function makeRegister(state, tree, folderId, title) {
    const template = await templateFor(state, tree)
    if (!template) {
      throw new StructureError(
        'There is no project register in monday.com to copy yet. Create the first initiative board in monday.com, or set MONDAY_REGISTER_TEMPLATE_BOARD_ID.',
        409,
      )
    }
    const data = await client().query(DUPLICATE_BOARD, { board: String(template), name: title, workspaceId: String(workspaceId), folder: String(folderId) })
    const board = data.duplicate_board?.board
    if (!board?.id) throw new StructureError('monday.com did not return the new project register board.', 502)
    return String(board.id)
  }

  return {
    // ── create (admins) ─────────────────────────────────────────────────

    async createPillar(input, identity) {
      requireLive()
      const title = clean(input.title)
      requireTitle(title, 'A pillar')
      const fields = pick(input, TRACKER_FIELDS.pillar)

      const current = (await readState()).value
      const existing = findInTracker(current, 'pillar', title)
      if (existing) throw new StructureError(`A pillar named "${existing.title}" already exists.`, 409)

      const tree = await folders()
      const claimed = new Set(current.pillars.map((pillar) => pillar.mondayId).filter(Boolean))
      const match = tree.find((folder) => folder.parent === null && titleKey(folder.name) === titleKey(title) && !claimed.has(folder.id))
      const folder = match ?? (await createFolder(client(), workspaceId, title, null))
      if (!folder?.id) throw new StructureError('monday.com did not return the new folder.', 502)
      const mondayId = String(folder.id)
      const now = clock()

      return commit((state) => {
        const record = { id: `obj-monday-${mondayId}`, title: match ? match.name : title, owner: fields.owner ?? '', mondayId }
        const { list, id, added } = upsert(state.pillars, record)
        return {
          state: { ...state, pillars: list },
          lines: added ? [structureLine(match ? 'Pillar linked to monday' : 'Pillar added', '', record.title, identity, now)] : [],
          result: { id, mondayId, linkedExisting: Boolean(match) },
        }
      })
    },

    async createInitiative(input, identity) {
      requireLive()
      const title = clean(input.title)
      requireTitle(title, 'An initiative')
      const fields = pick(input, TRACKER_FIELDS.initiative)

      const current = (await readState()).value
      const pillar = current.pillars.find((candidate) => candidate.id === input.pillarId)
      if (!pillar) throw new StructureError('That pillar is not in the tracker.', 404)
      if (!pillar.mondayId) throw new StructureError(`Pillar "${pillar.title}" is not in monday.com yet, so its initiatives cannot be created there.`, 409)
      const existing = findInTracker(current, 'initiative', title, pillar.id)
      if (existing) throw new StructureError(`Initiative "${existing.title}" already exists in this pillar.`, 409)

      const tree = await folders()
      const claimed = new Set(current.initiatives.map((initiative) => initiative.mondayId).filter(Boolean))
      const match = tree.find((folder) => folder.parent === String(pillar.mondayId) && titleKey(folder.name) === titleKey(title) && !claimed.has(folder.id))
      const folder = match ?? (await createFolder(client(), workspaceId, title, pillar.mondayId))
      if (!folder?.id) throw new StructureError('monday.com did not return the new folder.', 502)
      const mondayId = String(folder.id)
      // A folder made by an earlier attempt that stopped half way has no register yet: add it now.
      const boardId = (match && (await registerIn(match))) || (await makeRegister(current, tree, mondayId, match ? match.name : title))
      const now = clock()

      return commit((state) => {
        const record = { ...blankInitiative(`init-monday-${mondayId}`, pillar.id, match ? match.name : title, mondayId), ...fields, mondayBoardId: boardId }
        const { list, id, added } = upsert(state.initiatives, record)
        return {
          state: { ...state, initiatives: list },
          lines: added ? [structureLine(match ? 'Initiative linked to monday' : 'Initiative added', '', record.title, identity, now)] : [],
          result: { id, mondayId, mondayBoardId: boardId, linkedExisting: Boolean(match) },
        }
      })
    },

    async createProject(input, identity) {
      requireLive()
      const title = clean(input.title)
      requireTitle(title, 'A project')
      const businessOwner = clean(input.businessOwner)
      const executionOwner = clean(input.executionOwner)

      const current = (await readState()).value
      const initiative = current.initiatives.find((candidate) => candidate.id === input.initiativeId)
      if (!initiative) throw new StructureError('That initiative is not in the tracker.', 404)
      if (!initiative.mondayId) throw new StructureError(`Initiative "${initiative.title}" is not in monday.com yet, so its projects cannot be created there.`, 409)
      const existing = findInTracker(current, 'project', title, initiative.id)
      if (existing) throw new StructureError(`Project "${existing.title}" already exists in this initiative.`, 409)

      const boardId =
        initiative.mondayBoardId ||
        current.projects.find((project) => project.initiativeId === initiative.id && project.mondayBoardId)?.mondayBoardId ||
        (await registerIn((await folders()).find((folder) => folder.id === String(initiative.mondayId))))
      if (!boardId) throw new StructureError(`Initiative "${initiative.title}" has no project register board in monday.com.`, 409)

      const shape = (await client().query(BOARD_SHAPE, { ids: [String(boardId)] })).boards?.[0]
      if (!shape) throw new StructureError('The project register board is not visible to the sync account.', 502)
      const group = (shape.groups ?? []).find((candidate) => candidate.title === projectGroupTitle)

      const claimed = new Set(current.projects.map((project) => project.mondayId).filter(Boolean))
      const items = await fetchItems(client(), String(boardId))
      const match = items.find(
        (item) => norm(item.name) === norm(title) && (!group || item.group?.id === group.id) && !claimed.has(String(item.id)),
      )

      const warnings = []
      let item = match
      if (!item) {
        const columns = resolveColumns(shape.columns ?? [])
        const types = new Map((shape.columns ?? []).map((column) => [column.id, column.type]))
        const values = {}
        ;[
          ['businessOwner', businessOwner],
          ['executionOwner', executionOwner],
        ].forEach(([field, value]) => {
          if (!value) return
          const id = columns[field]
          if (id && types.get(id) === 'text') values[id] = value
          else warnings.push(`${field === 'businessOwner' ? 'Business owner' : 'Delivery owner'} was not sent to monday.com: the board has no text column for it.`)
        })
        if (!group) warnings.push(`The board has no "${projectGroupTitle}" group, so monday.com put the item in its first group.`)
        const created = await client().query(createItemMutation(Boolean(group)), {
          board: String(boardId),
          name: title,
          values: JSON.stringify(values),
          ...(group ? { group: group.id } : {}),
        })
        item = created.create_item
      }
      if (!item?.id) throw new StructureError('monday.com did not return the new item.', 502)
      const mondayId = String(item.id)
      const now = clock()

      return commit((state) => {
        const record = blankProject(`proj-monday-${mondayId}`, initiative.id, match ? item.name : title, now, identity, {
          businessOwner,
          executionOwner,
          mondayId,
          mondayBoardId: String(boardId),
        })
        const { list, id, added } = upsert(state.projects, record)
        const initiatives = initiative.mondayBoardId
          ? state.initiatives
          : state.initiatives.map((candidate) => (candidate.id === initiative.id ? { ...candidate, mondayBoardId: String(boardId) } : candidate))
        return {
          state: { ...state, projects: list, initiatives },
          lines: added ? [structureLine(match ? 'Project linked to monday' : 'Project added', '', record.title, identity, now, 0, record)] : [],
          result: { id, mondayId, mondayBoardId: String(boardId), linkedExisting: Boolean(match), warnings },
        }
      })
    },

    // ── update (admins and editors) ─────────────────────────────────────

    async updatePillar(id, input, identity) {
      const current = (await readState()).value
      const pillar = current.pillars.find((candidate) => candidate.id === id)
      if (!pillar) throw new StructureError('That pillar is not in the tracker.', 404)
      const patch = { ...pick(input, MONDAY_FIELDS.pillar), ...pick(input, TRACKER_FIELDS.pillar) }
      if (patch.title !== undefined) {
        requireTitle(patch.title, 'A pillar')
        const clash = current.pillars.find((candidate) => candidate.id !== id && titleKey(candidate.title) === titleKey(patch.title))
        if (clash) throw new StructureError(`A pillar named "${clash.title}" already exists.`, 409)
      }
      const renamed = patch.title !== undefined && patch.title !== pillar.title
      if (renamed && pillar.mondayId && live) {
        await updateFolder(client(), pillar.mondayId, { name: patch.title })
      }
      const now = clock()
      return commit((state) => {
        const before = state.pillars.find((candidate) => candidate.id === id)
        if (!before) throw new StructureError('That pillar was removed while you were editing it.', 409)
        const after = { ...before, ...patch }
        const lines = [
          ...(before.title !== after.title ? [structureLine('Pillar renamed', before.title, after.title, identity, now, 0)] : []),
          ...(before.owner !== after.owner ? [structureLine(`Pillar owner (${after.title})`, before.owner, after.owner, identity, now, 1)] : []),
        ]
        return {
          state: { ...state, pillars: state.pillars.map((candidate) => (candidate.id === id ? after : candidate)) },
          lines,
          result: { id, pushedToMonday: renamed && Boolean(pillar.mondayId) && live },
        }
      })
    },

    async updateInitiative(id, input, identity) {
      const current = (await readState()).value
      const initiative = current.initiatives.find((candidate) => candidate.id === id)
      if (!initiative) throw new StructureError('That initiative is not in the tracker.', 404)
      const patch = { ...pick(input, MONDAY_FIELDS.initiative), ...pick(input, TRACKER_FIELDS.initiative) }
      const pillarId = patch.pillarId ?? initiative.pillarId
      const target = current.pillars.find((pillar) => pillar.id === pillarId)
      if (!target) throw new StructureError('That pillar is not in the tracker.', 404)
      const title = patch.title ?? initiative.title
      if (patch.title !== undefined) requireTitle(patch.title, 'An initiative')
      const clash = current.initiatives.find(
        (candidate) => candidate.id !== id && candidate.pillarId === pillarId && titleKey(candidate.title) === titleKey(title),
      )
      if (clash) throw new StructureError(`Initiative "${clash.title}" already exists in that pillar.`, 409)

      const renamed = title !== initiative.title
      const moved = pillarId !== initiative.pillarId
      const linked = Boolean(initiative.mondayId) && live
      if (linked && moved && !target.mondayId) {
        throw new StructureError(`Pillar "${target.title}" is not in monday.com, so this initiative cannot move there.`, 409)
      }
      if (linked && (renamed || moved)) {
        await updateFolder(client(), initiative.mondayId, { name: renamed ? title : '', parent: moved ? target.mondayId : '' })
      }
      const now = clock()
      const labels = { scope: 'Scope statement', businessOwner: 'Business owner', executionOwner: 'Delivery owner', startQuarter: 'Start quarter', endQuarter: 'End quarter' }
      return commit((state) => {
        const before = state.initiatives.find((candidate) => candidate.id === id)
        if (!before) throw new StructureError('That initiative was removed while you were editing it.', 409)
        const after = { ...before, ...patch }
        const pillarName = (pid) => state.pillars.find((pillar) => pillar.id === pid)?.title ?? pid
        const lines = [
          ...(before.title !== after.title ? [structureLine('Initiative renamed', before.title, after.title, identity, now, 0)] : []),
          ...(before.pillarId !== after.pillarId ? [structureLine(`Initiative pillar (${after.title})`, pillarName(before.pillarId), pillarName(after.pillarId), identity, now, 1)] : []),
          ...TRACKER_FIELDS.initiative
            .filter((field) => clean(before[field]) !== clean(after[field]))
            .map((field, index) => structureLine(`${labels[field]} (${after.title})`, before[field], after[field], identity, now, 2 + index)),
        ]
        return {
          state: { ...state, initiatives: state.initiatives.map((candidate) => (candidate.id === id ? after : candidate)) },
          lines,
          result: { id, pushedToMonday: linked && (renamed || moved) },
        }
      })
    },
  }
}
