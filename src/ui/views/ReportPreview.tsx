// 🖨️ Printable reports. Today that is the pillar one-pager: one landscape
// page per pillar laid out like the leadership OKR slide, so it can be saved
// as PDF from the print dialog and dropped into the deck. The toolbar never
// prints; each page breaks onto its own sheet.

import { useMemo, type ReactNode } from 'react'
import { REPORT_CATALOG, reportInfo, type ReportId } from '../../reports/catalog'
import { buildOnePager, type Bullet, type OnePager } from '../../reports/onepager'
import { Dot, EmptyState, RagCountRow } from '../common'
import { useApp } from '../context'
import { Icon } from '../icons'
import { PaceTag, PaceTrack } from '../pace'
import { formatDay } from './WorkView'

const isReportId = (value: string): value is ReportId => REPORT_CATALOG.some((report) => report.id === value)

export function ReportPreview(props: { report: string; pillar?: string }) {
  const { tracker, navigate, canReport } = useApp()
  const { state, log, settings } = tracker

  const pages = useMemo(() => {
    const pillars = props.pillar ? state.pillars.filter((pillar) => pillar.id === props.pillar) : state.pillars
    return pillars.map((pillar) => buildOnePager(state, log, pillar, settings.staleThresholdDays))
  }, [state, log, settings.staleThresholdDays, props.pillar])

  const back = (
    <button type="button" className="back-link" onClick={() => navigate({ view: 'reports' })}>
      <Icon.ArrowLeft size={15} /> Reports
    </button>
  )

  if (!isReportId(props.report) || props.report !== 'pillar-one-pager' || !canReport(props.report)) {
    return (
      <div className="page">
        {back}
        <EmptyState title="That report isn’t available">It may have been renamed, or your role may not include it.</EmptyState>
      </div>
    )
  }

  return (
    <div className="page page-wide report-preview">
      <div className="report-toolbar no-print">
        {back}
        <div className="report-toolbar-title">
          <strong>{reportInfo(props.report).title}</strong>
          <span className="muted small">
            {pages.length} page{pages.length === 1 ? '' : 's'} · landscape · choose “Save as PDF” in the print dialog
          </span>
        </div>
        <label className="field inline">
          <span>Pillar</span>
          <select
            className="select"
            value={props.pillar ?? ''}
            onChange={(event) => navigate({ view: 'reports', report: props.report, pillar: event.target.value || undefined }, { replace: true })}
          >
            <option value="">All pillars</option>
            {state.pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon.Print size={16} /> Print or save PDF
        </button>
      </div>

      {pages.length === 0 ? (
        <EmptyState title="No pillars to report on">Add a pillar in the portfolio first.</EmptyState>
      ) : (
        pages.map((page) => <OnePagerSheet key={page.pillar.id} page={page} />)
      )}
    </div>
  )
}

function OnePagerSheet({ page }: { page: OnePager }) {
  return (
    <article className="sheet" aria-label={`${page.eyebrow}: ${page.title}`}>
      <header className="sheet-head">
        <div>
          <div className="sheet-eyebrow">{page.eyebrow}</div>
          <h1 className="sheet-title">{page.title}</h1>
        </div>
        <div className="sheet-brand">
          <Icon.Logo size={30} />
          <span>WiseTrack</span>
        </div>
      </header>

      <div className="sheet-grid">
        <div className="sheet-col">
          <SheetBox title="Where it stands">
            <p>
              <strong>{page.progress}%</strong> complete across {page.projects} project{page.projects === 1 ? '' : 's'} in {page.initiatives}{' '}
              initiative{page.initiatives === 1 ? '' : 's'}.
            </p>
            <div className="sheet-standing">
              <PaceTag pace={page.pace} />
              <RagCountRow counts={page.counts} />
            </div>
          </SheetBox>
          <SheetBox title="Team">
            <p>
              <span className="sheet-k">Sponsor</span> {page.owner || 'Not set'}
            </p>
            <p>
              <span className="sheet-k">Members</span> {page.members.length ? page.members.join(', ') : 'None recorded'}
            </p>
          </SheetBox>
          <SheetBox title="Dependencies" grow>
            <BulletList items={page.dependencies} empty="No dependencies recorded." />
          </SheetBox>
        </div>

        <div className="sheet-col">
          <div className="sheet-box flush">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th scope="col">Key results</th>
                  <th scope="col">Target</th>
                  <th scope="col">To date</th>
                </tr>
              </thead>
              <tbody>
                {page.keyResults.map((result) => (
                  <tr key={result.title}>
                    <th scope="row">
                      {result.title}
                      <span className="sheet-sub">
                        {result.projects} project{result.projects === 1 ? '' : 's'}
                      </span>
                    </th>
                    <td>{result.target || '—'}</td>
                    <td>
                      <span className="sheet-kr">
                        <strong>{result.progress}%</strong> · {result.paceLabel}
                      </span>
                      <PaceTrack progress={result.paceProgress} expected={result.expected} pace={result.pace} label={result.title} compact />
                    </td>
                  </tr>
                ))}
                {page.keyResults.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No initiatives yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <SheetBox title="Goals and outcomes" grow>
            <BulletList items={page.goals} empty="No open projects." />
            {page.moreGoals > 0 && <p className="sheet-meta sheet-more">and {page.moreGoals} more open projects</p>}
          </SheetBox>
        </div>

        <div className="sheet-col tinted">
          <SheetBox title="Recent accomplishments">
            <BulletList items={page.accomplishments} empty="Nothing logged in the last 45 days." />
          </SheetBox>
          <SheetBox title="Next steps">
            <BulletList items={page.nextSteps} empty="No milestones in the next 60 days." />
          </SheetBox>
          <SheetBox title="Risks and issues" grow>
            <BulletList items={page.risks} empty="No open risks on at-risk or off-track projects." />
          </SheetBox>
        </div>
      </div>

      <footer className="sheet-foot">
        <span className="sheet-updated">Updated {formatDay(page.asOf)}</span>
        <span>Bars show work done; the line marks where the schedule says it should be today.</span>
      </footer>
    </article>
  )
}

function SheetBox(props: { title: string; children: ReactNode; grow?: boolean }) {
  return (
    <section className={`sheet-box${props.grow ? ' grow' : ''}`}>
      <h2 className="sheet-box-title">{props.title}</h2>
      {props.children}
    </section>
  )
}

function BulletList({ items, empty }: { items: Bullet[]; empty: string }) {
  if (items.length === 0) return <p className="sheet-empty">{empty}</p>
  return (
    <ul className="sheet-list">
      {items.map((item, index) => (
        <li key={index}>
          {item.tone && <Dot status={item.tone} size={7} />}
          <span>
            {item.text}
            {item.meta && <span className="sheet-meta"> · {item.meta}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
