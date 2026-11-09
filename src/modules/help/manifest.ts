// 🔌 Help: how to use the tracker. Workflows by role, FAQ and glossary.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'help',
  title: 'Help',
  description: 'Workflows by role, frequently asked questions and a glossary of tracker terms.',
  icon: Icon.Help,
  navOrder: 90,
  requires: null,
  load: () => import('./entry'),
}
