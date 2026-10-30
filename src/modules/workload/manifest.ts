// 🔌 Workload: everyone named in owner fields, and the PM heat map.

import { Icon, type ModuleManifest, type Role } from '@sdk'
import { layoutFeature, workloadLayout } from './routes'

const LEADERSHIP: Role[] = ['admin', 'editor', 'executive']

export const manifest: ModuleManifest = {
  id: 'workload',
  title: 'Workload',
  description: 'Projects per person by status and role, and the PM attention heat map.',
  icon: Icon.People,
  navOrder: 50,
  features: [
    { key: 'workload', label: 'Workload', defaultRoles: LEADERSHIP },
    { key: 'workload.pm-heatmap', label: 'PM heat map', parent: 'workload', defaultRoles: LEADERSHIP },
  ],
  requires: (location) => layoutFeature(workloadLayout(location)),
  load: () => import('./entry'),
}
