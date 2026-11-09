// 📚 Everything the Help page says, as plain data. Edit the words here; the
// page in HelpView.tsx only lays them out. Keep sentences short and name
// screens exactly as they appear in the rail and buttons.

import type { Role } from '@sdk'

/** A module id a step may link to. Must exist in the rail or be a link-only page. */
export type HelpModule = 'portfolio' | 'board' | 'timeline' | 'work' | 'workload' | 'admin' | 'access' | 'settings'

export interface Step {
  text: string
  /** Optional link to the screen the step happens on. */
  link?: { module: HelpModule; label: string; params?: Record<string, string> }
}

export interface Workflow {
  id: string
  title: string
  /** One line on when to use it. */
  when: string
  steps: Step[]
}

export interface RoleGuide {
  role: Role
  /** Who holds the role, in one sentence. */
  who: string
  /** What the role can open and do. */
  can: string[]
  /** What it cannot do, and where to go for that. */
  cannot: string[]
  workflows: Workflow[]
}

export interface Faq {
  q: string
  a: string
  /** Words that should find this answer in search. */
  tags?: string[]
}

export interface Term {
  term: string
  meaning: string
  /** Optional status color shown as a dot beside the term. */
  dot?: 'green' | 'amber' | 'red'
}

export const QUICK_START: Step[] = [
  { text: 'Open Portfolio. Each pillar is a strategic theme. Expand a pillar to see its initiatives, and an initiative to see its projects.', link: { module: 'portfolio', label: 'Open Portfolio' } },
  { text: 'Look at the three numbers at the top of every page. Each colored dot is a status: green is On track, amber is At risk, red is Off track. Click one to show only those projects.' },
  { text: 'Click any project to open its page. You see its status, phase, owners, dates, decision, issues and recent changes.' },
  { text: 'Press / anywhere to search for a project, an initiative or a person.' },
  { text: 'Use Board to see projects by phase or status, and Timeline to see them across twelve months.', link: { module: 'board', label: 'Open Board' } },
  { text: 'Not sure what a word means? The Glossary tab explains every term the tracker uses.' },
]

export const GUIDES: RoleGuide[] = [
  {
    role: 'viewer',
    who: 'You read the portfolio to stay informed.',
    can: [
      'Open Portfolio (ledger and initiative heat map), Board and Timeline.',
      'Open any project to read its status, owners, dates, decision and issues.',
      'Search, filter and export the reports your role is allowed to use.',
    ],
    cannot: [
      'Change any project, initiative or pillar. Ask an Editor.',
      'See views your administrator has not opened to your role.',
    ],
    workflows: [
      {
        id: 'viewer-risk',
        title: 'See what needs attention',
        when: 'You want to know which projects are in trouble.',
        steps: [
          { text: 'In the top bar, click the red number (Off track) or the amber number (At risk).' },
          { text: 'The ledger now shows only those projects. Click one to read why: key risk, decision needed, open issues.', link: { module: 'portfolio', label: 'Open Portfolio' } },
          { text: 'Click the same number again, or Clear in the filter row, to see everything.' },
        ],
      },
      {
        id: 'viewer-project',
        title: 'Read one project',
        when: 'You need the full story on a single project.',
        steps: [
          { text: 'Press / and type part of the project name, or expand its initiative in Portfolio.' },
          { text: 'Open the project. Read the status tags, phase stepper, scope, next milestone and key risk.' },
          { text: 'Scroll to Decision, Issues and recent changes for the latest movement.' },
        ],
      },
      {
        id: 'viewer-dates',
        title: 'Check dates across the year',
        when: 'You want to know what lands when.',
        steps: [
          { text: 'Open Timeline. Each bar runs from start date to forecast end. A diamond marks the next milestone.', link: { module: 'timeline', label: 'Open Timeline' } },
          { text: 'Use the arrows to move by a quarter. Today returns you to the current date.' },
        ],
      },
    ],
  },
  {
    role: 'executive',
    who: 'You lead the work and review it with the PMO.',
    can: [
      'Everything a Viewer does.',
      'Open the Leadership brief and Pillar pace in Portfolio, and Workload.',
      'Use executive reports and export them.',
    ],
    cannot: [
      'Edit projects, initiatives or pillars. Ask an Editor or the PMO.',
      'Open Admin or My work unless your administrator has granted them.',
    ],
    workflows: [
      {
        id: 'exec-review',
        title: 'Run the weekly leadership review',
        when: 'You prepare for or run the portfolio review.',
        steps: [
          { text: 'Open Portfolio and choose the Leadership brief layout.', link: { module: 'portfolio', label: 'Open Portfolio', params: { layout: 'brief' } } },
          { text: 'Read the pillar summaries, then the projects that are Off track or At risk.' },
          { text: 'Switch to Pillar pace to see whether each pillar is moving as fast as its dates need.' },
          { text: 'Click Decisions in the filter row to list every decision waiting on leadership, longest wait first.' },
        ],
      },
      {
        id: 'exec-onepager',
        title: 'Share a pillar on one page',
        when: 'You need a printable summary for a meeting.',
        steps: [
          { text: 'In Portfolio, choose a pillar with the pillar filter.' },
          { text: 'In the Leadership brief, click Open one-pager.' },
          { text: 'Print it or save it as a PDF. The link back to WiseTrack still works in the PDF.' },
        ],
      },
      {
        id: 'exec-workload',
        title: 'See who carries what',
        when: 'You are checking whether a person or PM is stretched.',
        steps: [
          { text: 'Open Workload. Sort by size, off-track count or open issues.', link: { module: 'workload', label: 'Open Workload' } },
          { text: 'Click a person to see their projects. Use the PM heat map for the portfolio-wide view.' },
        ],
      },
    ],
  },
  {
    role: 'editor',
    who: 'You are a project manager or in the PMO. You keep project information current.',
    can: [
      'Everything an Executive sees, plus My work and Admin.',
      'Update project status, trend, phase, progress, dates, risk, decisions and issues.',
      'Add, edit and delete projects, initiatives and pillars that live in the tracker.',
      'Restore an earlier value from the change log, and import or export data.',
    ],
    cannot: [
      'Change fields that come from monday.com while the sync is live. Change them in monday.com.',
      'Change who can see which views. Only an Admin can.',
    ],
    workflows: [
      {
        id: 'editor-update',
        title: 'Update my projects',
        when: 'It is time for your regular status update.',
        steps: [
          { text: 'Open My work. It lists the projects you own as business owner, delivery owner or project manager.', link: { module: 'work', label: 'Open My work' } },
          { text: 'If the page asks who you are, pick your name once. Use Not you? if it chose wrong.' },
          { text: 'Open a project and click Update status. Set the status, trend, phase, progress and next milestone.' },
          { text: 'Changes save as you leave each field. Check the recent changes list to confirm.' },
        ],
      },
      {
        id: 'editor-decision',
        title: 'Request and record a decision',
        when: 'A project needs leadership to decide something.',
        steps: [
          { text: 'On the project page, click Request a decision and write the question.' },
          { text: 'It now appears in Decisions needed on Admin and under the Decisions filter.', link: { module: 'admin', label: 'Open Admin' } },
          { text: 'When leadership decides, open the project and click Record the decision. The question moves to Decision made.' },
        ],
      },
      {
        id: 'editor-issues',
        title: 'Log and close an issue',
        when: 'Something is blocking or threatening a project.',
        steps: [
          { text: 'On the project page, add an issue and set its severity: Low, Medium or High.' },
          { text: 'Change the severity as things develop. Click Resolve when it is fixed.' },
        ],
      },
      {
        id: 'editor-stale',
        title: 'Find and fix stale work',
        when: 'You are chasing projects nobody has updated.',
        steps: [
          { text: 'Open Admin. Stale projects lists the longest quiet ones first.', link: { module: 'admin', label: 'Open Admin' } },
          { text: 'Use Stale for to focus on 30, 60 or 90 days. Use the PM picker to see one person\'s projects.' },
          { text: 'Open a project and update it. It leaves the list once it has a fresh update.' },
        ],
      },
      {
        id: 'editor-undo',
        title: 'Undo a mistake',
        when: 'You changed the wrong thing.',
        steps: [
          { text: 'Open the project and open its change log. The latest edits are first.' },
          { text: 'Find the entry. Click Restore previous to put the old value back.' },
          { text: 'If two people edited the same field, you are asked to keep mine or theirs. The other value stays in the change log.' },
        ],
      },
    ],
  },
  {
    role: 'admin',
    who: 'You run the tracker for the firm.',
    can: [
      'Everything an Editor does.',
      'Open Access to choose which roles see which views and reports.',
      'Run the monday.com sync, set automatic pulls and take backups.',
      'Reorder pillars, and restore or import a backup file.',
    ],
    cannot: [
      'Add people to roles. That is done in Microsoft Entra, by adding people to the SG-Tracker groups.',
      'Change monday.com data. The sync only reads from monday.com.',
    ],
    workflows: [
      {
        id: 'admin-sync',
        title: 'Pull the latest from monday.com',
        when: 'Someone changed monday.com and you want the tracker to show it now.',
        steps: [
          { text: 'Open Admin and click Open sync.', link: { module: 'admin', label: 'Open Admin' } },
          { text: 'Choose Source: monday.com (live). Click Preview. Read the counts and any warnings. Nothing is saved yet.' },
          { text: 'If it looks right, click Apply.' },
        ],
      },
      {
        id: 'admin-auto',
        title: 'Set how often the tracker checks monday.com',
        when: 'You want everyone to stay current without pulling by hand.',
        steps: [
          { text: 'Open Admin, click Open sync, then find Automatic pulls.' },
          { text: 'Choose Off, or an interval from 5 minutes to once a day. Click Save.' },
          { text: 'The server checks on that schedule. If monday.com has not changed, nothing is written. Automatic pulls never remove records.' },
          { text: 'Everyone sees "monday data as of" in the top bar, so they know how fresh the data is.' },
        ],
      },
      {
        id: 'admin-remove',
        title: 'Remove records monday.com no longer has',
        when: 'A project was deleted or moved in monday.com.',
        steps: [
          { text: 'In Open sync, tick Also remove records monday.com does not have, then Preview.' },
          { text: 'Read the list of records that would be removed. Tick the box under the list to confirm it.' },
          { text: 'Click Apply. A backup file downloads first. To undo, use Import data in Settings with that file.' },
        ],
      },
      {
        id: 'admin-access',
        title: 'Choose who sees what',
        when: 'A role needs a view it does not have, or should lose one.',
        steps: [
          { text: 'Open Access. Each row is a view or report. Each column is a role.', link: { module: 'access', label: 'Open Access' } },
          { text: 'Tick or untick a cell, then click Save access. Admin always keeps everything.' },
          { text: 'To put a person in a role, ask the person who manages the SG-Tracker groups in Microsoft Entra. Access only decides what each role may open.' },
        ],
      },
      {
        id: 'admin-backup',
        title: 'Take a backup and restore it',
        when: 'Before a big change, or to recover from a bad one.',
        steps: [
          { text: 'Open Settings, then Data. Click Export file. Keep the JSON file somewhere safe.', link: { module: 'settings', label: 'Open Settings' } },
          { text: 'To restore, click Import file and choose that backup. Read the summary before you confirm. Import replaces current data.' },
        ],
      },
    ],
  },
]

export const FAQ: Faq[] = [
  {
    q: 'What do the three colored numbers at the top mean?',
    a: 'Each is a count of projects by status. Green is On track, amber is At risk and red is Off track. Click one to filter every view to those projects. When the window is narrow, the label hides and only the colored dot and number show.',
    tags: ['counts', 'dots', 'header', 'rag', 'status'],
  },
  {
    q: 'Why can I not edit anything?',
    a: 'Editing needs the Editor or Admin role. Viewers and Executives read only. If you should be able to edit, ask your administrator to add you to the Editors group in Microsoft Entra. The top bar shows "View only" when your role cannot edit.',
    tags: ['edit', 'read only', 'permission', 'role', 'view only'],
  },
  {
    q: 'Why does a field say it comes from monday.com?',
    a: 'While the monday.com sync is live, monday.com owns most project fields, and the names of pillars and initiatives. Change them in monday.com and the next pull brings them here. The tracker keeps issues, decision outcomes and plan links. It also keeps projects created inside the tracker.',
    tags: ['monday', 'locked', 'read only', 'managed'],
  },
  {
    q: 'I changed something in monday.com. When does it show here?',
    a: 'At the next pull. Your administrator sets how often the tracker checks monday.com, and an Admin can pull right away from Admin, Open sync. The top bar shows "monday data as of" with the time of the last good pull.',
    tags: ['monday', 'sync', 'delay', 'refresh', 'fresh'],
  },
  {
    q: 'Does the tracker change anything in monday.com?',
    a: 'No. The sync only reads. monday.com is the source of truth for the fields it supplies.',
    tags: ['monday', 'write', 'one way'],
  },
  {
    q: 'Why is a project marked Stale?',
    a: 'Nobody has updated it for longer than the stale threshold. The threshold is a setting (weekly, biweekly, monthly, quarterly or your own number of days). Update the project and the tag clears.',
    tags: ['stale', 'threshold', 'update'],
  },
  {
    q: 'My work is empty or shows the wrong projects. Why?',
    a: 'My work matches your sign-in name to the owner fields on projects (business owner, delivery owner, project manager). If it cannot match, it asks you to pick your name once. Click Not you? to pick again. If your name is spelled differently in the owner fields, ask the PMO to align it.',
    tags: ['my work', 'owner', 'name'],
  },
  {
    q: 'I cannot see Workload, Admin or Access in the left menu.',
    a: 'Each view is open to certain roles. By default Workload is open to Admin, Editor and Executive, Admin and My work to Admin and Editor, and Access to Admin only. An Admin can change this on the Access page.',
    tags: ['menu', 'access', 'missing', 'rail'],
  },
  {
    q: 'How do I search?',
    a: 'Press / on any page, or click the search box. Type part of a project, initiative or person. Choose a result to jump to it, or choose Filter all views by "…" to apply the text as a filter everywhere.',
    tags: ['search', 'find', 'filter'],
  },
  {
    q: 'I made a mistake. Can I undo it?',
    a: 'Yes. Open the change log from the project page, your account menu, Admin or Settings. Find the edit and click Restore previous. Only Editors and Admins can restore.',
    tags: ['undo', 'restore', 'change log', 'mistake'],
  },
  {
    q: 'What does the "keep mine or theirs" message mean?',
    a: 'Someone else changed the same field while you were editing it. Choose which value to keep. The other value stays in the change log, so nothing is lost.',
    tags: ['conflict', 'overwrite', 'mine', 'theirs'],
  },
  {
    q: 'How do I get my role changed?',
    a: 'Roles come from Microsoft Entra security groups, not from the tracker. Ask the person who owns the SG-Tracker groups to move you, then sign out and back in. Admins cannot change group membership in the app. They can change what each role may open on the Access page.',
    tags: ['role', 'group', 'entra', 'permission'],
  },
  {
    q: 'How do I export data or a report?',
    a: 'Open your account menu (top right) and choose Export. You can download any report your role can use, or a full backup. Settings, Data also has Export file.',
    tags: ['export', 'download', 'backup', 'report'],
  },
  {
    q: 'A message says a new version is available.',
    a: 'Click Reload when it suits you. Anything you already saved is kept. Opening the tracker always loads the latest version.',
    tags: ['update', 'reload', 'version'],
  },
  {
    q: 'Can I install the tracker as an app?',
    a: 'Yes. In Edge or Chrome, click the install icon at the right end of the address bar, or open Settings, App. On iPhone or iPad, use Share, then Add to Home Screen. It is the same tracker with the same sign-in.',
    tags: ['install', 'pwa', 'app', 'phone'],
  },
  {
    q: 'Where is my data stored?',
    a: 'In the firm\'s Azure database, behind Microsoft sign-in. In local development it is stored in your browser or a local file instead. A LOCAL badge in the top bar means the app is not behind sign-in.',
    tags: ['storage', 'azure', 'database', 'local'],
  },
]

export const GLOSSARY: Term[] = [
  { term: 'Pillar', meaning: 'A major strategic theme. Pillars are the top level of the tracker. Each holds initiatives.' },
  { term: 'Initiative', meaning: 'A program or workstream inside a pillar. It groups related projects and shows their combined health.' },
  { term: 'Project', meaning: 'A single delivery effort inside an initiative. Projects carry status, owners, dates, decisions and issues. They are what you update.' },
  { term: 'Ledger', meaning: 'The Portfolio list view: pillars, then initiatives, then projects, with health at each level.' },
  { term: 'Heat map', meaning: 'A Portfolio layout with one tile per initiative, colored by its worst project, so problem areas stand out. Click a tile to open that initiative.' },
  { term: 'Leadership brief', meaning: 'A Portfolio layout for executives: headline numbers, one card per pillar, and a Needs leadership attention list of off-track projects and projects waiting on a decision. It has an Open one-pager button.' },
  { term: 'Pillar pace', meaning: 'A Portfolio layout that compares how far along each pillar is with how much of its planned time has passed.' },
  { term: 'One-pager', meaning: 'A printable single-page summary of a pillar, made from the Leadership brief.' },
  { term: 'RAG status', meaning: 'Red, Amber, Green health. Green is On track, amber is At risk and red is Off track. It is the main health signal on every project.' },
  { term: 'On track', meaning: 'The project is expected to meet its dates and scope.', dot: 'green' },
  { term: 'At risk', meaning: 'The project may miss its dates or scope without action.', dot: 'amber' },
  { term: 'Off track', meaning: 'The project is not meeting its dates or scope and needs intervention.', dot: 'red' },
  { term: 'Trend', meaning: 'Which way the project is heading: Improving, Flat or Declining. It adds direction to the status.' },
  { term: 'Phase', meaning: 'Where the project is in its life: Discovery, Planning, Execution, Review, Launch, Stabilize or Closed. Multi-Phase (Release Based) is for projects delivered in repeating releases.' },
  { term: 'Progress', meaning: 'How complete the project is, as a percentage.' },
  { term: 'Validation', meaning: 'The project\'s validation step: Not Started, Pending, In Progress, Completed or N/A.' },
  { term: 'Business owner', meaning: 'The person accountable for the outcome from the business side.' },
  { term: 'Delivery owner', meaning: 'The person accountable for delivering the work.' },
  { term: 'Project manager', meaning: 'The person who runs the project day to day. Also called PM.' },
  { term: 'Original end date', meaning: 'The end date first planned for the project.' },
  { term: 'Forecast end date', meaning: 'The end date the team now expects. The gap between forecast and original shows how far the project has slipped.' },
  { term: 'Slip', meaning: 'How many days the forecast end date is later than the original end date.' },
  { term: 'Milestone', meaning: 'A dated checkpoint in a project. The next milestone shows on the project page and as a diamond on Timeline.' },
  { term: 'Key risk', meaning: 'The main threat or blocker to the project right now.' },
  { term: 'Dependencies', meaning: 'Other work or teams the project relies on.' },
  { term: 'Decision needed', meaning: 'A question a project has asked leadership to answer. It stays on the list until an outcome is recorded.' },
  { term: 'Decision made', meaning: 'The recorded answer to a decision request.' },
  { term: 'Issue', meaning: 'A problem affecting a project today. Each has a severity of Low, Medium or High and stays open until resolved.' },
  { term: 'Plan link', meaning: 'A link from a project to its detailed plan.' },
  { term: 'Stale', meaning: 'Not updated for longer than the stale threshold.' },
  { term: 'Stale threshold', meaning: 'The number of quiet days after which a project counts as stale. It is set in Settings.' },
  { term: 'Workload', meaning: 'A view of everyone named on projects: their projects by status, their role on each, and their open issues.' },
  { term: 'PM heat map', meaning: 'A Workload layout that colors each project manager\'s portfolio by status.' },
  { term: 'My work', meaning: 'The decisions, issues and milestones on projects you own.' },
  { term: 'Change log', meaning: 'A record of every edit: what changed, who changed it, when, and the old and new values. Editors can restore an earlier value.' },
  { term: 'Role', meaning: 'What you may do and see: Admin, Editor, Executive or Viewer. Roles come from Microsoft Entra groups.' },
  { term: 'Admin', meaning: 'Can do everything, and decides which roles see which views on the Access page.' },
  { term: 'Editor', meaning: 'Project managers and the PMO. Can update projects, initiatives and pillars.' },
  { term: 'Executive', meaning: 'Leadership. Reads everything, including executive reports. Cannot edit.' },
  { term: 'Viewer', meaning: 'Reads the portfolio. Cannot edit.' },
  { term: 'Access', meaning: 'The admin page where each role is granted or denied each view and report.' },
  { term: 'monday.com sync', meaning: 'A one-way pull from monday.com into the tracker. monday.com is the source of truth for the fields it supplies.' },
  { term: 'Managed in monday.com', meaning: 'A record or field that comes from monday.com. Change it there. The next pull brings the change here.' },
  { term: 'Preview', meaning: 'A sync step that reads monday.com and shows what would change. It saves nothing.' },
  { term: 'Apply', meaning: 'The sync step that saves what Preview showed.' },
  { term: 'Automatic pulls', meaning: 'A schedule that checks monday.com for changes. If nothing changed, nothing is written. It never removes records.' },
  { term: 'Capture file', meaning: 'A saved copy of monday.com data. Admins can load one to refresh the tracker by hand, and it is used for testing.' },
  { term: 'monday data as of', meaning: 'The time shown in the top bar of the last successful pull from monday.com. It turns amber when the data is old or the last pull failed.' },
  { term: 'Backup', meaning: 'A JSON file with the whole tracker. Export one before big changes. Import restores it.' },
]
