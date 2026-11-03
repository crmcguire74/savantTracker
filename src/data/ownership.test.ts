// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isMondayField, ownedByMonday } from './ownership'

describe('field ownership', () => {
  it('locks synced fields on linked projects, only while the sync is live', () => {
    expect(ownedByMonday({ mondayId: '9001' }, 'rag', true)).toBe(true)
    expect(ownedByMonday({ mondayId: '9001' }, 'rag', false)).toBe(false)
  })

  it('leaves tracker-only fields and unlinked projects alone', () => {
    expect(ownedByMonday({ mondayId: '9001' }, 'decisionOutcome', true)).toBe(false)
    expect(ownedByMonday({ mondayId: '9001' }, 'planLink', true)).toBe(false)
    expect(ownedByMonday({}, 'rag', true)).toBe(false)
    expect(ownedByMonday(undefined, 'rag', true)).toBe(false)
  })

  it('owns the same fields the sync writes', () => {
    expect(isMondayField('businessOwner')).toBe(true)
    expect(isMondayField('issues')).toBe(false)
  })
})
