// 🔌 Project: one project's status report, reached from any list (`#/project/<id>`).

import type { ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'project',
  title: 'Project',
  description: 'Status report and editor for a single project.',
  // Every role may read a project; no rail entry, it belongs to the portfolio.
  requires: null,
  activeNav: () => 'portfolio',
  load: () => import('./entry'),
}
