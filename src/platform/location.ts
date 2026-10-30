// 🧭 Hash routing for modules. The app is served from a relative base (file
// share, App Service, sub-path), so the hash is the one URL part every host
// leaves alone. The platform reads only the first segment, the module id; the
// rest belongs to the module, which parses its own params. That is what lets
// a module be added without touching a central route table.

import { useCallback, useEffect, useState } from 'react'
import type { LinkTo, Location } from './module'

export function parseLocation(hash: string): Location {
  const [path = '', search = ''] = hash.replace(/^#\/?/, '').split('?')
  const [module = '', ...rest] = path.split('/')
  const id = rest.join('/')
  const params: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(search)) if (value) params[key] = value
  return { module: decodeURIComponent(module), ...(id ? { id: decodeURIComponent(id) } : {}), params }
}

export function formatLocation(to: LinkTo): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(to.params ?? {})) if (value) params.set(key, value)
  const query = params.toString()
  return `#/${encodeURIComponent(to.module)}${to.id ? `/${encodeURIComponent(to.id)}` : ''}${query ? `?${query}` : ''}`
}

export function useLocation() {
  const [location, setLocation] = useState<Location>(() => parseLocation(window.location.hash))

  useEffect(() => {
    const onChange = () => setLocation(parseLocation(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: LinkTo, options: { replace?: boolean } = {}) => {
    const hash = formatLocation(to)
    if (hash === window.location.hash) return
    if (options.replace) {
      window.history.replaceState(null, '', hash)
      setLocation(parseLocation(hash))
    } else {
      window.location.hash = hash
    }
  }, [])

  return { location, navigate }
}
