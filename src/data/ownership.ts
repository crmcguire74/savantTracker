// 🔒 Who owns a project field once the tracker syncs with monday.com.
//
// On a project linked to monday (it has a `mondayId`), monday owns the synced fields. The next live
// pull would overwrite an edit made here, so the tracker declines the edit and says where to make
// it. The tracker keeps issues, decision outcome and plan link, and everything on projects that
// were created here.
//
// The lock applies only when the server pulls from monday with its own token (`live`). In test mode
// (a browser-only build, or a server with no token) nothing overwrites an edit until someone
// uploads a capture, so testers can still change fields.

import { SYNCED_FIELDS } from '../../server/monday/mapping'
import type { Project, ProjectFieldKey } from '../types'

const OWNED = new Set<string>(SYNCED_FIELDS)

export const isMondayField = (field: string): boolean => OWNED.has(field)

export const ownedByMonday = (project: Pick<Project, 'mondayId'> | undefined, field: ProjectFieldKey, live: boolean): boolean =>
  live && Boolean(project?.mondayId) && OWNED.has(field)

export const ownedMessage = (label: string): string =>
  `${label} comes from monday.com. Change it there and the next sync brings it in.`
