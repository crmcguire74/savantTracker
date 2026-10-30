// 🧭 Hash routing. The app is served from a relative base (file share, App
// Service, sub-path), so the hash is the one URL part every host leaves alone.
// Routes deep-link and the browser back button works between views.

import { useCallback, useEffect, useState } from 'react'

export type PortfolioLayout = 'ledger' | 'heatmap' | 'brief' | 'pace'
export type BoardLayout = 'phase' | 'status'
export type WorkloadLayout = 'people' | 'pm-heatmap'

export type Route =
  | { view: 'portfolio'; layout: PortfolioLayout; pillar?: string; initiative?: string }
  | { view: 'board'; layout: BoardLayout }
  | { view: 'timeline' }
  | { view: 'work'; person?: string }
  | { view: 'workload'; layout: WorkloadLayout }
  /** The printable pillar one-pager; every pillar unless one is named. */
  | { view: 'onepager'; pillar?: string }
  | { view: 'settings' }
  /** PMO upkeep: stale projects, open decisions, recent activity, monday sync. */
  | { view: 'admin' }
  /** Who sees which views and reports. Admin role only. */
  | { view: 'access' }
  | { view: 'project'; id: string }

export type View = Route['view']

export function parseRoute(hash: string): Route {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(search)
  const [view, id] = path.split('/')
  const get = (key: string) => params.get(key) ?? undefined

  switch (view) {
    case 'board':
      return { view: 'board', layout: get('layout') === 'status' ? 'status' : 'phase' }
    case 'timeline':
      return { view: 'timeline' }
    case 'work':
      return { view: 'work', person: get('person') }
    case 'workload':
      return { view: 'workload', layout: get('layout') === 'pm-heatmap' ? 'pm-heatmap' : 'people' }
    case 'onepager':
      return { view: 'onepager', pillar: get('pillar') }
    // Links saved before the Reports page became Admin.
    case 'reports':
      return get('report') === 'pillar-one-pager' ? { view: 'onepager', pillar: get('pillar') } : { view: 'admin' }
    case 'settings':
      return { view: 'settings' }
    case 'admin':
      return { view: 'admin' }
    case 'access':
      return { view: 'access' }
    case 'project':
      if (id) return { view: 'project', id: decodeURIComponent(id) }
      break
  }
  const layout = get('layout')
  return {
    view: 'portfolio',
    layout: layout === 'heatmap' || layout === 'brief' || layout === 'pace' ? layout : 'ledger',
    pillar: get('pillar'),
    initiative: get('initiative'),
  }
}

export function formatRoute(route: Route): string {
  const query = (entries: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(entries)) if (value) params.set(key, value)
    const text = params.toString()
    return text ? `?${text}` : ''
  }
  switch (route.view) {
    case 'portfolio':
      return `#/portfolio${query({
        layout: route.layout === 'ledger' ? undefined : route.layout,
        pillar: route.pillar,
        initiative: route.initiative,
      })}`
    case 'board':
      return `#/board${query({ layout: route.layout === 'phase' ? undefined : route.layout })}`
    case 'work':
      return `#/work${query({ person: route.person })}`
    case 'workload':
      return `#/workload${query({ layout: route.layout === 'people' ? undefined : route.layout })}`
    case 'onepager':
      return `#/onepager${query({ pillar: route.pillar })}`
    case 'project':
      return `#/project/${encodeURIComponent(route.id)}`
    default:
      return `#/${route.view}`
  }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route, options: { replace?: boolean } = {}) => {
    const hash = formatRoute(next)
    if (hash === window.location.hash) return
    if (options.replace) {
      window.history.replaceState(null, '', hash)
      setRoute(parseRoute(hash))
    } else {
      window.location.hash = hash
    }
  }, [])

  return { route, navigate }
}
