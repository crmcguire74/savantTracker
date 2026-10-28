// 🙋 Which person in the owner fields is the signed-in user? The signed-in
// name is matched first. When that misses (owner fields say "Padman", the
// sign-in says "Padman Perumal" is fine; a nickname or a typo may not be),
// the user picks themself once and the choice is kept in this browser,
// per identity, so a shared laptop does not mix people up.

import { useCallback, useMemo, useState } from 'react'
import { matchPerson, type Person } from '../lib/people'
import type { Identity } from '../types'

const STORAGE_KEY = 'savant-tracker:me'

const readClaims = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function useMe(identity: Identity, people: Person[]) {
  const [claims, setClaims] = useState<Record<string, string>>(readClaims)
  const claimed = claims[identity.id]

  const me = useMemo<Person | null>(() => {
    if (claimed) {
      const person = people.find((candidate) => candidate.key === claimed)
      if (person) return person
    }
    return matchPerson(people, identity.name)
  }, [claimed, people, identity.name])

  const claim = useCallback(
    (personKey: string | null) => {
      setClaims((current) => {
        const next = { ...current }
        if (personKey) next[identity.id] = personKey
        else delete next[identity.id]
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Private windows throw; the claim still holds for this session.
        }
        return next
      })
    },
    [identity.id],
  )

  return { me, claimed: Boolean(claimed && me?.key === claimed), claim }
}
