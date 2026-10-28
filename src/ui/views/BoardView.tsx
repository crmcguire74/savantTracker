// 📋 Board: projects as cards in columns, by phase or by status. Filters
// narrow the columns in place rather than replacing the board with a list,
// so the shape of the work stays visible. Editors can drag a card to another
// column to change its phase or status; the change goes through the same
// conflict-checked field update as every other edit.

import { useMemo, useRef, useState, type DragEvent } from 'react'
import { PHASE, RAG } from '../../constants'
import type { BoardLayout } from '../../hooks/useRoute'
import { byStatusThenTitle, phaseLabel } from '../../lib/insights'
import { isStale, needsDecision } from '../../lib/rollups'
import { daysSince } from '../../lib/id'
import type { Phase, Project, ProjectFieldKey, RagStatus } from '../../types'
import { FilterChips, PageHeader, Progress, Segmented, Tag } from '../common'
import { useApp } from '../context'

interface Column {
  key: string
  label: string
  dot: RagStatus | 'none' | 'accent'
  projects: Project[]
}

const PHASE_KEYS: Phase[] = ['', ...(Object.keys(PHASE) as Exclude<Phase, ''>[])]
const STATUS_ORDER: RagStatus[] = ['red', 'amber', 'green']

export function BoardView(props: { layout: BoardLayout }) {
  const { tracker, navigate, matches, filtering, canWrite } = useApp()
  const { state, actions } = tracker
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // The ref is read by dragover/drop, which can fire before React re-renders.
  const draggingRef = useRef<string | null>(null)

  const visible = useMemo(() => state.projects.filter(matches).sort(byStatusThenTitle), [state.projects, matches])

  const columns: Column[] =
    props.layout === 'phase'
      ? PHASE_KEYS.map((phase) => ({
          key: phase,
          label: phaseLabel(phase),
          dot: phase ? 'accent' : 'none',
          projects: visible.filter((project) => project.phase === phase),
        }))
      : STATUS_ORDER.map((rag) => ({
          key: rag,
          label: RAG[rag].label,
          dot: rag,
          projects: visible.filter((project) => project.rag === rag),
        }))

  const field: ProjectFieldKey = props.layout === 'phase' ? 'phase' : 'rag'

  const drop = (event: DragEvent, columnKey: string) => {
    event.preventDefault()
    setOver(null)
    const projectId = event.dataTransfer.getData('text/plain') || draggingRef.current
    draggingRef.current = null
    setDragging(null)
    const project = state.projects.find((candidate) => candidate.id === projectId)
    if (!project || project[field] === columnKey) return
    void actions.updateProjectField(project.id, field, columnKey, project[field] as string)
  }

  return (
    <div className="page page-wide">
      <PageHeader
        eyebrow="Board"
        title={props.layout === 'phase' ? 'Projects by phase' : 'Projects by status'}
        actions={
          <Segmented
            label="Layout"
            value={props.layout}
            options={[
              { value: 'phase', label: 'By phase' },
              { value: 'status', label: 'By status' },
            ]}
            onChange={(layout) => navigate({ view: 'board', layout }, { replace: true })}
          />
        }
      />
      <FilterChips count={filtering ? visible.length : undefined} noun={visible.length === 1 ? 'project' : 'projects'} />
      {canWrite && <p className="hint">Drag a card to another column to change its {props.layout === 'phase' ? 'phase' : 'status'}.</p>}

      <div className={`board board-${props.layout}`}>
        {columns.map((column) => (
          <section
            key={column.key || 'none'}
            className={`board-col${over === column.key ? ' drop-target' : ''}`}
            aria-label={column.label}
            onDragOver={(event) => {
              if (!canWrite || !draggingRef.current) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              if (over !== column.key) setOver(column.key)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null)
            }}
            onDrop={(event) => canWrite && drop(event, column.key)}
          >
            <header className="board-col-head">
              <span className={`dot dot-${column.dot}`} />
              <span className="board-col-title">{column.label}</span>
              <span className="board-col-count">{column.projects.length}</span>
            </header>
            <div className="board-col-body">
              {column.projects.map((project) => (
                <BoardCard
                  key={project.id}
                  project={project}
                  layout={props.layout}
                  draggable={canWrite}
                  dragging={dragging === project.id}
                  onDragStart={() => {
                    draggingRef.current = project.id
                    setDragging(project.id)
                  }}
                  onDragEnd={() => {
                    draggingRef.current = null
                    setDragging(null)
                    setOver(null)
                  }}
                />
              ))}
              {column.projects.length === 0 && <div className="board-empty">{filtering ? 'No matches' : 'Empty'}</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function BoardCard(props: {
  project: Project
  layout: BoardLayout
  draggable: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const { openProject, contextOf, tracker } = useApp()
  const { project } = props
  const context = contextOf(project)
  const stale = isStale(project, tracker.settings.staleThresholdDays)
  const age = daysSince(project.updatedAt)
  const openIssues = project.issues.filter((issue) => issue.status === 'open').length

  return (
    // A div, not a <button>: Firefox will not start a drag from a button.
    <div
      role="button"
      tabIndex={0}
      className={`board-card rag-edge-${project.rag}${props.dragging ? ' is-dragging' : ''}`}
      draggable={props.draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', project.id)
        event.dataTransfer.effectAllowed = 'move'
        props.onDragStart()
      }}
      onDragEnd={props.onDragEnd}
      onClick={() => openProject(project.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openProject(project.id)
        }
      }}
    >
      <span className="board-card-title">{project.title}</span>
      <span className="board-card-sub">{context.initiative?.title ?? ''}</span>
      <span className="board-card-progress">
        <Progress value={project.progress} />
        <span>{project.progress}%</span>
      </span>
      <span className="tag-row">
        {props.layout === 'phase' ? (
          <Tag tone={project.rag}>{RAG[project.rag].label}</Tag>
        ) : (
          <Tag tone="outline">{phaseLabel(project.phase)}</Tag>
        )}
        {stale && age !== null && <Tag tone="amber">Stale {age}d</Tag>}
        {needsDecision(project) && <Tag tone="blue">Decision</Tag>}
        {openIssues > 0 && (
          <Tag tone="outline">
            {openIssues} issue{openIssues === 1 ? '' : 's'}
          </Tag>
        )}
      </span>
    </div>
  )
}

