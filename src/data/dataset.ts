// 📌 Which dataset is this browser's data from?
//
// The browser-only build keeps its data in IndexedDB. The monday.com data
// ships inside each build (src/data/snapshot.json), so "a new dataset is
// available" means "this build carries a monday dataset the browser has not
// taken yet". A small marker in localStorage remembers which one it took.
//
//   no marker, or a different source  ->  offer it (once per dataset)
//   same source                       ->  nothing to do, local edits stay
//   "keep my data" was chosen         ->  stay quiet about that dataset
//   an older dataset than the marker  ->  never offered
//
// Only datasets whose source starts with "monday-sync" are offered, so a build
// that still carries the old artifact snapshot never nags anyone.
//
// Pure decision logic plus two tiny storage helpers. Storage can throw (private
// windows, blocked site data), so every read and write is wrapped.

export const DATASET_MARKER_KEY = 'savant-tracker:dataset'

export interface DatasetMarker {
  /** `source` of the dataset this browser's data was last loaded from. Empty when unknown. */
  source: string
  exportedAt: string
  /** A bundled dataset the person chose to keep their own data over. */
  dismissed?: string
}

export interface BundledDataset {
  source: string
  exportedAt: string
  projects: number
}

export interface DatasetOffer {
  source: string
  exportedAt: string
  bundledProjects: number
  localProjects: number
  /** True when this browser has never recorded where its data came from. */
  untracked: boolean
}

export const isMondayDataset = (source: string): boolean => source.startsWith('monday-sync')

export function decideDatasetOffer(
  bundled: BundledDataset,
  marker: DatasetMarker | null,
  localProjects: number,
): DatasetOffer | null {
  if (!isMondayDataset(bundled.source)) return null
  if (marker?.source === bundled.source) return null
  if (marker?.dismissed === bundled.source) return null
  if (marker?.exportedAt && bundled.exportedAt <= marker.exportedAt) return null
  return {
    source: bundled.source,
    exportedAt: bundled.exportedAt,
    bundledProjects: bundled.projects,
    localProjects,
    untracked: !marker?.source,
  }
}

type MarkerStore = Pick<Storage, 'getItem' | 'setItem'>

const browserStore = (): MarkerStore | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readMarker(store: MarkerStore | null = browserStore()): DatasetMarker | null {
  try {
    const raw = store?.getItem(DATASET_MARKER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DatasetMarker>
    if (typeof parsed.source !== 'string' || typeof parsed.exportedAt !== 'string') return null
    return {
      source: parsed.source,
      exportedAt: parsed.exportedAt,
      ...(typeof parsed.dismissed === 'string' ? { dismissed: parsed.dismissed } : {}),
    }
  } catch {
    return null
  }
}

export function writeMarker(marker: DatasetMarker, store: MarkerStore | null = browserStore()): void {
  try {
    store?.setItem(DATASET_MARKER_KEY, JSON.stringify(marker))
  } catch {
    // Storage blocked: the person is simply asked again next time.
  }
}
