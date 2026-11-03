// 🗺️ Discovery: walk the workspace folders and find each initiative's project
// register.
//
//   top-level folder  = pillar
//   sub-folder        = initiative (deeper folders roll up to their depth-2 ancestor)
//   board in it       = a project register IF it has the project columns
//                       (task boards such as "Rename" fail that test and are skipped)
//
// Nothing here is written anywhere. It returns plain data plus a plain-language
// list of what was skipped and why, because a sync you cannot explain is a
// sync nobody trusts.

import { CAPTURE_FORMAT, CAPTURE_VERSION, validateCapture } from './capture.js'
import { hash64 } from './retire.js'
import { isProjectRegister, mapItem, missingFields, norm, resolveColumns } from './mapping.js'

const PAGE = 100

/** Template leftovers and test rows that are not real projects. Compared ignoring case and punctuation. */
export const DEFAULT_IGNORED_TITLES = Object.freeze(['Rename', 'test'])

export const FOLDERS_QUERY = `
  query ($workspaceIds: [ID], $page: Int!) {
    folders(workspace_ids: $workspaceIds, limit: ${PAGE}, page: $page) {
      id
      name
      parent { id }
      sub_folders { id }
      children { id name }
    }
  }`

export const COLUMNS_QUERY = `
  query ($ids: [ID!]) {
    boards(ids: $ids, limit: 25) { id name columns { id title type } }
  }`

const ITEM_FIELDS = `
  id
  name
  updated_at
  group { id title }
  column_values {
    id
    type
    text
    ... on MirrorValue { display_value }
    ... on FormulaValue { display_value }
    ... on BoardRelationValue { display_value }
  }`

export const ITEMS_QUERY = `
  query ($ids: [ID!]) {
    boards(ids: $ids) { items_page(limit: ${PAGE}) { cursor items { ${ITEM_FIELDS} } } }
  }`

export const NEXT_ITEMS_QUERY = `
  query ($cursor: String!) {
    next_items_page(limit: ${PAGE}, cursor: $cursor) { cursor items { ${ITEM_FIELDS} } }
  }`

export const STAMPS_QUERY = `
  query ($ids: [ID!]) {
    boards(ids: $ids, limit: 25) { id updated_at }
  }`

const chunk = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size))

export async function fetchFolders(client, workspaceId) {
  const collect = async (page, found) => {
    const data = await client.query(FOLDERS_QUERY, { workspaceIds: [workspaceId], page })
    const batch = data.folders ?? []
    const all = [...found, ...batch]
    return batch.length < PAGE ? all : collect(page + 1, all)
  }
  return collect(1, [])
}

export async function fetchColumns(client, boardIds) {
  const batches = await Promise.all(
    chunk(boardIds, 25).map((ids) => client.query(COLUMNS_QUERY, { ids }).then((data) => data.boards ?? [])),
  )
  return batches.flat()
}

export async function fetchItems(client, boardId) {
  const first = await client.query(ITEMS_QUERY, { ids: [boardId] })
  const page = first.boards?.[0]?.items_page ?? { cursor: null, items: [] }

  const more = async (cursor, found) => {
    if (!cursor) return found
    const data = await client.query(NEXT_ITEMS_QUERY, { cursor })
    const next = data.next_items_page ?? { cursor: null, items: [] }
    return more(next.cursor, [...found, ...next.items])
  }
  return more(page.cursor, page.items ?? [])
}

/** Folder chain from a folder up to its top-level ancestor: [self, parent, ..., root]. */
function chainOf(folder, byId) {
  const walk = (current, seen) =>
    current && !seen.has(current.id)
      ? [current, ...walk(current.parent ? byId.get(String(current.parent.id)) : null, new Set([...seen, current.id]))]
      : []
  return walk(folder, new Set())
}

/**
 * Every board that sits in a folder, with the pillar and initiative above it.
 * Boards directly in a pillar folder have no initiative.
 */
export function placeBoards(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return folders.flatMap((folder) => {
    const chain = chainOf(folder, byId) // [self ... root]
    const root = chain[chain.length - 1]
    const initiative = chain.length >= 2 ? chain[chain.length - 2] : null
    return (folder.children ?? []).map((board) => ({
      board: { id: String(board.id), name: board.name },
      pillar: root,
      initiative,
      folderName: folder.name,
    }))
  })
}

/**
 * A cheap fingerprint of the workspace: the folder tree plus each initiative board's updated_at.
 * monday keeps a board's updated_at at its newest item change, so an unchanged fingerprint means a
 * full read would find nothing new. Costs one folder query and one small query per 25 boards.
 * Take it BEFORE the full read: a change that lands mid-read then shows up as different next time.
 */
export async function fetchBoardStamps(client, workspaceId) {
  if (!workspaceId) throw new Error('MONDAY_WORKSPACE_ID is not set.')
  const folders = (await fetchFolders(client, workspaceId)).map((folder) => ({
    id: String(folder.id),
    name: folder.name,
    parent: folder.parent ? { id: String(folder.parent.id) } : null,
    children: (folder.children ?? []).map((board) => ({ id: String(board.id), name: board.name })),
  }))
  const placed = placeBoards(folders).filter((entry) => entry.initiative)
  const ids = [...new Set(placed.map((entry) => entry.board.id))].sort()
  const batches = await Promise.all(
    chunk(ids, 25).map((batch) => client.query(STAMPS_QUERY, { ids: batch }).then((data) => data.boards ?? [])),
  )
  const stamps = batches.flat().map((board) => `${board.id}@${board.updated_at ?? ''}`).sort()
  const tree = folders.map((folder) => `${folder.id}|${folder.name}|${folder.parent?.id ?? ''}|${folder.children.map((b) => `${b.id}:${b.name}`).sort().join(',')}`).sort()
  return hash64(JSON.stringify([tree, stamps]))
}

/**
 * Reads the raw monday data the sync needs and nothing else: the folder tree, the columns of every
 * board inside an initiative, and the items of every board that looks like a project register.
 * The result is plain JSON. It can be saved to a file, uploaded to a test site and replayed with
 * discoverFromCapture, so everything after this step runs the same with or without a token.
 */
export async function captureWorkspace(client, { workspaceId, now = new Date().toISOString() } = {}) {
  if (!workspaceId) throw new Error('MONDAY_WORKSPACE_ID is not set.')
  const folders = (await fetchFolders(client, workspaceId)).map((folder) => ({
    id: String(folder.id),
    name: folder.name,
    parent: folder.parent ? { id: String(folder.parent.id) } : null,
    children: (folder.children ?? []).map((board) => ({ id: String(board.id), name: board.name })),
  }))
  const inInitiatives = placeBoards(folders).filter((entry) => entry.initiative)
  const columnInfo = await fetchColumns(client, inInitiatives.map((entry) => entry.board.id))
  const boards = await Promise.all(
    columnInfo.map(async (board) => {
      const columns = board.columns ?? []
      const items = isProjectRegister(columns) ? await fetchItems(client, String(board.id)) : []
      return { id: String(board.id), name: board.name, columns, items }
    }),
  )
  return { format: CAPTURE_FORMAT, version: CAPTURE_VERSION, capturedAt: now, workspaceId: String(workspaceId), folders, boards }
}

/** Turns a capture into the project list the merge step reads. Pure: no network, no clock. */
export function discoverFromCapture(
  rawCapture,
  { projectGroupTitle = 'Projects', ignoreTitles = DEFAULT_IGNORED_TITLES } = {},
) {
  const capture = validateCapture(rawCapture)
  const folders = capture.folders.map((folder) => ({ ...folder, id: String(folder.id) }))
  const placed = placeBoards(folders)
  const captured = new Map(capture.boards.map((board) => [String(board.id), board]))

  const warnings = []
  const skipped = []
  const ignored = new Set(ignoreTitles.map(norm))
  let placeholderRows = 0

  placed
    .filter((entry) => !entry.initiative)
    .forEach((entry) =>
      skipped.push({ board: entry.board.name, reason: `sits directly in pillar folder "${entry.folderName}", not in an initiative` }),
    )
  const inInitiatives = placed.filter((entry) => entry.initiative)

  const registers = inInitiatives.filter((entry) => {
    const columns = captured.get(entry.board.id)?.columns ?? []
    if (isProjectRegister(columns)) return true
    skipped.push({ board: entry.board.name, reason: `no project columns (${entry.folderName})` })
    return false
  })

  const boards = registers.map((entry) => {
    const { columns, items } = captured.get(entry.board.id)
    const columnIds = resolveColumns(columns)
    const absent = missingFields(columns)
    if (absent.length > 0) warnings.push(`Board "${entry.board.name}" has no column for: ${absent.join(', ')}.`)

    const inGroup = items.filter((item) => item.group?.title === projectGroupTitle)
    const used = inGroup.length > 0 ? inGroup : items
    if (inGroup.length === 0 && items.length > 0) {
      warnings.push(`Board "${entry.board.name}" has no "${projectGroupTitle}" group; read every item.`)
    }

    const real = used.filter((item) => !ignored.has(norm(item.name)))
    placeholderRows += used.length - real.length

    const projects = real.map((item) => mapItem(item, columnIds))
    projects.forEach((project) => warnings.push(...project.warnings))

    return {
      pillar: { id: entry.pillar.id, name: entry.pillar.name },
      initiative: { id: entry.initiative.id, name: entry.initiative.name },
      board: entry.board,
      projects: projects.map(({ warnings: _omit, ...project }) => project),
    }
  })

  if (placeholderRows > 0) {
    warnings.push(`Ignored ${placeholderRows} placeholder row(s) named ${ignoreTitles.map((title) => `"${title}"`).join(' or ')}.`)
  }

  return { boards, skipped, warnings }
}

export async function discoverProjects(client, { workspaceId, projectGroupTitle, ignoreTitles } = {}) {
  const capture = await captureWorkspace(client, { workspaceId })
  return discoverFromCapture(capture, { projectGroupTitle, ignoreTitles })
}
