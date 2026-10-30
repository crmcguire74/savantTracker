// 🧭 The portfolio module's URL: `#/portfolio?layout=…&pillar=…&initiative=…`.
// Shared by the manifest (access per layout) and the views (links). Other
// modules link here with plain params; this file is not exported to them.

import type { FeatureKey, Location } from '@sdk'

export type PortfolioLayout = 'ledger' | 'heatmap' | 'brief' | 'pace'

const LAYOUTS: readonly PortfolioLayout[] = ['ledger', 'heatmap', 'brief', 'pace']

export const portfolioLayout = (location: Location): PortfolioLayout =>
  LAYOUTS.find((layout) => layout === location.params.layout) ?? 'ledger'

/** Each layout is its own access feature, so the brief can be leadership-only. */
export const layoutFeature = (layout: PortfolioLayout): FeatureKey => (layout === 'ledger' ? 'portfolio' : `portfolio.${layout}`)
