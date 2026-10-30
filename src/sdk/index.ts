// 📐 The module SDK: the whole surface a module may import, as `@sdk`.
//
// A module imports React, `@sdk`, and files inside its own folder. Nothing
// else. The architecture tests (src/platform/boundaries.test.ts) fail the
// build on any other import, which is what keeps a module portable: an
// external team can build one against this file alone, and a change behind
// it cannot break a module without changing what is exported here.
//
// Adding to the SDK is a platform decision. Export the narrowest thing that
// works, and prefer a pure function or a component over a raw hook into
// platform internals.

// ── platform contract ──────────────────────────────────────────────────────
export { usePlatform } from '../platform/context'
export type { ConfirmRequest, PlatformApi } from '../platform/context'
export type { LinkTo, Location, ModuleEntry, ModuleManifest, ModuleProps } from '../platform/module'

// ── domain model and pure logic ───────────────────────────────────────────
export * from '../types'
export * from '../constants'
export * from '../lib/id'
export * from '../lib/insights'
export * from '../lib/rollups'
export * from '../lib/people'
export * from '../lib/pace'
export * from '../lib/file-io'
export * from '../auth/roles'
export { canUseFeature, defaultPolicy, featureRoles, normalizePolicy } from '../auth/access'
export type { AccessPolicy, FeatureCatalog, FeatureInfo, FeatureKey } from '../auth/access'
export * from '../reports/catalog'
export * from '../reports/onepager'
export type { NewInitiativeInput, NewProjectInput, TrackerActions, TrackerApi } from '../hooks/useTracker'
export { applyUpdate, checkForUpdate, promptInstall, usePwa } from '../hooks/usePwa'

// ── shared UI kit ─────────────────────────────────────────────────────────
export * from '../ui/common'
export * from '../ui/atoms'
export * from '../ui/pace'
export { Icon } from '../ui/icons'
