// 🔌 Timeline: a twelve-month window of schedules and milestones.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'timeline',
  title: 'Timeline',
  description: 'Start-to-forecast bars, milestones and a today line, paged by quarter.',
  icon: Icon.Timeline,
  navOrder: 30,
  usesFilters: true,
  features: [{ key: 'timeline', label: 'Timeline', defaultRoles: ['admin', 'editor', 'executive', 'viewer'] }],
  requires: 'timeline',
  load: () => import('./entry'),
}
