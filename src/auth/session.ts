// 🔑 Which sign-in is in charge, and (locally) which role the tester picked.
//
//   local   The shared username and password screen, with a role picker so
//           anyone can try the app as an admin, editor, executive or viewer.
//   entra   Azure with App Service authentication turned on. No password
//           screen: Entra has already signed the user in, and roles come from
//           their app-role claims.
//
// Which one is in charge:
//   VITE_AUTH_MODE=local or entra   forces that mode (a build-time override).
//   unset, or "auto"                the app asks the server at start-up (/api/me,
//                                   see probeRuntime in ./runtime.ts). A server with
//                                   real sign-in behind it answers local:false and the
//                                   app runs on Entra roles. No server, or a server
//                                   with no sign-in, keeps the test sign-in.
//
// An Entra user with no app role assigned lands on a "no role" screen, so it is
// safe to deploy before the roles are handed out.

import { isRole, type Role } from './roles'

export type AuthMode = 'local' | 'entra'

const ROLE_KEY = 'savant-tracker:dev-role'

let detected: AuthMode | null = null

/** Called once by probeRuntime() before the app renders. */
export function setDetectedAuthMode(mode: AuthMode | null): void {
  detected = mode
}

const configuredMode = (): AuthMode | 'auto' => {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AUTH_MODE
    return value === 'entra' || value === 'local' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function authMode(): AuthMode {
  const configured = configuredMode()
  return configured === 'auto' ? (detected ?? 'local') : configured
}

/** The role picked at the local sign-in. Editor when nothing was picked, matching the app before roles existed. */
export function readDevRole(): Role {
  try {
    const value = sessionStorage.getItem(ROLE_KEY)
    return isRole(value) ? value : 'editor'
  } catch {
    return 'editor'
  }
}

export function writeDevRole(role: Role): void {
  try {
    sessionStorage.setItem(ROLE_KEY, role)
  } catch {
    // Private windows may refuse storage; the role lasts until reload.
  }
}

export function forgetDevRole(): void {
  try {
    sessionStorage.removeItem(ROLE_KEY)
  } catch {
    // Nothing stored means nothing to forget.
  }
}

/** Header the local server reads to act as the picked role. Ignored when sign-in is enforced. */
export const DEV_ROLE_HEADER = 'x-tracker-dev-role'
