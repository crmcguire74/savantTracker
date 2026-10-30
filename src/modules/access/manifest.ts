// 🔌 Access: who sees which views and reports. Admin role only.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'access',
  title: 'Access',
  description: 'Edit the access policy: which roles see each view, layout and report.',
  icon: Icon.Shield,
  navOrder: 70,
  // Decided by role, not policy, so no edit can lock admins out of this page.
  adminOnly: true,
  load: () => import('./entry'),
}
