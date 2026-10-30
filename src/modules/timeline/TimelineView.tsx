// 📅 Timeline: a twelve-month range, grouped by pillar. A bar spans start to
// forecast end (original end when there is no forecast); the diamond marks
// the next milestone, or the end date when no milestone is set. The range
// pages by quarter.

import { useMemo, useState } from 'react'
import { FilterChips, PageHeader, usePlatform, Icon, byStatusThenTitle, hasSchedule, phaseLabel, pillarLabel, timelinePosition, timelineWindow, projectsForPillar, type Project } from '@sdk'

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function TimelineView() {
  const { tracker, matches, filtering } = usePlatform()
  const { state } = tracker
  const [offset, setOffset] = useState(0)
  const range = useMemo(() => timelineWindow(offset), [offset])
  const today = timelinePosition(range, new Date().toISOString().slice(0, 10))

  const groups = state.pillars
    .map((pillar, index) => ({
      pillar,
      label: pillarLabel(pillar, index),
      projects: projectsForPillar(state, pillar.id).filter((project) => matches(project) && hasSchedule(project)).sort(byStatusThenTitle),
    }))
    .filter((group) => group.projects.length > 0)

  const scheduled = groups.reduce((sum, group) => sum + group.projects.length, 0)
  const unscheduled = state.projects.filter((project) => matches(project) && !hasSchedule(project)).length
  const first = range.months[0]
  const last = range.months[range.months.length - 1]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Timeline"
        title={`${MONTH_YEAR.format(first)} – ${MONTH_YEAR.format(last)}`}
        actions={
          <div className="row-actions">
            <button type="button" className="icon-btn" aria-label="Previous quarter" onClick={() => setOffset((v) => v - 3)}>
              <Icon.ArrowLeft size={16} />
            </button>
            <button type="button" className="btn btn-ghost sm" disabled={offset === 0} onClick={() => setOffset(0)}>
              Today
            </button>
            <button type="button" className="icon-btn" aria-label="Next quarter" onClick={() => setOffset((v) => v + 3)}>
              <Icon.ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        }
      />
      <FilterChips count={filtering ? scheduled : undefined} noun="scheduled" />

      <div className="card timeline" style={{ ['--months' as string]: range.months.length }}>
        <div className="tl-head">
          <div className="tl-label-col section-label">Project</div>
          <div className="tl-months">
            {range.months.map((month) => (
              <div key={month.toISOString()} className="tl-month">
                {MONTH.format(month)}
                {month.getUTCMonth() === 0 && <span className="tl-year">{month.getUTCFullYear()}</span>}
              </div>
            ))}
          </div>
        </div>

        {groups.length === 0 && <div className="list-empty">No projects with dates{filtering ? ' match these filters' : ''}.</div>}

        {groups.map((group) => (
          <div key={group.pillar.id} className="tl-group">
            <div className="tl-group-head">{group.label.title}</div>
            {group.projects.map((project) => (
              <TimelineRow key={project.id} project={project} range={range} today={today} />
            ))}
          </div>
        ))}
      </div>
      {unscheduled > 0 && (
        <p className="hint">
          {unscheduled} project{unscheduled === 1 ? ' has' : 's have'} no dates yet and {unscheduled === 1 ? 'is' : 'are'} not shown. Add a
          start, end, or milestone date from the project page.
        </p>
      )}
    </div>
  )
}

function TimelineRow(props: { project: Project; range: ReturnType<typeof timelineWindow>; today: number | null }) {
  const { openProject } = usePlatform()
  const { project, range } = props
  const end = project.forecastEndDate.trim() || project.originalEndDate.trim()
  const startRaw = timelinePosition(range, project.startDate)
  const startClamped = timelinePosition(range, project.startDate, true)
  const endClamped = timelinePosition(range, end, true)
  const endRaw = timelinePosition(range, end)

  // Draw the bar only when the span actually overlaps the range.
  const showBar = startClamped !== null && endClamped !== null && endClamped > startClamped
  const marker = timelinePosition(range, project.nextMilestoneDate) ?? (project.nextMilestoneDate.trim() ? null : endRaw)

  const title = [
    project.startDate && `Start ${project.startDate}`,
    end && `End ${end}`,
    project.nextMilestone && `Next: ${project.nextMilestone}${project.nextMilestoneDate ? ` (${project.nextMilestoneDate})` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button type="button" className="tl-row" onClick={() => openProject(project.id)} title={title}>
      <span className="tl-label-col">
        <span className="tl-title">{project.title}</span>
        <span className="tl-sub">
          {phaseLabel(project.phase)} · {project.progress}%
        </span>
      </span>
      <span className="tl-track">
        {props.today !== null && <span className="tl-today" style={{ left: `${props.today * 100}%` }} />}
        {showBar && (
          <span
            className={`tl-bar bar-${project.rag}${startRaw === null ? ' cut-start' : ''}${endRaw === null ? ' cut-end' : ''}`}
            style={{ left: `${startClamped! * 100}%`, width: `${(endClamped! - startClamped!) * 100}%` }}
          >
            <span className="tl-bar-fill" style={{ width: `${project.progress}%` }} />
          </span>
        )}
        {marker !== null && <span className={`tl-diamond diamond-${project.rag}`} style={{ left: `${marker * 100}%` }} />}
      </span>
    </button>
  )
}
