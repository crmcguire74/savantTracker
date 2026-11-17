// 🏗️ The browser's handle on structure write-back (server/monday/writeback.js).
//
// While the server pulls live from monday, a new pillar, initiative or project, a rename, or moving
// an initiative to another pillar goes through the server: it changes monday first, then saves the
// tracker record already linked, so the next pull finds it and adds no copy. Fields monday has no
// property for (pillar owner; initiative scope statement, owners and quarters) travel in the same
// call and are stored in the tracker only.
//
// Nothing here talks to React. useTracker decides when to call it (live and linked) and when to
// save in the browser instead (test mode, or a record the tracker made before monday was connected).

import type { Initiative, Pillar } from '../types'

export class StructureRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'StructureRequestError'
    this.status = status
  }
}

export interface CreatedRecord {
  id: string
  mondayId: string
  mondayBoardId?: string
  /** True when monday already had a record with that name and the tracker linked to it. */
  linkedExisting: boolean
  warnings?: string[]
}

export interface UpdatedRecord {
  id: string
  pushedToMonday: boolean
}

export type PillarInput = Partial<Pick<Pillar, 'title' | 'owner'>>
export type InitiativeInput = Partial<
  Pick<Initiative, 'title' | 'pillarId' | 'scope' | 'businessOwner' | 'executionOwner' | 'startQuarter' | 'endQuarter'>
>

export interface StructureApi {
  createPillar(input: PillarInput): Promise<CreatedRecord>
  updatePillar(id: string, input: PillarInput): Promise<UpdatedRecord>
  createInitiative(input: InitiativeInput & { pillarId: string; title: string }): Promise<CreatedRecord>
  updateInitiative(id: string, input: InitiativeInput): Promise<UpdatedRecord>
  createProject(input: { initiativeId: string; title: string; businessOwner: string; executionOwner: string }): Promise<CreatedRecord>
}

export interface StructureApiDeps {
  apiBase?: string
  headers?: () => Record<string, string>
  fetchImpl?: typeof fetch
}

export function createStructureApi(deps: StructureApiDeps = {}): StructureApi {
  const apiBase = (deps.apiBase ?? '/api').replace(/\/$/, '')

  async function call<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
    const impl = deps.fetchImpl ?? fetch.bind(globalThis)
    let response: Response
    try {
      response = await impl(`${apiBase}/structure/${path}`, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(deps.headers?.() ?? {}) },
        body: JSON.stringify(body),
      })
    } catch {
      throw new StructureRequestError('Cannot reach the tracker server.', 0)
    }
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new StructureRequestError(data.error ?? `The server answered ${response.status}.`, response.status)
    return data as T
  }

  const id = (value: string) => encodeURIComponent(value)

  return {
    createPillar: (input) => call('pillars', 'POST', input),
    updatePillar: (pillarId, input) => call(`pillars/${id(pillarId)}`, 'PATCH', input),
    createInitiative: (input) => call('initiatives', 'POST', input),
    updateInitiative: (initiativeId, input) => call(`initiatives/${id(initiativeId)}`, 'PATCH', input),
    createProject: (input) => call('projects', 'POST', input),
  }
}
