// 🔌 Board: projects as cards by phase or status; editors drag to change.

import { Icon, type ModuleManifest } from '@sdk'

export const manifest: ModuleManifest = {
  id: 'board',
  title: 'Board',
  description: 'Kanban of projects by phase or by status.',
  icon: Icon.Board,
  navOrder: 20,
  usesFilters: true,
  features: [{ key: 'board', label: 'Board', defaultRoles: ['admin', 'editor', 'executive', 'viewer'] }],
  requires: 'board',
  load: () => import('./entry'),
}
