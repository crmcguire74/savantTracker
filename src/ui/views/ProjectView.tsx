// 📄 Project page. Reads like a status report; editing happens in place for
// the things people do often (resolve an issue, record a decision, move the
// phase) and in the "Update status" drawer for everything else. Every edit
// goes through updateProjectField with the value the field started from,
// which is what lets the tracker detect a concurrent edit.

import { useMemo, useState } from 'react'
import { FIELD_LABELS, PHASE, RAG, SEVERITY, TREND } from '../../constants'
import { dateOnly, daysSince } from '../../lib/id'
import { pillarLabel, slipDays } from '../../lib/insights'
import { isStale, needsDecision } from '../../lib/rollups'
import type { Phase, Project, ProjectFieldKey, ProjectFieldValue, RagStatus, Severity, Trend } from '../../types'
import { EditableDate, EditableText, EditableTextArea, ProgressControl } from '../atoms'
import { ageLabel, Drawer, EmptyState, formatLogValue, RAG_KEYS, Tag } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'
import { formatDay } from './WorkView'

const PHASES = Object.keys(PHASE) as Exclude<Phase, ''>[]

export function ProjectView(props: { id: string }) {
  const { tracker, navigate, canWrite, contextOf, openChangeLog } = useApp()
  const project = tracker.state.projects.find((candidate) => candidate.id === props.id)
  const [editing, setEditing] = useState(false)

  if (!project) {
    return (
      <div className="page">
        <button type="button" className="back-link" onClick={() => navigate({ view: 'portfolio', layout: 'ledger' })}>
          <Icon.ArrowLeft size={15} /> Portfolio
        </button>
        <EmptyState title="This project no longer exists">It may have been deleted. The change log keeps a record of what happened.</EmptyState>
      </div>
    )
  }

  const context = contextOf(project)
  const stale = isStale(project, tracker.settings.staleThresholdDays)
  const age = daysSince(project.updatedAt)

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <button type="button" className="crumb-root" onClick={() => navigate({ view: 'portfolio', layout: 'ledger' })}>
          <Icon.ArrowLeft size={14} /> Portfolio
        </button>
        {context.pillar && (
          <>
            <span className="crumb-sep">/</span>
            <button type="button" onClick={() => navigate({ view: 'portfolio', layout: 'ledger', pillar: context.pillar!.id })}>
              {pillarLabel(context.pillar, context.pillarIndex).title}
            </button>
          </>
        )}
        {context.initiative && (
          <>
            <span className="crumb-sep">/</span>
            <button
              type="button"
              onClick={() =>
                navigate({ view: 'portfolio', layout: 'ledger', pillar: context.pillar?.id, initiative: context.initiative!.id })
              }
            >
              {context.initiative.title}
            </button>
          </>
        )}
      </nav>

      <div className="page-head project-head">
        <div className="page-head-text">
          <h1 className="page-title">{project.title}</h1>
          <div className="tag-row">
            <Tag tone={project.rag}>{RAG[project.rag].label}</Tag>
            <Tag tone="outline">
              {TREND[project.trending].symbol} {TREND[project.trending].label}
            </Tag>
            <Tag tone="outline">{project.phase ? PHASE[project.phase]?.label : 'No phase'}</Tag>
            {stale && age !== null && <Tag tone="amber">Stale · {age} days</Tag>}
            {needsDecision(project) && <Tag tone="blue">Decision waiting</Tag>}
            {project.planLink && (
              <a className="tag tag-accent" href={project.planLink} target="_blank" rel="noopener noreferrer">
                Project plan <Icon.External size={12} />
              </a>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => openChangeLog(project.id)}>
            <Icon.History size={16} /> Change log
          </button>
          {canWrite && (
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              Update status
            </button>
          )}
        </div>
      </div>

      <PhaseStepper project={project} />

      <div className="project-grid">
        <div className="stack">
          <section className="card pad">
            <div className="label-caps">Scope</div>
            <p className="prose">{project.scope.trim() || <span className="muted">No scope written yet.</span>}</p>
            <div className="split">
              <div>
                <div className="label-caps">Next milestone</div>
                <p className="prose">
                  {project.nextMilestone.trim() || (
                    <span className="muted">{project.nextMilestoneDate ? 'Unnamed milestone' : 'No milestone set.'}</span>
                  )}
                  {project.nextMilestoneDate && <span className="muted"> · {formatDay(project.nextMilestoneDate)}</span>}
                </p>
              </div>
              <div>
                <div className="label-caps tone-red">Key risk / blocker</div>
                <p className="prose">{project.keyRisk.trim() || <span className="muted">None recorded.</span>}</p>
              </div>
            </div>
          </section>

          <DecisionCard project={project} />
          <IssuesCard project={project} />
        </div>

        <div className="stack">
          <section className="card pad">
            <h2 className="card-title">Owners</h2>
            <dl className="owner-list">
              <dt>Business owner</dt>
              <dd>{project.businessOwner || <span className="muted">Not set</span>}</dd>
              <dt>Delivery owner</dt>
              <dd>{project.executionOwner || <span className="muted">Not set</span>}</dd>
              <dt>Project manager</dt>
              <dd>{project.projectManager || <span className="muted">Not set</span>}</dd>
            </dl>
          </section>

          <ScheduleCard project={project} />
          <RecentChanges project={project} />
        </div>
      </div>

      {editing && <UpdateDrawer project={project} onClose={() => setEditing(false)} />}
    </div>
  )
}

function useFieldUpdater(project: Project) {
  const { tracker, canWrite } = useApp()
  return (field: ProjectFieldKey, value: ProjectFieldValue) => {
    if (!canWrite) return
    void tracker.actions.updateProjectField(project.id, field, value, project[field] as ProjectFieldValue)
  }
}

function PhaseStepper({ project }: { project: Project }) {
  const { canWrite } = useApp()
  const update = useFieldUpdater(project)
  const current = project.phase ? PHASES.indexOf(project.phase) : -1

  return (
    <section className="card stepper" aria-label="Phase">
      <ol className="steps">
        {PHASES.map((phase, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo'
          const label = PHASE[phase].label
          return (
            <li key={phase} className={`step ${state}`}>
              {canWrite ? (
                <button
                  type="button"
                  title={index === current ? `Current phase: ${label}` : `Move to ${label}`}
                  aria-current={index === current ? 'step' : undefined}
                  onClick={() => update('phase', index === current ? '' : phase)}
                >
                  <span className="step-bar" />
                  <span className="step-label">{label}</span>
                </button>
              ) : (
                <span aria-current={index === current ? 'step' : undefined}>
                  <span className="step-bar" />
                  <span className="step-label">{label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="stepper-progress">
        <span className="stepper-value">{project.progress}%</span>
        <span className="muted small">progress</span>
      </div>
    </section>
  )
}

function DecisionCard({ project }: { project: Project }) {
  const { canWrite, tracker } = useApp()
  const { actions } = tracker
  const [mode, setMode] = useState<'idle' | 'record' | 'raise'>('idle')
  const [draft, setDraft] = useState('')
  const asked = project.decisionNeeded.trim()
  const decided = project.decisionOutcome.trim()

  const status = !asked && !decided ? <Tag tone="neutral">None</Tag> : decided ? <Tag tone="green">Decided</Tag> : <Tag tone="blue">Waiting</Tag>

  const save = () => {
    if (!draft.trim()) return
    const text = draft.trim()
    void (async () => {
      if (mode === 'record') {
        await actions.updateProjectField(project.id, 'decisionOutcome', text, project.decisionOutcome)
        return
      }
      // A new ask reopens the decision. Sequential writes: each one reads the
      // fresh state, so the second must not start before the first lands.
      await actions.updateProjectField(project.id, 'decisionNeeded', text, project.decisionNeeded)
      if (project.decisionOutcome) await actions.updateProjectField(project.id, 'decisionOutcome', '', project.decisionOutcome)
    })()
    setDraft('')
    setMode('idle')
  }

  return (
    <section className="card pad">
      <div className="card-title-row flush">
        <h2 className="card-title">Decision</h2>
        {status}
      </div>
      {asked ? (
        <p className="prose">
          <span className="label-inline">Asked</span> {project.decisionNeeded}
        </p>
      ) : (
        !decided && <p className="prose muted">No decision requested.</p>
      )}
      {decided && (
        <p className="prose">
          <span className="label-inline green">Decided</span> {project.decisionOutcome}
        </p>
      )}

      {canWrite && mode !== 'idle' && (
        <div className="inline-form">
          <textarea
            className="input"
            rows={3}
            autoFocus
            value={draft}
            placeholder={mode === 'record' ? 'What leadership decided, and by whom' : 'The specific ask of leadership'}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="row-actions">
            <button type="button" className="btn btn-primary sm" disabled={!draft.trim()} onClick={save}>
              {mode === 'record' ? 'Record decision' : 'Request decision'}
            </button>
            <button type="button" className="btn btn-quiet sm" onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {canWrite && mode === 'idle' && (
        <div className="row-actions">
          {asked && !decided && (
            <button type="button" className="btn btn-primary sm" onClick={() => setMode('record')}>
              Record the decision
            </button>
          )}
          {(!asked || decided) && (
            <button type="button" className="btn btn-ghost sm" onClick={() => setMode('raise')}>
              {asked ? 'Request a new decision' : 'Request a decision'}
            </button>
          )}
          {decided && asked && (
            <span className="muted small">Requesting a new decision keeps this one in the change log.</span>
          )}
        </div>
      )}
    </section>
  )
}

function IssuesCard({ project }: { project: Project }) {
  const { tracker, canWrite, ask } = useApp()
  const { actions } = tracker
  const [draft, setDraft] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const open = project.issues.filter((issue) => issue.status === 'open')
  const resolved = project.issues.filter((issue) => issue.status === 'resolved')
  const visible = showResolved ? [...open, ...resolved] : open

  const add = () => {
    if (!draft.trim()) return
    void actions.addIssue(project.id, draft.trim())
    setDraft('')
  }

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Issues</h2>
        <span className="muted small">
          {open.length} open{resolved.length ? ` · ${resolved.length} resolved` : ''}
        </span>
      </div>
      {visible.length === 0 && <div className="list-empty">No open issues.</div>}
      <ul className="issue-list">
        {visible.map((issue) => (
          <li key={issue.id} className={`issue-row${issue.status === 'resolved' ? ' resolved' : ''}`}>
            {canWrite ? (
              <select
                className={`sev-select sev-${issue.severity}`}
                value={issue.severity}
                aria-label="Severity"
                onChange={(event) => void actions.setIssueSeverity(project.id, issue.id, event.target.value as Severity)}
              >
                {(Object.keys(SEVERITY) as Severity[]).map((key) => (
                  <option key={key} value={key}>
                    {SEVERITY[key].label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`sev-select sev-${issue.severity}`}>{SEVERITY[issue.severity].label}</span>
            )}
            <span className="issue-text">{issue.title}</span>
            {canWrite && (
              <span className="row-actions">
                <button
                  type="button"
                  className="btn btn-ghost sm"
                  onClick={() => void actions.toggleIssue(project.id, issue.id, issue.status === 'open' ? 'resolved' : 'open')}
                >
                  {issue.status === 'open' ? (
                    <>
                      <Icon.Check size={14} /> Resolve
                    </>
                  ) : (
                    'Reopen'
                  )}
                </button>
                <button
                  type="button"
                  className="icon-btn sm danger"
                  aria-label="Remove issue"
                  title="Remove issue"
                  onClick={() =>
                    ask({
                      title: 'Remove issue?',
                      message: `Remove “${issue.title}”? Resolving keeps it on record; removing deletes it.`,
                      confirmLabel: 'Remove',
                      onConfirm: () => void actions.deleteIssue(project.id, issue.id),
                    })
                  }
                >
                  <Icon.Trash size={15} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {resolved.length > 0 && (
        <div className="card-foot">
          <button type="button" className="link-btn" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? 'Hide resolved' : `Show ${resolved.length} resolved`}
          </button>
        </div>
      )}
      {canWrite && (
        <div className="card-foot add-issue">
          <input
            className="input"
            value={draft}
            placeholder="Log a new issue…"
            aria-label="New issue"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
          <button type="button" className="btn btn-ghost" disabled={!draft.trim()} onClick={add}>
            Add issue
          </button>
        </div>
      )}
    </section>
  )
}

function ScheduleCard({ project }: { project: Project }) {
  const slip = slipDays(project)
  const row = (label: string, value: string) => (
    <>
      <dt>{label}</dt>
      <dd>{value.trim() ? formatDay(value.trim()) : <span className="muted">Not set</span>}</dd>
    </>
  )
  return (
    <section className="card pad">
      <div className="card-title-row flush">
        <h2 className="card-title">Schedule</h2>
        {slip !== null && slip > 0 && <Tag tone="amber">+{slip}d slip</Tag>}
        {slip !== null && slip < 0 && <Tag tone="green">{Math.abs(slip)}d early</Tag>}
      </div>
      <dl className="schedule">
        {row('Start', project.startDate)}
        {row('Original end', project.originalEndDate)}
        {row('Forecast end', project.forecastEndDate)}
      </dl>
    </section>
  )
}

function RecentChanges({ project }: { project: Project }) {
  const { tracker, openChangeLog } = useApp()
  const entries = useMemo(() => tracker.log.filter((entry) => entry.projectId === project.id), [tracker.log, project.id])
  return (
    <section className="card pad">
      <div className="card-title-row flush">
        <h2 className="card-title">Recent changes</h2>
        {entries.length > 0 && (
          <button type="button" className="link-btn" onClick={() => openChangeLog(project.id)}>
            View all
          </button>
        )}
      </div>
      <p className="muted small">
        Last updated {project.updatedAt ? formatDay(dateOnly(project.updatedAt)) : '—'}
        {project.updatedByName ? ` by ${project.updatedByName}` : ''}.
      </p>
      {entries.length > 0 && (
        <ul className="mini-log">
          {entries.slice(0, 5).map((entry) => (
            <li key={entry.id}>
              <span className="mini-log-field">{entry.field}</span>
              <span className="mini-log-value">{formatLogValue(entry.fieldKey, entry.newValue) || <span className="muted">(cleared)</span>}</span>
              <span className="muted small">
                {entry.editedByName || 'Unknown'} · {ageLabel(entry.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function UpdateDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const { ask, tracker, navigate, contextOf } = useApp()
  const update = useFieldUpdater(project)

  return (
    <Drawer
      label={`Update ${project.title}`}
      onClose={onClose}
      wide
      header={<span className="muted small">Changes save as you go and are logged.</span>}
    >
      <h2 className="drawer-title">Update status</h2>
      <p className="muted">{project.title}</p>

      <fieldset className="form-section">
        <legend>Status</legend>
        <div className="rag-picker" role="radiogroup" aria-label={FIELD_LABELS.rag}>
          {RAG_KEYS.map((key: RagStatus) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={project.rag === key}
              className={`rag-option rag-${key}${project.rag === key ? ' active' : ''}`}
              onClick={() => project.rag !== key && update('rag', key)}
            >
              <span className={`dot dot-${key}`} /> {RAG[key].label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{FIELD_LABELS.trending}</span>
            <select className="select" value={project.trending} onChange={(event) => update('trending', event.target.value as Trend)}>
              {(Object.keys(TREND) as Trend[]).map((key) => (
                <option key={key} value={key}>
                  {TREND[key].symbol} {TREND[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{FIELD_LABELS.phase}</span>
            <select className="select" value={project.phase} onChange={(event) => update('phase', event.target.value as Phase)}>
              <option value="">No phase</option>
              {PHASES.map((key) => (
                <option key={key} value={key}>
                  {PHASE[key].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ProgressControl value={project.progress} onCommit={(value) => update('progress', value)} />
      </fieldset>

      <fieldset className="form-section">
        <legend>Next milestone</legend>
        <div className="form-grid wide-first">
          <label className="field">
            <span>{FIELD_LABELS.nextMilestone}</span>
            <EditableText value={project.nextMilestone} onCommit={(value) => update('nextMilestone', value)} />
          </label>
          <label className="field">
            <span>Date</span>
            <EditableDate value={project.nextMilestoneDate} onCommit={(value) => update('nextMilestoneDate', value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Risk and decision</legend>
        <label className="field">
          <span>{FIELD_LABELS.keyRisk}</span>
          <EditableTextArea value={project.keyRisk} placeholder="Why the status is what it is" onCommit={(value) => update('keyRisk', value)} />
        </label>
        <label className="field">
          <span>Decision needed from leadership</span>
          <EditableTextArea value={project.decisionNeeded} placeholder="The specific ask, if any" onCommit={(value) => update('decisionNeeded', value)} />
        </label>
        <label className="field">
          <span>{FIELD_LABELS.decisionOutcome}</span>
          <EditableTextArea
            value={project.decisionOutcome}
            placeholder="Fill in once leadership has decided"
            onCommit={(value) => update('decisionOutcome', value)}
          />
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Owners</legend>
        <div className="form-grid three">
          <label className="field">
            <span>{FIELD_LABELS.businessOwner}</span>
            <EditableText value={project.businessOwner} onCommit={(value) => update('businessOwner', value)} />
          </label>
          <label className="field">
            <span>{FIELD_LABELS.executionOwner}</span>
            <EditableText value={project.executionOwner} onCommit={(value) => update('executionOwner', value)} />
          </label>
          <label className="field">
            <span>{FIELD_LABELS.projectManager}</span>
            <EditableText value={project.projectManager} onCommit={(value) => update('projectManager', value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Schedule</legend>
        <div className="form-grid three">
          <label className="field">
            <span>{FIELD_LABELS.startDate}</span>
            <EditableDate value={project.startDate} onCommit={(value) => update('startDate', value)} />
          </label>
          <label className="field">
            <span>{FIELD_LABELS.originalEndDate}</span>
            <EditableDate value={project.originalEndDate} onCommit={(value) => update('originalEndDate', value)} />
          </label>
          <label className="field">
            <span>{FIELD_LABELS.forecastEndDate}</span>
            <EditableDate value={project.forecastEndDate} onCommit={(value) => update('forecastEndDate', value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Scope and plan</legend>
        <label className="field">
          <span>
            {FIELD_LABELS.scope} ({project.scope.length}/250)
          </span>
          <EditableTextArea
            value={project.scope}
            maxLength={250}
            rows={3}
            placeholder="One to two sentences describing what this project covers"
            onCommit={(value) => update('scope', value)}
          />
        </label>
        <label className="field">
          <span>Detailed project plan link</span>
          <EditableText value={project.planLink} placeholder="https://…" onCommit={(value) => update('planLink', value)} />
        </label>
      </fieldset>

      <fieldset className="form-section danger-zone">
        <legend>Danger zone</legend>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() =>
            ask({
              title: 'Delete project?',
              message: `Delete “${project.title}”? The change log records the deletion but cannot undo it.`,
              confirmLabel: 'Delete project',
              onConfirm: () => {
                const context = contextOf(project)
                void tracker.actions.deleteProject(project.id)
                onClose()
                navigate({ view: 'portfolio', layout: 'ledger', pillar: context.pillar?.id, initiative: context.initiative?.id }, { replace: true })
              },
            })
          }
        >
          <Icon.Trash size={15} /> Delete project
        </button>
      </fieldset>

      <button type="button" className="btn btn-primary block" onClick={onClose}>
        Done
      </button>
    </Drawer>
  )
}
