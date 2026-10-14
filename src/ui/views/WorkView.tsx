// 🙋 My work: the decisions, issues and milestones on projects you own.
// "My" means the signed-in person. Looking at someone else's work is a
// separate, clearly labelled state (reached from Workload, search, or the
// person picker) with a one-click way back, so the page never claims to be
// yours when it is not.

import { useMemo, useState } from 'react'
import { FIELD_LABELS, PHASE, RAG, SEVERITY } from '../../constants'
import { byStatusThenTitle, isOverdue, projectsOf, workItems, type WorkItem, type WorkKind } from '../../lib/insights'
import { rolesOn, type OwnerRole, type Person } from '../../lib/people'
import type { Severity } from '../../types'
import { EditableDate, EditableText } from '../atoms'
import { Avatar, Drawer, EmptyState, PageHeader, ProjectList, Segmented, Tag, pillarTitle } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'

const KIND_META: Record<WorkKind, { title: string; tag: string; tone: 'blue' | 'amber' | 'accent' }> = {
  decision: { title: 'Decisions', tag: 'Decision', tone: 'blue' },
  issue: { title: 'Issues', tag: 'Issue', tone: 'amber' },
  milestone: { title: 'Milestones', tag: 'Milestone', tone: 'accent' },
}

type RoleFilter = 'all' | OwnerRole

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const formatDay = (iso: string): string => {
  const time = Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(time) ? iso : DAY.format(time)
}

export function WorkView(props: { person?: string }) {
  const { people, me, navigate, tracker, identity, identitySource, openIdentity } = useApp()
  const viewingOther = Boolean(props.person && props.person !== me?.key)
  const person = viewingOther ? (people.find((candidate) => candidate.key === props.person) ?? null) : me

  const [role, setRole] = useState<RoleFilter>('all')
  const [selected, setSelected] = useState<{ kind: WorkKind; projectId: string; issueId?: string } | null>(null)

  const projects = useMemo(() => {
    const owned = projectsOf(tracker.state, person)
    return role === 'all' || !person ? owned : owned.filter((project) => person[role].includes(project.id))
  }, [tracker.state, person, role])
  const items = useMemo(() => workItems(projects), [projects])
  const openCount = items.decision.length + items.issue.length + items.milestone.length

  const pickPerson = (key: string) => navigate({ view: 'work', person: key && key !== me?.key ? key : undefined })

  if (!viewingOther && !me) {
    return (
      <div className="page">
        <PageHeader eyebrow="My work" title="Decisions, issues and milestones" />
        <ClaimIdentity
          name={identity.name}
          canRename={identitySource === 'local'}
          onRename={openIdentity}
        />
      </div>
    )
  }

  if (viewingOther && !person) {
    return (
      <div className="page">
        <PageHeader eyebrow="Team member" title="Person not found" />
        <EmptyState title="Nobody by that name owns a project">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ view: 'workload' })}>
            Back to workload
          </button>
        </EmptyState>
      </div>
    )
  }

  const first = person!.name.split(' ')[0]

  return (
    <div className="page">
      {viewingOther && (
        <button type="button" className="back-link" onClick={() => navigate({ view: 'work' })}>
          <Icon.ArrowLeft size={15} /> Back to my work
        </button>
      )}
      <PageHeader
        eyebrow={viewingOther ? 'Team member' : 'My work'}
        title={viewingOther ? `${person!.name}’s work` : 'Decisions, issues and milestones'}
        actions={
          <Segmented<RoleFilter>
            label="Role"
            value={role}
            options={[
              { value: 'all', label: 'All roles' },
              { value: 'business', label: 'Business' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'pm', label: 'PM' },
            ]}
            onChange={setRole}
          />
        }
      />

      <div className="work-bar">
        <Avatar initials={person!.initials} size={34} />
        <label className="work-person">
          <span className="muted">Viewing work for</span>
          <select className="select" value={person!.key} onChange={(event) => pickPerson(event.target.value)}>
            {me && <option value={me.key}>{me.name} (me)</option>}
            {people
              .filter((candidate) => candidate.key !== me?.key)
              .map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.name}
                </option>
              ))}
          </select>
        </label>
        <span className="muted">
          {openCount} open item{openCount === 1 ? '' : 's'} across {projects.length} project{projects.length === 1 ? '' : 's'}
        </span>
        {!viewingOther && <NotMe />}
      </div>

      <div className="work-cols">
        {(['decision', 'issue', 'milestone'] as WorkKind[]).map((kind) => (
          <section key={kind} className="card work-col" aria-label={KIND_META[kind].title}>
            <header className="work-col-head">
              <h2 className="card-title">{KIND_META[kind].title}</h2>
              <span className="muted">{items[kind].length}</span>
            </header>
            {items[kind].length === 0 ? (
              <div className="list-empty">
                {kind === 'decision' ? 'No decisions waiting.' : kind === 'issue' ? 'No open issues.' : 'No milestones set.'}
              </div>
            ) : (
              <ul className="work-list">
                {items[kind].map((item) => (
                  <li key={item.id}>
                    <WorkRow item={item} onOpen={() => setSelected({ kind, projectId: item.project.id, issueId: item.issue?.id })} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">{viewingOther ? `${first}’s projects` : 'My projects'}</h2>
          <span className="muted small">{projects.length}</span>
        </div>
        <ProjectList projects={projects.slice().sort(byStatusThenTitle)} empty="No projects in this role." />
      </div>

      {selected && <WorkItemDrawer selection={selected} person={person!} onClose={() => setSelected(null)} />}
    </div>
  )
}

function WorkRow({ item, onOpen }: { item: WorkItem; onOpen: () => void }) {
  const meta = KIND_META[item.kind]
  const overdue = item.kind === 'milestone' && isOverdue(item.due)
  return (
    <button type="button" className="work-row" onClick={onOpen}>
      <span className="work-text">{item.text}</span>
      <span className="tag-row">
        {item.kind === 'issue' && item.issue ? (
          <Tag tone={item.issue.severity === 'high' ? 'red' : item.issue.severity === 'medium' ? 'amber' : 'neutral'}>
            {SEVERITY[item.issue.severity].label} issue
          </Tag>
        ) : (
          <Tag tone={meta.tone}>{meta.tag}</Tag>
        )}
        {item.due && <Tag tone={overdue ? 'red' : 'outline'}>{overdue ? 'Overdue · ' : ''}{formatDay(item.due)}</Tag>}
        <span className="work-project">{item.project.title}</span>
      </span>
    </button>
  )
}

function NotMe() {
  const { me, meClaimed, claimMe, people } = useApp()
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="link-btn push-right" onClick={() => setOpen(true)}>
        Not you?
      </button>
    )
  }
  return (
    <span className="push-right row-actions">
      <select
        className="select"
        aria-label="Choose which owner you are"
        defaultValue={me?.key}
        onChange={(event) => {
          claimMe(event.target.value)
          setOpen(false)
        }}
      >
        {people.map((person) => (
          <option key={person.key} value={person.key}>
            {person.name}
          </option>
        ))}
      </select>
      {meClaimed && (
        <button type="button" className="link-btn" onClick={() => { claimMe(null); setOpen(false) }}>
          Use my sign-in name
        </button>
      )}
      <button type="button" className="link-btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  )
}

function ClaimIdentity(props: { name: string; canRename: boolean; onRename: () => void }) {
  const { people, claimMe, navigate } = useApp()
  const [choice, setChoice] = useState(people[0]?.key ?? '')

  return (
    <div className="card claim">
      <h2 className="card-title">Which owner are you?</h2>
      <p className="muted">
        {props.name
          ? `“${props.name}” does not appear in any project's owner fields, so this page cannot tell which work is yours.`
          : 'Your name is not set yet, so this page cannot tell which work is yours.'}{' '}
        Pick your name as it appears on projects. This is remembered in this browser.
      </p>
      {people.length > 0 ? (
        <div className="row-actions">
          <select className="select" value={choice} aria-label="Your name on projects" onChange={(event) => setChoice(event.target.value)}>
            {people.map((person) => (
              <option key={person.key} value={person.key}>
                {person.name} · {person.projectIds.length} project{person.projectIds.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => claimMe(choice)}>
            This is me
          </button>
          {props.canRename && (
            <button type="button" className="btn btn-ghost" onClick={props.onRename}>
              {props.name ? 'Change my name' : 'Set my name'}
            </button>
          )}
        </div>
      ) : (
        <p className="muted">No project has an owner yet.</p>
      )}
      <p className="hint">
        Just looking? <button type="button" className="link-btn" onClick={() => navigate({ view: 'workload' })}>Browse everyone's work in Workload</button>.
      </p>
    </div>
  )
}

function WorkItemDrawer(props: { selection: { kind: WorkKind; projectId: string; issueId?: string }; person: Person; onClose: () => void }) {
  const { tracker, canWrite, openProject, contextOf } = useApp()
  const { actions } = tracker
  const project = tracker.state.projects.find((candidate) => candidate.id === props.selection.projectId)
  const issue = project?.issues.find((candidate) => candidate.id === props.selection.issueId)
  const [outcome, setOutcome] = useState('')
  const [done, setDone] = useState<string | null>(null)

  if (!project) return null
  const context = contextOf(project)
  const meta = KIND_META[props.selection.kind]
  const roles = rolesOn(props.person, project.id)
  const roleNames = { business: 'Business owner', delivery: 'Delivery owner', pm: 'Project manager' } as const

  const heading =
    props.selection.kind === 'decision'
      ? project.decisionNeeded || project.decisionOutcome
      : props.selection.kind === 'issue'
        ? (issue?.title ?? 'Issue removed')
        : project.nextMilestone || 'Milestone cleared'

  return (
    <Drawer label={`${meta.tag}: ${heading}`} onClose={props.onClose} header={<Tag tone={meta.tone}>{meta.tag}</Tag>}>
      <h2 className="drawer-title">{heading}</h2>
      <dl className="facts">
        <dt>Project</dt>
        <dd>
          <button type="button" className="link-btn strong" onClick={() => openProject(project.id)}>
            {project.title}
          </button>
        </dd>
        <dt>Initiative</dt>
        <dd>{context.initiative?.title ?? '—'}</dd>
        <dt>Pillar</dt>
        <dd>{context.pillar ? pillarTitle(context.pillar.title) : '—'}</dd>
        <dt>{props.person.name.split(' ')[0]}’s role</dt>
        <dd>{roles.map((role) => roleNames[role]).join(', ') || '—'}</dd>
        <dt>Due</dt>
        <dd>{props.selection.kind === 'milestone' && project.nextMilestoneDate ? formatDay(project.nextMilestoneDate) : 'Not set'}</dd>
        <dt>Project status</dt>
        <dd className={`tone-${project.rag}`}>
          <strong>{RAG[project.rag].label}</strong>
          {project.phase ? ` · ${PHASE[project.phase]?.label ?? project.phase}` : ''} · {project.progress}%
        </dd>
      </dl>

      {project.keyRisk.trim() && (
        <div className="callout">
          <strong>Key risk:</strong> {project.keyRisk}
        </div>
      )}

      {done && <div className="callout success">{done}</div>}

      {props.selection.kind === 'decision' && canWrite && !project.decisionOutcome.trim() && (
        <div className="drawer-action">
          <label className="field">
            <span>{FIELD_LABELS.decisionOutcome}</span>
            <textarea
              className="input"
              rows={4}
              value={outcome}
              placeholder="What leadership decided, and by whom"
              onChange={(event) => setOutcome(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary block"
            disabled={!outcome.trim()}
            onClick={() => {
              void actions.updateProjectField(project.id, 'decisionOutcome', outcome.trim(), project.decisionOutcome)
              setDone('Decision recorded. It now leaves the waiting list.')
            }}
          >
            Record the decision
          </button>
        </div>
      )}
      {props.selection.kind === 'decision' && project.decisionOutcome.trim() && (
        <div className="callout">
          <strong>Decided:</strong> {project.decisionOutcome}
        </div>
      )}

      {props.selection.kind === 'issue' && issue && canWrite && (
        <div className="drawer-action">
          <label className="field">
            <span>Severity</span>
            <select
              className="select"
              value={issue.severity}
              onChange={(event) => void actions.setIssueSeverity(project.id, issue.id, event.target.value as Severity)}
            >
              {(Object.keys(SEVERITY) as Severity[]).map((key) => (
                <option key={key} value={key}>
                  {SEVERITY[key].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary block"
            onClick={() => {
              const next = issue.status === 'open' ? 'resolved' : 'open'
              void actions.toggleIssue(project.id, issue.id, next)
              setDone(next === 'resolved' ? 'Issue resolved.' : 'Issue reopened.')
            }}
          >
            {issue.status === 'open' ? 'Mark resolved' : 'Reopen issue'}
          </button>
        </div>
      )}

      {props.selection.kind === 'milestone' && canWrite && (
        <div className="drawer-action">
          <label className="field">
            <span>{FIELD_LABELS.nextMilestone}</span>
            <EditableText
              value={project.nextMilestone}
              onCommit={(value) => void actions.updateProjectField(project.id, 'nextMilestone', value, project.nextMilestone)}
            />
          </label>
          <label className="field">
            <span>{FIELD_LABELS.nextMilestoneDate}</span>
            <EditableDate
              value={project.nextMilestoneDate}
              onCommit={(value) => void actions.updateProjectField(project.id, 'nextMilestoneDate', value, project.nextMilestoneDate)}
            />
          </label>
          <p className="hint">Hit the milestone? Replace it with the next one so this list stays current.</p>
        </div>
      )}

      <button type="button" className="btn btn-ghost block" onClick={() => openProject(project.id)}>
        Open project
      </button>
    </Drawer>
  )
}
