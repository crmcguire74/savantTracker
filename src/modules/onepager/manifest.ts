// 🔌 One-pager: the printable pillar report, opened from the leadership brief.

import type { ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'onepager',
  title: 'Pillar one-pager',
  description: 'Print-ready landscape page per pillar for the leadership deck.',
  requires: 'portfolio.brief',
  activeNav: () => 'portfolio',
  load: () => import('./entry'),
}
