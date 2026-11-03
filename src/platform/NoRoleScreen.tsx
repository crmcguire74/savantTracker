// 🚪 Signed in with a Microsoft account that holds no tracker role yet.
//
// Entra proves who you are; the app role says what you may do. Until an admin assigns one of the
// Tracker roles (Admin, Editor, Executive, Viewer) in Entra, the API refuses every request, so
// this screen says so plainly instead of showing an empty app.

import { ROLE_ORDER, ROLES } from '../auth/roles'
import { Icon } from '../ui/icons'

export function NoRoleScreen({ name }: { name: string }) {
  return (
    <main className="login-screen">
      <div className="login-card" role="alert">
        <div className="login-brand">
          <span className="brand-mark">
            <Icon.Logo size={34} />
          </span>
          <span className="brand-text">
            <span className="brand-title">WiseTrack</span>
            <span className="brand-sub">Strategic Initiatives</span>
          </span>
        </div>
        <p className="login-intro">
          {name ? `${name}, you are` : 'You are'} signed in, but your account has no role on this application yet.
        </p>
        <p className="login-intro">
          Ask a tracker admin to assign you one of these roles in Microsoft Entra, then sign in again:{' '}
          {ROLE_ORDER.map((role) => ROLES[role].appRole).join(', ')}.
        </p>
        <a className="btn btn-ghost block" href="/.auth/logout?post_logout_redirect_uri=/">
          Sign out
        </a>
      </div>
    </main>
  )
}
