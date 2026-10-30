// 👥 People, derived. Owner fields are free text ("Padman / Daran for
// technology delivery", "Business owner: TBD", "Kevin and Zach"), so the
// directory is built by pulling the human names out of that prose and folding
// obvious duplicates together. Nothing here is stored; it is recomputed from
// the tracker state every time.

import type { Project, TrackerState } from '../types'

export type OwnerRole = 'business' | 'delivery' | 'pm'

export interface Person {
  /** Stable lowercase key, e.g. "padman perumal". */
  key: string
  name: string
  initials: string
  business: string[]
  delivery: string[]
  pm: string[]
  /** Every project id this person owns in any role, de-duplicated. */
  projectIds: string[]
}

/** First words that introduce a label or a team, never a person. */
const STOP_WORDS = new Set([
  'tbd', 'tba', 'n/a', 'na', 'none', 'unassigned', 'not', 'owner', 'owners', 'business', 'delivery',
  'execution', 'project', 'pm', 'pmo', 'technology', 'tech', 'final', 'replacement', 'confirm', 'change',
  'advisory', 'leadership', 'team', 'teams', 'support', 'the', 'named', 'ops', 'operations', 'platform',
  'program', 'product', 'data', 'marketing', 'finance', 'sales', 'various', 'multiple', 'other', 'others',
  'vendor', 'partner', 'executive', 'exec', 'committee', 'steering', 'group', 'manager', 'lead', 'leads',
])

const NICKNAMES: Record<string, string> = {
  tony: 'anthony', tom: 'thomas', tommy: 'thomas', mike: 'michael', jim: 'james', jimmy: 'james',
  bob: 'robert', rob: 'robert', bill: 'william', will: 'william', dave: 'david', dan: 'daniel',
  chris: 'christopher', matt: 'matthew', nick: 'nicholas', steve: 'steven', joe: 'joseph', alex: 'alexander',
  kate: 'katherine', katie: 'katherine', liz: 'elizabeth', beth: 'elizabeth', jen: 'jennifer', jenny: 'jennifer',
  sam: 'samuel', ben: 'benjamin', andy: 'andrew', drew: 'andrew', greg: 'gregory', jeff: 'jeffrey', ken: 'kenneth',
  rick: 'richard', rich: 'richard', dick: 'richard', pat: 'patrick', zack: 'zachary', zach: 'zachary',
}

const canonicalFirst = (first: string): string => NICKNAMES[first] ?? first

const NAME_WORD = /^[A-Z][a-z][A-Za-z'’-]*$/

/** Pulls person names out of one free-text owner field. */
export function extractNames(raw: string): string[] {
  if (!raw) return []
  const cleaned = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(business owner|delivery owner|execution owner|project manager|owner|pm)\s*:/gi, ' ')
    .replace(/[?!.]/g, ' ')

  const segments = cleaned.split(/[/,;&+]|\band\b|\bthrough\b|\bvia\b|\bwith\b|\bplus\b/i)
  const names: string[] = []

  for (const segment of segments) {
    // "Padman for platform enablement", "Nicole from BridgeNext" keep the name only.
    const trimmed = segment.replace(/\s+(from|for|to|on|as|at|in|of|closely|coordinating)\b.*$/i, '').trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/)
    const taken: string[] = []
    for (const word of words) {
      if (taken.length >= 3) break
      if (!NAME_WORD.test(word)) break
      if (STOP_WORDS.has(word.toLowerCase())) break
      taken.push(word)
    }
    if (taken.length && !STOP_WORDS.has(words[0].toLowerCase())) names.push(taken.join(' '))
  }

  return Array.from(new Set(names))
}

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

const ROLE_FIELDS: Record<OwnerRole, keyof Pick<Project, 'businessOwner' | 'executionOwner' | 'projectManager'>> = {
  business: 'businessOwner',
  delivery: 'executionOwner',
  pm: 'projectManager',
}

/**
 * Builds the people directory. Duplicates fold in three passes:
 *   1. same first name (nicknames resolved) and a near-identical surname
 *   2. a bare first name joins the most common full name that shares it
 * Distinct people who share only a first name are left separate.
 */
export function buildPeople(state: Pick<TrackerState, 'projects'>): Person[] {
  const mentions = new Map<string, { name: string; count: number }>()
  const projectNames: Array<{ projectId: string; role: OwnerRole; name: string }> = []

  for (const project of state.projects) {
    for (const role of Object.keys(ROLE_FIELDS) as OwnerRole[]) {
      for (const name of extractNames(project[ROLE_FIELDS[role]])) {
        const key = name.toLowerCase()
        const entry = mentions.get(key) ?? { name, count: 0 }
        entry.count += 1
        mentions.set(key, entry)
        projectNames.push({ projectId: project.id, role, name: key })
      }
    }
  }

  const alias = new Map<string, string>()
  const fullNames = [...mentions.keys()].filter((key) => key.includes(' '))
  const byCount = (a: string, b: string) => (mentions.get(b)?.count ?? 0) - (mentions.get(a)?.count ?? 0)

  // Pass 1: full-name near-duplicates ("Padman Permual" → "Padman Perumal", "Tony Behrens" → "Anthony Behrens").
  const sortedFull = fullNames.slice().sort(byCount)
  for (let i = 0; i < sortedFull.length; i += 1) {
    const candidate = sortedFull[i]
    if (alias.has(candidate)) continue
    const [first, ...restParts] = candidate.split(' ')
    const last = restParts.join(' ')
    for (let j = 0; j < i; j += 1) {
      const target = alias.get(sortedFull[j]) ?? sortedFull[j]
      const [targetFirst, ...targetRest] = target.split(' ')
      const targetLast = targetRest.join(' ')
      if (canonicalFirst(first) === canonicalFirst(targetFirst) && editDistance(last, targetLast) <= 2) {
        alias.set(candidate, target)
        break
      }
    }
  }

  // Pass 2: bare first names join a full name ("Padman" → "Padman Perumal").
  for (const key of mentions.keys()) {
    if (key.includes(' ')) continue
    const match = sortedFull.find((full) => !alias.has(full) && canonicalFirst(full.split(' ')[0]) === canonicalFirst(key))
    if (match) alias.set(key, match)
  }

  const resolve = (key: string): string => alias.get(key) ?? key
  const people = new Map<string, Person>()

  for (const { projectId, role, name } of projectNames) {
    const key = resolve(name)
    let person = people.get(key)
    if (!person) {
      const display = mentions.get(key)?.name ?? name
      person = { key, name: display, initials: initialsOf(display), business: [], delivery: [], pm: [], projectIds: [] }
      people.set(key, person)
    }
    if (!person[role].includes(projectId)) person[role].push(projectId)
    if (!person.projectIds.includes(projectId)) person.projectIds.push(projectId)
  }

  return [...people.values()].sort((a, b) => b.projectIds.length - a.projectIds.length || a.name.localeCompare(b.name))
}

/** Owner roles a person holds on one project. */
export function rolesOn(person: Person, projectId: string): OwnerRole[] {
  return (['business', 'delivery', 'pm'] as OwnerRole[]).filter((role) => person[role].includes(projectId))
}

/**
 * Finds the directory entry for a signed-in name. Exact full name first, then
 * a unique first-name match. Returns null when the name is not an owner.
 */
export function matchPerson(people: Person[], name: string): Person | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const exact = people.find((person) => person.key === wanted)
  if (exact) return exact
  const [first, ...rest] = wanted.split(/\s+/)
  const last = rest[rest.length - 1]
  if (last) {
    const sameFull = people.find((person) => {
      const parts = person.key.split(' ')
      return parts.length > 1 && canonicalFirst(parts[0]) === canonicalFirst(first) && parts[parts.length - 1] === last
    })
    if (sameFull) return sameFull
  }
  const firstOnly = people.filter((person) => canonicalFirst(person.key.split(' ')[0]) === canonicalFirst(first))
  return firstOnly.length === 1 ? firstOnly[0] : null
}
