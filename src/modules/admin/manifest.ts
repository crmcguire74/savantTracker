// 🔌 Admin: PMO upkeep (stale projects, open decisions, recent activity).

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'admin',
  title: 'Admin',
  description: 'Stale projects, the decision list, recent activity and sync status.',
  icon: Icon.Clipboard,
  navOrder: 60,
  // Replaced the old Reports view; a fresh key so grants made for Reports
  // don't carry over to a page built for the PMO.
  features: [{ key: 'admin', label: 'Admin page', defaultRoles: ['admin', 'editor'] }],
  requires: 'admin',
  redirects: {
    // Links saved before the Reports page became Admin.
    reports: (location) =>
      location.params.report === 'pillar-one-pager'
        ? { module: 'onepager', params: { pillar: location.params.pillar } }
        : { module: 'admin' },
  },
  load: () => import('./entry'),
}
