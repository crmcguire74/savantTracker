// 👥 Workload: who owns what. One row per person pulled from the owner
// fields, with their projects split by status and by role. A row opens that
// person's work page. The PM heat map layout lives in PmHeatmap.tsx.

import { useMemo, useState } from 'react'
import { countByRag } from '../../lib/rollups'
import type { Person } from '../../lib/people'
import type { WorkloadLayout } from '../../hooks/useRoute'
import { Avatar, EmptyState, PageHeader, Segmented, StackedBar } from '../common'
import { useApp } from '../context'
import { PmHeatmap } from './PmHeatmap'

type SortKey = 'total' | 'red' | 'issues' | 'name'

export function WorkloadView(props: { layout: WorkloadLayout }) {
  const { navigate, can } = useApp()
  const showHeatmap = can('workload.pm-heatmap')
  const layout = showHeatmap ? props.layout : 'people'

  return (
    <div className="page">
      <PageHeader
        eyebrow="Team workload"
        title={layout === 'pm-heatmap' ? 'Which projects need help' : 'Who owns what'}
        sub={
          layout === 'pm-heatmap'
            ? 'Every project in its project manager’s row, heated by how urgently it needs attention. Hottest rows first.'
            : "Names are read from each project's business owner, delivery owner and project manager fields."
        }
        actions={
          showHeatmap && (
            <Segmented<WorkloadLayout>
              label="View"
              value={layout}
              options={[
                { value: 'people', label: 'People' },
                { value: 'pm-heatmap', label: 'PM heat map' },
              ]}
              onChange={(next) => navigate({ view: 'workload', layout: next }, { replace: true })}
            />
          )
        }
      />
      {layout === 'pm-heatmap' ? <PmHeatmap /> : <People />}
    </div>
  )
}

function People() {
  const { people, tracker, navigate, me } = useApp()
  const [sort, setSort] = useState<SortKey>('total')

  const rows = useMemo(() => {
    const byId = new Map(tracker.state.projects.map((project) => [project.id, project]))
    return people.map((person) => {
      const projects = person.projectIds.map((id) => byId.get(id)!).filter(Boolean)
      return {
        person,
        counts: countByRag(projects),
        total: projects.length,
        issues: projects.reduce((sum, project) => sum + project.issues.filter((issue) => issue.status === 'open').length, 0),
      }
    })
  }, [people, tracker.state.projects])

  const sorted = rows.slice().sort((a, b) => {
    switch (sort) {
      case 'red':
        return b.counts.red - a.counts.red || b.total - a.total
      case 'issues':
        return b.issues - a.issues || b.total - a.total
      case 'name':
        return a.person.name.localeCompare(b.person.name)
      default:
        return b.total - a.total || a.person.name.localeCompare(b.person.name)
    }
  })
  const max = Math.max(1, ...rows.map((row) => row.total))

  const open = (person: Person) => navigate({ view: 'work', person: person.key === me?.key ? undefined : person.key })

  return (
    <>
      <div className="workload-sort">
        <Segmented<SortKey>
          label="Sort"
          value={sort}
          options={[
            { value: 'total', label: 'Most projects' },
            { value: 'red', label: 'Off track' },
            { value: 'issues', label: 'Open issues' },
            { value: 'name', label: 'Name' },
          ]}
          onChange={setSort}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No owners recorded yet">Add business or delivery owners on projects to see workload here.</EmptyState>
      ) : (
        <div className="card table-card">
          <div className="wl-row wl-head" role="row">
            <span>Person</span>
            <span>Projects by status</span>
            <span className="num">Business</span>
            <span className="num">Delivery</span>
            <span className="num">PM</span>
            <span className="num">Open issues</span>
          </div>
          {sorted.map((row) => (
            <button key={row.person.key} type="button" className="wl-row" onClick={() => open(row.person)}>
              <span className="wl-person">
                <Avatar initials={row.person.initials} size={30} />
                <span>
                  {row.person.name}
                  {row.person.key === me?.key && <span className="muted small"> (me)</span>}
                </span>
              </span>
              <span className="wl-bar">
                <span style={{ width: `${(row.total / max) * 100}%` }}>
                  <StackedBar counts={row.counts} height={12} />
                </span>
                <span className="muted small">{row.total}</span>
              </span>
              <span className="num">{row.person.business.length}</span>
              <span className="num">{row.person.delivery.length}</span>
              <span className="num">{row.person.pm.length}</span>
              <span className={`num${row.issues ? ' tone-amber strong' : ''}`}>{row.issues}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
