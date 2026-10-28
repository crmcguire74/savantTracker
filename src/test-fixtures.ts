// 🧪 Shared builders for unit tests. Every field gets a neutral default so a
// test states only what it is about.

import type { Initiative, Pillar, Project, TrackerState } from './types'

export const makeProject = (patch: Partial<Project>): Project => ({
  id: 'p',
  initiativeId: 'i',
  title: 'Project',
  businessOwner: '',
  executionOwner: '',
  projectManager: '',
  scope: '',
  trending: 'stable',
  phase: '',
  validation: '',
  planLink: '',
  startDate: '',
  originalEndDate: '',
  forecastEndDate: '',
  nextMilestone: '',
  nextMilestoneDate: '',
  dependencies: '',
  keyRisk: '',
  decisionNeeded: '',
  decisionOutcome: '',
  rag: 'green',
  progress: 0,
  updatedAt: new Date().toISOString(),
  updatedById: '',
  updatedByName: '',
  issues: [],
  ...patch,
})

export const makeState = (parts: {
  pillars?: Pillar[]
  initiatives?: Initiative[]
  projects?: Project[]
}): TrackerState => ({
  quarter: '',
  pillars: parts.pillars ?? [{ id: 'o1', title: 'Pillar 1: Grow', owner: '' }],
  initiatives: parts.initiatives ?? [
    { id: 'i', pillarId: 'o1', title: 'Initiative', businessOwner: '', executionOwner: '', startQuarter: '', endQuarter: '' },
  ],
  projects: parts.projects ?? [],
})
