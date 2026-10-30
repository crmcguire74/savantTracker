// 🧭 The workload module's URL: `#/workload?layout=pm-heatmap`; people is the default.

import type { FeatureKey, Location } from '@sdk'

export type WorkloadLayout = 'people' | 'pm-heatmap'

export const workloadLayout = (location: Location): WorkloadLayout =>
  location.params.layout === 'pm-heatmap' ? 'pm-heatmap' : 'people'

export const layoutFeature = (layout: WorkloadLayout): FeatureKey => (layout === 'pm-heatmap' ? 'workload.pm-heatmap' : 'workload')
