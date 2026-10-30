// 🏠 The app is the platform plus its modules. Everything app-wide lives in
// src/platform; every page lives in src/modules and is listed in one place.

import { MODULES } from './modules'
import { PlatformProvider } from './platform/PlatformProvider'
import { createRegistry } from './platform/registry'
import { AppShell } from './platform/Shell'

const registry = createRegistry(MODULES)

export default function App() {
  return (
    <PlatformProvider registry={registry}>
      <AppShell />
    </PlatformProvider>
  )
}
