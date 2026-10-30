// 🔌 __TITLE__: __DESCRIPTION__

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: '__ID__',
  title: '__TITLE__',
  description: '__DESCRIPTION__',
  icon: Icon.Clipboard,
  navOrder: __ORDER__,
  // The access feature this module adds. Admins grant it on the Access page.
  features: [{ key: '__ID__', label: '__TITLE__', defaultRoles: ['admin', 'editor'] }],
  requires: '__ID__',
  load: () => import('./entry'),
}
