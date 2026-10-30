// 🔌 My work: decisions, issues and milestones on the projects someone owns.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'work',
  title: 'My work',
  description: 'Your open decisions, issues and milestones, with in-place actions.',
  icon: Icon.Person,
  navOrder: 40,
  features: [{ key: 'work', label: 'My work', defaultRoles: ['admin', 'editor'] }],
  requires: 'work',
  // Someone else's work is reached from Workload, so it lights that up.
  activeNav: (location, platform) =>
    location.params.person && location.params.person !== platform.me?.key ? 'workload' : 'work',
  load: () => import('./entry'),
}
