import { describe, expect, it } from 'vitest'
import {
  DATASET_MARKER_KEY,
  decideDatasetOffer,
  isMondayDataset,
  readMarker,
  writeMarker,
  type BundledDataset,
  type DatasetMarker,
} from './dataset'

const BUNDLED: BundledDataset = { source: 'monday-sync-2026-11-10', exportedAt: '2026-11-10T15:00:00.000Z', projects: 27 }
const TOOK_OLDER: DatasetMarker = { source: 'monday-sync-2026-11-02', exportedAt: '2026-11-02T18:54:00.000Z' }

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    data,
  }
}

describe('dataset offer', () => {
  it('offers a newer monday dataset to a browser that took an older one', () => {
    expect(decideDatasetOffer(BUNDLED, TOOK_OLDER, 20)).toEqual({
      source: 'monday-sync-2026-11-10',
      exportedAt: '2026-11-10T15:00:00.000Z',
      bundledProjects: 27,
      localProjects: 20,
      untracked: false,
    })
  })

  it('offers it to a browser that never recorded where its data came from', () => {
    const offer = decideDatasetOffer(BUNDLED, null, 43)
    expect(offer?.untracked).toBe(true)
    expect(offer?.localProjects).toBe(43)
  })

  it('stays quiet when the browser already has this dataset, whatever was edited since', () => {
    const same: DatasetMarker = { source: BUNDLED.source, exportedAt: BUNDLED.exportedAt }
    expect(decideDatasetOffer(BUNDLED, same, 12)).toBeNull()
  })

  it('stays quiet after "keep my data", and asks again for the next dataset', () => {
    const kept: DatasetMarker = { ...TOOK_OLDER, dismissed: BUNDLED.source }
    expect(decideDatasetOffer(BUNDLED, kept, 20)).toBeNull()
    const next: BundledDataset = { source: 'monday-sync-2026-11-17', exportedAt: '2026-11-17T15:00:00.000Z', projects: 30 }
    expect(decideDatasetOffer(next, kept, 20)?.source).toBe('monday-sync-2026-11-17')
  })

  it('never offers a dataset older than the one the browser has', () => {
    const newer: DatasetMarker = { source: 'monday-sync-2026-11-20', exportedAt: '2026-11-20T09:00:00.000Z' }
    expect(decideDatasetOffer(BUNDLED, newer, 30)).toBeNull()
  })

  it('only offers monday datasets, so the old artifact snapshot never prompts', () => {
    const artifact: BundledDataset = { source: 'claude-artifact-db', exportedAt: '2026-09-01T00:00:00.000Z', projects: 43 }
    expect(decideDatasetOffer(artifact, null, 5)).toBeNull()
    expect(isMondayDataset('monday-sync-2026-11-02')).toBe(true)
    expect(isMondayDataset('app-export')).toBe(false)
  })
})

describe('dataset marker storage', () => {
  it('round-trips a marker, including a dismissed dataset', () => {
    const store = memoryStore()
    writeMarker({ ...TOOK_OLDER, dismissed: 'monday-sync-2026-11-10' }, store)
    expect(readMarker(store)).toEqual({ ...TOOK_OLDER, dismissed: 'monday-sync-2026-11-10' })
  })

  it('reads nothing from an empty, damaged or wrongly shaped value', () => {
    expect(readMarker(memoryStore())).toBeNull()
    expect(readMarker(memoryStore({ [DATASET_MARKER_KEY]: '{not json' }))).toBeNull()
    expect(readMarker(memoryStore({ [DATASET_MARKER_KEY]: JSON.stringify({ source: 4 }) }))).toBeNull()
    expect(readMarker(null)).toBeNull()
  })

  it('survives a store that throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readMarker(blocked)).toBeNull()
    expect(() => writeMarker(TOOK_OLDER, blocked)).not.toThrow()
  })
})
