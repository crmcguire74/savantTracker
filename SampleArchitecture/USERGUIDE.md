# Thrive Financial User Guide

> Current navigation and review periods: [Current views and workflows](CURRENT_WORKFLOWS.md) (reviewed October 27, 2026).


This guide reflects the current application UI and workflow in the codebase.

## Current dashboard: Summary, Detailed and downloads

In Novice Dashboards choose **Summary** or **Detailed** without changing modes. Summary shows the selected role’s priorities and one next step. Set **Whose records?**, role, **From** and **Through**, then leave both date fields to apply the range. **Open income review** and **Open spending review** open the source detail below the summary. **Income PDF** and **Spending PDF** beside the controls use the dashboard scope/dates. Monthly cash flow uses active months, with no automatic decree cutoff, and is not a future budget. For exact export populations, payroll routes and role differences, use [Current views and workflows](CURRENT_WORKFLOWS.md).

## 1. Before You Start

Thrive Financial has two separate surfaces:

- the public website at `/`
- the private workspace at `/app.html`

Inside the workspace, your case data is stored locally in your browser’s IndexedDB. Case files do not sync to a hosted Thrive case database. You should export a `.thrive` backup regularly with **Save Case** in the header.

AI features may transmit selected document text or case context to Google Gemini for parsing or analysis. Firebase manages authentication, access roles, usage counters, and billing metadata; Stripe handles payment flows. Do not treat the app as offline-only.

## 2. Getting Into The App

### New users

After sign-in, the onboarding flow lets you:

1. start a guided setup
2. identify who you are in the case
3. choose Novice or Advanced mode

The onboarding wizard supports these “who are you” choices:

- spouse 1
- spouse 2
- attorney for spouse 1
- attorney for spouse 2
- Guardian ad Litem
- forensic accountant
- divorce coach

The ongoing interface role saved in the case profile is one of:

- Spouse
- Attorney
- Forensic Accountant
- Divorce Coach
- Other / Pro Se

The Dashboard also has a **View as Role** selector. This does not change the evidence in the case file. It changes how the Dashboard organizes the same case data for an attorney, forensic accountant, divorce coach, spouse, or pro se user.

### Returning users

Returning users can restore a case file from:

- onboarding
- the header’s **Open Case** button
- **Clients & Cases → Register** for one case
- **Clients & Cases → Relink Folder** for multiple organization cases stored in one network-drive folder

Accepted import types are `.thrive` and compatible `.json` backups, including combined case-plus-documents `.thrive` files from Save Case or Automatic Local Backup, which reattach the original documents automatically as part of opening the case. The app verifies the case-file integrity hash before loading it. If a `.thrive` file was password protected during export, Thrive asks for the password before importing; the password is not stored by Thrive and cannot be recovered if lost.

For organization workspaces, the case roster is shared in Firebase, but the `.thrive` file itself stays on your device or network drive. If another team member has already added a case, you should see it in **Clients & Cases**. To open it on your computer, grant browser access to the shared `.thrive` file once. Use **Register** for a single case, or **Relink Folder** to select the shared drive folder and let Thrive match all visible cases by file name, shared path, or fingerprint.

Case data on a shared computer is kept separate per sign-in — signing in with a different email never mixes into another account's case data on the same device. If you sign in with an email Thrive hasn't seen before on this device but it finds an existing, unclaimed case, it asks whether that case is yours before doing anything else, so you can restore it instead of accidentally starting blank. If you open the same case in a second browser tab, Thrive shows a warning so you don't make conflicting edits in both at once.

## 3. Understanding The Two Navigation Modes

### Novice mode

Novice mode turns the sidebar into a guided workflow:

1. **Dashboards**
2. **Evidence Requests**
3. **Get Records**
4. **Verify Records**
5. **Investigations**
6. **Properties and Debts**
7. **Reports** *(Personal Plus and higher; shows a lock icon for lower tiers)*
8. **Court Prep**
9. **Settlement**

Novice mode also adds a horizontal journey bar, role-aware next-best-step guidance, novice-specific layouts, and plain-language review workflows. A floating **?** button opens help for the novice view currently on screen. **Help & Support** opens the full Novice Mode field guide.

### What each novice step means

| Step | Goal | Quick help available |
| --- | --- | --- |
| Dashboards | See the case picture, choose a role/scope/date range, and follow the best next step | Role guidance, journey status, case metrics, floating help |
| Evidence Requests | Decide what records are needed and track requests or productions | Guided request tasks, deficiency follow-up, production handoff |
| Get Records | Upload documents, open the library, and view transactions or extracted data | Intake guidance, browse-by-type, document and account directories |
| Verify Records | Resolve warnings, confirm metadata/subtypes, duplicates, and missing periods | Review queue, evidence display, notes, verification success feedback |
| Investigations | Start an analysis, then work the findings it produces | Two sections (Start & reports, Findings), source-linked findings, review notes, discovery follow-up, and contained exhibit creation |
| Properties and Debts | Build the shared inventory for case and settlement calculations | Ownership help, values, crypto holdings, income, children, businesses |
| Reports | Review saved investigations, scoped visuals, and live case views | Spouse/business/joint filters, case-duration heat map, exports |
| Court Prep | Build proceeding-specific exhibits and permanently number their selected PDF sources | Five tailored exhibit builders, auto-selected sources, inline Bates production, packet status and downloads |
| Settlement | Assign assets/debts and understand possible outcomes | Plain-language worksheet, allocation shortcuts, assumptions and cautions |

### Advanced mode

Advanced mode shows the full navigation directly:

- Dashboard
- Data Analysis *(personal_plus and higher; lock icon shown for lower tiers)*
- Discovery Manager
- Document Parser
- Asset Manager
- Investigations
- Court Prep
- Settlement Agreement
- Help & Support
- Settings

Switch modes any time in **Settings → Configuration & Tools** or with the sidebar mode toggle.

## 4. Core Workflow

The strongest current workflow is:

1. build or import the case
2. use **Get Records** to load evidence and **Verify Records** to check it
3. use **Properties and Debts** to build the financial inventory
4. use **Evidence Requests** to formalize requests and track missing items
5. use **Investigations** to analyze the case, review findings, and collect or challenge evidence
6. use **Court Prep** from Investigations or the sidebar to label material for a proceeding, number every selected PDF source, and
   preserve the production and exhibit packages
7. use **Settlement** to model or assess proposals
8. export backups, audit logs, and PDFs

### Review checkpoints

Before relying on a dashboard number, finding, or PDF packet, confirm:

- source documents are preserved and match the Document Manager certificate / SHA-256 hash; for large PDFs parsed in safety mode, the original PDF is not embedded in the case file, so keep the source PDF outside Thrive
- owner, business, document type, account, and legal subtype labels are correct
- Coverage Analysis does not show unexplained gaps for the period you are presenting
- duplicate banks, accounts, and cash platforms have been merged in **Settings → Account Configuration**
- findings and AI-written text have been checked against the original records
- missing records and incomplete parse warnings are disclosed instead of hidden

For legal use, preserve the original source file, certificate of authenticity, `.thrive` backup, audit-log PDF, and the relevant module export together.

## 5. Novice Mode Journey

The journey bar groups the novice workspaces into six broader stages:

| Stage | Related workspace | What the status means |
| --- | --- | --- |
| Gather | Get Records and Evidence Requests | Records collected and known requests/gaps |
| Verify | Verify Records | Records still requiring review, or complete when no review items remain |
| Investigate | Investigations | Records, analysis, findings, evidence, and finding-to-packet creation |
| Organize | Properties and Debts | Inventory readiness |
| Negotiate | Settlement | Settlement worksheet progress |
| Present | Reports | Saved reports and case visuals |

The Dashboard does not highlight a stage because it summarizes the entire journey. If new records are added, an earlier stage may become active again.

### Get Records versus Verify Records

- Use **Get Records** when you are adding, finding, or opening records.
- Use **Document Library** to review source files, details, parsed data, notes, originals, and integrity certificates.
- Use **Extracted Data** to see all transactions or document-specific structured information by type.
- Use **Verify Records** when a record has a parsing warning, owner/date/type question, subtype question, possible duplicate, or coverage gap.
- For **Filings and Emails**, verify the subtype such as motion, petition, order, affidavit, or email exchange.

**Save & mark verified** saves the displayed metadata, assignments, corrections, and review note and
records who reviewed them and when. This is a human-review status, not a certification: Thrive does
not re-read the file, authenticate it, certify every extracted figure, alter the preserved source,
or decide admissibility.

It either clears the record out of the queue or names what is still holding it there, rather than
reporting the record verified and closing on a row that still reads "Needs review". Two conditions
keep a record in the queue:

- **An unresolved page check.** Those pages have to be recovered or explicitly confirmed blank.
- **A record with no page report at all,** which is the shape left by a parse that predates page
  tracking. There are no pages to recover or confirm, so dismissing the coverage warning is the
  only thing that resolves it, and the panel offers that.

### Large PDFs and combined-account files

- If a bank or P2P PDF bundles a linked sub-account together with the primary one — for example a savings account attached to checking, sharing every page — Thrive detects and links each account separately, automatically. You only need to split a PDF yourself when it combines statements for genuinely unrelated accounts or customers. Large statements parse in page-range chunks; Thrive only flags a file for manual splitting when multiple account numbers are observed with no structured per-account split to act on, not by comparing separate chunks' independent guesses, so a stray misread on one page (or a document, like some credit card statements, that never prints its own account number) no longer produces a false split-PDF prompt.
- Large PDFs parse in chunks. When a file is large enough to risk browser storage or memory limits, Thrive uses **Large PDF safety mode**: extracted data, filename, page count, and source hash are saved, but the original PDF bytes are not embedded in the case file.
- Keep the original PDF in your source-record folder. The certificate still records the SHA-256 hash so the external source file can be verified later.
- Parse credits are deducted only after the parsed record has been saved. If the browser cannot save the result, or if you confirm **Cancel parse** before a file is saved, the queue shows an error and the unsaved file is not charged. Documents already saved before cancellation remain in the case and keep their normal credit charge.

### Reviewing investigation findings

Use **Investigate → Findings → Review finding**. Filter Needs review / Reviewed, origin (AI Red Flag
findings or Structured findings), and the relevant spouse/business. Original records open inside
the review; report links expand under Appears in N reports. AI findings offer Prepare for exhibit
when exact cited rows can support a factual observation. See [the complete workflow](INVESTIGATE_GUIDE.md).

### Guided analysis and card status

Novice Mode adds two review aids that Advanced mode does not show. Both appear on the
**Dashboard** and in **Reports**.

**Guided analysis** works through six passes, each asking one question of the same records, in
the order a reviewer would ask them:

| # | Pass | The question it asks |
| --- | --- | --- |
| 1 | The record | Can you trust the record you are reading? |
| 2 | Money in | Does the money arriving match what was declared? |
| 3 | Money out | Where does the money go, and has that changed? |
| 4 | After the line | What changed once the marriage ended? |
| 5 | Between pockets | Where does money move rather than get spent? |
| 6 | Saying it out loud | Which of this can you actually stand behind? |

The order matters: a spending pattern read off an incomplete ledger is a guess, and pass four
has no meaning until the case has a separation date to measure from. Each pass states what it
is looking at, the figures behind it, what would be ordinary, what would be worth a second
look, and a one-sentence read of your case right now.

A pass reports **needs attention**, **worth a look**, **settled**, or **waiting on records** —
carried by marker shape as well as colour. Waiting is deliberately different from settled: a
pass whose inputs are missing says so rather than reporting all-clear on nothing. In Reports,
the six passes run against the scope selected there.

**Card status badges** sit in the top-right corner of every data card. The badge states what the
card can support about itself, and opening it slides out that card's findings: what stands out,
what it means in plain language, and the single next step, usually with a button that opens the
records or findings behind it.

There are three verdicts, and each is carried by shape as well as colour so the state survives a
reader with no colour vision:

| Shape | Verdict | What it asserts |
| --- | --- | --- |
| Dashed ring | **Not checked** | The inputs this card needs are absent. No builder ran, so no conclusion is available. |
| Flag with a count | **Checked (review)** | The card was evaluated and the count is how many items warrant a second look. |
| Tick | **Checked and clear within loaded records** | The card was evaluated against the records currently loaded and nothing on it requires attention. |

The third label is scoped deliberately. A builder that finds nothing to read returns **Not
checked** rather than clear, so a card whose inputs are missing can never present a tick, and
clear never means more than clear against what is loaded.

- Findings are graded **Needs attention**, **Worth a look**, or **Good to know**. Only the
  first two raise the flag count; context notes never make a clean card look alarming.
- A card shows at most four findings, most severe first.
- An empty card names which of three conditions applies rather than going blank: the records it
  needs are not in the case, records exist but none fall inside the selected party, business or
  date range, or the card does not apply to this case at all.
- Findings are leads, not conclusions. They report what the records show and what would
  explain it innocently, never intent. Open the source document before relying on one.

### Using novice Reports

Case visuals can be filtered to all activity, one spouse, joint activity, or one business. The selected scope applies to income, spending, cash movement, source coverage, and finding priority. Spouse views do not include business-owned account activity merely because that spouse owns the business. The spending heat map covers the available case period.

When a Reports link opens another workspace, use **Back to Reports** at the top to return.

### Novice help

**Video Tutorials** and **Release Notes** are available below the novice field guide, using the same video library and published release archive as Advanced mode.

- Click the floating help button in the lower-right for instructions about the current view.
- Open **Help & Support** for the complete Novice Mode navigation and workflow guide.
- Use **Ask Thrive support** to send an in-app message with the signed-in user's name, email address, case, and source view.

## 6. Dashboard Command Center

The Dashboard is the case home screen and role-based command center. It is a synthesis layer: it reads the case record that already exists in the app and organizes it into cards, charts, priorities, deadlines, and reports. It does not replace the source documents.

For a plain-English, card-by-card breakdown of what every dashboard sub-part means and where its numbers come from, see [non-technical-module-guide.md](non-technical-module-guide.md).

### Access by tier

| Tier | What you see |
| --- | --- |
| Starter | Spouse / Pro Se view only. Action Center and Education Progress are not shown. |
| Personal Case | All role views: spouse, attorney, paralegal, forensic accountant, and coach. |
| Personal Plus | All role views. Also has access to Data Analysis. |
| Professional, Firm | All role views. |

### Main controls

- **Scope**: full case, one spouse, or a business. This changes which documents, assets, debts, reports, transfers, and charts are included.
- **View as Role**: Attorney, Divorce Coach, Forensic Accountant, Paralegal, or Spouse / Pro Se, the order depends on the Summary or Detailed control. *(Not shown for Starter tier.)*
- **Date Range**: limits cash-flow, variance, timeline, coverage, and activity cards to a selected period.
- **Open Case**: imports a `.thrive` or compatible `.json` case file.
- **Save Case**: exports a standard hashed `.thrive` backup, with an optional password-protected encrypted backup for sharing or transport.
- **Export PDF**: creates a role-specific dashboard case report.

### Where dashboard data comes from

The **Income & other resources** card separates earnings, distributions, support, asset proceeds,
loans and unclassified receipts. Choose a year, then **Open full review** to inspect declarations,
tax bases, methods and source records. If no affidavit was filed that year, Thrive uses the latest
earlier individual affidavit and labels it **Carried forward**. Confirm any income changes since
its original filing; a later affidavit is never applied to earlier years.

Large differences appear as review leads. Payroll deposits are usually net of withholding;
affidavits declare gross monthly rates, and tax returns report an annual tax measure. The net/gross
panel replaces payroll once with same-year W-2 wages or a clearly labeled estimate from case
records. It shows the rate and calibration years, and applies no default tax rate. Company-paid
personal expenses stay separate: they are not automatically tax-free and may already be reported
as compensation or distributions. A difference alone does not prove undisclosed income.

Use **Export income PDF** for all years of the selected person, or **Export this year** inside the
full review. The dashboard's main **Export PDF** also includes this analysis, review leads,
declaration dates, methods and source-document references.

- **Assets, debts, income, children, and businesses** come from Asset Manager and Settings → Profile & Case.
- **Cash flow and spending** come from parsed bank transactions and Cash App/P2P records. Owned-account transfers are excluded symmetrically where the app can identify them. A transfer, wire, or P2P deposit is only treated as an internal move when the app can corroborate it; otherwise it is shown as an **unverified deposit (source unknown)** rather than assumed income or a plain non-income receipt. Money arriving from a business account the case owns is shown as a **business-to-personal inflow** and kept out of income to avoid double-counting.
- **Declared income and variance** come from tax returns, financial affidavits, and manual historical income entries compared against observed deposits and qualifying P2P inflows.
- **Evidence coverage** comes from parsed statement ranges, transaction dates, business document ranges, and direct counts of parsed documents.
- **Findings and risk cards** come from the unified Investigations projection of standing rules,
  focused AI reports, and rules-first Comprehensive Analysis.
- **Standing Findings Program** results are recalculated from the current case records without AI.
  A test is shown as clear only when its detector records the comparison scope it examined. Missing
  records produce targeted discovery wording; planned, partial, failed, or unusable comparisons are
  shown as not run and never included in clean counts.
- **Discovery deadlines and missing-item status** come from Discovery Manager.
- **Case timeline rows** come from parsed legal filings, case dates, affidavit dates, report timeline entries, large deposits/withdrawals, and user-marked key transactions. No date on the timeline is authored by a model. Every row states how its date was established and links to the record behind it.
- **Card source records** are declared per card rather than inferred from the current scope. Each card lists the exact documents its figure was computed from, and an exhibit built from a card attaches only those. A card that cannot name its sources names none instead of falling back to everything in scope.
- **Case Document Intelligence** comes from parsed legal documents and reconciles extracted assertions, obligations, key dates, loan commitments, and admissions against available transactions and tax records.
- **Coach records** come from the Divorce Coach dashboard workspace and are saved with the case.

If a card is empty or dashed, the app does not yet have the source data needed for that card. Add or correct the source data in the owning module rather than editing dashboard numbers directly.

### Shared calculations

- **Monthly external inflow** is total non-internal external inflow divided by active external-transaction months in the selected scope/date range.
- **Monthly external outflow** is total non-internal external outflow divided by the same active external-transaction month count.
- **Monthly cash flow** is average external inflow minus average external outflow on that same owner/account/business/date basis. Internal owned-account transfers are excluded from both sides.
- **Net estate** is scoped asset value minus scoped debt value.
- **Liquidity** is estimated from scoped cash, bank, checking, savings, and investment-type assets.
- **Debt-to-income ratio** is total debts divided by annualized observed monthly income.
- **Disclosure variance** is observed annual bank deposits plus qualifying P2P income minus declared income from tax returns, financial affidavits, or manual historical income entries. It is reported with the tax basis of both sides, and it is not computed at all when either side resolves to a mixed basis. See [Income definitions and tax basis](#income-definitions-and-tax-basis).
- **Document coverage** is based on months and document types represented in parsed records for the selected scope and date range.

For the complete year-selection, carry-forward, gross/net and PDF workflow, see [Income review guide](INCOME_REVIEW_GUIDE.md).

### Income definitions and tax basis

Income measures have separate definitions. The dashboard headline previously counted every
deposit as income, including transfers between the household's own accounts, loan proceeds,
refunds and gifts. Each quantity now has its own name, and the name says what it counts:

| Figure | What it counts |
| --- | --- |
| **Money arriving** | Every external dollar received. This is **not** income. |
| **Identified income** | Classified earnings, investment income, distributions and other identified income sources. |
| **Employment income** | Earnings only. |
| **Declared income (affidavit)** | What was sworn to. |
| **Reported income (tax return)** | What was filed. |
| **Reconstructed gross wages** | Box 1 W-2 wages read from the parsed returns. |
| **Unverified deposits** | Money in with no identified source. Not income until it has one. |
| **Internal transfers in** | The household's own money moving between its own accounts. |
| **Liquid cash** | Cash available now. |

Declared, observed and identified figures are shown side by side, each printing the exact buckets
behind it. Nothing is presented as income without naming what it counted.

**Tax basis is stated beside the comparison figures.** Affidavit monthly rates and tax-return annual income are gross declarations. Payroll deposits are take-home after deductions. Distributions, K-1 income and cash receipts are distinct measures. The income review flags material cash/declaration differences as reconciliation leads, with basis and timeframe caveats; it does not label the difference unreported taxable income. Same-year W-2 wages are preferred for full-calendar-year payroll comparisons. A supported case-derived deduction rate may estimate payroll before deductions when needed; its sources, calibration years and limitations are shown. Other cash sources are not grossed up. Company-paid benefits remain outside cash and are not automatically tax-free.

**Payment-app deposits** are excluded from income only when a parsed statement for that owner and
that platform actually covers the date in question. Every exclusion is disclosed on screen and in
exported reports, with its count, its dollars, and the sentence "excluded as platform transfer,
date coverage only, not individually verified". Zelle is never excluded and is always treated as
money received, because Zelle carries no balance, so a recurring Zelle credit cannot be a wallet
settlement.

### Screening thresholds

The dollar thresholds the detectors screen against are shown, can be adjusted per case, and are
printed on every finding and export, so the question "what was your materiality?" has an answer
on the page. A case that has changed a threshold from the published default is marked as having
done so. These are product defaults chosen to be defensible in an ordinary dissolution. They are
not figures from a published standard and are not calibrated to a particular estate.

### How a finding was produced

Every finding states its origin, on screen and in exports:

| Label | What you can rely on |
| --- | --- |
| **Checked by rule** | Calculated from the parsed records. The same records produce the same result every time. No AI was used. |
| **AI lead, not verified** | Raised by a language model reading the records. A lead for a person to verify, not a computed result, and it may be wrong. |
| **Added by a reviewer** | Entered by a person working the case, not produced by an automatic check. |
| **Rule and AI, not corroboration** | Both reached the same subject. They read the same records, so this is **not** independent confirmation. Verify the AI portion separately. |

Counts are never merged. A headline of twelve findings that is three computed results and nine AI
leads prints the split, because the two are different inputs to a decision about where to spend
effort.

### The case timeline

Attorney, paralegal, coach, pro se and forensic views render the same timeline: the same rows, the
same sources, the same actions. The rows scroll inside each role's card.

No date is authored by a model. Each row carries one provenance label:

| Label | Meaning |
| --- | --- |
| ▣ Source record | Read from a produced record. |
| ◆ Deterministic rule | Derived by a rule from records in the case. |
| ○ Case date (profile) | Taken from the case profile you entered. |
| △ Extracted/unverified | Pulled from document text and still needs review. |

**Confirm this date**, **Add a date**, and **Remove this date** are available wherever the
timeline appears. A row you have confirmed reads **✓ Confirmed by you** and still prints the
class it was extracted under, so confirming never hides what was extracted. Confirmations are
stored separately from the extracted value, which survives them unchanged.

Row behavior worth knowing:

- A date that conflicts with the case profile is grouped under one anchor-conflict row for review.
- Rows are titled by the event, such as "Loan funded · QNA Chicago Inc", not by how the row was selected.
- Equal amounts collapse to "2 × $500,000" rather than showing one figure.
- A figure the filing never stated reads **Not stated**, never `$0`.
- A placeholder date with no day in the text reads "2001 (year only)".
- A filing whose stored date disagrees with its file name date is not labelled a source record, and both dates are shown.
- Only the actual judgment counts as the decree. Filings that merely mention it are not labelled as one.
- **Show ability-to-pay statements** reveals dated claims about a party's ability to pay. It was previously called "Show statement dates", which read as bank statements.

### When a comparison has not finished

The comparison behind the legal cards rebuilds in a worker after an application update. The cards
carry that state rather than reporting "No claims extracted" on work that has not run:

- **Rebuilding the comparison after an update.** Anything missing has not been checked yet.
- **From an earlier version, rebuilding.** The previous run's figures are shown and labelled provisional.
- **Could not run the comparison.** The recorded reason is shown with a **Retry the comparison** button.

No banner appears when the layer is current, so a settled case looks unchanged.

Each claim from a filing is tested against the period it describes and links to the records used.
One verdict vocabulary covers every result: **Untested**, **Partial**, **Flagged**, or
**Supported**. No card calls anything a violation, a contradiction, or fraud. It states what the
records show. A claim about intent or earning capacity is marked Untested, because bank records
cannot test it.

### Attorney dashboard

Use the Attorney view to review litigation and settlement readiness.

Key cards and workflows:

- **Net Marital Estate**: marital and hybrid assets minus marital and hybrid debts.
- **Client Share (Est.)**: current settlement worksheet net allocation when available; otherwise a labeled 50/50 status-quo model. Equalization is shown as a transfer between parties, and partial worksheets label unassigned items separately.
- **Monthly Cash Flow**: selected-range average external inflow minus external outflow over active scoped transaction months.
- **Forensic Risk Score**: weighted summary of unified Investigations findings, estimated flagged dollars, source confidence, missing months, and disclosure variance.
- **Marital Estate Breakdown**: marital/hybrid assets grouped by category.
- **Net Worth Over Time**: estimated trend derived from cumulative observed cash flow, not an actual account balance.
- **Linked Transfers**: transfer reconciliation results ranked by concern level.
- **P2P Activity Summary**: external sent/received across Cash App, Venmo, Zelle, PayPal, Apple Cash, and similar records. Platform statements are authoritative for owner-platforms that have one; bank records are used for owner-platforms without a parsed statement. Internal wallet funding, cash-out, and fees are shown separately.
- **Document Coverage**: direct parsed counts for statements, tax returns, affidavits, legal docs, and business docs.
- **Deadlines and Recent Activity**: Discovery Manager due dates and audit-log entries.

Most attorney cards link to the owning module for deeper review.

The **Standing Findings Program** card opens the detailed ledger in Investigations. Its active count
excludes findings explicitly marked **Not an issue**, while a set-aside section preserves those
results and their reviewer notes. The separate funded-card card appears when a card payment can be
paired to a withdrawal from another account; Investigations provides the source-linked review.

Filing-relative tests use **Settings → Profile & Case → Dissolution Filing Date**. If that field is
blank, Thrive may use the earliest dated petition in parsed legal documents. The separation date is
never substituted for the filing date.

### Forensic Accountant dashboard

Use the Forensic Accountant view to review evidence readiness, money movement, variance, and findings.

Key cards and workflows:

- **Evidence Readiness**: document count, date coverage, source confidence, and missing months.
- **Financial Position**: assets, debts, net estate, liquidity, monthly external inflow, monthly external outflow, and debt ratios.
- **Top Findings by Impact**: unified Investigations findings, sorted by risk and dollar impact where identifiable.
- **Money Flow Overview**: categorized inflows and outflows from parsed records.
- **Disclosure Variance**: observed deposits and P2P inflows compared with declared income.
- **Subject Focus**: spending categories for the selected spouse or business.
- **Timeline**: case dates, legal filings, affidavits, saved investigation events, large transactions, and key transactions.

Treat forensic cards as leads for review. Verify against source documents before using them as evidence.

### Divorce Coach dashboard

Use the Divorce Coach view to manage client readiness and practical next steps.

Key cards and workflows:

- **Financial Clarity Score**: composite score from document coverage, inventory completeness, income understanding, settlement readiness, coaching task progress, and education progress.
- **Documents Understood**: parsed documents compared with expected documents for the process period.
- **Marital Estate Identified**: marital estate value and percentage of potential assets identified.
- **Cash Flow Stability**: average monthly observed net cash flow.
- **Action Plan Progress**: completed coaching tasks divided by total coaching tasks.
- **Emotional Readiness**: readiness check-ins plus task and question progress.
- **Financial Education Progress**: saved lesson progress by education module.
- **Top Priorities**: deterministic priorities from cash flow, children, taxes, retirement, missing assets, document gaps, and findings.

The coach sidebar includes workflow entry forms:

- **Client at a Glance**: editable client profile for primary goal, top concern, communication style, support system, next milestone, preferred contact method, session cadence, and safety or sensitivity notes.
- **Add Coaching Note**: saves notes on the individual client case.
- **Coaching Task**: records open tasks by category and due date.
- **Client Question**: records financial, legal, document, settlement, or support questions.
- **Readiness Check-In**: records financial confidence, decision confidence, and context notes.

Coach records persist to the case database and are included in `.thrive` exports.

### Paralegal dashboard

Use the Paralegal view for production work rather than case strategy. It replaces the attorney
view for this role because the work is different work: chasing records, verifying what came back,
numbering pages, assembling packets, tracking discovery, and keeping a record of what was served.

Six work queues, one per question the work is made of:

| Queue | The question it answers |
| --- | --- |
| What is due | What has a date on it, and has any of it passed? |
| Records to check | Which records are unconfirmed, which did the parser flag, and which months have no statement? |
| PDFs waiting on Bates numbers | Which attached PDFs still need permanent page numbers before a packet can be exported? |
| Packets and what is blocking them | Which packets are draft, ready, or filed, and what stands in the way of each one? |
| Discovery still outstanding | Which requested items have nothing recorded against them, and is a response date past? |
| What has been produced | What went out, when, under what Bates range, and whose records were they? |

Each queue reports one of three states, and the third is the reason the set is worth reading:
**Needs action**, **Checked, nothing outstanding**, or **Waiting on records**. A queue with no
items and no inputs behind it reports waiting, never clear.

One next step is always shown, ranked by what most blocks a filing. Every count routes to the
work behind it, and the numbering card carries its document selection with it rather than
leaving you to re-find the documents.

Dated work is graded **Date passed**, **Within 7 days**, or **Scheduled**.

Novice **Detailed** and Advanced Mode render the six preparation queues. Novice **Summary**
starts with compact preparation priorities; choose Detailed to open all queues.

### Spouse / Pro Se dashboard

Use the Spouse / Pro Se view when you need plain-language orientation.

Key cards and workflows:

- **Your Clarity Score**: overall readiness based on documents, inventory, cash-flow signal, discovery readiness, settlement status, and education progress.
- **What's Helping / What to Focus On**: checklist of completed signals and missing next steps.
- **Readiness Cards**: documents understood, marital estate identified, cash-flow stability, action plan progress, and emotional readiness.
- **Your Financial Overview**: assets, debts, net estate, external inflow, external outflow, cash flow, and debt-to-asset ratio.
- **Cash Flow Overview**: last six active external-flow months from parsed records.
- **Top Priorities**: housing, emergency fund, tax, retirement, and budget priorities.
- **Next Best Step**: module link based on the current case gaps.

The Spouse / Pro Se view is not legal advice. Use it to prepare questions and organize information for counsel, a mediator, financial advisor, or your own pro se planning.

### Dashboard PDF export

The dashboard PDF is a top-level case report for the selected role, scope, and date range. It includes:

- case caption and matter details
- role and scope
- assets, debts, net estate, liquidity
- average monthly external inflow and external outflow
- document coverage and confidence
- parsed document count
- findings count and top findings
- recent cash-flow rows
- observed-vs-declared variance rows when available
- income-review composition, all takeaways, gross/net methods, affidavit monthly/yearly rates, dated declarations and compact source references for the selected scope

The PDF does not include raw source documents. Save the full `.thrive` case file when you need a restorable backup with the case data.

PDF reports use the Organization template by default, with a lighter purple editorial cover/header, a white logo and header lockup, white header text, Cormorant Garamond headings, and Outfit body text. Eligible firm-branding plans can choose a different report template and supported typography in **Organization → Brand Kit**; those saved choices take precedence over the default.

### Review standard

If a dashboard number looks wrong, check these before relying on the card:

1. document owner and business tags in Document Parser
2. duplicate account or bank names in Settings → Account Configuration
3. date range and scope filters
4. missing months or missing document types
5. source documents behind the parsed records

## 7. Document Parser

The code module is `StatementAnalyzer`, but the UI label is **Document Parser**.

### Supported document types

- bank statements
- investment, crypto and retirement statements (IRA, Roth IRA, 401(k) and other plans)
- credit card statements
- financial affidavits
- court orders, filed affidavits, loan agreements, emails, and other legal filings
- tax returns
- Cash App / P2P histories
- business income statements
- business balance sheets
- business general ledgers
- bank, credit card, and cash-platform transaction exports as spreadsheets (`.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.csv`, `.tsv`)

### Basic workflow

1. go to **Document Parser**
2. upload or drag in files
3. assign an owner and document type for each file
4. add business tags where needed
5. start parsing

### Key views

- **Document Manager**: master library of parsed files
- **Coverage Analysis**: monthly, yearly, and business-document coverage checks
- document-specific tabs for transactions, affidavits, legal filings, tax returns, Cash App, and business financials
- cash-platform rows that carry no date are displayed rather than failing the screen, and are left out of year filters

### Current power features

- bulk metadata editing
- duplicate-aware coverage review
- legal filing extraction for ordered fees, sanctions, payment obligations, due dates, insolvency claims, and dated financial terms
- balance-sheet parsing for wide monthly matrix PDFs, including year-end / latest-reported-month snapshots by year
- counterparty and deposit-method capture on bank rows, shown as **Method** and **Counterparty** columns (with a business icon for company counterparties) and filterable by method and counterparty type
- transfer purpose badges (Distribution, Reimbursement, Payroll, Loan) on matched linked transfers, with an inline override that persists and a **Transfer Purpose** filter
- **Family Support** chips on deposits from a known family member or a spouse's surname (see Asset Manager → Family Members); these are treated as non-income and flagged for review, never counted as earned income
- **Owner Benefit?** chips with accept/reject controls on business-account charges that look personal — a personal-type category (groceries, dining, streaming, fitness) on a business account, a household bill (rent/mortgage, utilities) on a spouse's card, or leisure-pattern travel (weekend dates or resort/spa/cruise/Disney/Airbnb/VRBO). Accept to mark the charge a personal expense (it then counts under Company-Paid Expenses on the dashboard) or reject to dismiss it; a reviewed suggestion never comes back. Use **Accept All / Reject All** in the Bulk Edit dialog to clear several at once. The system only suggests — you stay in control of every personal-expense flag
- **Re-analyze with latest parser** per-document action — re-runs the current AI parser on a stored statement and refreshes the AI-extracted fields (counterparty, deposit method) while keeping all of your manual edits (categories, owner, business tags, personal-expense and transfer-purpose choices); costs one document's worth of AI credits and is disabled in demo mode
- **spreadsheet transaction import** — upload a bank, card, or cash-platform export instead of a PDF statement; figures are read literally from the cells (see below)
- **re-attach a missing original** and **attach the bank's PDF statement** to a spreadsheet-imported record, both from Document Manager (see below)
- original file + certificate download
- Excel export for transactions and Cash App data (bank export includes method and counterparty)
- account, bank, and cash-platform cleanup through **Settings → Account Configuration**
- documents automatically inherit their business classification from the Account Directory even when the statement itself was not individually tagged, so business account statements consistently file under Business everywhere in the app
- a dedicated **Business credit card statements** category, separate from business checking/savings and personal credit cards
- Document Library owner filtering can target one specific business, not just spouse or joint
- large-PDF warnings ("this may parse in up to N chunks") are based on the document's actual page count

### Portfolio statements and compact transaction tools

Open **Investments**, **Crypto** or **Retirement**, select the account owner and choose **Parse statement**. Novice mode reaches the same workspace through Get Records → **Investment, crypto & retirement statements**. Upload one account per PDF/image, confirm page-based credits, and compare closing holdings and activity with the source. Eligible dated USD snapshots can create an account asset; existing inventory remains unchanged and discrepancies require review. Early retirement-withdrawal notes identify age/date questions without deciding a tax penalty. See [Portfolio guide](PORTFOLIO_GUIDE.md).

Bank Transactions, Credit Cards and Cash App / P2P offer **Review bank and account names** and **Assign cards to people**. On mobile these are two compact icon buttons; other parser tabs do not show them. The transaction **Filters** expander contains the card & user saved-view dropdown.

### Page coverage and missing-page recovery

Most statements are not raised for page review at all. When the transactions Thrive
extracted walk the statement's own opening balance to its own closing balance, nothing is
missing regardless of which pages produced the rows, and pages that came back empty are
left alone. Page review appears only when that check cannot be made or does not pass.

When one PDF holds several statement periods — a whole year of monthly statements for one
account, which is a common way to receive records — each period is checked against its own
printed opening and closing balances rather than the document being summed end to end. A
shortfall is then reported against the month it occurred in, and offsetting errors in
different months can no longer cancel each other out. Documents parsed before this existed,
or whose periods cannot be separated cleanly, fall back to the whole-document check.

Use **Document Parser → Document Manager → Page Coverage** for a statement that shows
**Confirm pages**, **Missing rows**, **Pages not read**, or **Likely missing pages**. In
Novice Mode, the same workflow starts from the item in **Verify Records**.

What the app asks for depends on what it can prove:

| Badge | What it means | What to do |
| --- | --- | --- |
| **Confirm pages** | The pages were read and produced no rows, and the balances do not contradict that | Check the listed pages against the original and confirm they are blank |
| **Missing rows** | The statement's opening and closing balances do not match the transactions found, so rows are demonstrably absent | Recover the listed pages |
| **Pages not read** | The parser never sent those pages to the model | Recover them |
| **Likely missing pages** | An older record with no page-by-page report | Re-analyze to build one |

1. Compare the listed pages with the original PDF. A page with no extracted rows is most often a cover, disclosure, advertisement, or blank page, which is why confirming is the default request rather than re-reading.
2. If an older statement has no page-by-page report, choose **Re-analyze to check pages**. This full source re-read uses the normal document AI-credit tier and requires the original file to be attached.
3. For pages you have checked and found blank, choose **I checked — these pages are blank**. This records the review instead of silently dismissing the warning. Use **Not all pages are blank** first to narrow the confirmation to only the pages you verified.
4. For pages that do carry activity, choose **Recover these pages · Free** (shown as **Read them again instead · Free** when confirming is the default). Targeted recovery reads only those pages, consumes no AI credits, and does not replace existing case transactions.
5. Choose **View transactions** to open the transaction table filtered to the exact source file. Use **Show all transactions** or reset the source-file filter when the focused review is complete.

Confirming pages as blank is unavailable when Thrive detects that its own page numbers are
unreliable — the signature is every chunk's rows landing at the same position within the
chunk. Only re-reading can settle those, because the page numbers a blank confirmation
would rest on are wrong.

If the original is unavailable—including a large PDF stored in safety mode—targeted recovery cannot run. Retain external originals, manually add verified missing rows when appropriate, or upload and parse a suitable source copy.

When you open an existing case (or import a `.thrive` file), Thrive automatically upgrades it in the background so it picks up the latest analysis — transfer purposes, family-support flags, candidate distributions, and owner-benefit suggestions appear without re-parsing, and none of your manual edits are changed. This runs once per update. Use **Re-analyze with latest parser** only when you want a fresh AI read of a specific document.

## 8. Court Prep

1. Open Court Prep in the sidebar, or follow the saved exhibit into its packet from Investigate. If starting here, create a packet and enter its name, proceeding, submitting party and case details.
2. Under What are you presenting?, add a Thrive chart/report, uploaded material, selected transactions or source documents. Choose the content first; the matching builder and supporting-record controls appear next.
3. For a finding exhibit, review the saved visual or transaction table and its automatically attached records. For a live Dashboard/Data Analysis card, use the chart/report picker and select the exact card; verify the proposed source records.
4. Check the exhibit label and description. A label names an exhibit in this proceeding; Bates numbers are permanent page addresses on the original source PDFs.
5. Use Number N PDFs before download for selected PDFs without locked Bates ranges. Review the source identity, order and numbering. Numbering in Court Prep saves the ranges; it does not download the exhibit.
6. Save the packet. Saving an exhibit or editing its transaction selection does not download files. Review and export / Download this exhibit performs the actual export; a transaction exhibit includes matching PDF and Excel tables. Download checklist exports only the packet index.
7. Mark the packet Ready when all required details and source numbering are complete. Changes to a Ready packet return it to Draft. Mark Filed / used only after using that exact packet; used packets cannot be edited. Create a new packet for a later proceeding.
8. Check the downloaded exhibit, original records, citations and any required redactions or filing instructions. Ready is an application preparation state, not a ruling that a court will admit the material.

**Suggested exhibits to consider** offers up to two focused, reproducible findings with available linked originals. **Build exhibit** seeds a transaction or source-document draft for review and saving; **Ignore** dismisses the suggestion for the current visit. Suggestions rank clarity and backing evidence; they do not certify admissibility or bypass source review, Bates numbering or export gates.

See [Court Prep guide](COURT_PREP_GUIDE.md) for the complete packet workflow.

Court Prep is a standalone workspace in both modes. It combines proceeding-specific exhibit labels,
type-specific material selection, associated-record review, required PDF-source Bates numbering,
source-verified packaging, and Draft → Ready → Filed/used history. Advanced Document Manager and
Dashboard/Reports shortcuts open this same model rather than separate exhibit systems.

### Bates numbering and citing evidence

A Bates number is a unique, sequential label stamped on every page of a produced document —
`CHASE-000122`. It is the reference an exhibit list, a deposition outline, a motion, or a
summary chart uses to point at a specific page, so anyone reading can turn to that page and
check it. A Bates number identifies **one page**, never a document.

For the end-to-end packet workflow, output contents, troubleshooting, and preservation checklist,
see [Court Prep: Productions, Exhibits, and Bates Numbering](COURT_PREP_GUIDE.md).

#### Internal reference numbers

Thrive normally assigns each parsed PDF a provisional institution-based range for internal case
references. It derives a prefix from the institution (`CHASE`, `BOA`, `AMEX`, `IRS2023`), keeps
the institution's records together in date order, and allocates a contiguous block from the case
registry. The range appears in the Document Manager's **Bates #** column.

These institution-based values are **provisional internal references**, useful while reviewing
and citing records inside the working case. They are not a served production sequence. A court
production normally uses one continuous prefix for the producing party; use the named production
flow below when the files are leaving Thrive.

The Document Manager groups these repair actions under a **Source page numbers** strip, kept
separate from filters and from Create Production so it isn't mistaken for either. A **Number N
unnumbered** button appears there only when something is missing numbers — a case imported from
an older export, most often. It continues the sequence and changes nothing already numbered, so
it is always safe to run.

**Reset all provisional numbers** is the opposite: it renumbers the case from scratch. Renumbering
after documents have been shared, cited, or filed invalidates every reference already made to
them — treat it as a setup-only action, and lock anything you have produced first.

#### Creating a court production

Three interfaces call the same verification, numbering, packaging, locking, and persistence
engine: **Document Parser → Document Manager → Create Production** in Advanced Mode, **Get
Records → Document Library → Number Documents** in Novice Mode, and the inline source-PDF gate
inside each Court Prep exhibit.

In Advanced Mode:

1. Sort the table into the order the recipient should receive the records.
2. Select the PDF documents and choose **Create Production**.
3. Enter a production name, producing-party prefix, starting number, and default custodian.
   Custodian means the person or entity that controlled the record; it is not inferred from
   account ownership. Override individual rows when a set has more than one custodian.
4. Review the exact document order, any source/PDF blockers, and the estimated ending number.
5. Confirm that counsel's numbering and production protocol have been reviewed, then choose
   **Create and download ZIP**.

In Novice Mode's Document Library, the same work is presented as four plain-language steps:
choose only ready source PDFs, order them with accessible arrow controls, name/number the set and
identify custodians, then complete the protocol/confidentiality review and create the ZIP. Every
disabled source states why it is not eligible, and a visible readiness checklist explains what
still prevents creation. This guided path is intentionally available to pro se users; switching to
Advanced Mode is not required.

Court Prep's compact entry point appears only after an exhibit's associated-record selector. A
draft can be saved while source PDFs are unnumbered, but the exhibit cannot be marked **Ready** or
downloaded until every selected PDF source has a locked range. Its action changes to **Number N
PDFs before download** and opens the inline form for a prefix, starting number, one custodian, and
the same permanent-numbering acknowledgment. Native spreadsheets and other non-PDF sources have
no PDF pages to stamp and remain verified originals. The full workspaces above remain the place
for ordering a larger production or setting a custodian per document.

A source that fails verification — no preserved hash, a hash mismatch, an unopenable PDF, no
recoverable original bytes, or (on a second run over a mixed selection) a document that's already
locked — is set aside and named, not a reason the rest of the selection fails to number.

Before changing the case, Thrive verifies each preserved original against its SHA-256 hash,
opens the actual PDF to count its pages, assigns one uninterrupted sequence, stamps the pages
bottom-right, hashes each stamped derivative, and builds the complete ZIP. It then commits the
document ranges, locks, named event, and prefix high-water mark in one browser-storage
transaction. If verification, stamping, packaging, or persistence fails, no partial production
is recorded.

The ZIP contains:

- `documents/` — stamped derivative PDFs named by BegBates, EndBates, and source filename;
- `load-file.csv` — `BegBates`, `EndBates`, `Custodian`, `SourceFile`, `DateRange`, original
  SHA-256 `Hash`, `ProducedFile`, derivative `ProducedHash`, `PageCount`, and event fields;
- `manifest.json` — the immutable event and per-file provenance; and
- `README.txt` — contents, hash meanings, and the protocol limitation.

The CSV is a general UTF-8 production index. It is **not** a Concordance DAT, Opticon file,
native-file production, or guarantee of compliance with a jurisdiction's ESI protocol. Required
fields, delimiter/encoding, confidentiality markings, native handling, family relationships,
privilege logging, and sequence policy vary; confirm them with counsel before service.
To make the CSV safe to open in spreadsheet software, Thrive prefixes values that could execute
as formulas with an apostrophe; `manifest.json` retains the exact source values.

Named-production locks cannot be released or deleted in Thrive. If a served set needs correction,
preserve it and create a clearly named supplemental or replacement production under counsel's
instructions. Keep the original ZIP: Production History can download the event record and hashes,
but a PDF regenerated after a library upgrade is not guaranteed to have identical derivative bytes.

When numbering is completed inside Court Prep, Thrive commits the permanent ranges and locks but
does not download a separate source-production ZIP. **Save configuration** also creates no file. A
later **Download this exhibit** or **Export exhibit ZIP** action regenerates the locked stamps and
creates the proceeding-specific ZIP containing the primary item and supporting records. Standalone
productions created from Document Library or Document Manager still download their own production
ZIP immediately and must be retained.

#### Locking produced numbers

Select the documents you have served, filed, or cited and choose **Mark as Produced**. Their
Bates numbers are frozen from that point: **Reset all provisional numbers** skips them, the
allocator reserves their range so nothing else can be issued the same numbers, and the range
appears with a lock in the **Bates #** column. Recording why the numbers were fixed ("Served on
opposing counsel, Production Vol. 1") is optional and goes to the audit log.

**Release Lock** is available only for a manual lock. Releasing means those numbers can move
again, so anything already filed that cites them would then point at the wrong page. A lock owned
by a named production event is permanent and has no release action.

#### Exhibit labels

An exhibit label is not a Bates number, and Thrive keeps them apart on purpose.

| | Bates number | Exhibit label |
| --- | --- | --- |
| Identifies | One page of one record | One thing offered in a proceeding |
| Example | `CHASE-000104` | `Exhibit A`, `Petitioner's Exhibit 4` |
| Belongs to | The record, permanently | The proceeding — the same statement can be Exhibit 4 at a deposition and Exhibit B at trial |
| Changes | Never, once produced | Whenever the proceeding does |

Open **Court Prep** from the sidebar — present in both Novice and Advanced Mode. In Advanced Mode,
selecting records first in **Document Manager** and choosing **Build Exhibit Set** opens the same
workspace preloaded with that selection; it is a shortcut, not a separate flow. Name the petition,
motion, hearing, deposition, discovery response, settlement conference, or trial; add the date and
filing/docket reference; identify the submitting party; and record any judge-specific convention.

**Packet details** and **What are you presenting?** are collapsible panels. Choose **Add exhibit**
from the responsive packet action bar. A new exhibit initially shows only **What's in it?**; after
you choose a composition, Court Prep reveals the label, description, matching builder, associated-
record selector, and source-page-number status. The five choices are:

- **A Thrive Financial chart or report and the records behind it** — select a saved report, or
  choose Dashboard or Reports and click a card in the temporary selection mode. Known sources are
  attached automatically. Exhibit controls stay hidden during ordinary visits to those modules.
- **A custom visual aid or exhibit to manually upload** — upload a PDF or image made outside
  Thrive, describe it, and choose its supporting records. The upload is hashed exactly as supplied,
  but it is not parsed or placed in the source-record Bates sequence.
- **User-selected set of transactions** — choose the rows and add a selection/method note. Their
  source records are auto-selected and cannot be removed while those transactions remain selected.
- **Just the documents** — select every record that should carry this exhibit label.
- **Something else** — describe the item and attach the case records that belong with it.

A sixth entry path starts from a reviewed finding rather than from an empty Court Prep group. In
**Investigations**, choose **Build exhibit → Focused visual or evidence grid**. Thrive
selects a comparison, timeline, ranked bar chart, key-number card, or evidence grid from the
finding's retained amounts, dates, evidence roles, and citations. This is deterministic and does not
use AI to invent or revise data. The preview, complete data rows, selection reason, method,
contradictory evidence, limitations, missing evidence, source IDs, and finding ID are saved together.
In the same drawer, confirm the supporting records, choose an existing editable packet or create a
new packet, enter the exhibit label and description, and save. The drawer confirms what was created;
it does not redirect to another module. The existing manual Dashboard/Reports picker remains
available in Court Prep's separate Create Exhibit workflow.

Later, open Court Prep and choose **Review and export** beside the generated preview. Directly cited records stay
attached while the visual depends on them. The exported PDF contains the visual first, followed by a
selectable-text data-and-method appendix and the normal source appendix; the ZIP retains the source
records, index, and hash manifest.

Each exhibit group has one label and exhibit-list description. Associated records appear only after
the composition is selected. A report, captured card, or transaction set attaches its known sources
as **Auto-selected for exhibit** records; records checked manually are marked **Selected by you**.
The one checkbox controls exhibit attachment only. A separate badge on the same row shows whether
the record is Bates-locked, needs Bates numbering, or is a native file with no PDF pages. The same
record can therefore be both auto-selected and in need of numbering; the summary reports these as
separate labeled counts instead of treating them as mutually exclusive choices. Add missing support
and review any broader scope-based suggestions. A filing, motion, or petition suggested behind a
chart is not proof that it supports the calculation—the card may not expose exact source IDs, so the
picker may propose all records in the active person/business/date scope.

Labels must be unique **inside one set**. They are deliberately reusable in another set, and a
source may appear under different labels in different proceedings. This preserves the history
instead of overwriting one global `exhibitLabel` every time a hearing changes. Bates-shaped labels
remain invalid because they would confuse a proceeding label with a page address.

For a chart supported by four statements, choose the Thrive chart/report composition and confirm
the four supporting statements. Confirm whether the court permits one compound exhibit or instead
requires the chart and records to use separate exhibit numbers or subparts.

After document selection, Court Prep checks only the selected PDF source records. If any lacks a
locked Bates range, its exhibit card shows **Number N PDFs before download** and the review checklist
keeps the packet from becoming Ready. Complete the inline numbering; no file downloads at that
point. Native non-PDF sources remain their verified originals because they have no PDF pages. Mark
the set **Ready** only after metadata, labels, items, and locked source-PDF ranges are complete;
mark it **Filed / used** after it leaves preparation. Filed/used packets are read-only; make an
editable copy for a later version.

#### Exporting one chart or card as an exhibit

In Court Prep, choose the Thrive chart/report exhibit type, then choose **Choose from Dashboard** or
**Choose from Reports** and click the exact visible card when selection mode opens. This works in
both Novice and Advanced modes and is not limited to two named visuals. The review dialog:

1. selects or creates a proceeding-specific exhibit set;
2. collects the exhibit label and exhibit-list description;
3. suggests records from the selected dashboard scope and asks the user to remove anything that
   did not contribute and add anything missing; and
4. requires confirmation of the court's compound-exhibit/subpart, exchange, redaction,
   foundation, and authentication conventions.

Choose **Save configuration** to attach only the card reference, scope, label, and source IDs to the
packet. This closes the dialog without capturing the card, rendering a PDF, downloading a file, or
adding generated bytes to the case. From Court Prep, **Open visual to export** returns to the saved
live card and restores that exhibit group. The PDF is rendered only when **Export exhibit ZIP** is
chosen.

The exported ZIP contains the rendered visual PDF, the selected source files, an
`EXHIBIT_LIST.csv`, a `MANIFEST.json` with SHA-256 hashes, and a plain-language README. The visual
PDF ends with a Data Sources Appendix. The chart itself never joins the source-record Bates
sequence. Every selected source PDF must already have a locked range; if not, the primary action
becomes **Number N PDFs before export** and opens inline numbering. Export regenerates the Bates
stamps from each hash-verified original and uses verified originals for native non-PDF sources.
When a previously served derivative must be used byte-for-byte as delivered, retain and use that
prior production copy rather than treating a regenerated reference copy as authoritative.

Many cards suggest records from the active screen scope because they do not expose exact
per-card sources. Cards that provide `data-exhibit-source-ids` use those exact records. In every
case, the user reviews the list before export. Court Prep stores the live-card reference and source
IDs, not rendered bytes. Reopen that configuration from the exhibit card whenever an export is
needed. Selecting a saved investigation report attaches its
known sources but does not regenerate the report PDF during a later group download; export the
reviewed report separately, or add its final PDF as a custom upload when it must be the primary file
inside that exhibit ZIP.

For other compositions, the same exhibit ZIP can lead with the uploaded primary file or a generated
transaction-summary PDF, or contain only the selected documents. A transaction exhibit also
includes an editable Excel workbook with the selected rows and their citations. Each exhibit
downloads from its own card. **Download checklist** is the whole packet's index, not a combined
exhibit-file export.

For a transaction summary, choose one or more accounts first. Thrive uses the account directory to
collect the statements for each account; it does not ask you to select document files. After you
filter and select transactions, only the records containing those rows are auto-attached. Sort the
working list by date or signed amount; money out is negative and money in is positive. **Find & select
other sides** ignores the working-list filters and searches all parsed accounts for exact-amount,
opposite-direction entries in different accounts. Ordinary transfers must post within two days;
recognizable card-payment pairs may span seven days to cover posting differences. Likely pairs are
ranked using saved transfer links, account-number references, wording, and date proximity. It selects the suggestions immediately,
including rows hidden by the current filters. Review them and uncheck any suggestion that is not the
same transfer; a suggestion is not proof of a match.

**Select all visible** adds every row matching the current transaction filters, including rows below
the scroll window. Filter and sort changes retain prior selections and report how many selected rows
are outside the current view. Use **Clear visible** for only the current matches or **Clear all** for
the entire transaction selection. After adding the summary, use **Edit transactions** on its saved
card to restore its accounts, rows, title, method note, and retained match markers. Add or remove
rows, then choose **Save transaction changes**; supporting records are recalculated and no file is
rendered or downloaded. A Filed / used packet must be copied to an editable draft first. Saving
stores only the selected transaction and source IDs. When
you explicitly download the exhibit, its ZIP contains both a court-readable transaction-summary PDF
and an editable Excel workbook with the same signed rows, source records, and Bates citations. Both
tables include **Matching side found** so retained counterpart pairs are visible in either format.

#### Citing a transaction to its page

With **Bates #** enabled in the transactions view, each row shows the Bates number of the
page that transaction was printed on, derived from the document's starting number and the
page the parser read the row from.

Two forms appear, and the difference matters:

| Display | Meaning |
| --- | --- |
| `CHASE-000122` (solid) | The Bates number of the page this transaction appears on. Citable. |
| `CHASE-000101 – CHASE-000132` with a `DOC` marker (dashed) | The document's range. Thrive could not identify a single page for this row. |

Thrive falls back to the document range whenever a page-level citation would be a guess:
the row carries no page number, the derived page falls outside the range assigned to the
document, or the parser's page attribution for that document is known to be unreliable.
Hover the dashed form to see which applies. A page number reported unreliably is worse than
no page number at all, because a citation that does not match the stamped page can be
challenged, so Thrive declines to assert one.

To convert a dashed citation into a page citation, resolve the underlying page attribution:
open the record's page report and re-read the pages, which re-attributes the rows.

#### Stamping the pages

Bates numbers are written onto PDFs in three circumstances. A named production stamps every
selected PDF in its permanent sequence; Court Prep re-stamps every selected PDF source with its
locked range when creating the exhibit; and Advanced Document Manager's **Certificate of
Authenticity** can create a single working derivative when a range exists. Native non-PDF files are
not stamped. An exhibit export never silently substitutes an unnumbered PDF original.

Bates numbers cannot be stamped on a document whose original bytes or saved SHA-256 hash are
unavailable. Re-attach the exact original when the record already has a hash but its bytes are
missing (see *Re-attaching a missing original*). A legacy record with no saved hash must be
re-parsed from the original so Thrive can establish source identity before production.

#### Reports, charts, and other generated material

Material Thrive generates — red-flag reports, dashboards, visualizations, summary tables —
is analysis, not evidence obtained from a third party, and is not stamped in the evidence
sequence. It carries its own provenance instead: a SHA-256 hash and, when online, an
RFC 3161 trusted timestamp recorded in the audit log. Counsel decides how any summary is
labelled and produced.

What they do carry is a citation. Every exported red-flag report ends with a **Data Sources
Appendix**:

- **Prepared from records `CHASE-000001–000132, BOA-000201–000248`** — the ranges the report
  was built from, merged per institution.
- A table of every source record: filename, type, owner, Bates range, and SHA-256 hash.
  Records with no Bates numbers are listed as *Not numbered* rather than given one here.
- **Findings and the records behind them** — the Bates pages supporting each individual
  finding, with the same citation printed on the finding's own card.

Thrive works out which records a finding rests on by matching the dated dollar figures in the
finding's own text against your transactions, and cites a record only when the match is
unambiguous. A figure that fits two transactions equally well is left uncited rather than
attributed to a guess, and a page-level cite degrades to the document's range under exactly
the rules described above. A finding listing no records named nothing specific enough to
check against the transaction data.

The same citation appears on each finding on screen, so you can see what a report will cite
before exporting it. General analysis reports can identify an unnumbered source by filename and
hash. Court Prep is stricter: once that report or visual is placed in an exhibit, every associated
PDF source must be permanently numbered before the exhibit can become Ready or download.

### Importing transactions from a spreadsheet

When an institution offers a transaction export but no PDF statement for a period, upload the
export directly. Thrive accepts `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.csv`, and `.tsv` for
bank, credit card, and cash-platform activity.

- Amounts, dates, descriptions, and balances are read **literally from the cells**. No model
  sees or restates a figure, so every number traces back to a numbered row of your file.
- A model is asked to label columns only when the headers are not recognisable, and it answers
  with column indices — never values.
- Descriptions are categorised after deduplication. A 5,000-row export usually holds a few
  hundred distinct descriptions, so the credit cost stays small regardless of file size.
- Open **Spreadsheet import** on the document to see which column became the amount and how
  money in was told from money out, without reopening the workbook.

**A spreadsheet is a convenience, not evidence.** Exports can be edited after download and
usually carry no letterhead, running-balance verification, or certification. Every record
imported this way carries a standing evidentiary caution. For filing, discovery, or any
contested tracing, obtain the true and correct statement from the issuing institution and
import that.

You can keep the institution's own statement with the imported record: use **Attach the bank's
PDF statement** in Document Manager (or the novice Document Library). The attachment is stored
and **never parsed** — the spreadsheet already produced the transactions, so parsing the PDF as
well would double-count every row. It therefore costs no AI credits. Use **Replace** or
**Remove** on the same badge to change or clear it.

### Re-attaching a missing original

A document can end up in the case without its source bytes: an analysis-only case file, a
source archive that was never imported, or a large PDF parsed by a build that discarded the
payload. Those rows show **Original file missing — click to re-attach** in Document Manager,
and in Novice Mode's Document Library.

- The file you select is accepted **only** when its SHA-256 matches the hash recorded when the
  document was parsed. Thrive matches on the hash, never the filename — the hash is what the
  source certificate attests to and what makes a re-parse trustworthy.
- On a match, the bytes go back into the source archive and re-parse, original download, page
  recovery, and certificates all work again.
- On a mismatch the file is refused and both digests are shown. Check for a different month, a
  re-downloaded copy, or a PDF that a viewer re-saved.
- A record parsed before source hashing existed cannot be checked this way. Re-parse the
  original document instead.

### Re-parsing one document

**Reparse document**, in the Document Library, reads a record's stored original again with the
current parser. You do not re-upload the file.

A confirmation step states the cost before anything runs: normal parsing credits apply, charged
per page for a PDF. Only the extraction fields for that document type are rewritten. Source
identity, assignments, Bates information, user labels, review history, and any field you have
edited are never taken from a new parser response. For a bank or cash-platform record, existing
transaction rows are retained and re-analysis does not add unmatched rows, so nothing is
duplicated or silently dropped. A late response is discarded if the document has left the case or
its source hash has changed.

The action is unavailable, with the reason shown, in two cases:

- **The record came from a spreadsheet.** Use the spreadsheet import flow to review a corrected export.
- **The original file is missing.** Restore the matching source archive first.

If what you need is **missing bank transactions**, use **Check pages** instead. Re-reading will
not add rows the first pass never reached.

### Legal filings

Use the legal-document type for court orders, sanctions orders, filed affidavits or declarations, motions, petitions, decrees, judgments, stipulations, insolvency declarations, bankruptcy materials, receivership filings, and business-closure documents. If the upload modal detects a legal filing, confirm the subtype as **Order**, **Affidavit**, or **Other** before parsing.

After parsing, open **Legal Documents** to review:

- ordered fees, support, equalization, sanctions, or other monetary commitments
- who owes and who receives the payment
- order dates, due dates, filing dates, and effective dates
- insolvency, bankruptcy, defunct-business, dissolution, liquidation, or closure claims
- dated terms such as account freezes, transfer deadlines, valuation dates, escrow releases, and distribution restrictions

These extracted dates can appear as timeline anchors in dashboard cash-flow charts and can be used by Investigations and its Asset Tracer engines to test whether payments, transfers, business activity, or claimed insolvency line up with the record.

### Case Document Intelligence

When legal documents are parsed, Thrive builds a Case Intelligence Layer that downstream dashboards can use. It can include:

- assertions from affidavits, motions, petitions, and email exchanges
- obligations from orders, stipulations, settlement terms, and loan agreements
- key dates such as filing dates, due dates, insolvency claim dates, and transfer deadlines
- loan commitments with borrower, lender, principal, guarantors, and use-of-funds limits
- admissions extracted from email exchange threads

The dashboard then compares some entries against available evidence. For example, income claims can be compared with tax returns and bank deposits, ordered payments can be matched against debit transactions, and loan proceeds can be checked for possible personal-use outflows. These comparisons are review aids, not legal conclusions.

### Important tip

Keep ownership, business links, document types, and legal subtypes accurate. Those fields are reused by Investigations, Dashboard, Discovery Manager, and Data Analysis.

## 9. Asset Manager

Asset Manager is the shared financial inventory for the case.

### Track here

- assets
- debts
- income
- children
- business-linked items
- **family members** — name and optional relationship for people whose support you may receive

### Family Members

Use the **Family Members** card to list relatives who send you money (parents, siblings, in-laws, etc.). Thrive suggests candidates from your dependents and spouse surnames, but never adds them automatically. Once listed, check/wire/P2P deposits from these people are tagged **Family Support** in the transaction table and treated as non-income for review, so counsel can decide how they should be handled. Adding or removing a family member re-scans your deposits immediately.

### Ownership options

- marital
- spouse 1 non-marital
- spouse 2 non-marital
- hybrid

This module drives settlement math and also improves cross-module reporting.

Asset and debt changes are written to the local case database before the editor closes. A successful message confirms the save. If browser storage is unavailable, the editor stays open, the prior inventory remains unchanged, and Thrive explains how to retry. Novice and Advanced mode use the same loaded inventory, so switching modes does not reload or replace these entries.

### Personal property and itemized portfolios

Asset categories include **Art**, **Boat**, **Computers & Electronics**, **Furniture**, **Jewelry** and **RV**. Asset/debt category menus are alphabetical, with **Other / Other Debt** separated at the bottom.

Investment Account and Retirement Account assets accept itemized stock, fund, option, bond, crypto, cash and other holdings. Supported symbols trigger name/price lookup; exchange is optional for listing verification. Current quotes refresh in editors and on entering Assets/Debts or Settlement, including retirement holdings. Quotes show their provider/time and remain separate from saved settlement values. Use **Use current price for this holding**, review the valuation and save to adopt a quote. Check the latest parsed statement for quantity/price/date differences. See [Portfolio guide](PORTFOLIO_GUIDE.md) for matching and pricing limits.

### Cryptocurrency holdings

Choose **Cryptocurrency** when adding an asset in either mode. Select a common coin or choose **Other coin / token** and enter a symbol. Record the quantity and either:

- use **Look up current price** for a timestamped USD market quote; or
- enter a manual USD price per coin for the valuation date.

Thrive calculates quantity × unit price and saves that dollar value as the asset value used by Dashboard, Reports, and Settlement. The quote is an estimate, not an appraisal. Refresh it or enter an agreed valuation-date price before final settlement calculations.

## 10. Discovery Manager

The current Discovery Manager is a command center, not only a form builder.

### Advanced mode tabs

- **Dashboard**
- **We Requested**
- **They Requested**

### What each side does

#### We Requested

Use this lane to:

- build outgoing Requests for Production
- finalize and export the request PDF
- track what the other side has produced
- prepare the existing Illinois Rule 201(k) follow-up template when that procedure applies

#### They Requested

Use this lane to:

- upload an incoming discovery request or Rule 201(k) notice
- let the AI parse it into checklist items
- track what you have produced
- send received production files directly to the Document Parser

Novice mode presents the same ideas as guided steps instead of dashboard lanes.

The generated Request for Production and Rule 201(k) follow-up are Illinois templates and currently
retain Illinois rule language regardless of the profile jurisdiction. Do not use those forms outside
Illinois without replacing the rule, caption, deadline, consultation/certificate language, and local
procedure. Even in Illinois, confirm the live rule, court order, service, privilege, protective-order,
and local-practice requirements before signing or sending anything.

## 11. Investigate

1. Open Investigate → Start & reports. Choose Start AI investigation to select the people/businesses, records, period and concerns, then review the scope and run the report. The wizard shows the existing credit requirement.
2. Automatic forensic checks run as parsed case records change. Run rules-based analysis creates a saved rules-only report when your tier includes it; it does not spend AI credits.
3. Open a saved report to Rename it or Download PDF. To prepare its AI findings together, choose Prepare findings for exhibits, then Review finding beside each result.
4. In Findings, choose Needs review or Reviewed. Filter by AI Red Flag findings / Structured findings, then spouses, businesses or individual names. Critical findings is a filter under Reviewed.
5. Read the title and observation, then choose Review finding. Appears in N reports opens the reports containing the finding; the original documents and transactions are inside the finding review.
6. For an individual AI finding, choose Prepare for exhibit. Thrive resolves exact cited bank/payment-app rows and checks matched business/personal transfer entries. A factual schedule or transfer observation becomes Ready for your approval. The original AI claim remains separately visible and is not established by this step.
7. If preparation cannot identify exact rows, read the specific explanation. Correct a missing reference, account owner or parsed value in the source record, or run a focused report with the correct records. Document-only, income-comparison and narrative claims require their appropriate supported comparison or professional review; Thrive does not guess supporting transactions.
8. Read the original files and retained page/transaction references. Close the source to return to the same finding. Individual source decisions are optional and do not substitute for approval of the overall finding.
9. In novice mode, choose Relevant — complete review, then Complete review. Professional views offer Confirmed or Qualified with a limitation note. Not relevant / Rejected sets the item aside. Follow-up decisions stay in Needs review. A positive completed review moves to Reviewed and Ready for an exhibit.
10. Choose Build the exhibit. Select the finding-specific visual, cited transaction table or source documents. Keep the supporting records attached. Choose an editable packet or create a new packet, check its label and description, then save. Wait for Exhibit created and the packet name.
11. Open Court Prep to finish the packet and export it. Preparation checks use no AI credits and do not change plan pricing or feature access. If the cited data changes, prepare and approve the current result again.

Similar AI red flags about the same issue are consolidated to reduce repetition while retaining source references, contrary evidence and gaps. Different subjects, years, monetary claims and distinct issues remain separate. **Appears in N reports** preserves report lineage; fewer visible items do not mean the record contains fewer source detections.

See [complete Investigate guide](INVESTIGATE_GUIDE.md) for readiness states and preparation limits. Existing tier access, subscription pricing and AI-credit requirements are unchanged.

## 12. Data Analysis

Data Analysis unlocks at **Personal Plus** and higher (the `forensicDashboard` feature). Administrators always have access. Tiers below Personal Plus see an upgrade prompt.

### Analytics tabs

| Tab | What it shows |
| --- | --- |
| Overview | Forensic Risk Pulse, marriage span, data coverage, document inventory, confidence score, income discrepancy, lifestyle analysis, risk intelligence, net worth, business-to-personal transfers, unconfirmed (one-sided) candidate distributions, and an **Income Sources** ledger per party. Business financials card appears here when a business scope is selected. |
| Cash Flow | Monthly cash flow pulse versus declared income, legal filing timeline markers, annual income comparison. |
| Spending | Category concentration, lifestyle pressure, source-precedence external P2P exposure, Cash App activity with internal wallet funding separated. |
| Assets & Debts | Estate composition, ownership breakdown, divisible-value ledger. |
| Business | Business summary, financial health, fraud highlights. In combined case view, a separate panel is shown for each registered business. |
| Transfers | Money-flow Sankey chart, transfer breakdown table, linked-account analysis. |
| Risk | Prioritized findings, dissipation heat matrix, forensic narrative. |

### Scope

Select Combined Case, Spouse 1, Spouse 2, or a specific business from the scope dropdown. All charts and calculations update immediately. The Business tab shows a panel per business when Combined Case is selected and multiple businesses are registered.

### What Data Analysis is best for

- forensic overview across a full case or focused on one party
- business-to-personal transfer review with per-business breakdowns
- **income by source** — the Income Sources card lists each party's received income grouped by type (payroll, bonus, side gig, interest/investment, owner distributions, candidate distributions, company-paid expenses, family support, and unverified wire/check/cash), with counts, totals, an annualized estimate, and declared-comparable / extra-income / unverified subtotals. Every deposit is counted once
- surfacing potential owner distributions even before the business statement is loaded (shown as "unconfirmed, one-sided" and never added to the confirmed distribution total)
- cash-flow trends versus declared income
- capital structure and divisible-value ledger for settlement
- money-flow visualization for exhibits or mediation packets

### Access note

Data Analysis can export the full Advanced analysis PDF. It can also package any visible chart or data card with user-selected supporting records, source citations, manifest, and exhibit list. The generated visual is analysis, not a source record, and does not receive a source-record Bates number. Every selected supporting PDF must have a locked range before exhibit export; native non-PDFs remain verified originals. Exact card source IDs are used where available, otherwise the active scope is proposed for human review. The module uses case data already stored by other workflows; review each visual and its source selection before use.

## 13. Settlement Agreement

Settlement Agreement supports both manual and AI-assisted workflows.

The worksheet header shows a snapshot of the net divisible marital estate value, how many items are allocated, and the current spouse 1 / spouse 2 split.

### Available actions

- manual worksheet planning
- AI settlement proposal from the selected spouse, legal-team, or neutral-professional perspective
- uploaded agreement Fairness Score and protective-term assessment
- equalization and support review
- PDF export

Worksheet allocation math is net-basis math: assigned assets minus debts assumed, plus or minus equalization. Equalization is treated as a transfer between parties. Partial worksheets do not silently split unassigned items; unassigned assets and debts are labeled until assigned.

The worksheet includes a multi-jurisdiction support-planning calculator, and the AI proposal prompt
calculates proposed maintenance and child support using recorded income, custody information, needs,
and configured state/country guidance. These are negotiation estimates—not an official worksheet or
court calculation. Preserve the inputs and assumptions and compare the result with the current official
calculator, statute, order, or qualified professional before relying on it.

The agreement review shows an AI-generated **Fairness Score** from the selected user's or neutral
professional's perspective. It considers the recorded inventory, selected analysis and findings,
configured state guidance, and agreement terms. It is a negotiation assessment, not a binding legal
determination or prediction of enforceability, tax treatment, or court approval.

### Access note

Manual planning is broadly available. AI planning-draft generation and agreement comparison are gated by plan tier and credit availability. All outputs require source and professional review before signing, filing, or relying on them.

## 14. Settings

The current Settings nav is:

- **Profile & Case**
- **Account Configuration**
- **People & Cards**
- **Subscription & Billing**
- **Configuration & Tools**
- **Danger Zone**

### Profile & Case

Use this section to update:

- your role
- your information
- spouse / opposing party information
- lawyer and forensic contacts
- jurisdiction and case metadata
- business records

### Account Configuration

Use this section to manage:

- account directory
- bank profiles
- cash platform profiles
- transaction categories

This is the right place to merge duplicate accounts and improve linked-transfer quality.

### Subscription & Billing

Use this section to:

- review the current plan
- upgrade or manage Stripe billing
- buy AI credit top-ups
- confirm whether a subscription is set to cancel at period end

### Configuration & Tools

Use this section to:

- switch Novice / Advanced mode
- set up, reconnect, or turn off **Automatic Local Backup** (below)
- generate an analysis-only (source documents stripped) export
- export your original documents as one re-importable **Source Document Archive**, or pick specific originals to download as a **ZIP**
- install the PWA when supported
- generate an anonymized demo file
- upgrade older case files to the account-directory format
- upgrade case files with clean document references
- export the audit-log PDF — this downloads through your browser's normal download location, not your Automatic Local Backup folder even if you have one configured; if nothing appears after exporting, check your browser's download settings or download history

#### Automatic Local Backup

Automatic Local Backup lets Thrive silently keep your case backed up to a folder on this computer, without you needing to remember to click Save Case. Once you grant a folder, Thrive periodically writes an updated backup file there while you work — the same combined case-plus-documents format Save Case produces (below). If Thrive can no longer reach the folder (for example, it was renamed or moved), Settings shows a "needs reconnect" status with a one-click way to pick the folder again. Settings also shows the name of the connected folder, so you can confirm where your backups are actually being written; browsers only share the folder's name, not its full location on disk, so the name may not be unique if you have more than one folder with the same name. This is separate from — and does not replace — **Save Case**, described below.

#### Source Document Archive & ZIP export

Save Case already includes your original documents (see below). These two options are for when you want just the documents on their own — to preserve or hand off originals separately, or to reattach documents to a case backup that's missing them (for example, an analysis-only export, or an older `.thrive` file from before combined backups):

- **Export Source Archive** downloads every original document as one `.thrive-archive` file you can re-import into this case later to reattach them.
- **Export Documents as ZIP** opens a picker so you can choose specific original documents and download just those, in their original format, as a ZIP. Unlike the archive file, a ZIP can't be re-imported back into Thrive.

### Danger Zone

Use **Reset Application** only after exporting a backup. It clears the local case dataset.

**Sign Out and Erase This Device** is a separate, more limited action: it signs you out and permanently deletes this case's local data from this browser, intended for shared or office computers where you don't want case data left behind. A normal sign-out does **not** delete your local case data — only this explicit option does.

### People & Cards

> **Joint accounts do not prevent analysis.** Thrive reconstructs the complete financial estate,
> identifies transaction users where the available records support attribution, separates
> business and employee activity from spouse spending, preserves shared and household expenses,
> and clearly identifies activity that remains unknown or disputed.

This section handles joint accounts, shared cards, and multi-employee business cards — cases
where knowing *which account* a charge sits in isn't enough to know whose charge it is.

The screen is organized as a short guided path: understand the four questions, confirm only the
people who appear on the records, then answer the card users that can affect joint or business
analysis. Dashboard and Verify Records show a task card when one of those answers is actually
needed and take you directly to the relevant step.

> **A spouse-only account does not require a card or extra person mapping for ordinary totals.**
> Explicit account ownership already identifies whose account the money came from. Mapping a
> card on that account is optional context unless other evidence conflicts. Joint, shared, and
> business accounts are different because the account alone cannot identify who initiated or
> benefited from the activity.

**Estate structure.** Describe how the couple organized money: mostly separate, mixed, mostly
joint, fully joint, unknown, or changed over time. This shapes which analyses Thrive suggests.
It never changes how an individual transaction is classified.

**People & Roles.** Everyone who might use a card, sign a check, or receive money — spouses,
employees, contractors, bookkeepers, children, third parties. For each person you can:

- Enter the name and role, and link an employee to a business
- Add alternate spellings ("LEE/CHRIS", "Doe, Jane") so statements match automatically
- Record employment or authorization dates — charges outside that window are **not**
  attributed to them and are flagged for review instead
- Mark someone confirmed or disputed
- Merge duplicates, which keeps existing attributions working rather than deleting history
- Deactivate someone without losing their historical charges

**Cards & Users.** Which card, wallet, checkbook, or handle draws on which account, and who
normally uses it. Cards found while parsing statements appear here automatically as unassigned.
For each card you can set the user, restrict the mapping to a date range, link a replacement
card after a reissue, or mark it shared, automated, unknown, or disputed. Conflicting
assignments are listed at the top of the section.

**Remove card** is offered only for a card the parsed statements do not cite. A card whose
number still appears on parsed transactions shows **On the statements, cannot remove** instead,
with the reason and the alternatives: if the number is not a card, mark those transactions "not a
card" in Card & User Review; otherwise use **Mark disputed** or **Mark user unknown**.

Deleting a cited card did not hold. The row was removed and saved, then the next discovery pass
found the suffix on the statements with no matching card and recreated it under a new identity
with no assignment, so removal looked broken. Discovery is right to do that: removing a directory
row does not remove the card from the evidence, and a forensic tool should not let a
filing-relevant card disappear from records that reference it.

For a card no statement cites, removal is clean. If any transactions still resolve to it you are
told how many before confirming, and those rows return to "unknown user" rather than losing
anything. People are deactivated rather than deleted, so a departed employee's historical charges
keep their attribution.

> **The rule that matters most:** assigning a card says **who used it**, not **whose spending it
> is**. Groceries or the mortgage bought on one spouse's debit card remain household expenses.
> Individual benefit is a separate decision, made during review, and it always requires you to
> name who benefited.

Charges Thrive cannot attribute stay visible and unassigned. Unknown activity is reported with
its own total and is never divided equally between the spouses — that unexplained total is
itself a finding, and it tells you what to ask for in discovery.

### Reviewing card and user questions

Once people and cards are set up, Thrive raises the questions it cannot answer on its own. It
only asks questions that are **answerable and consequential** — it stays silent about spending
from a spouse's own account, wire transfers with no card, matched internal transfers, and
ordinary household costs on a joint card, because something else already settles those.

**Novice Mode → Verify Records → Card & user review.** Each item is a *decision*, not a
transaction. A cardholder name appearing on 800 rows is one question, and answering it resolves
all 800. Every item shows which account the money came from and what the transactions actually
are, with three examples and a **Show all N transactions** list.

**Advanced Mode → Document Parser → Document Manager → Card & User Review.** The same queue and
the same component, with a count badge on the tab.

Three labelled controls, each with a heading that stays visible: **Who used the card**, **Who
benefited**, and **What was it for** (Mortgage or rent, Utilities, Children's education or
childcare, One person's personal spending, Business expense, … plus *Other (describe it)*).

Choosing a value does not apply it. You get an explicit confirmation stating exactly what will
happen and to how many rows — "Record Jordan Morgan as who benefited on 1,603 transactions
totalling $1,052,505.06. This will add that amount to their totals." Non-spouse choices say
instead that the amount is kept out of both spouses' totals.

Other actions: **This looks right**, **I can't tell** (stays visible, counts toward nobody),
**This is disputed** (flagged for follow-up, kept out of every total), and **Just add a note**.

### Assigning money from the transaction list

The queue only raises what its rules anticipate. When you already know the answer, both the
single-row editor and **Bulk Edit** carry an always-visible **Assignment** section with three
separate controls: **Earned or received by** (deposits), **Spent for** (spending — the one your
spending totals read), and **Paid by / card user** (spending — identifies who paid, and changes
nobody's total). Above them is a line saying what you have selected, for example "12 joint, 3
personal, 5 business".

Every control starts on **Leave unchanged** unless the rows you selected already share a
decision, in which case it opens on that decision so you can see it. **Nothing is recorded for a
control you did not move.** Correcting a category, a bank name or a year saves that correction
and nothing else: the rows stay on your review list, unassigned, exactly as they were. There is
no "use the account owner" option, because recording an account's ownership as a decision would
make it look like somebody had chosen it.

**Clear my choice** returns one answer to unknown *and* puts the record back on the review list,
with the change written to the audit log — so taking back an answer leaves the record genuinely
open, not quietly blank.

In Guided mode the transaction list carries a **Whose money** column instead. It states what
each record counts as today ("Joint spending · Not assigned to a person", "Shared household cost
(suggested)", "*Name*'s account", "Transfer between accounts", "Account owner not set") and puts
an **Assign person** button only on joint-account records, because those are the only ones with
an open question. The dialog asks exactly one thing — who earned a deposit, or whose spending a
payment was — and shows the card user, where the records establish one, as a line to read rather
than as a second question.

### Money leaving a joint account

An internal transfer only cancels out when Thrive has statements for **both** accounts. A
transfer, check, card payment, or cash withdrawal out of the joint account with no statement for
where it went is not a wash — it is money leaving the marital estate to somewhere nobody can
see, and a slow drain looks exactly like a run of ordinary transfers. These are raised at high
priority, ahead of every spending question. The explanation is often entirely innocent; the
point is that it gets established rather than assumed.

### Assigning benefit to specific transactions

The queue can only raise what its rules anticipate. When you know something the rules cannot —
that a particular check was one spouse's attorney fee, say — go to **Document Parser → Bank
Transactions** or **Credit Cards**, select the rows, and open **Bulk Edit**. The **"Who
benefited from this spending?"** control records the decision with the same audit trail as the
review queue.

### What every decision records

Your name, the time, what the value was before, what it is now, and your reason — with one
audit-log entry per changed transaction. Decisions survive re-parsing, export, and import.
Re-parsing refreshes what the statement *said*; it never overwrites what you *decided*.

### Asking for the records that answer the question

Some questions cannot be answered from the statements you have. A corporate card statement can
be complete for every month of the marriage and still never say which of eleven employees made
a charge.

**Discovery Manager → Request Library** now includes six groups of records that establish *who
used an account* rather than merely what it did:

| Group | What it asks for |
| --- | --- |
| Account Identity & Access | Opening documents, signature cards, authorized signers, online banking users |
| Debit, ATM & Wallet Instruments | Card issuance records, number-to-user mappings, replacement history, wallet tokens |
| Business & Corporate Cards | Cardholder rosters, card-to-employee mappings, issuance and cancellation dates, virtual and departmental cards |
| Charge Substantiation | Expense reports, receipts, reimbursements, merchant invoices, payroll detail |
| Transaction-Level Detail | ACH addenda, wire instructions, check images, P2P exports |
| Accounts the Ledger Points To | Statements for every card paid from, or account referenced by, a produced transaction |

**Document Parser → Coverage → Production Completeness** shows how complete the production is at
five levels: institution, account, payment instrument, cardholder, and monthly period. The rule
that matters: **a month is not marked complete while the card or cardholder detail inside it is
unresolved.** A produced statement whose charges name no card is *Instrument detail missing*,
not *Statement complete*.

Gaps are only reported where a question actually exists. A wire transfer has no card user, a
personal account has no employee roster, and an internal transfer has no beneficiary to
establish — so none of those is counted against completeness.

These gaps can flow into the existing **Rule 201(k) deficiency-letter template**. The template is
Illinois-specific and must not be treated as a neutral form for another jurisdiction. The gaps are
stated as factual observations about the records produced. The draft says what is absent and what
would resolve it. Characterizing an
absence — as a refusal, a concealment, or a sanctionable failure — is a legal conclusion, and
Thrive leaves that to you.

### Attribution and settlement

Attribution findings appear in the settlement worksheet as **Joint-Estate Adjustments**. Each
one shows three amounts:

- **Established by records** — what the documents actually support
- **In this scenario** — what your scenario uses, which is zero until you include it
- **Ceiling** — the upper bound if every unresolved item belonged to that adjustment

Every adjustment starts **excluded**. Nothing derived from the ledger enters a settlement figure
on its own. Including one at more than the established amount records it as an *explicit
assumption* rather than a proven amount, and exports say so.

Some things can never become an adjustment against a spouse: an employee's business-card charge,
an owner's unaccepted business expense, and activity nobody can place. Unresolved activity is
reported at full size, held out of the planning-comparison score, and can only enter a scenario if you
deliberately adopt it as an assumption.

**Lock this scenario** freezes what you argued and the basis for it. If attribution later
changes — you map a card, a new statement arrives — Thrive reports the difference as *drift*
against the locked version and leaves the locked figures alone. A number already served on the
other side does not quietly restate itself.

### Where each joint-estate surface lives

Everything below is **role-independent** — spouse, attorney, forensic accountant, and coach all
see the same surfaces. None of them require a particular scope or business filter to be selected.

| Surface | Novice | Advanced |
| --- | --- | --- |
| People & Roles, Cards & Users | Settings → Case Setup & Maintenance → People & Cards | same |
| Card & user review queue | Verify Records → Card & user review | Document Parser → Document Manager → Card & User Review |
| Production Completeness | — | Document Parser → Coverage |
| Instrument / User column, card views | — | Document Parser → Bank Transactions / Credit Cards |
| Estate scope by lane | Dashboard, and Reports → Case visuals | Dashboard, and Data Analysis → Reconciliation |
| Joint-estate charts (6) | — | Data Analysis → Reconciliation |
| Joint Estate Reconstruction Report | Reports → Case visuals | Data Analysis → Reconciliation |
| Joint-Estate Adjustments | Settlement → worksheet | Settlement → Worksheet |
| Discovery templates, 201(k) gaps | Evidence Requests → Request Library | Discovery Manager → Request Library |

**All of them are gated on the case having joint-estate data** — at least one mapped card, one
non-spouse person, or one reviewed attribution. Until then they render nothing at all, so an
existing case is visually unchanged. Auto-seeded spouses deliberately do not satisfy the gate;
every case gets those, and they answer no attribution question on their own.

### The Joint Estate Reconstruction Report

**Data Analysis → Reconciliation → Joint Estate Reconstruction Report** produces a 26-section,
source-linked reconstruction of the estate: scope, case dates, sources reviewed, missing records,
the account and cardholder maps, reconciliation, sources and uses of funds, household and
individual spending, business crossover, unknown transfers, cash, post-separation activity,
methodology, confidence definitions, limitations, discovery items, a per-transaction attribution
exhibit, and a source index.

Every statement is labelled with what it rests on — a **source fact**, a **calculation**, a
**review decision**, an **assumption**, or an **open question**. The panel shows that mix before
you export, because a report that is mostly "unresolved" is a different document from one that
is mostly "source fact", and you should know which you have.

Every attributed transaction traces to its source document, filename, hash, page number, and the
verbatim text it was read from, along with the instrument, actor, beneficiary, method,
confidence, reviewer decision, and rule version.

AI-written narrative, if present, is kept in its own section and clearly labelled. It can never
become a numbered finding, and where it differs from a numbered section, the section governs.

The report carries a tamper-evident SHA-256 over its content. Regenerating it from the same case
data at the same rule version produces the same hash. **It makes no claim as to admissibility in
any proceeding.**

> **For the full workflow**, including the order of work and how to read the results, see
> [UNTANGLING_JOINT_ACCOUNTS.md](UNTANGLING_JOINT_ACCOUNTS.md).

## 15. Header Actions

The main app header exposes:

- **Open Case**
- **Save Case**

### Open Case

- imports `.thrive` or compatible `.json`
- prompts before overwriting the current case
- validates the case-file hash before load
- asks for the password when opening a password-protected `.thrive` backup

### Register And Relink Folder

From **Clients & Cases**:

- **Register** links one visible case record to a `.thrive` file on this device.
- **Relink Folder** asks for access to a folder, scans `.thrive` files inside it, and links matching cases in bulk.
- Nothing is uploaded during registration or relinking. The browser file handle is saved only on your device.
- The shared network path and file fingerprint are stored with the Firebase case record so other organization members can find and validate the same file.

### Save Case

- exports a standard hashed `.thrive` backup by default
- can create a password-protected AES-256 encrypted `.thrive` backup for sharing or transport
- clears the manual-backup indicator after a fully confirmed save
- names the file from case number, date, and party names

Before export, Thrive finishes queued transaction changes and checks the asset/debt inventory. If browser storage cannot confirm every update, Save Case still creates a recovery-capable backup from the current on-screen case state, keeps the manual-backup indicator active, and displays a persistent storage warning. Keep that downloaded backup and reload before continuing. Export stops only when Thrive cannot read enough case data to build and validate a usable backup.

A `.thrive` file from Save Case includes your original uploaded documents along with your parsed case data — not just the data. Thrive builds this the same memory-safe way Automatic Local Backup does, adding documents to the file one at a time instead of loading them all at once, so this stays reliable even for cases with many large PDFs. The only export that leaves documents out on purpose is the analysis-only export in Settings → Configuration & Tools, for when you want a smaller file to share without the originals.

Thrive now tracks two things separately in the header:

- **whether your edits are safely stored** — this happens automatically, continuously, in your browser, and additionally to your Automatic Local Backup folder if you've set one up
- **whether you have a current portable Save Case download** — this only happens when you click Save Case yourself

If you haven't clicked Save Case recently, the header shows "Backup recommended" with the time of your last automatic local backup, instead of a generic "unsaved changes" warning. Signing out with a portable-save still pending asks whether you want to save first; an automatic local backup running in the background does not silently dismiss that prompt.

## 16. Security And Evidence Features

Current evidence-oriented safeguards include:

- local IndexedDB case storage, kept separate per signed-in account on a shared device
- SHA-256 hashed standard `.thrive` exports
- optional password-protected AES-256 encrypted `.thrive` exports
- source-file hashing during parsing
- preserved original-file downloads, backed by a dedicated source-document archive store
- certificate generation for originals
- audit-log export
- methodology statements on generated PDFs
- optional Automatic Local Backup that keeps a case-plus-documents copy current in a folder you control

### Practical evidence packet

For a disputed transaction, obligation, loan, or income claim, keep these together:

1. the original downloaded source document (Document Manager, or a Source Document Archive / ZIP export)
2. the source certificate from Document Manager
3. the `.thrive` case backup used to generate the report — a standard Save Case backup already includes the original documents alongside the parsed data
4. the audit-log PDF
5. the module PDF or spreadsheet export that cites the item
6. notes identifying who reviewed the source document and what still needs counsel/expert review

Important limits:

- A `.thrive` hash proves whether the exported case file changed after export; it does not prove that the user-supplied records are true or complete. Password-protected `.thrive` files add confidentiality for transport, but lost passwords cannot be recovered by Thrive.
- AI findings are prompts for review, not legal conclusions.
- Generated PDFs and reports should be checked against the original source files before they are shared with counsel, opposing parties, mediators, or courts.

## 17. AI Credits And Plan Gating

The app currently mixes plan allowances with top-up credits.

### What credits are used for

- document parsing
- focused investigation reports and optional comprehensive narrative
- AI settlement proposals
- AI agreement assessment

### Common locked experiences

- Investigations on lower tiers
- Data Analysis on lower tiers
- settlement AI on lower tiers

When a feature is locked, the sidebar or module shows an upgrade prompt instead of running the action.

## 18. PWA And Offline Behavior

The app currently includes:

- `manifest.json`
- `sw.js`
- install prompt handling

You can install the workspace from **Settings → Configuration & Tools** when the browser exposes the install prompt. Same-origin assets are cached, but Firebase, Stripe, and Gemini traffic still depends on network access.

## 19. FAQ

### Where do I update my case information?

Go to **Settings → Profile & Case**.

### Why does the Dashboard change when I switch roles?

The role selector changes how the same case data is organized. Attorney view emphasizes case readiness and deadlines. Forensic Accountant view emphasizes evidence, variance, findings, and money movement. Divorce Coach view emphasizes client readiness, education, notes, tasks, and questions. Spouse / Pro Se view emphasizes plain-language next steps.

### Where do Dashboard numbers come from?

Dashboard numbers come from parsed documents, Asset Manager, Discovery Manager, unified Investigations findings and saved Asset Tracer reports, settlement state, and coach workflow records. Empty cards usually mean the source data has not been added or does not match the selected scope/date range.

### How do I save divorce coach notes or client profile details?

Switch the Dashboard to **Divorce Coach**. Use **Client at a Glance**, **Add Coaching Note**, **Coaching Task**, **Client Question**, or **Readiness Check-In** from the dashboard sidebar. Those records are saved with the local case and included in `.thrive` exports.

### Where do I fix duplicate accounts or bank labels?

Go to **Settings → Account Configuration**.

### Can Document Parser read court orders or filed legal materials?

Yes. In Novice Mode upload the file in **Get Records**, choose **Filing or Email**, and confirm a subtype such as **Motion**, **Petition**, **Order**, **Affidavit**, or **Email Exchange**. Review the extracted details in **Filings and Emails** before relying on them. Advanced Mode uses the underlying Document Parser legal-document tools.

### Where do I buy more AI credits?

Go to **Settings → Subscription & Billing**.

### Where do I export the Activity Log?

Go to **Settings → Configuration & Tools → Audit Log**.

### What happens if I clear browser data?

You lose the local case copy. Export a `.thrive` file first.

For organization cases on a network drive, clearing browser data also removes this browser's saved file permissions. The case records still appear in **Clients & Cases**, but you must use **Register** or **Relink Folder** again before one-click opening works.

Turning on **Automatic Local Backup** (Settings → Configuration & Tools) protects against this: Thrive keeps a current case-plus-documents copy in a folder of your choosing, so clearing browser data does not mean losing your only copy.

### Thrive asked whether an existing case on this device was mine — what does that mean?

You signed in with an email Thrive hasn't seen on this computer before, and it found case data left behind (often from a previous sign-in). Thrive never merges that data into your new sign-in automatically — it asks first, so you can restore it if it's yours or start a clean, separate case if it isn't. Each signed-in account keeps its own separate local case data on a shared device.

### Why does Thrive warn me that my case is already open?

You (or someone else on this device) have the same case open in more than one browser tab at the same time. Working in two tabs at once can cause conflicting edits, so Thrive shows a warning asking you to continue in a single tab.

### Is this legal advice?

No. Thrive Financial is a financial-analysis and case-organization tool. AI outputs should be reviewed against the original source documents and, where appropriate, by legal or financial professionals.

### Is Thrive Financial storing my full case in the cloud?

No hosted Thrive case database stores the complete case dataset. The active case lives in browser IndexedDB. However, Firebase stores account and billing-related metadata, Stripe handles payments, and selected case content can be sent to Google Gemini when you use AI features.

### How do I get quick help while using a novice step?

Click the floating **?** button in the lower-right corner. It opens help for the screen you are on without leaving the workflow.
