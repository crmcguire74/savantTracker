import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startPwa } from './hooks/usePwa'
import { LoginGate } from './platform/LoginGate'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// Before render, so the install prompt event is never missed.
startPwa()

createRoot(container).render(
  <StrictMode>
    <LoginGate>
      <App />
    </LoginGate>
  </StrictMode>,
)
