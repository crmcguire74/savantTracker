// 📚 The report library: every exportable report, what it is for, and who
// sees it by default. Admins can change the "who" in the admin console; the
// builders live in ./builders.ts and are keyed by the same ids.

import type { Role } from '../auth/roles'

export type ReportId =
  | 'pillar-one-pager'
  | 'status-register'
  | 'pm-status'
  | 'attention'
  | 'decision-log'
  | 'change-log'

export type ReportFormat = 'print' | 'csv'

export interface ReportInfo {
  id: ReportId
  title: string
  description: string
  /** Who it is written for, shown on the card. */
  audience: string
  formats: ReportFormat[]
  defaultRoles: Role[]
}

const EVERYONE: Role[] = ['admin', 'editor', 'executive', 'viewer']
const LEADERSHIP: Role[] = ['admin', 'editor', 'executive']

export const REPORT_CATALOG: ReportInfo[] = [
  {
    id: 'pillar-one-pager',
    title: 'Pillar one-pager',
    description:
      'One landscape page per pillar: objective, team, key results, dependencies, recent accomplishments, next steps and risks. Built for the leadership deck.',
    audience: 'Leadership',
    formats: ['print'],
    defaultRoles: LEADERSHIP,
  },
  {
    id: 'status-register',
    title: 'Project status register',
    description: 'Every project with every field, one row each. Opens in Excel.',
    audience: 'Everyone',
    formats: ['csv'],
    defaultRoles: EVERYONE,
  },
  {
    id: 'pm-status',
    title: 'Status by project manager',
    description: 'Each PM’s projects with status, phase, validation, next milestone and how long since the last update.',
    audience: 'PMO',
    formats: ['csv'],
    defaultRoles: LEADERSHIP,
  },
  {
    id: 'attention',
    title: 'Needs attention',
    description: 'Projects that are off track, stale, past a milestone, carrying a high-severity issue or waiting on a decision, with the reasons.',
    audience: 'Leadership',
    formats: ['csv'],
    defaultRoles: LEADERSHIP,
  },
  {
    id: 'decision-log',
    title: 'Decision log',
    description: 'Every decision requested of leadership, and the outcome where one is recorded.',
    audience: 'Leadership',
    formats: ['csv'],
    defaultRoles: LEADERSHIP,
  },
  {
    id: 'change-log',
    title: 'Change log',
    description: 'Who changed what and when, for the most recent edits the tracker keeps.',
    audience: 'PMO',
    formats: ['csv'],
    defaultRoles: ['admin', 'editor'],
  },
]

export const REPORT_IDS = REPORT_CATALOG.map((report) => report.id)

export const reportInfo = (id: ReportId): ReportInfo => REPORT_CATALOG.find((report) => report.id === id)!
