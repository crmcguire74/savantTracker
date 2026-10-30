// 🕘 The change log as a drawer. Opened from a project it shows that
// project's history first, with a switch to the whole tracker. Editors can
// restore any field edit's previous value.

import { useMemo, useState } from 'react'
import type { LogEntry } from '../types'
import { Drawer, ageLabel, formatLogValue } from './common'
import { useApp } from './context'
import { Icon } from './icons'

export function ChangeLogDrawer(props: { projectId?: string; onClose: () => void }) {
  const { tracker, canWrite, openProject } = useApp()
  const [scope, setScope] = useState<'project' | 'all'>(props.projectId ? 'project' : 'all')
  const [query, setQuery] = useState('')
  const project = tracker.state.projects.find((candidate) => candidate.id === props.projectId)

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tracker.log
      .filter((entry) => scope === 'all' || entry.projectId === props.projectId)
      .filter(
        (entry) =>
          !needle ||
          [entry.projectTitle, entry.field, entry.oldValue, entry.newValue, entry.editedByName].some((value) =>
            value.toLowerCase().includes(needle),
          ),
      )
  }, [tracker.log, scope, props.projectId, query])

  const restore = (entry: LogEntry) => void tracker.actions.restoreFromLog(entry)

  return (
    <Drawer label="Change log" onClose={props.onClose} wide header={<span className="eyebrow">Change log</span>}>
      <h2 className="drawer-title">{scope === 'project' && project ? project.title : 'All changes'}</h2>
      <div className="log-tools">
        {props.projectId && (
          <div className="segmented sm" role="tablist">
            <button type="button" role="tab" aria-selected={scope === 'project'} className={scope === 'project' ? 'active' : ''} onClick={() => setScope('project')}>
              This project
            </button>
            <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
              Everything
            </button>
          </div>
        )}
        <input className="input" value={query} placeholder="Filter by field, value or person" aria-label="Filter change log" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {entries.length === 0 ? (
        <div className="list-empty">{tracker.log.length ? 'No changes match.' : 'No edits logged yet. Every change shows up here.'}</div>
      ) : (
        <ol className="log-list">
          {entries.map((entry) => (
            <li key={entry.id} className="log-item">
              <div className="log-item-head">
                {scope === 'all' && entry.projectId && tracker.state.projects.some((p) => p.id === entry.projectId) ? (
                  <button
                    type="button"
                    className="link-btn strong"
                    onClick={() => {
                      props.onClose()
                      openProject(entry.projectId)
                    }}
                  >
                    {entry.projectTitle}
                  </button>
                ) : scope === 'all' ? (
                  <strong>{entry.projectTitle}</strong>
                ) : null}
                <span className="log-field">{entry.field}</span>
              </div>
              <div className="log-change">
                {entry.oldValue && <span className="log-old">{formatLogValue(entry.fieldKey, entry.oldValue)}</span>}
                {entry.oldValue && <span className="muted"> → </span>}
                <span className="log-new">{formatLogValue(entry.fieldKey, entry.newValue) || <span className="muted">(empty)</span>}</span>
              </div>
              <div className="log-meta">
                <span>
                  {entry.editedByName || entry.editedById || 'Unknown'} ·{' '}
                  <span title={entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}>{ageLabel(entry.timestamp)}</span>
                </span>
                {canWrite && entry.fieldKey && tracker.state.projects.some((p) => p.id === entry.projectId) && (
                  <button type="button" className="btn btn-quiet sm" onClick={() => restore(entry)}>
                    <Icon.History size={14} /> Restore previous
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}
