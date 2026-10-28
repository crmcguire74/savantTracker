// 🚦 Routes in terms of the access policy: which feature a route needs, and
// where to send someone whose role cannot open the page they asked for.

import type { FeatureKey } from '../auth/access'
import type { Route } from '../hooks/useRoute'

/** The feature a route needs, or null for pages every role may open. */
export function featureForRoute(route: Route): FeatureKey | null {
  switch (route.view) {
    case 'portfolio':
      return route.layout === 'ledger' ? 'portfolio' : `portfolio.${route.layout}`
    case 'workload':
      return route.layout === 'pm-heatmap' ? 'workload.pm-heatmap' : 'workload'
    case 'board':
    case 'timeline':
    case 'work':
    case 'reports':
      return route.view
    // Project pages, settings and admin are decided elsewhere: every role may
    // read a project and its own settings; admin is admin-only, not policy.
    default:
      return null
  }
}

const LANDING: Array<{ feature: FeatureKey; route: Route }> = [
  { feature: 'portfolio', route: { view: 'portfolio', layout: 'ledger' } },
  { feature: 'board', route: { view: 'board', layout: 'phase' } },
  { feature: 'timeline', route: { view: 'timeline' } },
  { feature: 'reports', route: { view: 'reports' } },
  { feature: 'work', route: { view: 'work' } },
]

/** The first page this role may open, for the "no access" fallback. */
export function firstAllowedRoute(can: (feature: FeatureKey) => boolean): Route {
  return LANDING.find((entry) => can(entry.feature))?.route ?? { view: 'settings' }
}
