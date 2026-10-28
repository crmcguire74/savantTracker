// 🔒 Temporary access gate. It keeps casual visitors out while the app is
// being trialled; it is not security. The credentials ship in the bundle, so
// real access control stays with the server (Easy Auth in Azure).
//
// Locally the gate also asks which role to test as. With VITE_AUTH_MODE=entra
// the gate steps aside: Entra has signed the user in and supplies the roles.
import { useState, type FormEvent, type ReactNode } from 'react'
import { ROLE_ORDER, ROLES, type Role } from '../auth/roles'
import { authMode, forgetDevRole, readDevRole, writeDevRole } from '../auth/session'
import { Icon } from './icons'

const USERNAME = 'savant'
const PASSWORD = 'sw2026'
const SESSION_KEY = 'savant-tracker:unlocked'

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/** Ends access for this session and returns to the sign-in view. */
export function lockApp(): void {
  forgetUnlock()
  // A reload rather than a state change, so nothing from the session stays in memory.
  location.reload()
}

/** Clears access without navigating, for a sign-out link that leaves the page. */
export function forgetUnlock(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored means nothing to forget.
  }
  forgetDevRole()
}

export function LoginGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(readDevRole)
  const [error, setError] = useState('')

  if (unlocked || authMode() === 'entra') return <>{children}</>

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (username.trim().toLowerCase() !== USERNAME || password !== PASSWORD) {
      setError('That username and password don’t match.')
      setPassword('')
      return
    }
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // Private windows may refuse storage; the gate just asks again next load.
    }
    writeDevRole(role)
    setUnlocked(true)
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <span className="brand-mark">
            <Icon.Logo size={34} />
          </span>
          <span className="brand-text">
            <span className="brand-title">WiseTrack</span>
            <span className="brand-sub">Strategic Initiatives</span>
          </span>
        </div>
        <p className="login-intro">Sign in to continue.</p>
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <fieldset className="login-roles">
          <legend>Test as</legend>
          {ROLE_ORDER.map((value) => (
            <label key={value} className={`login-role${role === value ? ' active' : ''}`}>
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
              <span className="login-role-name">{ROLES[value].label}</span>
              <span className="login-role-desc">{ROLES[value].description}</span>
            </label>
          ))}
          <p className="hint">Local testing only. In Azure, your role comes from your Microsoft account.</p>
        </fieldset>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary block" disabled={!username || !password}>
          Sign in as {ROLES[role].label.toLowerCase()}
        </button>
      </form>
    </main>
  )
}
