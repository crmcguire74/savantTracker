// __TITLE__ view. Everything shared comes from `@sdk`; everything else lives
// in this folder.

import { useMemo } from 'react'
import { EmptyState, PageHeader, ProjectList, usePlatform } from '@sdk'

export function __COMPONENT__View(props: { filter?: string }) {
  const { tracker, navigate } = usePlatform()
  const projects = useMemo(() => {
    const needle = props.filter?.toLowerCase()
    return tracker.state.projects.filter((project) => !needle || project.title.toLowerCase().includes(needle))
  }, [tracker.state.projects, props.filter])

  return (
    <div className="page">
      <PageHeader
        eyebrow="__TITLE__"
        title="__TITLE__"
        sub="__DESCRIPTION__"
        actions={
          <input
            className="input"
            placeholder="Filter by title"
            defaultValue={props.filter ?? ''}
            aria-label="Filter by title"
            // The module owns its URL params; the platform reads only the module id.
            onChange={(event) => navigate({ module: '__ID__', params: { filter: event.target.value || undefined } }, { replace: true })}
          />
        }
      />
      {projects.length ? <ProjectList projects={projects} /> : <EmptyState title="No projects match" />}
    </div>
  )
}
