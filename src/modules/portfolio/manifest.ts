// 🔌 Portfolio: pillars → initiatives → projects, in four layouts.

import { Icon, type ModuleManifest, type Role } from '@sdk'
import { layoutFeature, portfolioLayout } from './routes'

const EVERYONE: Role[] = ['admin', 'editor', 'executive', 'viewer']
const LEADERSHIP: Role[] = ['admin', 'editor', 'executive']

export const manifest: ModuleManifest = {
  id: 'portfolio',
  title: 'Portfolio',
  description: 'Ledger, heatmap, leadership brief and pillar pace for the whole portfolio.',
  icon: Icon.Portfolio,
  navOrder: 10,
  usesFilters: true,
  features: [
    { key: 'portfolio', label: 'Portfolio', defaultRoles: EVERYONE },
    { key: 'portfolio.heatmap', label: 'Initiative heatmap', parent: 'portfolio', defaultRoles: EVERYONE },
    { key: 'portfolio.brief', label: 'Leadership brief', parent: 'portfolio', defaultRoles: LEADERSHIP },
    { key: 'portfolio.pace', label: 'Pillar pace', parent: 'portfolio', defaultRoles: LEADERSHIP },
  ],
  requires: (location) => layoutFeature(portfolioLayout(location)),
  load: () => import('./entry'),
}
