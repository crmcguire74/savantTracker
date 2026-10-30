// 🧰 Module workbench entry (workbench.html, `npm run dev:module`). Never
// part of the production build: vite.config.ts builds index.html only.
//
//   /workbench.html#/board                 one module, every other one registered
//   /workbench.html?only=board#/board      one module registered on its own
//   /workbench.html?storage=indexeddb      your real browser data instead of memory
//
// Storage defaults to memory, seeded from the bundled snapshot, so trying a
// module never touches the data in your normal tracker tab. The URL has to
// say so before storage is imported, hence the dynamic imports below.

import { createRoot } from 'react-dom/client'
import '../../styles.css'

const url = new URL(window.location.href)
if (!url.searchParams.has('storage')) {
  url.searchParams.set('storage', 'memory')
  window.history.replaceState(null, '', url)
}

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

void (async () => {
  const [{ Workbench }, { MODULES }] = await Promise.all([import('./Workbench'), import('../../modules')])
  const only = url.searchParams.get('only')
  const modules = only ? MODULES.filter((manifest) => manifest.id === only) : MODULES
  if (only && !modules.length) console.warn(`[workbench] ?only=${only}: no module has that id`)
  createRoot(container).render(<Workbench modules={modules} isolated={Boolean(only)} />)
})()
