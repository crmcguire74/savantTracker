// 🧩 The module contract. A module is one page of the app: one entry in the
// left rail (or none, for detail pages), one lazily loaded bundle, and one
// sandbox. The platform knows a module only through this manifest; the
// module knows the platform only through `@sdk`.
//
// A manifest is loaded eagerly with the shell, so it must stay tiny: plain
// data, an icon, and an `import()` of the module's entry. Never import the
// module's views statically from here, or its code joins the main bundle and
// stops being independently loadable.

import type { ComponentType } from 'react'
import type { FeatureInfo, FeatureKey } from '../auth/access'
import type { PlatformApi } from './context'

/** Where the app is: `#/<module>/<id>?<params>`. */
export interface Location {
  module: string
  id?: string
  params: Readonly<Record<string, string>>
}

/** Where to go. Undefined or empty params are dropped from the URL. */
export interface LinkTo {
  module: string
  id?: string
  params?: Record<string, string | undefined>
}

/** Every module entry receives its own location, already resolved. */
export interface ModuleProps {
  location: Location
}

export type ModuleEntry = ComponentType<ModuleProps>

export interface ModuleManifest {
  /** URL segment and registry key: lowercase letters, digits and dashes. */
  id: string
  /** Rail label, error-fallback title and document title. */
  title: string
  /** One line for the workbench and the module catalogue. */
  description?: string
  icon?: ComponentType<{ size?: number }>
  /** Position in the left rail, lowest first. Omit for pages reached only by link. */
  navOrder?: number
  /**
   * Access-policy features this module contributes. They appear on the Access
   * page automatically and are checked by `requires`.
   */
  features?: FeatureInfo[]
  /**
   * The feature needed to open the module at this location, or null when every
   * signed-in role may. A function lets one module gate its layouts separately.
   */
  requires?: FeatureKey | null | ((location: Location) => FeatureKey | null)
  /** Only the Admin role may open it, whatever the access policy says. */
  adminOnly?: boolean
  /**
   * True when the module honours the shared status/stale/search filters, so
   * the top bar can send a filter here instead of to a page that ignores it.
   */
  usesFilters?: boolean
  /**
   * Which rail item lights up while this module is open. Detail pages point at
   * their parent list; defaults to the module itself.
   */
  activeNav?: (location: Location, platform: PlatformApi) => string
  /** Retired URL segments this module now answers for, mapped to their new home. */
  redirects?: Record<string, (location: Location) => LinkTo>
  /** Loads the module's code. Called on first visit, never at startup. */
  load: () => Promise<{ default: ModuleEntry }>
}
