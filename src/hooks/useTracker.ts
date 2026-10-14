// 🪝 The one stateful hook. It owns the tracker's data, every mutation, and
// the conflict/import/export flows. Components stay presentational.
//
// Every write follows the same three steps: read the freshest state through
// the repository, build the next immutable state, persist it. Nothing mutates
// in place, which is what makes the change log trustworthy and the undo path
// ("restore previous value") possible.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FIELD_LABELS } from '../constants'
import { TrackerRepository, bundledSnapshot } from '../data/repository'
import type { AppFile } from '../data/appfile'
import { downloadAppFile, loadAppFile } from '../lib/file-io'
import { nowISO, uid } from '../lib/id'
import { openStorage, storage, type StorageStatus } from '../storage'
import type {
  Identity,
  Initiative,
  LogEntry,
  Pillar,
  Project,
  ProjectFieldKey,
  ProjectFieldValue,
  Settings,
  TrackerState,
} from '../types'

const EMPTY_STATE: TrackerState = { quarter: '', pillars: [], initiatives: [], projects: [] }

export interface Conflict {
  projectId: string
  field: ProjectFieldKey
  mine: ProjectFieldValue
  theirs: ProjectFieldValue
}

export interface Notice {
  tone: 'info' | 'success' | 'error'
  message: string
}

export interface NewProjectInput {
  title: string
  businessOwner: string
  executionOwner: string
}

export interface NewInitiativeInput {
  title: string
  businessOwner: string
  executionOwner: string
  startQuarter: string
  endQuarter: string
}

export function useTracker(identity: Identity, canWrite = true) {
  const repository = useMemo(() => new TrackerRepository(storage), [])

  const [state, setState] = useState<TrackerState>(EMPTY_STATE)
  const [log, setLog] = useState<LogEntry[]>([])
  const [settings, setSettings] = useState<Settings>({ staleThresholdDays: 30 })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(storage.status)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const identityRef = useRef(identity)
  useEffect(() => {
    identityRef.current = identity
  }, [identity])

  // The API is the real gate on writes. This ref stops a viewer's click from
  // making a round trip only to collect a 403, and stops local state from
  // briefly showing a change the server will refuse.
  const canWriteRef = useRef(canWrite)
  useEffect(() => {
    canWriteRef.current = canWrite
  }, [canWrite])

  const flash = useCallback((next: Notice, ms = 4500) => {
    setNotice(next)
    window.setTimeout(() => setNotice((current) => (current === next ? null : current)), ms)
  }, [])

  // ── boot ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const unsubscribers: Array<() => void> = []

    void (async () => {
      try {
        const opened = await openStorage()
        const boot = await repository.bootstrap()
        if (cancelled) return

        setState(boot.state)
        setLog(boot.log)
        setSettings(boot.settings)
        setLoading(false)

        if (opened.degraded) {
          flash({
            tone: 'error',
            message:
              'This browser would not open a local database, so the tracker is running in memory. Changes will be lost when the tab closes. Export before you leave.',
          }, 12000)
        } else if (boot.seeded) {
          flash({
            tone: 'success',
            message: `Loaded the migrated snapshot: ${boot.state.projects.length} projects across ${boot.state.pillars.length} pillars.`,
          })
        }

        unsubscribers.push(repository.subscribeState((next) => next && setState(next)))
        unsubscribers.push(repository.subscribeLog(setLog))
        unsubscribers.push(repository.subscribeSettings(setSettings))
        unsubscribers.push(storage.onStatusChange(setStorageStatus))
      } catch (error) {
        if (cancelled) return
        setLoading(false)
        flash({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Could not open local storage.',
        }, 12000)
      }
    })()

    return () => {
      cancelled = true
      unsubscribers.forEach((off) => off())
    }
  }, [repository, flash])

  // ── persistence primitives ────────────────────────────────────────────
  const persist = useCallback(
    async (next: TrackerState): Promise<boolean> => {
      if (!canWriteRef.current) {
        flash({ tone: 'error', message: 'You have view-only access to this tracker.' })
        return false
      }
      setState(next)
      stateRef.current = next
      const result = await repository.saveState(next)
      if (!result.ok) {
        if (result.theirs) {
          setState(result.theirs)
          stateRef.current = result.theirs
        }
        flash({ tone: 'error', message: 'Another window saved first. Your view was refreshed; reapply the change.' })
        return false
      }
      return true
    },
    [repository, flash],
  )

  const appendLog = useCallback(
    async (entry: Omit<LogEntry, 'id' | 'timestamp' | 'editedById' | 'editedByName'>) => {
      const full: LogEntry = {
        ...entry,
        id: uid('log'),
        timestamp: nowISO(),
        editedById: identityRef.current.id,
        editedByName: identityRef.current.name,
      }
      const entries = await repository.appendLog(full)
      setLog(entries)
    },
    [repository],
  )

  const stamp = useCallback(
    (project: Project): Pick<Project, 'updatedAt' | 'updatedById' | 'updatedByName'> => ({
      updatedAt: nowISO(),
      updatedById: identityRef.current.id,
      updatedByName: identityRef.current.name || project.updatedByName,
    }),
    [],
  )

  // ── project field editing (with conflict detection) ───────────────────
  const commitField = useCallback(
    async (
      base: TrackerState,
      projectId: string,
      field: ProjectFieldKey,
      value: ProjectFieldValue,
      previous: ProjectFieldValue,
    ) => {
      const project = base.projects.find((candidate) => candidate.id === projectId)
      if (!project) return

      const next: TrackerState = {
        ...base,
        projects: base.projects.map((candidate) =>
          candidate.id === projectId
            ? ({ ...candidate, [field]: value, ...stamp(candidate) } as Project)
            : candidate,
        ),
      }

      const saved = await persist(next)
      if (saved && previous !== value) {
        await appendLog({
          projectId,
          projectTitle: project.title,
          field: FIELD_LABELS[field] ?? field,
          fieldKey: field,
          oldValue: String(previous ?? ''),
          newValue: String(value ?? ''),
        })
      }
    },
    [persist, appendLog, stamp],
  )

  const updateProjectField = useCallback(
    async (projectId: string, field: ProjectFieldKey, value: ProjectFieldValue, baseline: ProjectFieldValue) => {
      const fresh = (await repository.readState()) ?? stateRef.current
      const live = fresh.projects.find((candidate) => candidate.id === projectId)
      const liveValue = (live ? live[field] : baseline) as ProjectFieldValue

      // Someone changed this field to a third value while the field was open.
      if (liveValue !== baseline && liveValue !== value) {
        setConflict({ projectId, field, mine: value, theirs: liveValue })
        return
      }
      await commitField(fresh, projectId, field, value, liveValue)
    },
    [repository, commitField],
  )

  const resolveConflict = useCallback(
    async (choice: 'mine' | 'theirs') => {
      if (!conflict) return
      const base = stateRef.current
      const project = base.projects.find((candidate) => candidate.id === conflict.projectId)
      const previous = (project ? project[conflict.field] : '') as ProjectFieldValue
      const value = choice === 'mine' ? conflict.mine : conflict.theirs
      setConflict(null)
      await commitField(base, conflict.projectId, conflict.field, value, previous)
    },
    [conflict, commitField],
  )

  const restoreFromLog = useCallback(
    async (entry: LogEntry) => {
      if (!entry.fieldKey) return
      const field = entry.fieldKey as ProjectFieldKey
      const base = stateRef.current
      const project = base.projects.find((candidate) => candidate.id === entry.projectId)
      if (!project) return
      const value: ProjectFieldValue = field === 'progress' ? Number(entry.oldValue) : entry.oldValue
      await commitField(base, entry.projectId, field, value, project[field] as ProjectFieldValue)
    },
    [commitField],
  )

  // ── structure ─────────────────────────────────────────────────────────
  const addPillar = useCallback(
    async (title: string, owner: string) => {
      if (!title.trim()) return
      const base = stateRef.current
      const pillar: Pillar = { id: uid('obj'), title: title.trim(), owner: owner.trim() }
      if (await persist({ ...base, pillars: [...base.pillars, pillar] })) {
        await appendLog({
          projectId: '',
          projectTitle: '(structure)',
          field: 'Pillar added',
          fieldKey: '',
          oldValue: '',
          newValue: pillar.title,
        })
      }
      return pillar.id
    },
    [persist, appendLog],
  )

  const updatePillar = useCallback(
    async (id: string, patch: Partial<Pillar>) => {
      const base = stateRef.current
      await persist({
        ...base,
        pillars: base.pillars.map((pillar) => (pillar.id === id ? { ...pillar, ...patch } : pillar)),
      })
    },
    [persist],
  )

  const deletePillar = useCallback(
    async (id: string) => {
      const base = stateRef.current
      const pillar = base.pillars.find((candidate) => candidate.id === id)
      const initiativeIds = new Set(
        base.initiatives.filter((initiative) => initiative.pillarId === id).map((initiative) => initiative.id),
      )
      const next: TrackerState = {
        ...base,
        pillars: base.pillars.filter((candidate) => candidate.id !== id),
        initiatives: base.initiatives.filter((initiative) => initiative.pillarId !== id),
        projects: base.projects.filter((project) => !initiativeIds.has(project.initiativeId)),
      }
      if (await persist(next)) {
        await appendLog({
          projectId: '',
          projectTitle: '(structure)',
          field: 'Pillar deleted',
          fieldKey: '',
          oldValue: pillar?.title ?? '',
          newValue: '',
        })
      }
    },
    [persist, appendLog],
  )

  const addInitiative = useCallback(
    async (pillarId: string, input: NewInitiativeInput) => {
      if (!input.title.trim() || !pillarId) return undefined
      const base = stateRef.current
      const initiative: Initiative = {
        id: uid('init'),
        pillarId,
        title: input.title.trim(),
        businessOwner: input.businessOwner.trim(),
        executionOwner: input.executionOwner.trim(),
        startQuarter: input.startQuarter.trim(),
        endQuarter: input.endQuarter.trim(),
      }
      if (await persist({ ...base, initiatives: [...base.initiatives, initiative] })) {
        await appendLog({
          projectId: '',
          projectTitle: '(structure)',
          field: 'Initiative added',
          fieldKey: '',
          oldValue: '',
          newValue: initiative.title,
        })
      }
      return initiative.id
    },
    [persist, appendLog],
  )

  const updateInitiative = useCallback(
    async (id: string, patch: Partial<Initiative>) => {
      const base = stateRef.current
      await persist({
        ...base,
        initiatives: base.initiatives.map((initiative) =>
          initiative.id === id ? { ...initiative, ...patch } : initiative,
        ),
      })
    },
    [persist],
  )

  const deleteInitiative = useCallback(
    async (id: string) => {
      const base = stateRef.current
      const initiative = base.initiatives.find((candidate) => candidate.id === id)
      const next: TrackerState = {
        ...base,
        initiatives: base.initiatives.filter((candidate) => candidate.id !== id),
        projects: base.projects.filter((project) => project.initiativeId !== id),
      }
      if (await persist(next)) {
        await appendLog({
          projectId: '',
          projectTitle: '(structure)',
          field: 'Initiative deleted',
          fieldKey: '',
          oldValue: initiative?.title ?? '',
          newValue: '',
        })
      }
    },
    [persist, appendLog],
  )

  const addProject = useCallback(
    async (initiativeId: string, input: NewProjectInput) => {
      if (!input.title.trim()) return
      const base = stateRef.current
      const project: Project = {
        id: uid('proj'),
        initiativeId,
        title: input.title.trim(),
        businessOwner: input.businessOwner.trim(),
        executionOwner: input.executionOwner.trim(),
        projectManager: '',
        scope: '',
        trending: 'stable',
        phase: '',
        planLink: '',
        startDate: '',
        originalEndDate: '',
        forecastEndDate: '',
        nextMilestone: '',
        nextMilestoneDate: '',
        keyRisk: '',
        decisionNeeded: '',
        decisionOutcome: '',
        rag: 'green',
        progress: 0,
        updatedAt: nowISO(),
        updatedById: identityRef.current.id,
        updatedByName: identityRef.current.name,
        issues: [],
      }
      if (await persist({ ...base, projects: [...base.projects, project] })) {
        await appendLog({
          projectId: project.id,
          projectTitle: project.title,
          field: 'Project added',
          fieldKey: '',
          oldValue: '',
          newValue: project.title,
        })
      }
    },
    [persist, appendLog],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      const base = stateRef.current
      const project = base.projects.find((candidate) => candidate.id === id)
      if (await persist({ ...base, projects: base.projects.filter((candidate) => candidate.id !== id) })) {
        await appendLog({
          projectId: id,
          projectTitle: project?.title ?? '',
          field: 'Project deleted',
          fieldKey: '',
          oldValue: project?.title ?? '',
          newValue: '',
        })
      }
    },
    [persist, appendLog],
  )

  // ── issues ────────────────────────────────────────────────────────────
  const mapProject = useCallback(
    async (projectId: string, change: (project: Project) => Project) => {
      const base = stateRef.current
      const next: TrackerState = {
        ...base,
        projects: base.projects.map((project) => (project.id === projectId ? change(project) : project)),
      }
      return persist(next)
    },
    [persist],
  )

  const addIssue = useCallback(
    async (projectId: string, title: string) => {
      const project = stateRef.current.projects.find((candidate) => candidate.id === projectId)
      if (!project || !title.trim()) return
      const saved = await mapProject(projectId, (current) => ({
        ...current,
        issues: [...current.issues, { id: uid('iss'), title: title.trim(), severity: 'medium', status: 'open' }],
        ...stamp(current),
      }))
      if (saved) {
        await appendLog({
          projectId,
          projectTitle: project.title,
          field: 'Issue logged',
          fieldKey: '',
          oldValue: '',
          newValue: title.trim(),
        })
      }
    },
    [mapProject, appendLog, stamp],
  )

  const toggleIssue = useCallback(
    async (projectId: string, issueId: string, status: 'open' | 'resolved') => {
      const project = stateRef.current.projects.find((candidate) => candidate.id === projectId)
      const issue = project?.issues.find((candidate) => candidate.id === issueId)
      const saved = await mapProject(projectId, (current) => ({
        ...current,
        issues: current.issues.map((candidate) =>
          candidate.id === issueId ? { ...candidate, status } : candidate,
        ),
        ...stamp(current),
      }))
      if (saved) {
        await appendLog({
          projectId,
          projectTitle: project?.title ?? '',
          field: 'Issue status',
          fieldKey: '',
          oldValue: issue?.status ?? '',
          newValue: status,
        })
      }
    },
    [mapProject, appendLog, stamp],
  )

  const setIssueSeverity = useCallback(
    async (projectId: string, issueId: string, severity: Project['issues'][number]['severity']) => {
      await mapProject(projectId, (current) => ({
        ...current,
        issues: current.issues.map((candidate) =>
          candidate.id === issueId ? { ...candidate, severity } : candidate,
        ),
      }))
    },
    [mapProject],
  )

  const deleteIssue = useCallback(
    async (projectId: string, issueId: string) => {
      const project = stateRef.current.projects.find((candidate) => candidate.id === projectId)
      const issue = project?.issues.find((candidate) => candidate.id === issueId)
      const saved = await mapProject(projectId, (current) => ({
        ...current,
        issues: current.issues.filter((candidate) => candidate.id !== issueId),
      }))
      if (saved && issue) {
        await appendLog({
          projectId,
          projectTitle: project?.title ?? '',
          field: 'Issue removed',
          fieldKey: '',
          oldValue: issue.title,
          newValue: '',
        })
      }
    },
    [mapProject, appendLog],
  )

  // ── settings ──────────────────────────────────────────────────────────
  const setStaleThreshold = useCallback(
    async (days: number) => {
      if (!canWriteRef.current) return
      const value = Math.max(1, Math.round(Number(days) || 30))
      const next: Settings = { staleThresholdDays: value }
      setSettings(next)
      await repository.saveSettings(next)
    },
    [repository],
  )

  // ── file in / file out ────────────────────────────────────────────────
  const exportData = useCallback(
    async (tag?: string) => {
      const file = await repository.exportAll(tag ? `app-export-${tag}` : 'app-export')
      const name = downloadAppFile(file, tag)
      flash({ tone: 'success', message: `Saved ${name}` })
      return file
    },
    [repository, flash],
  )

  const importData = useCallback(
    async (file: File, options: { backupFirst?: boolean } = {}) => {
      const { backupFirst = true } = options
      if (!canWriteRef.current) {
        flash({ tone: 'error', message: 'Importing replaces shared data, which needs editor access.' })
        return null
      }
      const parsed = await loadAppFile(file)
      if (backupFirst) await exportData('backup-before-import')
      await repository.replaceAll(parsed.file)
      setState(parsed.file.state)
      setLog(parsed.file.log)
      setSettings(parsed.file.settings)
      await appendLog({
        projectId: '',
        projectTitle: '(entire tracker)',
        field: 'Bulk import',
        fieldKey: '',
        oldValue: 'previous data',
        newValue: file.name,
      })
      flash({
        tone: parsed.warnings.length ? 'info' : 'success',
        message: parsed.warnings.length
          ? `Imported ${parsed.file.state.projects.length} projects with ${parsed.warnings.length} repair(s): ${parsed.warnings[0]}`
          : `Imported ${parsed.file.state.projects.length} projects and ${parsed.file.log.length} log entries.`,
      })
      return parsed
    },
    [repository, exportData, appendLog, flash],
  )

  const resetToSnapshot = useCallback(async (): Promise<AppFile | null> => {
    if (!canWriteRef.current) {
      flash({ tone: 'error', message: 'Resetting replaces shared data, which needs editor access.' })
      return null
    }
    const file = await repository.resetToSnapshot()
    setState(file.state)
    setLog(file.log)
    setSettings(file.settings)
    flash({ tone: 'info', message: 'Reset to the migrated snapshot.' })
    return file
  }, [repository, flash])

  return {
    state,
    log,
    settings,
    loading,
    notice,
    conflict,
    storageStatus,
    snapshotInfo: useMemo(() => {
      const file = bundledSnapshot()
      return { exportedAt: file.exportedAt, projects: file.state.projects.length }
    }, []),
    actions: {
      updateProjectField,
      resolveConflict,
      dismissConflict: () => setConflict(null),
      restoreFromLog,
      addPillar,
      updatePillar,
      deletePillar,
      addInitiative,
      updateInitiative,
      deleteInitiative,
      addProject,
      deleteProject,
      addIssue,
      toggleIssue,
      setIssueSeverity,
      deleteIssue,
      setStaleThreshold,
      exportData,
      importData,
      resetToSnapshot,
      dismissNotice: () => setNotice(null),
    },
  }
}

export type TrackerApi = ReturnType<typeof useTracker>
export type TrackerActions = TrackerApi['actions']
