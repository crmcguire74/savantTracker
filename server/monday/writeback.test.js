// Write-back of structure changes to monday.com, against a fake monday that keeps its own folders,
// boards and items. The point of most of these tests: no path makes a duplicate, and a pull after a
// write-back changes nothing.

import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../memory-store.js'
import { discoverFromCapture } from './discover.js'
import { FIELD_COLUMNS, SYNCED_FIELDS } from './mapping.js'
import { mergeMonday } from './merge.js'
import { createWriteback, findInTracker, titleKey, upsert, updateFolderMutation } from './writeback.js'

const NOW = '2026-11-16T12:00:00.000Z'
const ME = { id: 'u1', name: 'Chris' }
const COLUMNS = SYNCED_FIELDS.map((field) => ({ id: `c_${field}`, title: FIELD_COLUMNS[field][0], type: 'text' }))

/** A tiny in-memory monday: folders, boards (columns, groups, items). Records every mutation. */
function fakeMonday() {
  const db = {
    folders: [
      { id: '1', name: 'Pillar One', parent: null },
      { id: '2', name: 'Initiative One', parent: '1' },
    ],
    boards: [{ id: '101', name: 'Initiative One', folder: '2', columns: COLUMNS, groups: [{ id: 'g1', title: 'Projects' }], items: [] }],
    seq: 500,
    calls: [],
  }
  const query = async (gql, vars = {}) => {
    const op = (gql.match(/\b(folders|boards|create_folder|update_folder|duplicate_board|create_item|next_items_page)\b/) ?? [])[1]
    db.calls.push({ op, vars })
    switch (op) {
      case 'folders':
        return {
          folders: (vars.page ?? 1) > 1 ? [] : db.folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            parent: folder.parent ? { id: folder.parent } : null,
            children: db.boards.filter((board) => board.folder === folder.id).map((board) => ({ id: board.id, name: board.name })),
          })),
        }
      case 'boards': {
        const boards = db.boards.filter((board) => vars.ids.map(String).includes(board.id))
        if (/items_page/.test(gql)) {
          return { boards: boards.map((board) => ({ items_page: { cursor: null, items: board.items } })) }
        }
        return { boards: boards.map((board) => ({ id: board.id, name: board.name, columns: board.columns, groups: board.groups, updated_at: NOW })) }
      }
      case 'create_folder': {
        const folder = { id: String((db.seq += 1)), name: vars.name, parent: vars.parent ?? null }
        db.folders.push(folder)
        return { create_folder: { id: folder.id, name: folder.name } }
      }
      case 'update_folder': {
        const folder = db.folders.find((candidate) => candidate.id === vars.id)
        if (vars.name) folder.name = vars.name
        if (vars.parent) folder.parent = vars.parent
        return { update_folder: { id: folder.id, name: folder.name } }
      }
      case 'duplicate_board': {
        const source = db.boards.find((board) => board.id === vars.board)
        const board = { id: String((db.seq += 1)), name: vars.name, folder: vars.folder, columns: source.columns, groups: source.groups, items: [] }
        db.boards.push(board)
        return { duplicate_board: { board: { id: board.id, name: board.name } } }
      }
      case 'create_item': {
        const board = db.boards.find((candidate) => candidate.id === vars.board)
        const values = JSON.parse(vars.values || '{}')
        const item = {
          id: String((db.seq += 1)),
          name: vars.name,
          updated_at: NOW,
          group: board.groups.find((group) => group.id === vars.group) ?? board.groups[0],
          column_values: board.columns.map((column) => ({ id: column.id, type: 'text', text: values[column.id] ?? '' })),
        }
        board.items.push(item)
        return { create_item: { id: item.id, name: item.name } }
      }
      default:
        throw new Error(`fake monday cannot answer: ${gql}`)
    }
  }
  const capture = () => ({
    format: 'monday-capture',
    version: 1,
    capturedAt: NOW,
    workspaceId: '7',
    folders: db.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parent: folder.parent ? { id: folder.parent } : null,
      children: db.boards.filter((board) => board.folder === folder.id).map((board) => ({ id: board.id, name: board.name })),
    })),
    boards: db.boards.map((board) => ({ id: board.id, name: board.name, columns: board.columns, items: board.items })),
  })
  return { db, client: { query }, capture }
}

/** A tracker already synced once from the fake monday. */
async function setup({ live = true } = {}) {
  const monday = fakeMonday()
  const empty = { quarter: 'Q', pillars: [], initiatives: [], projects: [] }
  const synced = mergeMonday(empty, discoverFromCapture(monday.capture()), { now: NOW }).state
  const store = createMemoryStore([{ key: 'tracker.state', value: synced, version: 1, updatedAt: '' }])
  const writeback = createWriteback({ store, client: () => monday.client, workspaceId: '7', live, clock: () => NOW })
  const state = async () => (await store.readDocument('tracker.state')).doc.value
  /** Pull monday into the stored state the way the sync does, and report what changed. */
  const pull = async () => {
    const result = mergeMonday(await state(), discoverFromCapture(monday.capture()), { now: NOW })
    return result
  }
  return { monday, store, writeback, state, pull }
}

describe('helpers', () => {
  it('compares names without case, punctuation or the "Pillar N:" prefix', () => {
    expect(titleKey('Pillar 2: Build a Platform!')).toBe(titleKey('build a platform'))
  })

  it('finds a same-named record under the same parent only', () => {
    const state = {
      pillars: [{ id: 'p1', title: 'Growth' }],
      initiatives: [{ id: 'i1', pillarId: 'p1', title: 'Lead Gen' }],
      projects: [{ id: 'x', initiativeId: 'i1', title: 'Owl 2.0' }],
    }
    expect(findInTracker(state, 'initiative', 'lead gen', 'p1')?.id).toBe('i1')
    expect(findInTracker(state, 'initiative', 'lead gen', 'p2')).toBeNull()
    expect(findInTracker(state, 'project', 'OWL 2.0', 'i1')?.id).toBe('x')
  })

  it('upserts by id or monday link, never appending a second copy', () => {
    const first = upsert([{ id: 'init-monday-9', mondayId: '9', title: 'From sync', scope: '' }], { id: 'init-monday-9', mondayId: '9', title: 'From app', scope: 'Why' })
    expect(first.list).toHaveLength(1)
    expect(first.added).toBe(false)
    expect(first.list[0].scope).toBe('Why')
  })

  it('leaves optional arguments out of the folder mutation', () => {
    expect(updateFolderMutation({ name: 'X' })).not.toMatch(/parent_folder_id/)
    expect(updateFolderMutation({ parent: '3' })).not.toMatch(/name:/)
  })
})

describe('create', () => {
  it('creates a pillar folder in monday and a linked pillar in the tracker', async () => {
    const { monday, writeback, state, pull } = await setup()
    const result = await writeback.createPillar({ title: 'Grow Talent', owner: 'Brent' }, ME)
    expect(result.linkedExisting).toBe(false)
    const folder = monday.db.folders.find((candidate) => candidate.name === 'Grow Talent')
    expect(folder.parent).toBeNull()
    const pillar = (await state()).pillars.find((candidate) => candidate.id === result.id)
    expect(pillar).toMatchObject({ id: `obj-monday-${folder.id}`, title: 'Grow Talent', owner: 'Brent', mondayId: folder.id })
    expect((await pull()).changed).toBe(false)
  })

  it('creates an initiative: sub-folder, register board copied from an existing one, linked record', async () => {
    const { monday, writeback, state, pull } = await setup()
    const pillarId = (await state()).pillars[0].id
    const result = await writeback.createInitiative(
      { pillarId, title: 'Mentor Program', scope: 'Pair new advisors', businessOwner: 'Ann', executionOwner: 'Bo', startQuarter: 'Q1 2027', endQuarter: 'Q4 2027' },
      ME,
    )
    const folder = monday.db.folders.find((candidate) => candidate.name === 'Mentor Program')
    expect(folder.parent).toBe('1')
    const board = monday.db.boards.find((candidate) => candidate.folder === folder.id)
    expect(board.name).toBe('Mentor Program')
    expect(monday.db.calls.find((call) => call.op === 'duplicate_board').vars.board).toBe('101')
    const initiative = (await state()).initiatives.find((candidate) => candidate.id === result.id)
    expect(initiative).toMatchObject({ pillarId, title: 'Mentor Program', scope: 'Pair new advisors', startQuarter: 'Q1 2027', mondayId: folder.id, mondayBoardId: board.id })
    const after = await pull()
    expect(after.summary.initiativesCreated).toBe(0)
    expect(after.state.initiatives.filter((candidate) => candidate.title === 'Mentor Program')).toHaveLength(1)
  })

  it('creates a project as an item in the Projects group with the owners, and a pull adds no copy', async () => {
    const { monday, writeback, state, pull } = await setup()
    const initiativeId = (await state()).initiatives[0].id
    const result = await writeback.createProject({ initiativeId, title: 'Project Lynx', businessOwner: 'Ann', executionOwner: 'Bo' }, ME)
    const item = monday.db.boards[0].items.find((candidate) => candidate.name === 'Project Lynx')
    expect(item.group.title).toBe('Projects')
    expect(item.column_values.find((cell) => cell.id === 'c_businessOwner').text).toBe('Ann')
    const project = (await state()).projects.find((candidate) => candidate.id === result.id)
    expect(project).toMatchObject({ id: `proj-monday-${item.id}`, mondayId: item.id, mondayBoardId: '101', businessOwner: 'Ann', executionOwner: 'Bo' })
    const after = await pull()
    expect(after.summary.projectsCreated).toBe(0)
    expect(after.state.projects.filter((candidate) => candidate.title === 'Project Lynx')).toHaveLength(1)
  })

  it('refuses a name the tracker already has under the same parent', async () => {
    const { writeback, state, monday } = await setup()
    const pillarId = (await state()).pillars[0].id
    await expect(writeback.createInitiative({ pillarId, title: 'initiative one' }, ME)).rejects.toThrow('already exists')
    await expect(writeback.createPillar({ title: 'PILLAR ONE' }, ME)).rejects.toThrow('already exists')
    expect(monday.db.calls.some((call) => call.op === 'create_folder')).toBe(false)
  })

  it('links to a folder that monday has but the tracker does not, instead of creating a second one', async () => {
    const { monday, writeback, state } = await setup()
    monday.db.folders.push({ id: '77', name: 'Client Experience', parent: null })
    const result = await writeback.createPillar({ title: 'client experience', owner: 'Dee' }, ME)
    expect(result.linkedExisting).toBe(true)
    expect(result.mondayId).toBe('77')
    expect(monday.db.calls.some((call) => call.op === 'create_folder')).toBe(false)
    expect((await state()).pillars.find((pillar) => pillar.mondayId === '77')).toMatchObject({ title: 'Client Experience', owner: 'Dee' })
  })

  it('finishes a half-made initiative: reuses its folder and adds the missing register', async () => {
    const { monday, writeback, state } = await setup()
    monday.db.folders.push({ id: '88', name: 'Half Made', parent: '1' })
    const pillarId = (await state()).pillars[0].id
    const result = await writeback.createInitiative({ pillarId, title: 'Half Made' }, ME)
    expect(result).toMatchObject({ mondayId: '88', linkedExisting: true })
    expect(monday.db.boards.some((board) => board.folder === '88')).toBe(true)
    expect(monday.db.calls.some((call) => call.op === 'create_folder')).toBe(false)
  })

  it('links to an item already on the register instead of creating it again', async () => {
    const { monday, writeback, state } = await setup()
    monday.db.boards[0].items.push({ id: '4242', name: 'Project Heron', updated_at: NOW, group: { id: 'g1', title: 'Projects' }, column_values: [] })
    const initiativeId = (await state()).initiatives[0].id
    const result = await writeback.createProject({ initiativeId, title: 'project heron' }, ME)
    expect(result).toMatchObject({ mondayId: '4242', linkedExisting: true })
    expect(monday.db.calls.some((call) => call.op === 'create_item')).toBe(false)
  })

  it('keeps one record when a pull lands between the monday create and the tracker write', async () => {
    const { monday, store, state } = await setup()
    // A client that runs a full pull right after monday creates the register board, before the
    // write-back saves its own record.
    const racing = {
      query: async (gql, vars) => {
        const data = await monday.client.query(gql, vars)
        if (/duplicate_board/.test(gql)) {
          const doc = (await store.readDocument('tracker.state')).doc
          const merged = mergeMonday(doc.value, discoverFromCapture(monday.capture()), { now: NOW }).state
          await store.writeDocument('tracker.state', merged, doc.version)
        }
        return data
      },
    }
    const writeback = createWriteback({ store, client: () => racing, workspaceId: '7', live: true, clock: () => NOW })
    const pillarId = (await state()).pillars[0].id
    await writeback.createInitiative({ pillarId, title: 'Race Day', scope: 'From the app' }, ME)
    const matches = (await state()).initiatives.filter((initiative) => initiative.title === 'Race Day')
    expect(matches).toHaveLength(1)
    expect(matches[0].scope).toBe('From the app')
  })

  it('refuses names the sync ignores, and refuses to create anything when monday is not live', async () => {
    const { writeback, state } = await setup()
    const initiativeId = (await state()).initiatives[0].id
    await expect(writeback.createProject({ initiativeId, title: 'Rename' }, ME)).rejects.toThrow('ignores')
    const offline = (await setup({ live: false })).writeback
    await expect(offline.createPillar({ title: 'Anything' }, ME)).rejects.toThrow('not connected')
  })

  it('writes nothing to the tracker when monday refuses', async () => {
    const { store, state } = await setup()
    const before = JSON.stringify(await state())
    const failing = { query: async () => { throw Object.assign(new Error('Unauthorized'), { name: 'MondayError' }) } }
    const writeback = createWriteback({ store, client: () => failing, workspaceId: '7', live: true, clock: () => NOW })
    await expect(writeback.createPillar({ title: 'Nope' }, ME)).rejects.toThrow('Unauthorized')
    expect(JSON.stringify(await state())).toBe(before)
  })
})

describe('update', () => {
  it('renames a linked initiative in monday first, and the next pull changes nothing', async () => {
    const { monday, writeback, state, pull } = await setup()
    const initiative = (await state()).initiatives[0]
    const result = await writeback.updateInitiative(initiative.id, { title: 'Initiative Uno', scope: 'New scope', endQuarter: 'Q2 2027' }, ME)
    expect(result.pushedToMonday).toBe(true)
    expect(monday.db.folders.find((folder) => folder.id === '2').name).toBe('Initiative Uno')
    expect((await state()).initiatives[0]).toMatchObject({ title: 'Initiative Uno', scope: 'New scope', endQuarter: 'Q2 2027' })
    const after = await pull()
    expect(after.summary.initiativesRenamed).toBe(0)
    expect(after.state.initiatives[0].scope).toBe('New scope')
  })

  it('moves a linked initiative to another linked pillar by moving its monday folder', async () => {
    const { monday, writeback, state, pull } = await setup()
    const target = await writeback.createPillar({ title: 'Pillar Two' }, ME)
    const initiative = (await state()).initiatives[0]
    await writeback.updateInitiative(initiative.id, { pillarId: target.id }, ME)
    expect(monday.db.folders.find((folder) => folder.id === '2').parent).toBe(target.mondayId)
    expect((await state()).initiatives[0].pillarId).toBe(target.id)
    expect((await pull()).state.initiatives[0].pillarId).toBe(target.id)
  })

  it('stores fields monday has no property for without calling monday', async () => {
    const { monday, writeback, state } = await setup()
    const pillar = (await state()).pillars[0]
    const before = monday.db.calls.length
    const result = await writeback.updatePillar(pillar.id, { owner: 'Brent Brodeski' }, ME)
    expect(result.pushedToMonday).toBe(false)
    expect(monday.db.calls.length).toBe(before)
    expect((await state()).pillars[0].owner).toBe('Brent Brodeski')
  })

  it('renames a linked pillar in monday and logs who did it', async () => {
    const { monday, writeback, state, store } = await setup()
    const pillar = (await state()).pillars[0]
    await writeback.updatePillar(pillar.id, { title: 'Pillar One Renamed' }, ME)
    expect(monday.db.folders.find((folder) => folder.id === '1').name).toBe('Pillar One Renamed')
    const log = (await store.readDocument('tracker.log')).doc.value.entries
    expect(log[0]).toMatchObject({ field: 'Pillar renamed', oldValue: 'Pillar One', newValue: 'Pillar One Renamed', editedByName: 'Chris' })
  })
})
