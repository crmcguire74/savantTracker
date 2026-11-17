// ❓ Help: a short start, workflows for each role, FAQ, a glossary and the full User Guide. The
// words live in content.ts; the guide is the repository's `User Guide.md`, loaded on demand. This
// file lays them out and handles search and tabs.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dot, Icon, PageHeader, ROLE_ORDER, ROLES, Segmented, USER_GUIDE_FILE_NAME, downloadText, loadUserGuide, primaryRole, usePlatform, type ModuleProps, type Role } from '@sdk'
import { FAQ, GLOSSARY, GUIDES, QUICK_START, type Step, type Workflow } from './content'
import { Markdown, headingsOf } from './markdown'

export type HelpTab = 'start' | 'roles' | 'faq' | 'glossary' | 'guide'

const TABS: Array<{ value: HelpTab; label: string }> = [
  { value: 'start', label: 'Start here' },
  { value: 'roles', label: 'Workflows by role' },
  { value: 'faq', label: 'FAQ' },
  { value: 'glossary', label: 'Glossary' },
  { value: 'guide', label: 'User Guide' },
]

const isTab = (value: string | undefined): value is HelpTab => TABS.some((tab) => tab.value === value)
const isRole = (value: string | undefined): value is Role => ROLE_ORDER.some((role) => role === value)

const matches = (haystack: string, query: string): boolean => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = haystack.toLowerCase()
  return words.every((word) => text.includes(word))
}

export function HelpView({ location }: Pick<ModuleProps, 'location'>) {
  const { roles, navigate } = usePlatform()
  const mine = primaryRole(roles) ?? 'viewer'
  const [tab, setTab] = useState<HelpTab>(isTab(location.params.tab) ? location.params.tab : 'start')
  const [role, setRole] = useState<Role>(isRole(location.params.role) ? location.params.role : mine)
  const [query, setQuery] = useState('')

  // A link or the back button changes the URL; keep the page in step with it.
  useEffect(() => {
    setTab(isTab(location.params.tab) ? location.params.tab : 'start')
    if (isRole(location.params.role)) setRole(location.params.role)
  }, [location.params.tab, location.params.role])

  const goTab = (next: HelpTab) => {
    setTab(next)
    setQuery('')
    navigate({ module: 'help', params: { tab: next === 'start' ? undefined : next, role: next === 'roles' ? role : undefined } }, { replace: true })
  }

  return (
    <div className="page help-page">
      <PageHeader
        eyebrow="Help"
        title="Help"
        sub="How to use the tracker, answers to common questions, and what each term means."
        actions={<Segmented label="Help sections" value={tab} options={TABS} onChange={goTab} />}
      />

      {tab === 'start' && <StartHere onPick={goTab} />}
      {tab === 'roles' && <RoleGuides role={role} mine={mine} onRole={setRole} />}
      {tab === 'faq' && <FaqList query={query} onQuery={setQuery} />}
      {tab === 'glossary' && <GlossaryList query={query} onQuery={setQuery} />}
      {tab === 'guide' && <UserGuide />}
    </div>
  )
}

// ── user guide ────────────────────────────────────────────────────────────

const GUIDE_PAGE_STYLE = `
  body { font: 15px/1.55 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1d2733; max-width: 860px; margin: 32px auto; padding: 0 20px; }
  h1, h2, h3, h4 { font-family: Lora, Georgia, serif; font-weight: 500; line-height: 1.25; }
  h2 { font-size: 30px; } h3 { font-size: 22px; margin-top: 32px; border-top: 1px solid #dde3ea; padding-top: 18px; } h4 { font-size: 17px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
  th, td { border: 1px solid #dde3ea; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f2f5f8; }
  code { background: #f2f5f8; padding: 1px 4px; border-radius: 4px; font-size: 13px; }
  pre { background: #f2f5f8; padding: 12px; border-radius: 6px; overflow: auto; }
  blockquote { margin: 12px 0; padding: 4px 14px; border-left: 3px solid #8fcfc7; color: #4a5866; }
  a { color: #0f6f66; }
  @media print { body { margin: 0; max-width: none; } h3 { break-after: avoid; } table, pre { break-inside: avoid; } }
`

/** The rendered guide as one self-contained web page: opens anywhere, prints to PDF cleanly. */
const guidePage = (body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${USER_GUIDE_FILE_NAME}</title><style>${GUIDE_PAGE_STYLE}</style></head><body>${body}</body></html>`

function UserGuide() {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const body = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let live = true
    loadUserGuide().then(
      (markdown) => live && setText(markdown),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [])

  const contents = useMemo(() => (text ? headingsOf(text).filter((heading) => heading.level === 2) : []), [text])
  const jump = (id: string) => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const html = () => guidePage(body.current?.innerHTML ?? '')

  // Prints through a hidden frame, so only the guide prints and no pop-up window is needed.
  const print = () => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const doc = frame.contentDocument
    if (!doc || !frame.contentWindow) {
      frame.remove()
      return
    }
    doc.open()
    doc.write(html())
    doc.close()
    window.setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      window.setTimeout(() => frame.remove(), 1000)
    }, 150)
  }

  if (failed) {
    return (
      <section className="card pad">
        <p>The User Guide did not load. Check your connection and open this tab again.</p>
      </section>
    )
  }
  if (text === null) {
    return (
      <section className="card pad" aria-busy="true">
        <p className="muted">Loading the User Guide…</p>
      </section>
    )
  }

  return (
    <div className="guide-layout">
      <aside className="card pad guide-side" aria-label="User Guide">
        <h2 className="card-title">User Guide</h2>
        <p className="muted small">The full guide for people who use the tracker. Keep a copy or print it.</p>
        <div className="guide-actions">
          <button type="button" className="btn btn-primary sm" onClick={() => downloadText(`${USER_GUIDE_FILE_NAME}.html`, html(), 'text/html')}>
            <Icon.Download size={15} /> Download (web page)
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={() => downloadText(`${USER_GUIDE_FILE_NAME}.md`, text, 'text/markdown')}>
            <Icon.Download size={15} /> Download (Markdown)
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={print}>
            Print or save as PDF
          </button>
        </div>
        <nav aria-label="Guide sections" className="guide-toc">
          <h3 className="help-sub">Sections</h3>
          <ol>
            {contents.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#guide-${heading.id}`}
                  onClick={(event) => {
                    event.preventDefault()
                    jump(heading.id)
                  }}
                >
                  {heading.text.replace(/^\d+\.\s*/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <article className="card pad guide-body" ref={body}>
        <Markdown source={text} onAnchor={jump} />
      </article>
    </div>
  )
}

function StepLink({ step }: { step: Step }) {
  const { hrefFor } = usePlatform()
  if (!step.link) return null
  return (
    <a className="help-step-link" href={hrefFor({ module: step.link.module, params: step.link.params })}>
      {step.link.label}
      <Icon.External size={12} />
    </a>
  )
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="help-steps">
      {steps.map((step, index) => (
        <li key={index}>
          <span>{step.text}</span> <StepLink step={step} />
        </li>
      ))}
    </ol>
  )
}

function StartHere({ onPick }: { onPick: (tab: HelpTab) => void }) {
  return (
    <div className="help-grid">
      <section className="card pad">
        <h2 className="card-title">Six things to know</h2>
        <Steps steps={QUICK_START} />
      </section>
      <section className="card pad">
        <h2 className="card-title">The three layers</h2>
        <p className="muted">The tracker groups work in three levels.</p>
        <ul className="help-layers">
          <li>
            <strong>Pillar</strong>
            <span>A strategic theme.</span>
          </li>
          <li>
            <strong>Initiative</strong>
            <span>A program inside a pillar.</span>
          </li>
          <li>
            <strong>Project</strong>
            <span>One delivery effort inside an initiative. This is what gets updated.</span>
          </li>
        </ul>
        <h2 className="card-title">Where next</h2>
        <div className="help-next">
          <button type="button" className="btn btn-ghost" onClick={() => onPick('roles')}>
            What can my role do?
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onPick('faq')}>
            Common questions
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onPick('glossary')}>
            What does this word mean?
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onPick('guide')}>
            Read or download the User Guide
          </button>
        </div>
      </section>
    </div>
  )
}

function RoleGuides({ role, mine, onRole }: { role: Role; mine: Role; onRole: (role: Role) => void }) {
  const guide = GUIDES.find((entry) => entry.role === role) ?? GUIDES[0]
  return (
    <>
      <div className="help-roles" role="tablist" aria-label="Role">
        {ROLE_ORDER.slice()
          .reverse()
          .map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === role}
              className={`help-role${value === role ? ' active' : ''}`}
              onClick={() => onRole(value)}
            >
              {ROLES[value].label}
              {value === mine && <span className="help-you">You</span>}
            </button>
          ))}
      </div>

      <section className="card pad help-role-head">
        <h2 className="card-title">{ROLES[guide.role].label}</h2>
        <p>{guide.who}</p>
        <div className="help-can">
          <div>
            <h3 className="help-sub">You can</h3>
            <ul>
              {guide.can.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="help-sub">You cannot</h3>
            <ul>
              {guide.cannot.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {guide.workflows.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </>
  )
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <section className="card pad help-workflow">
      <h2 className="card-title">{workflow.title}</h2>
      <p className="muted">{workflow.when}</p>
      <Steps steps={workflow.steps} />
    </section>
  )
}

function SearchBox({ query, onQuery, label }: { query: string; onQuery: (value: string) => void; label: string }) {
  return (
    <div className="help-search">
      <Icon.Search size={16} />
      <input type="search" value={query} placeholder={label} aria-label={label} onChange={(event) => onQuery(event.target.value)} />
    </div>
  )
}

function FaqList({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const shown = useMemo(() => FAQ.filter((item) => !query || matches(`${item.q} ${item.a} ${(item.tags ?? []).join(' ')}`, query)), [query])
  return (
    <>
      <SearchBox query={query} onQuery={onQuery} label="Search the questions" />
      <div className="help-faq">
        {shown.map((item) => (
          <details key={item.q} className="card help-q">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
        {shown.length === 0 && <div className="list-empty">No question matches "{query}". Try one word, or look in the Glossary.</div>}
      </div>
    </>
  )
}

function GlossaryList({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const shown = useMemo(
    () => GLOSSARY.filter((item) => !query || matches(`${item.term} ${item.meaning}`, query)).sort((a, b) => a.term.localeCompare(b.term)),
    [query],
  )
  return (
    <>
      <SearchBox query={query} onQuery={onQuery} label="Search the glossary" />
      <dl className="help-glossary card pad">
        {shown.map((item) => (
          <div key={item.term} className="help-term">
            <dt>
              {item.dot && <Dot status={item.dot} size={10} />}
              {item.term}
            </dt>
            <dd>{item.meaning}</dd>
          </div>
        ))}
        {shown.length === 0 && <div className="list-empty">No term matches "{query}".</div>}
      </dl>
    </>
  )
}
