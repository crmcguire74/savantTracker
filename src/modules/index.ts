// 🔌 The plug board: every module this app is built from. Adding a module is
// one import and one array entry here; removing it is deleting both. Order
// here does not matter; each manifest's `navOrder` places it in the rail.
//
// Import manifests only. A manifest lazy-loads its own views, so this list
// costs a few hundred bytes per module at startup, not the module's code.

import type { ModuleManifest } from '@sdk'
import { manifest as access } from './access/manifest'
import { manifest as admin } from './admin/manifest'
import { manifest as board } from './board/manifest'
import { manifest as onepager } from './onepager/manifest'
import { manifest as portfolio } from './portfolio/manifest'
import { manifest as project } from './project/manifest'
import { manifest as settings } from './settings/manifest'
import { manifest as timeline } from './timeline/manifest'
import { manifest as work } from './work/manifest'
import { manifest as workload } from './workload/manifest'

export const MODULES: readonly ModuleManifest[] = [portfolio, project, onepager, board, timeline, work, workload, admin, access, settings]
