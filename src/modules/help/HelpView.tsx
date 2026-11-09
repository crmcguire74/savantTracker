// ❓ Help: a short start, workflows for each role, FAQ and a glossary. The words
// live in content.ts. This file lays them out and handles search and tabs.

import { useEffect, useMemo, useState } from 'react'
import { Dot, Icon, PageHeader, ROLE_ORDER, ROLES, Segmented, primaryRole, usePlatform, type ModuleProps, type Role } from '@sdk'
import { FAQ, GLOSSARY, GUIDES, QUICK_START, type Step, type Workflow } from './content'

export type HelpTab = 'start' | 'roles' | 'faq' | 'glossary'

const TABS: Array<{ value: HelpTab; label: string }> = [
  { value: 'start', label: 'Start here' },
  { value: 'roles', label: 'Workflows by role' },
  { value: 'faq', label: 'FAQ' },
  { value: 'glossary', label: 'Glossary' },
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
          <button type="button" className="btn" onClick={() => onPick('roles')}>
            What can my role do?
          </button>
          <button type="button" className="btn" onClick={() => onPick('faq')}>
            Common questions
          </button>
          <button type="button" className="btn" onClick={() => onPick('glossary')}>
            What does this word mean?
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
