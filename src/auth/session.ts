// 🔑 Which sign-in is in charge, and (locally) which role the tester picked.
//
//   VITE_AUTH_MODE=local   The default. The shared username and password
//                          screen, with a role picker so anyone can try the
//                          app as an admin, editor, executive or viewer.
//   VITE_AUTH_MODE=entra   Azure with App Service authentication turned on.
//                          No password screen: Entra has already signed the
//                          user in, and roles come from their app-role claims.
//
// Flip to `entra` only once the app roles in infra/app-roles.json are
// assigned to people; until then every Entra user would arrive with no role.

import { isRole, type Role } from './roles'

export type AuthMode = 'local' | 'entra'

const ROLE_KEY = 'savant-tracker:dev-role'

export function authMode(): AuthMode {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AUTH_MODE
    return value === 'entra' ? 'entra' : 'local'
  } catch {
    return 'local'
  }
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
