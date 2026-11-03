import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { probeRuntime } from './auth/runtime'
import { startPwa } from './hooks/usePwa'
import { LoginGate } from './platform/LoginGate'
import { Icon } from './ui/icons'
import { apiBaseUrl, resolveDriver } from './storage'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// Before render, so the install prompt event is never missed.
startPwa()

const root = createRoot(container)

root.render(
  <div className="boot">
    <Icon.Logo size={40} />
    <span>Loading tracker…</span>
  </div>,
)

// Ask the server whether real sign-in is behind it before choosing a sign-in screen.
void probeRuntime({ driver: resolveDriver(), baseUrl: apiBaseUrl() }).then(() =>
  root.render(
    <StrictMode>
      <LoginGate>
        <App />
      </LoginGate>
    </StrictMode>,
  ),
)
