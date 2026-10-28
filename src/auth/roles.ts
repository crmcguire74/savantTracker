// 🎭 Roles. One vocabulary for the browser, the API and Entra.
//
// Each role is an Entra app role (infra/app-roles.json) whose value is the
// `appRole` below. In Azure the roles arrive as claims; locally the sign-in
// screen lets a tester pick one. Either way the rest of the app only ever
// sees `Role`, so nothing downstream knows which mode it is running in.

export type Role = 'admin' | 'editor' | 'executive' | 'viewer'

export interface RoleInfo {
  label: string
  /** The Entra app role value, e.g. "Tracker.Admin". */
  appRole: string
  description: string
  /** May create, update and delete tracker data. */
  canEdit: boolean
}

// Most to least privileged. Admin first so lists read top-down.
export const ROLE_ORDER: Role[] = ['admin', 'editor', 'executive', 'viewer']

export const ROLES: Record<Role, RoleInfo> = {
  admin: {
    label: 'Admin',
    appRole: 'Tracker.Admin',
    description: 'Edits everything and decides which roles see which views and reports.',
    canEdit: true,
  },
  editor: {
    label: 'Editor',
    appRole: 'Tracker.Editor',
    description: 'Project managers and the PMO. Updates projects, initiatives and pillars.',
    canEdit: true,
  },
  executive: {
    label: 'Executive',
    appRole: 'Tracker.Executive',
    description: 'Leadership. Reads everything, including executive reports. Cannot edit.',
    canEdit: false,
  },
  viewer: {
    label: 'Viewer',
    appRole: 'Tracker.Viewer',
    description: 'Reads the portfolio. Cannot edit.',
    canEdit: false,
  },
}

const BY_APP_ROLE = new Map(ROLE_ORDER.map((role) => [ROLES[role].appRole.toLowerCase(), role]))

export const isRole = (value: unknown): value is Role => typeof value === 'string' && value in ROLES

/** Maps claim values ("Tracker.Editor") to roles, dropping anything unknown. */
export function rolesFromClaims(values: readonly string[]): Role[] {
  const found = new Set<Role>()
  for (const value of values) {
    const role = BY_APP_ROLE.get(value.toLowerCase()) ?? (isRole(value) ? value : undefined)
    if (role) found.add(role)
  }
  return ROLE_ORDER.filter((role) => found.has(role))
}

export const canEdit = (roles: readonly Role[]): boolean => roles.some((role) => ROLES[role].canEdit)
export const isAdmin = (roles: readonly Role[]): boolean => roles.includes('admin')

/** The most privileged role held, for one-word display ("Editor"). */
export const primaryRole = (roles: readonly Role[]): Role | null => ROLE_ORDER.find((role) => roles.includes(role)) ?? null
