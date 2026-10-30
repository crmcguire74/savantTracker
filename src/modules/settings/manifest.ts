// 🔌 Settings: stale threshold, appearance, app install/update, data.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'settings',
  title: 'Settings',
  description: 'Stale threshold, theme, install and update, import and export.',
  icon: Icon.Settings,
  navOrder: 80,
  requires: null,
  load: () => import('./entry'),
}
