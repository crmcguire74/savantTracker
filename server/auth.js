// 🔐 Identity and roles, read from App Service Easy Auth.
//
// Easy Auth sits in front of the app inside the App Service sandbox. It
// validates the Entra token itself, then injects headers describing the
// caller. It also STRIPS any copy of those headers that arrived from the
// client, so a browser cannot forge them. That guarantee only holds while
// traffic reaches the app through Easy Auth, which is why the deployment
// disables public network access and sets "Require authentication".
//
// REQUIRE_AUTH=false is for local development only. The startup check in
// index.js refuses to run with it disabled outside development.

const EDITOR_ROLE = 'Tracker.Editor'
const VIEWER_ROLE = 'Tracker.Viewer'

const ROLE_CLAIM_TYPES = new Set([
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
])
const NAME_CLAIM_TYPES = [
  'name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  'preferred_username',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
]
const ID_CLAIM_TYPES = [
  'http://schemas.microsoft.com/identity/claims/objectidentifier',
  'oid',
  'sub',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
]

function decodePrincipal(header) {
  if (!header) return null
  try {
    const parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    return Array.isArray(parsed?.claims) ? parsed : null
  } catch {
    return null
  }
}

function firstClaim(claims, types) {
  for (const type of types) {
    const found = claims.find((claim) => claim.typ === type && claim.val)
    if (found) return found.val
  }
  return ''
}

/**
 * Builds the caller's identity from the request. Returns null when the
 * request carries no verified principal.
 */
export function readIdentity(request) {
  const principal = decodePrincipal(request.headers['x-ms-client-principal'])

  if (!principal) {
    if (process.env.REQUIRE_AUTH === 'false') {
      return {
        id: 'local-dev',
        name: process.env.LOCAL_DEV_NAME || 'Local developer',
        roles: [EDITOR_ROLE],
        canWrite: true,
        source: 'local-dev',
      }
    }
    return null
  }

  const claims = principal.claims
  const roles = claims.filter((claim) => ROLE_CLAIM_TYPES.has(claim.typ)).map((claim) => claim.val)

  const id =
    firstClaim(claims, ID_CLAIM_TYPES) || String(request.headers['x-ms-client-principal-id'] || '')
  const name =
    firstClaim(claims, NAME_CLAIM_TYPES) || String(request.headers['x-ms-client-principal-name'] || '')

  return {
    id,
    name,
    roles,
    canWrite: roles.includes(EDITOR_ROLE),
    source: principal.auth_typ || 'aad',
  }
}

/** Any authenticated caller may read. */
export function requireReader(request, response, next) {
  const identity = readIdentity(request)
  if (!identity) {
    response.status(401).json({ error: 'Not signed in.' })
    return
  }
  // A caller in the tenant with neither role assigned gets nothing. This is
  // the difference between "works at Savant" and "was given the tracker".
  if (!identity.roles.includes(EDITOR_ROLE) && !identity.roles.includes(VIEWER_ROLE)) {
    response.status(403).json({
      error: 'Your account has no role on this application. Ask an administrator to add you.',
    })
    return
  }
  request.identity = identity
  next()
}

/** Only editors may write. Viewers get a clear 403, not a silent failure. */
export function requireEditor(request, response, next) {
  if (!request.identity?.canWrite) {
    response.status(403).json({ error: 'You have view-only access to this tracker.' })
    return
  }
  next()
}

export { EDITOR_ROLE, VIEWER_ROLE }
