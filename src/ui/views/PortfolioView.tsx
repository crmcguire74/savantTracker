// 🗂️ Portfolio: the landing page. Four layouts over the same data, each one
// shown only to the roles the access policy allows:
//   Ledger           pillars on the left, initiatives as an accordion
//   Heatmap          every initiative as a tile, colored by its worst project
//   Leadership brief headline numbers, pillar cards, what needs attention
//   Pillar pace      progress against schedule per pillar (PaceView.tsx)
// Filter chips apply in every layout. In the ledger, an active filter swaps
// the accordion for a flat list of matches across all pillars.

import { useEffect, useMemo, useState } from 'react'
import type { FeatureKey } from '../../auth/access'
import type { PortfolioLayout } from '../../hooks/useRoute'
import { PillarPace } from './PaceView'
import {
  byStatusThenTitle,
  initiativeHeat,
  needsAttention,
  pillarLabel,
  portfolioStats,
  summarizePillar,
} from '../../lib/insights'
import { initiativeRollup, needsDecision, projectsForInitiative } from '../../lib/rollups'
import type { Initiative, Pillar } from '../../types'
import {
  EmptyState,
  FilterChips,
  PageHeader,
  ProjectList,
  RagCountRow,
  Segmented,
  StackedBar,
  StatTile,
  StatusTag,
  Tag,
  pillarTitle,
} from '../common'
import { useApp } from '../context'
import { EditPillarForm, InitiativeForm, NewPillarForm, NewProjectForm } from '../forms'
import { Icon } from '../icons'

const LAYOUTS: Array<{ value: PortfolioLayout; label: string; feature: FeatureKey }> = [
  { value: 'ledger', label: 'Ledger', feature: 'portfolio' },
  { value: 'heatmap', label: 'Heatmap', feature: 'portfolio.heatmap' },
  { value: 'brief', label: 'Leadership brief', feature: 'portfolio.brief' },
  { value: 'pace', label: 'Pillar pace', feature: 'portfolio.pace' },
]

export function PortfolioView(props: { layout: PortfolioLayout; pillar?: string; initiative?: string }) {
  const { navigate, tracker, matches, filtering, can } = useApp()
  const layouts = LAYOUTS.filter((layout) => can(layout.feature))
  const matchCount = useMemo(
    () => tracker.state.projects.filter(matches).length,
    [tracker.state.projects, matches],
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Portfolio"
        title="All pillars and initiatives"
        actions={
          <Segmented
            label="Layout"
            value={props.layout}
            options={layouts}
            onChange={(layout) => navigate({ view: 'portfolio', layout, pillar: props.pillar }, { replace: true })}
          />
        }
      />
      <FilterChips count={filtering ? matchCount : undefined} noun={matchCount === 1 ? 'project' : 'projects'} />

      {props.layout === 'ledger' && <Ledger pillarId={props.pillar} initiativeId={props.initiative} />}
      {props.layout === 'heatmap' && <Heatmap />}
      {props.layout === 'brief' && <Brief />}
      {props.layout === 'pace' && <PillarPace />}
    </div>
  )
}

// ── ledger ────────────────────────────────────────────────────────────────

function Ledger(props: { pillarId?: string; initiativeId?: string }) {
  const { tracker, canWrite, navigate, filtering, matches, ask } = useApp()
  const { state, actions } = tracker
  const [addingPillar, setAddingPillar] = useState(false)
  const [editingPillar, setEditingPillar] = useState(false)

  const selected = state.pillars.find((pillar) => pillar.id === props.pillarId) ?? state.pillars[0]
  const selectedIndex = selected ? state.pillars.indexOf(selected) : -1

  useEffect(() => setEditingPillar(false), [selected?.id])

  if (filtering) {
    const hits = state.projects.filter(matches).sort(byStatusThenTitle)
    return (
      <div className="card">
        <ProjectList projects={hits} empty="Nothing matches these filters. Clear one to widen the search." />
      </div>
    )
  }

  const selectPillar = (pillar: Pillar) => navigate({ view: 'portfolio', layout: 'ledger', pillar: pillar.id }, { replace: true })

  const deletePillar = (pillar: Pillar) => {
    const initiatives = state.initiatives.filter((initiative) => initiative.pillarId === pillar.id)
    const projectCount = initiatives.reduce((total, initiative) => total + projectsForInitiative(state, initiative.id).length, 0)
    ask({
      title: 'Delete pillar?',
      message:
        projectCount > 0 || initiatives.length > 0
          ? `“${pillarTitle(pillar.title)}” holds ${initiatives.length} initiative(s) and ${projectCount} project(s). Deleting it deletes all of them, and the change log cannot undo this.`
          : `Delete “${pillarTitle(pillar.title)}”?`,
      confirmLabel: 'Delete pillar',
      onConfirm: () => {
        void actions.deletePillar(pillar.id)
        navigate({ view: 'portfolio', layout: 'ledger' }, { replace: true })
      },
    })
  }

  return (
    <div className="ledger">
      <aside className="card pillar-list" aria-label="Pillars">
        <div className="pillar-list-head">
          <span className="section-label">Pillars</span>
          {canWrite && (
            <button type="button" className="icon-btn sm" aria-label="Add pillar" title="Add pillar" onClick={() => setAddingPillar((v) => !v)}>
              <Icon.Plus size={16} />
            </button>
          )}
        </div>
        {addingPillar && (
          <NewPillarForm
            onSave={(title, owner) => {
              void actions.addPillar(title, owner).then((id) => id && navigate({ view: 'portfolio', layout: 'ledger', pillar: id }, { replace: true }))
              setAddingPillar(false)
            }}
            onCancel={() => setAddingPillar(false)}
          />
        )}
        {state.pillars.map((pillar, index) => {
          const label = pillarLabel(pillar, index)
          const summary = summarizePillar(state, pillar, index, tracker.settings.staleThresholdDays)
          return (
            <button
              key={pillar.id}
              type="button"
              className={`pillar-item${pillar.id === selected?.id ? ' active' : ''}`}
              aria-current={pillar.id === selected?.id}
              onClick={() => selectPillar(pillar)}
            >
              <span className="pillar-eyebrow">{label.eyebrow}</span>
              <span className="pillar-name">{label.title}</span>
              <StackedBar counts={summary.counts} height={6} />
              <span className="pillar-meta">
                {summary.projects.length} projects · {summary.initiatives} initiatives
              </span>
            </button>
          )
        })}
        {state.pillars.length === 0 && <div className="list-empty">No pillars yet.{canWrite ? ' Add the first one with +.' : ''}</div>}
      </aside>

      <section className="pillar-detail" aria-label={selected ? pillarTitle(selected.title) : 'Pillar'}>
        {!selected ? (
          <EmptyState title="No pillars yet">
            {canWrite ? 'Create a pillar to start organizing initiatives and projects.' : 'An editor has not set up the portfolio yet.'}
          </EmptyState>
        ) : editingPillar ? (
          <EditPillarForm
            pillar={selected}
            onSave={(patch) => {
              void actions.updatePillar(selected.id, patch)
              setEditingPillar(false)
            }}
            onCancel={() => setEditingPillar(false)}
          />
        ) : (
          <PillarDetail
            pillar={selected}
            index={selectedIndex}
            focusInitiative={props.initiativeId}
            onEdit={() => setEditingPillar(true)}
            onDelete={() => deletePillar(selected)}
          />
        )}
      </section>
    </div>
  )
}

function PillarDetail(props: { pillar: Pillar; index: number; focusInitiative?: string; onEdit: () => void; onDelete: () => void }) {
  const { tracker, canWrite } = useApp()
  const { state, actions } = tracker
  const initiatives = state.initiatives.filter((initiative) => initiative.pillarId === props.pillar.id)
  const projectCount = initiatives.reduce((total, initiative) => total + projectsForInitiative(state, initiative.id).length, 0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    props.focusInitiative ? { [props.focusInitiative]: true } : {},
  )
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!props.focusInitiative) return
    setExpanded((current) => ({ ...current, [props.focusInitiative!]: true }))
    window.setTimeout(() => document.getElementById(`initiative-${props.focusInitiative}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
  }, [props.focusInitiative])

  const label = pillarLabel(props.pillar, props.index)

  return (
    <>
      <div className="pillar-detail-head">
        <div>
          <h2 className="section-title">
            {label.title}
            <span className="section-count">
              {initiatives.length} initiatives · {projectCount} projects
            </span>
          </h2>
          {props.pillar.owner && <div className="muted small">Owner: {props.pillar.owner}</div>}
        </div>
        {canWrite && (
          <div className="row-actions">
            <button type="button" className="btn btn-ghost sm" onClick={() => setAdding((v) => !v)}>
              <Icon.Plus size={15} /> Initiative
            </button>
            <button type="button" className="icon-btn sm" aria-label="Edit pillar" title="Edit pillar" onClick={props.onEdit}>
              <Icon.Edit size={16} />
            </button>
            <button type="button" className="icon-btn sm danger" aria-label="Delete pillar" title="Delete pillar" onClick={props.onDelete}>
              <Icon.Trash size={16} />
            </button>
          </div>
        )}
      </div>

      {adding && (
        <InitiativeForm
          submitLabel="Add initiative"
          onSave={(input) => {
            void actions.addInitiative(props.pillar.id, input).then((id) => {
              if (id) setExpanded((current) => ({ ...current, [id]: true }))
            })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="stack">
        {initiatives.length === 0 && (
          <EmptyState title="No initiatives in this pillar yet">
            {canWrite ? 'Use “+ Initiative” to add the first one.' : null}
          </EmptyState>
        )}
        {initiatives.map((initiative) => (
          <InitiativeRow
            key={initiative.id}
            initiative={initiative}
            expanded={!!expanded[initiative.id]}
            onToggle={() => setExpanded((current) => ({ ...current, [initiative.id]: !current[initiative.id] }))}
          />
        ))}
      </div>
    </>
  )
}

function InitiativeRow(props: { initiative: Initiative; expanded: boolean; onToggle: () => void }) {
  const { tracker, canWrite, ask } = useApp()
  const { state, actions } = tracker
  const { initiative } = props
  const stats = initiativeRollup(state, initiative.id)
  const projects = projectsForInitiative(state, initiative.id).slice().sort(byStatusThenTitle)
  const [editing, setEditing] = useState(false)
  const [addingProject, setAddingProject] = useState(false)

  const owners = [
    initiative.businessOwner && `Business: ${initiative.businessOwner}`,
    initiative.executionOwner && `Delivery: ${initiative.executionOwner}`,
  ].filter(Boolean)
  const quarters = initiative.startQuarter || initiative.endQuarter ? `${initiative.startQuarter || '?'} → ${initiative.endQuarter || '?'}` : ''

  const remove = () =>
    ask({
      title: 'Delete initiative?',
      message:
        projects.length > 0
          ? `“${initiative.title}” holds ${projects.length} project(s). Deleting it deletes all of them, and the change log cannot undo this.`
          : `Delete “${initiative.title}”?`,
      confirmLabel: 'Delete initiative',
      onConfirm: () => void actions.deleteInitiative(initiative.id),
    })

  if (editing) {
    return (
      <InitiativeForm
        initial={initiative}
        submitLabel="Save"
        onSave={(input) => {
          void actions.updateInitiative(initiative.id, input)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={`card initiative${props.expanded ? ' open' : ''}`} id={`initiative-${initiative.id}`}>
      <button type="button" className="initiative-head" aria-expanded={props.expanded} onClick={props.onToggle}>
        <Icon.Chevron size={16} className="chev" />
        <span className="initiative-main">
          <span className="initiative-title">{initiative.title}</span>
          <span className="initiative-sub">
            {stats.total} project{stats.total === 1 ? '' : 's'} · avg progress {stats.avgProgress}% ·{' '}
            {owners.length ? owners.join(' · ') : 'Owners not set'}
            {quarters ? ` · ${quarters}` : ''}
          </span>
        </span>
        <span className="initiative-signals">
          <RagCountRow counts={stats.counts} />
          {stats.openIssues > 0 && <Tag tone="amber">{stats.openIssues} issue{stats.openIssues === 1 ? '' : 's'}</Tag>}
          {stats.decisions > 0 && <Tag tone="blue">{stats.decisions} decision{stats.decisions === 1 ? '' : 's'}</Tag>}
        </span>
      </button>

      {props.expanded && (
        <div className="initiative-body">
          <ProjectList projects={projects} showPath={false} empty="No projects under this initiative yet." />
          {addingProject && (
            <div className="inset">
              <NewProjectForm
                onSave={(input) => {
                  void actions.addProject(initiative.id, input)
                  setAddingProject(false)
                }}
                onCancel={() => setAddingProject(false)}
              />
            </div>
          )}
          {canWrite && !addingProject && (
            <div className="initiative-foot">
              <button type="button" className="btn btn-ghost sm" onClick={() => setAddingProject(true)}>
                <Icon.Plus size={15} /> Add project
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn-quiet sm" onClick={() => setEditing(true)}>
                <Icon.Edit size={15} /> Edit initiative
              </button>
              <button type="button" className="btn btn-quiet sm danger" onClick={remove}>
                <Icon.Trash size={15} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── heatmap ───────────────────────────────────────────────────────────────

function Heatmap() {
  const { tracker, navigate, matches, filtering } = useApp()
  const { state } = tracker

  return (
    <div className="heatmap">
      <p className="hint">
        Each tile is an initiative, colored by its worst project status. Click a tile to open it in the ledger.
        {filtering && ' Only projects matching the filters count toward each tile.'}
      </p>
      {state.pillars.map((pillar, index) => {
        const label = pillarLabel(pillar, index)
        const summary = summarizePillar(state, pillar, index, tracker.settings.staleThresholdDays, matches)
        const initiatives = state.initiatives.filter((initiative) => initiative.pillarId === pillar.id)
        return (
          <div key={pillar.id} className="heat-row">
            <div className="heat-label">
              <span className="pillar-eyebrow">{label.eyebrow}</span>
              <span className="heat-title">{label.title}</span>
              <span className="muted small">
                {summary.projects.length} projects · {summary.offTrack} off track
              </span>
            </div>
            <div className="heat-grid">
              {initiatives.map((initiative) => {
                const heat = initiativeHeat(state, initiative, matches)
                const dim = filtering && heat.projects.length === 0
                return (
                  <button
                    key={initiative.id}
                    type="button"
                    className={`heat-tile heat-${heat.status ?? 'none'}${dim ? ' dim' : ''}`}
                    onClick={() => navigate({ view: 'portfolio', layout: 'ledger', pillar: pillar.id, initiative: initiative.id })}
                  >
                    <span className="heat-tile-title">{initiative.title}</span>
                    <span className="heat-tile-meta">
                      <StatusTagInline status={heat.status} total={heat.total} />
                      <span>· {heat.projects.length} proj</span>
                      <span>· {heat.avgProgress}%</span>
                    </span>
                  </button>
                )
              })}
              {initiatives.length === 0 && <div className="muted small">No initiatives.</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusTagInline({ status, total }: { status: ReturnType<typeof initiativeHeat>['status']; total: number }) {
  if (!status) return <strong className="tone-muted">{total ? 'No matches' : 'No projects'}</strong>
  const labels = { green: 'On track', amber: 'At risk', red: 'Off track' } as const
  return <strong className={`tone-${status}`}>{labels[status]}</strong>
}

// ── leadership brief ──────────────────────────────────────────────────────

function Brief() {
  const { tracker, navigate, matches, setFilters, filters, openProject, contextOf } = useApp()
  const { state, settings } = tracker
  const projects = useMemo(() => state.projects.filter(matches), [state.projects, matches])
  const stats = portfolioStats(state, projects, settings.staleThresholdDays)
  const attention = needsAttention(projects)

  return (
    <div className="brief">
      <div className="tiles">
        <StatTile label="Projects" value={stats.projects} sub={`${stats.initiatives} initiatives`} />
        <StatTile
          label="On track"
          tone="green"
          value={`${stats.onTrackPct}%`}
          sub={`${stats.counts.green} of ${stats.projects}`}
          active={filters.rag.length === 1 && filters.rag[0] === 'green'}
          onClick={() => setFilters({ rag: filters.rag.length === 1 && filters.rag[0] === 'green' ? [] : ['green'] })}
        />
        <StatTile
          label="Off track"
          tone="red"
          value={stats.counts.red}
          sub={`${stats.counts.amber} more at risk`}
          active={filters.rag.length === 1 && filters.rag[0] === 'red'}
          onClick={() => setFilters({ rag: filters.rag.length === 1 && filters.rag[0] === 'red' ? [] : ['red'] })}
        />
        <StatTile
          label="Decisions waiting"
          tone="blue"
          value={stats.decisions}
          sub="need an outcome"
          active={filters.decisions}
          onClick={() => setFilters({ decisions: !filters.decisions })}
        />
        <StatTile
          label="Stale"
          tone="amber"
          value={stats.stale}
          sub={`no update in ${settings.staleThresholdDays}+ days`}
          active={filters.stale}
          onClick={() => setFilters({ stale: !filters.stale })}
        />
      </div>

      <div className="pillar-cards">
        {state.pillars.map((pillar, index) => {
          const label = pillarLabel(pillar, index)
          const summary = summarizePillar(state, pillar, index, settings.staleThresholdDays, matches)
          return (
            <button
              key={pillar.id}
              type="button"
              className="card pillar-card clickable"
              onClick={() => navigate({ view: 'portfolio', layout: 'ledger', pillar: pillar.id })}
            >
              <span className="pillar-card-head">
                <span className="pillar-card-title">{label.title}</span>
                <span className="muted small">{label.eyebrow}</span>
              </span>
              <StackedBar counts={summary.counts} height={10} />
              <span className="metrics">
                <Metric value={summary.projects.length} label="projects" />
                <Metric value={`${summary.avgProgress}%`} label="avg progress" />
                <Metric value={summary.decisions} label="decisions" tone="blue" />
                <Metric value={summary.stale} label="stale" tone="amber" />
              </span>
            </button>
          )
        })}
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">Needs leadership attention</h2>
          <span className="muted small">Off track, or waiting on a decision</span>
        </div>
        {attention.length === 0 ? (
          <div className="list-empty">Nothing is off track or waiting on a decision.</div>
        ) : (
          <ul className="attention">
            {attention.map((project) => {
              const context = contextOf(project)
              const waiting = needsDecision(project)
              return (
                <li key={project.id}>
                  <button type="button" className="attention-row" onClick={() => openProject(project.id)}>
                    <span className="attention-status">
                      <StatusTag status={project.rag} />
                    </span>
                    <span className="attention-main">
                      <span className="plist-title">{project.title}</span>
                      <span className="plist-path">{context.pillar ? pillarTitle(context.pillar.title) : ''}</span>
                    </span>
                    <span className="attention-text">
                      {waiting ? (
                        <>
                          <strong>Decision needed:</strong> {project.decisionNeeded}
                        </>
                      ) : project.keyRisk.trim() ? (
                        <>
                          <strong>Key risk:</strong> {project.keyRisk}
                        </>
                      ) : (
                        <span className="muted">No risk recorded.</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Metric(props: { value: number | string; label: string; tone?: 'blue' | 'amber' }) {
  return (
    <span className="metric">
      <span className={`metric-value${props.tone ? ` tone-${props.tone}` : ''}`}>{props.value}</span>
      <span className="metric-label">{props.label}</span>
    </span>
  )
}
