// 🛡️ Admin console: who sees which views and reports. Admins edit a draft of
// the access policy and save it for everyone in one go, so a half-finished
// change never reaches other people. The Admin column is fixed on: admins
// always see everything, which keeps anyone from locking the console away.

import { useEffect, useMemo, useState } from 'react'
import { defaultPolicy, FEATURE_CATALOG, normalizePolicy, type AccessPolicy } from '../../auth/access'
import { ROLE_ORDER, ROLES, type Role } from '../../auth/roles'
import { REPORT_CATALOG } from '../../reports/catalog'
import { PageHeader, Tag } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'
import { formatDay } from './WorkView'

type Section = 'features' | 'reports'

interface Row {
  key: string
  label: string
  sub?: string
  child?: boolean
}

const FEATURE_ROWS: Row[] = FEATURE_CATALOG.map((feature) => ({
  key: feature.key,
  label: feature.label,
  child: Boolean(feature.parent),
}))

const REPORT_ROWS: Row[] = REPORT_CATALOG.map((report) => ({ key: report.id, label: report.title, sub: report.audience }))

export function AdminView() {
  const { tracker, identitySource, ask } = useApp()
  const saved = tracker.access
  const [draft, setDraft] = useState<AccessPolicy>(saved)
  const [saving, setSaving] = useState(false)

  // Someone else saved while this page was open: start from theirs.
  useEffect(() => setDraft(saved), [saved])

  const dirty = useMemo(() => JSON.stringify(draft.features) + JSON.stringify(draft.reports) !== JSON.stringify(saved.features) + JSON.stringify(saved.reports), [draft, saved])

  const toggle = (section: Section, key: string, role: Role) => {
    if (role === 'admin') return
    setDraft((current) => {
      const table = current[section] as Record<string, Role[]>
      const roles = table[key] ?? []
      const next = roles.includes(role) ? roles.filter((value) => value !== role) : [...roles, role]
      return normalizePolicy({ ...current, [section]: { ...table, [key]: next } })
    })
  }

  const save = async () => {
    setSaving(true)
    await tracker.actions.saveAccess(draft)
    setSaving(false)
  }

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Access and roles"
        sub="Choose which roles see each view and report. Saving applies to everyone the next time their page updates."
        actions={
          <>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() =>
                ask({
                  title: 'Restore the default access?',
                  message: 'This puts every view and report back to the roles it shipped with. Nothing changes for anyone until you save.',
                  confirmLabel: 'Restore defaults',
                  onConfirm: () => setDraft(defaultPolicy()),
                })
              }
            >
              Restore defaults
            </button>
            <button type="button" className="btn btn-ghost" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
              Discard changes
            </button>
            <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save access'}
            </button>
          </>
        }
      />

      {dirty && (
        <div className="callout amber admin-unsaved" role="status">
          You have unsaved access changes.
        </div>
      )}

      <section className="card pad">
        <h2 className="card-title">Roles</h2>
        <p className="muted">
          {identitySource === 'entra'
            ? 'People get a role in Microsoft Entra ID: Enterprise applications → WiseTrack → Users and groups. Changes take effect at their next sign-in.'
            : 'Local mode: testers pick a role on the sign-in screen, or switch roles from the account menu. In Azure, roles come from Microsoft Entra ID.'}
        </p>
        <div className="role-grid">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="role-card">
              <div className="role-card-head">
                <strong>{ROLES[role].label}</strong>
                <Tag tone={ROLES[role].canEdit ? 'accent' : 'outline'}>{ROLES[role].canEdit ? 'Can edit' : 'Read only'}</Tag>
              </div>
              <p className="muted small">{ROLES[role].description}</p>
              <code className="role-claim">{ROLES[role].appRole}</code>
            </div>
          ))}
        </div>
      </section>

      <AccessMatrix
        title="Views and layouts"
        hint="A layout needs its view too: turning off Workload hides the PM heat map."
        rows={FEATURE_ROWS}
        table={draft.features}
        saved={saved.features}
        onToggle={(key, role) => toggle('features', key, role)}
      />

      <AccessMatrix
        title="Reports"
        hint="Reports are listed on the Reports page, so a role also needs the Reports view."
        rows={REPORT_ROWS}
        table={draft.reports}
        saved={saved.reports}
        onToggle={(key, role) => toggle('reports', key, role)}
      />

      <p className="muted small admin-foot">
        {saved.updatedAt
          ? `Last saved ${formatDay(saved.updatedAt.slice(0, 10))}${saved.updatedByName ? ` by ${saved.updatedByName}` : ''}.`
          : 'Using the default access. Nothing has been saved yet.'}{' '}
        This controls what the app shows. Every role with access can still read the shared tracker data.
      </p>
    </div>
  )
}

function AccessMatrix(props: {
  title: string
  hint: string
  rows: Row[]
  table: Record<string, Role[]>
  saved: Record<string, Role[]>
  onToggle: (key: string, role: Role) => void
}) {
  const counts = ROLE_ORDER.map((role) => props.rows.filter((row) => props.table[row.key]?.includes(role)).length)

  return (
    <section className="card access-card">
      <div className="card-title-row">
        <h2 className="card-title">{props.title}</h2>
        <span className="muted small">{props.hint}</span>
      </div>
      <div className="access-scroll">
        <table className="access-matrix">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{props.title}</span>
              </th>
              {ROLE_ORDER.map((role, index) => (
                <th key={role} scope="col">
                  <span className="access-role">{ROLES[role].label}</span>
                  <span className="access-count">
                    {counts[index]} of {props.rows.length}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.key} className={row.child ? 'child' : ''}>
                <th scope="row">
                  <span className="access-label">{row.label}</span>
                  {row.sub && <span className="access-sub">{row.sub}</span>}
                </th>
                {ROLE_ORDER.map((role) => {
                  const on = props.table[row.key]?.includes(role) ?? false
                  const changed = on !== (props.saved[row.key]?.includes(role) ?? false)
                  const locked = role === 'admin'
                  return (
                    <td key={role}>
                      <label className={`access-cell${on ? ' on' : ''}${changed ? ' changed' : ''}${locked ? ' locked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onChange={() => props.onToggle(row.key, role)}
                          aria-label={`${ROLES[role].label} can use ${row.label}`}
                        />
                        {locked ? <Icon.Lock size={13} /> : on ? <Icon.Check size={14} /> : null}
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
