import type { DiscoveredProjects } from './pipeline'
import type { MondayCapture } from './capture'

export declare const DEFAULT_IGNORED_TITLES: readonly string[]
export declare function discoverFromCapture(
  capture: unknown,
  options?: { projectGroupTitle?: string; ignoreTitles?: readonly string[] },
): DiscoveredProjects
export type { MondayCapture }

export declare function fetchBoardStamps(client: { query: Function }, workspaceId: string): Promise<string>
