# Thrive Financial Architecture README

> Current navigation and review periods: [Current views and workflows](CURRENT_WORKFLOWS.md) (reviewed October 27, 2026).


This document describes the technical architecture of the Thrive Financial codebase for architects, senior engineers, security reviewers, and platform maintainers. It focuses on system design, runtime boundaries, framework choices, data flow, fault tolerance, and operational integrations.

## Current review presentation and calculation lifecycle

`NoviceCaseDashboard` switches between `NoviceFinancialPicture` and its detailed role workspace; `NoviceDashboardControls`, `NoviceRoleSnapshot` and `summaryPresentation.ts` own compact presentation. Shared `FinancialReviewDownloads` calculates income only on request and exports existing scoped spending rows. `utils/spendingReview.ts` consumes reconciled cash-flow entries; `services/spendingReviewPdf.ts` renders text/vector output. `DashboardDateRange` buffers both endpoints atomically. Shared worker caches retain unchanged reference-based inputs across navigation; stale work is cancelled and never applied to a newer case. Large encrypted records decode through a queued local worker. Optional payroll code mounts only after opening the record-workspace panel. These changes retain local persistence, tier gates and deterministic number authority. See [performance details](PERFORMANCE_LOADING.md).

## Executive Summary

Thrive Financial is a local-first, browser-based financial case analysis application for divorce and forensic workflows. The authenticated product is a React + TypeScript single-page application built with Vite. The app stores full case data locally in IndexedDB, encrypts local records with Web Crypto when available, and uses Firebase for identity, authorization metadata, billing metadata, Cloud Functions, and operational ledgers. AI parsing and forensic report generation use Google Gemini through a Firebase Cloud Function proxy so model keys never reach the browser. Stripe handles payments through hosted Checkout and subscription lifecycle webhooks, with Firebase custom claims and Firestore metadata driving product access.

The core architectural split is:

- Browser: UI, case workspace, local IndexedDB case storage, deterministic analytics, PDF generation, and orchestration.
- Firebase Auth / Firestore: identity, roles, tier claims, usage counters, org metadata, case index metadata, brand kits, audit/event ledgers.
- Firebase Cloud Functions: privileged server boundary for Stripe, Gemini, role claims, AI credit debits, lifecycle jobs, and timestamping.
- Stripe: hosted checkout, subscriptions, one-time purchases, portal, and payment lifecycle.
- Gemini: document extraction, report synthesis, settlement analysis, discovery parsing, and other AI workflows.

## Languages And Runtime

| Layer | Choice | Why |
|---|---|---|
| Frontend language | TypeScript | The app has complex financial, legal, and document-domain data structures. TypeScript gives compile-time shape checks for case records, parsed documents, reports, tier gates, and Cloud Function payloads. |
| UI runtime | React 18 | The product is highly interactive and stateful: uploads, review tables, dashboards, charts, modals, wizards, and report surfaces. React's component model fits long-lived client state better than server-rendered request pages. |
| Build tool | Vite | Vite provides fast local development, simple static hosting, multi-page entry support, and Rollup chunk control without requiring a Node application server. |
| Cloud Functions | TypeScript on Node.js 20 | Server logic stays in the same language family while running in a managed runtime close to Firebase Auth and Firestore. |
| Storage APIs | IndexedDB, Firestore, browser File APIs | Case evidence remains local-first in IndexedDB; Firestore stores account and operational metadata; File APIs support import/export and document upload workflows. |

## High-Level Runtime Topology

```text
Browser React App
  |
  |-- IndexedDB: local encrypted case workspace
  |-- Firebase Auth: identity, sessions, custom claims
  |-- Firestore: role, billing, org, audit, usage metadata
  |-- Firebase Functions:
        |-- callGemini -> Google Gemini API
        |-- createCheckoutSession / billing functions -> Stripe API
        |-- deductAiCredits -> Firestore usage ledger
        |-- role/admin/beta/presence/timestamp functions
  |
  |-- Stripe hosted pages: Checkout and Billing Portal redirects
```

## Application Architecture

The app shell starts at `index.tsx` and `App.tsx`. Vite is configured as a multi-page app: `index.html` is the public/marketing surface and `app.html` is the authenticated application shell.

There is no React Router. Navigation is app-state driven through the `activeView` value in `types.ts` and the global Zustand store in `store.ts`. `App.tsx` switches between lazy-loaded feature modules:

- `modules/StatementAnalyzer` for document ingestion and AI parsing.
- `modules/Investigations` for the canonical Start & reports / Findings workspace with separate Court Prep, shared finding projection, and contained finding-to-packet exhibit builder.
- `modules/FraudFinder` for the Asset Tracer focused-AI and deterministic comprehensive-analysis engines, historical report storage, aggregation, and PDF output consumed by Investigations.
- `modules/AssetManager` for assets, debts, income, children, and settlement inputs.
- `modules/SettlementAgreement` for proposal and agreement workflows.
- `modules/DiscoveryManager` for discovery requests and responses.
- `modules/DashboardLanding` and `modules/ForensicDashboard` for cross-module analytics.
- `modules/Settings`, `modules/Admin`, `modules/ClientsCases`, and `modules/OrganizationTeam` for account, admin, and multi-client workflows.

### Why React Instead Of Next.js

React + Vite is the better fit for this repository because the authenticated product is not primarily a server-rendered content site. It is a local-first, client-heavy workspace that must keep large case datasets, parsed transactions, document-derived entities, and analysis state in the browser.

Next.js would add server-rendering and server routing that are not central to the product's main workload. The existing architecture avoids a long-running app server, keeps deployment static-friendly, and uses Firebase Cloud Functions only for privileged operations. This reduces hosting complexity and keeps the sensitive case workspace local.

### Why TypeScript Instead Of Python

Python would be strong for back-office data science, but this application is an interactive browser product. TypeScript lets domain models be shared across UI components, client services, and Firebase function payloads. It also avoids impedance mismatch between client records and server call contracts. Deterministic forensic logic can run in-browser without a Python service that would centralize case data.

Python remains a possible future fit for offline batch analytics or model evaluation tooling, but it is intentionally not the core runtime for the product shell.

## Micro-UI And Frontend Design Architecture

The UI is a modular composition of:

- Shared shell components: `Header`, `Sidebar`, `NotificationToaster`, `ModuleErrorBoundary`, help surfaces, paywall/credit modals.
- Shared primitives and headless UI dependencies: Radix UI components, custom icon sets, lucide icons where used, charting via Recharts.
- Domain-owned module components under `modules/<FeatureName>/components`.
- Tailwind-style utility classes and design tokens such as `brand-purple`, `text-text-main`, `dark:*`, card backgrounds, borders, and spacing.
- Report/PDF rendering services that use React components offscreen, `html2canvas`, and `jsPDF`.

The "micro-ui" pattern is module-scoped rather than package-scoped: each feature owns its dense workflow UI, while shared shell and primitives live under `components/`. This keeps forensic, discovery, settlement, and asset workflows cohesive without forcing a monolithic design-system abstraction too early.

## State Management

Global application state is centralized in `store.ts` using Zustand. The store holds:

- Active view and app status.
- Parsed document state.
- Asset, debt, income, child, profile, and settlement state.
- Fraud reports and comprehensive analysis results.
- Discovery state.
- Data visualization layout.
- Notifications and audit log actions.
- Persistence actions that coordinate with `services/dbService.ts`.

### Why Zustand Instead Of Redux

Zustand is a good fit because this app has a large, local-first state graph but does not need Redux's action/reducer ceremony. Store actions can directly orchestrate IndexedDB persistence, AI calls, credit checks, and notifications. That is useful for workflow-heavy features such as parsing, report generation, imports, exports, and batch updates.

The tradeoff is that `store.ts` is a coupling hotspot. The repo map calls this out explicitly. New domain flows should prefer module-local stores or local hooks when the state does not need to be shared globally.

## Data Storage Architecture

### Local Case Storage

Full case work product is stored in browser IndexedDB through `services/dbService.ts`. The database includes stores for assets, debts, income, settlements, parsed statements, affidavits, legal documents, tax returns, Cash App histories, business financial documents, account directories, forensic reports, discovery records, audit logs, and visualization layouts.

Records written through `dbService` are encrypted at rest when Web Crypto is available:

- `services/dbEncryption.ts` generates a non-extractable AES-256-GCM device key.
- The key is stored in a separate IndexedDB keystore through structured clone.
- The record key path (`id` or `email`) remains plaintext so IndexedDB can address records.
- Legacy plaintext records are tolerated and re-encrypted on future writes.

### Case File Export

Case exports support password-protected `.thrive` containers:

- `utils/secureFile.ts` uses PBKDF2-HMAC-SHA256 with 310,000 iterations.
- Payload encryption uses AES-256-GCM.
- The encrypted payload includes a SHA-256 ciphertext hash.
- Export provenance can include RFC 3161 trusted timestamp metadata when reachable.

### Cloud Metadata Storage

Firestore stores account and operational metadata, not the complete local case evidence database. Key collections include:

- `userRoles`
- `usage_counters` and `usage_counters/{uid}/creditTransactions`
- `customers/{uid}` for Stripe extension data
- `products` and nested `prices`
- `ai_usage_log`
- `organizations`, `memberships`, `orgAuditEvents`
- `caseIndex`
- `brandKits`
- `presence`
- `app_config`, `beta_allowlist`, and release note metadata

### Why IndexedDB Instead Of A Central Case Database

The product handles sensitive personal financial evidence. Local-first IndexedDB reduces central data custody and lets users work with large parsed case datasets without constantly round-tripping to a server. Firestore is still used where cloud coordination is required: identity, billing, org metadata, role claims, usage ledgers, and case index metadata.

The tradeoff is device locality: users must export/import or link local case files when moving devices. The architecture accepts that tradeoff to minimize hosted case-evidence storage.

## Firebase Architecture

Firebase is used for:

- Authentication via Firebase Auth.
- Firestore for roles, billing metadata, org metadata, usage counters, presence, and audit ledgers.
- Cloud Functions for server-authoritative operations.
- Firebase emulators for local Auth, Functions, Firestore, and Hosting workflows.

`firebase.js` initializes `auth`, `db`, and `functions`. Production auth uses the custom domain `thrivefinancial.app` so redirect handlers share origin with the app.

### Firestore Rules

Firestore rules enforce:

- Users can read their own user role and usage metadata.
- Sensitive collections such as `userRoles`, `usage_counters`, and credit ledgers are not writable by clients.
- Admins can read operational ledgers.
- Stripe customer subcollections follow the Firebase Stripe extension shape.
- Products and prices are publicly readable.
- Organization and membership data is scoped to owners/members/admins.
- Audit entries are append-only where client creation is allowed.

### Why Firebase Instead Of A Custom Backend

Firebase gives this product a managed identity, rules, metadata database, callable functions, scheduled functions, and local emulators without maintaining a separate API server. That is aligned with a static-first React app whose server needs are privileged operations rather than general CRUD over case evidence.

A custom backend would be justified if the product moved toward centralized case collaboration, server-side analytics, or strict enterprise tenancy controls. The current design keeps the backend intentionally narrow.

## Authentication And Authorization

Authentication is Firebase Auth. Authorization combines:

- Firebase custom claims: `role`, `stripeRole`, and `full_access`.
- Firestore mirrors in `userRoles/{uid}`.
- Stripe-derived product roles.
- App-level tier feature mapping in `src/config/tierFeatures.ts`.
- View gating through `TierGate` and `useTierAccess`.

Cloud Functions manage claims:

- `onUserCreated` initializes new users and makes the first user an administrator.
- `claimMyRole` migrates existing Firestore role records into custom claims.
- `syncMyRoleToStripeTier` mirrors Stripe role claims into the app role model.
- Admin functions set roles, full access, credit limits, and billing controls.

The app also writes presence/session tokens to detect concurrent sessions and can show a concurrent-session modal when another login supersedes the current session.

## Billing And Stripe Architecture

Stripe is the payment processor. The implementation follows a hosted Checkout + Billing model:

- `services/checkoutService.ts` calls Cloud Functions, not Stripe directly.
- `createCheckoutSession` creates Stripe Checkout Sessions on the server.
- Recurring tiers use Checkout Sessions in `subscription` mode.
- One-time tiers and credit top-ups use `payment` mode.
- Stripe customer IDs are linked under `customers/{uid}` so Firebase Stripe extension data maps back to Firebase users.
- `customers/{uid}/subscriptions` drives subscription lifecycle.
- `customers/{uid}/payments` drives one-time purchases and AI credit top-ups.
- `createBillingPortalSession` supports Stripe-hosted customer portal access.

The tier model is defined in `src/config/stripe.ts` and `src/config/tierFeatures.ts`:

- `starter`
- `personal_case`
- `personal_plus`
- `professional`
- `firm`

### Why Stripe Checkout Instead Of A Custom Payment Form

Stripe Checkout keeps card entry, PCI-sensitive payment UI, payment method handling, coupons, and subscription setup on Stripe-hosted pages. This is lower risk and lower maintenance than building a custom Payment Element flow. The product needs reliable subscription/tier state more than bespoke checkout UX.

### Why Billing APIs Instead Of Manual PaymentIntents

Subscriptions require renewals, status changes, cancellations, retries, dunning, and portal workflows. Stripe Billing and subscription objects handle that lifecycle. Manual PaymentIntent renewal logic would be brittle and easy to double-charge or under-entitle users.

## LLM Architecture

Gemini powers AI-assisted workflows for:

- Statement parsing.
- Affidavit, legal document, tax return, Cash App, and business document parsing.
- Focused Asset Tracer report generation and optional narrative over deterministic Comprehensive Analysis findings.
- Settlement proposal and agreement analysis.
- Discovery request parsing.
- Comprehensive layered report synthesis.

Deterministic record coverage, balance continuity, transfer/card-funding matching, reconciliations,
the standing Findings Program, Comprehensive Analysis calculations, review decisions, Bates
allocation, finding-dependent demonstrative selection, and exhibit packaging do not depend on an AI
conclusion. Investigations projects both rules-based results and AI-assisted red flags into one
labelled review model. A generated demonstrative persists its versioned rows, displayed-row IDs,
evidence roles, methods, limitations, and source-record IDs; Court Prep reproduces that definition
and exports a selectable-text data/method appendix while retaining the manual live-card workflow. See
[AI and Forensic Analysis](AI_AND_FORENSIC_ANALYSIS.md) for the app-wide authority boundaries and
[Investigations Workspace Architecture](INVESTIGATIONS_ARCHITECTURE.md) for the projection and
direct packet-persistence contracts.

All Gemini requests route through the `callGemini` Cloud Function:

- The browser constructs structured prompts and schemas.
- `services/geminiService.ts` invokes the callable proxy.
- The Cloud Function authenticates to Vertex AI using its runtime service account; no Gemini provider key is required. Project comes from `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT`; optional server-only `VERTEX_AI_LOCATION` defaults to `global`.
- Token usage is returned and logged to `ai_usage_log`.
- AI credit consumption is handled separately by `deductAiCredits` after successful operations.

### Why Gemini Through Cloud Functions Instead Of Browser API Keys

The browser is not a safe place for model API keys. Routing through Cloud Functions lets the app keep secrets server-side, enforce authentication, perform tier gating, set timeouts/memory, and centralize usage logging.

### Deterministic + LLM Pattern

The architecture intentionally mixes deterministic analytics with LLM synthesis:

- Deterministic services normalize transactions, classify transfers, detect P2P pass-throughs, calculate cash-flow summaries, and build rule-based findings.
- LLM calls parse unstructured documents and produce narrative reports under strict schemas.

This reduces the risk of using an LLM as the sole source of financial truth. The model is used where language and extraction are useful; deterministic code is used where repeatable math and classification matter.

## Joint And Commingled Estate Model

Joint accounts, shared cards, and multi-employee business cards break the assumption that an
account identifies whose money moved. The joint-estate layer separates concepts the original
model collapsed into one.

**Governing rule.** Account ownership identifies the financial container. A card, debit
instrument, employee name, check, wallet, or credential may identify the likely transaction
*initiator*. Neither fact alone establishes the economic beneficiary, transaction purpose,
marital character, business purpose, or legal significance.

**Independent axes**, each with its own confidence and review state, defined in
`modules/StatementAnalyzer/jointEstateTypes.ts`:

| Axis | Question | Type |
| --- | --- | --- |
| Actor | Who initiated it? | `FinancialActor` reference |
| Instrument | What was used? | `PaymentInstrument` reference |
| Beneficiary | Who benefited? | `BeneficiaryType` |
| Purpose | Household or business? | `TransactionPurposeClass` |

**Modules**

| File | Responsibility |
| --- | --- |
| `modules/StatementAnalyzer/jointEstateTypes.ts` | Type definitions for the whole layer |
| `utils/jointEstate.ts` | Compatibility accessors, rule version, date windows |
| `utils/financialActors.ts` | Actor directory: aliases, dates, business links, merges |
| `utils/paymentInstruments.ts` | Instrument directory: assignment, windows, replacements, conflicts |
| `utils/attributionEngine.ts` | Pure deterministic engine (initiator only), review queue, coverage |
| `utils/instrumentDiscovery.ts` | Parser output → instrument directory, without overwriting reviews |
| `utils/businessCardAttribution.ts` | Actor-aware business classification and analytics |
| `utils/jointAccountAttribution.ts` | Household vs individual benefit, perspectives, reconciliation |
| `utils/attributionPresentation.ts` | Grid cell, badges, tooltip, filters, saved views, export columns |
| `utils/attributionReview.ts` | Review queue, decisions with provenance, bulk actions, novice copy |
| `utils/estateScope.ts` | Lane assignment, estate rollup, spouse outflows, ledger reconciliation |
| `utils/jointEstateAnalytics.ts` | Coverage breakdowns, exposure metrics, headline figures, status labels |
| `utils/jointEstateInvestigations.ts` | Deterministic finding templates with full evidentiary structure |
| `utils/discoveryCoverage.ts` | Five-level production completeness and deficiency items |
| `modules/DiscoveryManager/jointEstateRequests.ts` | Discovery templates for account access, cards, and rosters |
| `utils/settlementAdjustments.ts` | Adjustment states, inclusion decisions, scenario versions, drift |
| `utils/jointEstateReport.ts` | The 26-section source-linked reconstruction report |

**Scope calculations (Prompt 11).** `estateScope.ts` assigns every outflow to exactly one of
nine mutually exclusive lanes (`internal_transfer`, `household`, `spouse1_individual_benefit`,
`spouse2_individual_benefit`, `other_beneficiary`, `employee_business`, `owner_business`,
`business_operating`, `unresolved`). Because the lanes are exclusive, they sum to the ledger,
and `reconcileEstateRollup()` proves no dollar was double-counted or dropped.

Lane order encodes the domain rules: transfers leave first, so they net to zero and are never
also counted as income; a *confirmed beneficiary* then decides the lane — read from
`beneficiary`, never from `actorId`, which is what stops the card user becoming the person who
benefited; household beats everything else, so groceries on one spouse's debit card stay
household; only then does business-card role matter, keeping employee and owner activity out of
spouse spending unless a benefit was accepted with a named beneficiary.

`computeSpouseLifestyle()` admits exactly three sources: personal-account spending, accepted
individual-benefit spending from joint accounts, and accepted company-paid personal benefits.

**This module is additive and not yet wired into any dashboard.** It exists so the new figures
can be proven against the ledger before any vetted number is repointed at them. The
reconciliation suite in `estateScope.spec.ts` is organised by the ten requirements and is the
gate for that rewiring.

**No data migration.** New fields are optional and absent on legacy records. Readers go through
`getTransactionAttribution()` and `getAccountOwnership()`, which resolve an absent value to an
explicit `unknown`. Legacy `.thrive` files round-trip byte-identically and can never gain an
invented attribution. `AccountProfile.ownerType`/`ownerSpouse` remain authoritative for every
pre-existing selector.

**Evidence ladder.** The engine ranks evidence (human-confirmed mapping → printed cardholder
name → instrument last four → named check → named P2P → ACH/wire originator → expense document
→ corroboration → pattern → none). Only a human-confirmed mapping can reach `confirmed`; weak
signals cap at `suggested`, which never feeds a financial total. Conflicting evidence is
preserved as alternatives rather than resolved. Every result records its method, evidence, and
`ATTRIBUTION_RULE_VERSION`, so a re-run is provably reproducible.

**Discovery coverage (Prompt 14).** `discoveryCoverage.ts` evaluates completeness at five
levels — institution, account, payment instrument, cardholder, monthly period — and rolls each
up so a parent is never rated better than its worst child. That roll-up is what enforces the
governing rule: *a monthly statement is not complete while the card or cardholder detail inside
it is unresolved.* Gaps carry a `DiscoveryGapKind` that resolves to the request templates in
`modules/DiscoveryManager/jointEstateRequests.ts`, so an open item names its own remedy.
Deficiency text is descriptive by construction — it states what the records show and stops
there, because characterizing an absence is a legal conclusion.

Statement-date and month-range primitives (`parseStatementDate`, `statementCoversMonth`,
`buildMonthRange`) live here and are imported by the Document Manager's calendar grid, so the
grid and the completeness analysis cannot disagree about what a month covers.

**Settlement adjustments (Prompt 15).** `settlementAdjustments.ts` derives candidate adjustments
from the same lanes the dashboards use. Every candidate carries three amounts — established,
in-scenario, and the ceiling if all unresolved activity belonged to it — and **starts excluded
from the scenario.** Including one above the established amount records it as
`included_as_assumption` rather than `proven`. Unresolved activity is excluded from fairness
scoring and can only enter as an explicit assumption. `lockScenarioVersion()` deep-freezes a
scenario; `detectScenarioDrift()` reports how the current attribution differs from it and never
mutates it, so re-reviewing a card months later cannot silently restate a served figure.
Decisions persist on `Settlement.jointEstateAdjustments`; the candidates themselves are
re-derived from the ledger on every render, so a stored figure cannot go quietly stale.

**Reconstruction report (Prompt 16).** `jointEstateReport.ts` builds 26 numbered sections plus a
traceable exhibit and source index. Every statement carries a required `ProvenanceKind` —
`source_fact`, `deterministic_calculation`, `human_review_decision`, `ai_narrative`,
`assumption`, or `unresolved_issue` — so a reader can tell what a line rests on. Model output is
held in a separate `narrative` field and never becomes a numbered section. `canonicalPayload`
excludes `generatedAt`, so regenerating the report from the same case at the same rule version
produces the same content hash. `services/pdfService.ts` renders it with autoTable rather than
html2canvas, keeping a multi-thousand-row exhibit fast and text-searchable.

**Persistence.** IndexedDB `DB_VERSION = 22` adds `financial_actor_directory` and
`payment_instrument_directory`; `estateStructure` lives in `app_meta`. All three are included in
case export/import and default safely when absent. Prompts 14–16 add **no** new object stores:
coverage and the report are derived on demand, and settlement adjustment decisions ride inside
the existing `settlements` blob as optional fields.

**The 30-point integration contract.** `utils/jointEstateIntegration.spec.ts` builds one
realistic commingled estate and asserts all thirty properties from Prompt 17 against it, using
the specification's own numbering so a failure names the requirement it violates. Three of the
thirty cannot be fully established by a unit test — encrypted backups, WCAG conformance, and
where evidence physically lives — and are tested at the point a regression would originate: the
serialization round-trip, the status vocabularies that must never rely on colour alone, and a
static check that no joint-estate module imports a network or Firebase surface.

## Standing Findings Program

`hooks/useFindingsProgram.ts` derives one cached report from the current Zustand record set.
`services/findingsProgramService.ts` adapts the existing deterministic comprehensive engine plus
card-funding, balance-continuity, missing-month, and distribution checks into the catalogue in
`utils/findingsProgram.ts`. Results are not persisted because deleting or reparsing a source must
immediately change the derived result; reviewer decisions are persisted separately.

The status invariant is strict: `clear` requires both satisfied record requirements and an explicit
`examinedByCode` scope from the detector. Missing inputs, planned tests, partial coverage, detector
failure, or an unusable comparison scope all return `not_run`. A detector exception therefore cannot
turn into a clean result. Filing-relative rules use the configured dissolution filing date, falling
back only to a dated petition; separation remains a distinct event anchor.

`FindingDecisionControls` stores reviewed/not-issue decisions beside deterministic results. Active
dashboard and ledger counts exclude `not_issue` findings, while the ledger retains a reversible
set-aside section. The decision record is included in normal case backup/import and removed from
obfuscated demo exports because notes and snapshots may contain case-sensitive text.

## AI Credits And Usage Control

AI usage is gated by plan limits and top-up credits:

- `services/aiCreditGate.ts` performs client-side preflight reads from `usage_counters/{uid}`.
- Successful AI workflows call `deductAiCredits`.
- Firestore rules block direct client writes to counters.
- `deductAiCredits` uses the Admin SDK and Firestore transactions to debit plan credits first, then top-up credits.
- Every credit debit or purchase creates a ledger row.
- Full-access users bypass credit limits but still get ledger tracking.

This split provides optimistic UX while preserving server-authoritative mutation of billable state.

## Auditing, Logging, And Provenance

The app has multiple audit surfaces:

- Local case audit log in IndexedDB through `dbService.addAuditLogEntry`.
- Organization audit events in Firestore through `logOrgAuditEvent`.
- AI token/cost logs in `ai_usage_log`.
- Credit transaction ledgers under `usage_counters/{uid}/creditTransactions`.
- PDF export provenance with SHA-256 hashes and optional RFC 3161 timestamp records.
- Case export logs with hashes and encryption details.

Local audit entries cover document parsing, imports, exports, transaction edits, account merges, report generation, discovery actions, profile updates, and reset operations. Organization audit logging is best-effort and intentionally does not block local case work.

## Fault Tolerance And Resilience

Key resilience patterns:

- Lazy module loading with `lazyWithReload`; stale chunk failures after deployment trigger one guarded full-page reload.
- `ModuleErrorBoundary` contains feature-level render crashes and offers a reload path.
- IndexedDB `onversionchange` closes the database and reloads to avoid stale schema conflicts across tabs.
- Read-only demo/minimized modes prevent writes to local case stores.
- AI workflows use payload sizing, batching, retries, and partial-analysis warnings when model context or API limits are hit.
- Stripe payment and credit webhooks are idempotent by ledger/payment document IDs.
- Subscription lifecycle functions include grace periods, scheduled downgrade processing, cancellation-at-period-end state, and renewal handling.
- Billing client code guards against duplicate subscriptions by forcing recurring-to-recurring changes through in-place plan changes.
- Firestore rules make sensitive ledgers immutable from the client.
- PDF provenance logging is fire-and-forget so report downloads are not blocked by timestamp service availability.
- AI usage logging is fire-and-forget so model operations do not fail merely because telemetry logging fails.

## Security Boundaries

Important trust boundaries:

- Browser owns full local case workspace but cannot mutate privileged billing/credit records directly.
- Cloud Functions own Stripe secret, Gemini secret, custom claim mutations, and credit ledger writes.
- Firestore rules enforce user/admin/org visibility for metadata.
- Stripe hosts card entry and subscription/payment lifecycle.
- Gemini receives selected case content only when the user runs AI workflows.

Sensitive caveat: this is local-first, not offline-only. AI, auth, billing, email, timestamping, and operational metadata require network services.

## Reporting And PDF Architecture

PDF generation is client-side:

- `services/pdfService.ts` uses `jsPDF`, `html2canvas`, and offscreen React rendering.
- Shared PDF theme logic lives in `services/pdfTheme.ts`.
- Export style is tier-aware: watermarked, clean, custom branding, or firm branding.
- Brand kit metadata can customize exported PDFs.
- Generated PDFs are hashed and logged for provenance.

Client-side PDF generation keeps case evidence in the browser and avoids a server-side report renderer that would receive complete case documents.

## Bates Production Architecture

Novice, Advanced, and exhibit-local numbering are presentation layers over one production
transaction:

```text
Novice: Document Library → Number Documents ───────┐
Advanced: Document Manager → Create Production ────┤
Court Prep / visual export → InlineBatesNumbering ─┘
       → selected, still-unnumbered PDF source ids only
       → store.createBatesProduction
       → resolve archived source bytes
       → services/batesProductionService.ts
       → verify source SHA-256 + count real PDF pages
       → allocate one non-overlapping sequence + stamp + hash derivatives
       → build ZIP (PDFs + CSV + manifest + README)
       → dbService.commitBatesProduction (one IndexedDB transaction)
       → update documents + event + prefix high-water mark
       → download ZIP
```

The presentation layers are `modules/StatementAnalyzer/NoviceBatesProduction.tsx`,
`modules/StatementAnalyzer/components/DocumentManager.tsx`, and the compact embedded form
`modules/CourtPrep/components/InlineBatesNumbering.tsx`. The embedded form appears after an
exhibit's associated-record selector and inside `VisualExhibitAction.tsx`, so numbering does not
discard an in-progress exhibit. All call `store.createBatesProduction`; none owns allocation or
stamping rules.

`utils/batesProduction.ts` owns production validation, allocation, filenames, CSV/manifest data,
and package instructions. `services/batesService.ts` counts and stamps PDF pages.
`services/batesProductionService.ts` orchestrates the complete in-memory package, and
`services/dbService.ts#commitBatesProduction` is the atomic persistence boundary. A source that
fails verification is set aside rather than failing the whole batch — see
`SkippedProductionSource` in `services/batesProductionService.ts`.

Core production invariants:

- a source PDF must have preserved bytes and a saved SHA-256 hash, and the bytes must match it;
- each source can appear only once in an event, and only actual PDF page counts allocate numbers;
- the producing-party prefix is alphanumeric and the configured six-digit sequence cannot overflow;
- a range cannot overlap a live document or fall at/below the saved prefix high-water mark;
- no live case field changes until all PDFs, hashes, CSV, manifest, README, and ZIP exist;
- the documents, named event, and high-water mark commit atomically;
- every event document receives a permanent `batesLock.productionId`; it cannot be renumbered,
  unlocked, or deleted through the application; and
- full case backup/import carries both `batesProductionEvents` and the registry, including retired
  ranges that no current document occupies.

Court Prep adds a caller and service invariant: a draft may reference an unnumbered PDF, but the
packet cannot move to `ready` and an exhibit cannot export until every selected PDF source has both
a valid range and `batesLock`. The UI computes that subset per exhibit and sends only the still-
unnumbered PDFs to `InlineBatesNumbering`. `services/exhibitPackageService.ts` repeats the check so a
new or alternate caller cannot bypass it. Native non-PDF records bypass the PDF-only gate because
they have no pages to stamp; they remain hash-verified originals.

The CSV intentionally implements a safe general index rather than pretending to satisfy every ESI
protocol. It contains the common core plus original and derivative traceability fields, and escapes
spreadsheet-formula-shaped values. Exact user values remain in the JSON manifest. Native-file
productions, family relationships, DAT/Opticon formatting, privilege logs, confidentiality markings,
and jurisdiction-specific fields remain protocol decisions outside this generic PDF workflow.

Source records and generated analysis remain distinct. Source PDFs receive Bates page addresses.
Exported charts/cards, user uploads, and generated transaction summaries retain their own hash/provenance,
exhibit label, and citations back to source documents/pages; they never enter the source-record
production sequence automatically.

## Exhibit Set And Single-Visual Export Architecture

Exhibits use a proceeding-scoped many-to-many model rather than the legacy one-label-per-document
field, and live in their own module (`modules/CourtPrep/`, not nested inside Statement Analyzer):

```text
Sidebar → Court Prep (both modes) ─────────────────────┐
Advanced: Document Manager → Build Exhibit Set ────────┤  (opens the same workspace as a modal,
                                                         ├─ CourtPrep.tsx  preloaded with the selection)
Court Prep → open Dashboard / Reports in selection mode ┤
       → DashboardExhibitPicker → VisualExhibitAction ─┘
       → ExhibitSet / ExhibitGroup / ExhibitItem
       → store.upsertExhibitSet → IndexedDB app_meta.exhibitSets
       → choose contentKind
           ├─ thrive-visual → saved report or live-card configuration
           ├─ custom-upload → preserved uploaded bytes + hash
           ├─ transactions → saved ids → generated row-cited PDF + XLSX at download
           ├─ documents → primary source records
           └─ other → described item + associated records
       → derive required sources; auto-select known report/transaction sources
       → require locked Bates range for every PDF source
           └─ InlineBatesNumbering → atomic range/event lock; no download
       → Save configuration: persist references only; never render
       → Export: build primary PDF/file where applicable
       → createVisualExhibitPackage
           └─ repeat PDF lock gate + verify every source SHA-256
       → ZIP (primary + transaction XLSX when applicable + stamped PDF sources/native originals + CSV + manifest + README)
```

`modules/CourtPrep/exhibitTypes.ts` defines the durable model. One `ExhibitSet` records a
petition, motion, hearing, deposition, discovery response, settlement conference, trial, or other
proceeding. Its `ExhibitGroup` owns the proceeding-local label and durable `purpose`; the UI's
`contentKind` remembers which of five tailored builders must reopen. Items may reference documents,
reports, generated visuals, user uploads, or transaction-summary selections; a document item is
explicitly primary or supporting. Thus one label can cover a visual and four supporting statements,
while the same statement may belong to many sets under different labels.

`modules/CourtPrep/CourtPrep.tsx` is the shared workspace for both UI modes — reached directly from
the sidebar (`View: 'court-prep'`, registered in `App.tsx`'s `renderActiveView`), or opened as a
modal from `DocumentManager.tsx`'s **Build Exhibit Set** button with the current selection preloaded.
It uses progressive disclosure: collapsible packet/exhibit panels, a composition chooser before
downstream fields, a type-specific primary-item builder, then the associated-record selector and
PDF-numbering status. **Add exhibit** is part of the responsive sticky packet action bar. Known
report and transaction sources are auto-selected and cannot be detached while the selected primary
item depends on them.

Transaction selection is account-first. `utils/transactionExhibit.ts` resolves a row's canonical
account from its own `accountId`, then the parent statement's directory mapping, with deterministic
fallbacks for legacy records. Multiple statement periods group under one account choice; selected
rows determine which physical source-document IDs are attached. The normalization pass creates one
account lookup and resolves each statement's parent account once. `TransactionExhibitBuilder.tsx`
sends a compact, document-free search index to `transactionExhibit.worker.ts` for account/text/date/
amount filtering, date/amount sorting, and counterpart-candidate matching, and uses
`@tanstack/react-virtual` for the result viewport. The pure counterpart matcher applies
hard gates for equal amount, opposite direction, and different account. Ordinary transfers use a
two-day date gate. Rows where both sides carry payment language and either side identifies a card
account or issuer use a seven-day gate for card/funding-account posting differences. Candidate
ranking then uses existing transfer links, cross-account last-four references, payment/transfer
wording, and date proximity. Candidate matching searches the full index rather than the currently filtered viewport;
the UI immediately unions its suggestions into the durable selected-ID set, adds their accounts and
source documents, and presents every suggestion above the list for removal. Retained pair IDs are
stored with the exhibit configuration so the rebuilt PDF and XLSX mark both sides consistently.
The saved transaction card passes that durable item back to the same builder for editing; the modal
restores available row/account selections and reconstructs only previously retained pairs. Saving
preserves the item identity, replaces its selected-ID configuration, and reconciles the derived
supporting-document references without invoking either renderer.
Full `DocumentItem`
objects, source archives, and PDF bytes never cross the worker boundary; unsupported-worker clients
fall back to the same pure filter on the main thread.

Sets persist through `store.upsertExhibitSet` in the `exhibitSets` app-meta value, load with
statement-analyzer data, and travel through full case export/import. A label is unique only inside
its set. `used` sets cannot be edited through the UI, preserving the preparation history; deleting one is allowed behind a confirmation and is audit-logged.

Custom-upload bytes do not inflate the `ExhibitSet` JSON. `UploadExhibitFile.tsx` hashes the bytes
and calls `dbService.saveExhibitUploadRecord`, which stores them in the source archive under the
reserved `exhibit-upload::<uploadId>` owner id and leaves only file/hash metadata in the exhibit
item. Re-download resolves by upload id plus hash; removal deletes that dedicated archive record.

`modules/CourtPrep/components/DashboardExhibitPicker.tsx` lets either mode select any rendered card
in place instead of relying on a hard-coded visual list. It stays visually absent during ordinary
Dashboard and Reports visits and appears only when Court Prep activates selection. It passes the selected element and
current-scope source suggestions to `modules/CourtPrep/components/VisualExhibitAction.tsx`, which
can save only the source view/card locator, labels, scope, and reviewed supporting-document
references. No save path captures or stores rendered bytes. Court Prep later routes through the
saved view/key to reopen the live card. Only explicit export calls `captureAnalyticsSection` and
`buildVisualExhibitPdf`, then delegates packaging to `services/exhibitPackageService.ts`. The visual
PDF is analysis and is not Bates stamped. Supporting
PDFs must have locked ranges and receive regenerated stamps using those same ranges; unnumbered PDFs
are rejected. Native non-PDF sources remain verified originals. The manifest distinguishes original
and included hashes and the README directs users to keep any exact derivative previously served as
the authoritative production copy.

The picker uses exact `data-exhibit-source-ids` when a card provides them. Otherwise it proposes the
current person/business/date scope, a conservative fallback rather than a claim that every suggested
record contributed to the card. User review is required. `ExhibitVisualItem` stores the source
view/card locator and source-id snapshot, not PDF bytes; **Open visual to export** re-enters that live
view instead of packaging an incomplete source-only visual exhibit. A selected `FullReport` likewise stores a report reference and source
ids rather than rendered report bytes; its final PDF is exported separately or reintroduced through
the custom-upload path. User-uploaded primary bytes are preserved and can be re-downloaded.
Transaction-summary selections store transaction/source IDs and render a fresh row-cited PDF plus
an editable two-sheet XLSX at download. `transactionExhibitWorkbookService.ts` creates the Summary
and Transactions sheets in memory; `exhibitPackageService.ts` adds the workbook as a hashed
supplemental artifact beside the PDF.

Inline Bates numbering inside Court Prep commits the permanent event, range locks, and registry
high-water mark but passes `downloadOutput: false`, so it starts no download. The explicit exhibit
export later regenerates the locked stamps and includes those PDFs in the proceeding-specific ZIP.
Standalone production screens omit that option and preserve the existing immediate-download
behavior because those workflows are themselves requests for a delivery package. Saving an exhibit
configuration yields no file in either case.

The application does not decide whether a court treats a chart and its support as one compound
exhibit, separate exhibits, or subparts. The UI records the convention and requires the user to
confirm exchange, redaction, confidentiality, foundation, authentication, and local filing rules.

## Deployment And Build

Build/development commands:

- `npm run dev` starts Vite.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.
- `npm run test` runs Vitest.
- `functions` builds with `tsc` and deploys with `firebase deploy --only functions`.

Vite build config:

- Multi-page input: `index.html` and `app.html`.
- Manual vendor chunks for charts, PDF libraries, Firebase, and Gemini SDK code.
- Dev server includes no-store headers and a public-directory index plugin for public resource routes.

Deployment surfaces include Firebase Functions and static app hosting. `netlify.toml` is present, so the static frontend can also be served by Netlify depending on deployment configuration.

## Testing Strategy

The repo currently uses Vitest for deterministic services and utilities. There is not a full end-to-end test harness for all workflows. For high-risk changes, the expected validation is:

- `npm run build`.
- Focused Vitest tests where available.
- Manual smoke testing through the affected module.
- Verification that notifications appear through `NotificationToaster`.
- For billing/auth work, test with Firebase/Stripe test mode and verify Firestore counters, subscription docs, and custom claims.

## Architectural Decision Notes

### React + Vite Over Next.js

Chosen because the application is a client-heavy local workspace. Vite avoids unnecessary server-rendering infrastructure and keeps the deployable frontend static.

### TypeScript Over Python For Core Product

Chosen because the core product is browser UI plus typed domain state. TypeScript keeps UI, services, and Cloud Function contracts in one language family.

### IndexedDB Over Server Case Storage

Chosen to minimize centralized custody of sensitive financial evidence and support large local datasets.

### Firebase Over Custom Backend

Chosen for managed auth, Firestore metadata, rules, callable functions, scheduled functions, custom claims, and emulator support.

### Zustand Over Redux

Chosen for lower ceremony and direct workflow orchestration in a local-first app.

### Stripe Checkout/Billing Over Custom Payments

Chosen to delegate card handling, coupons, subscription lifecycle, and customer portal workflows to Stripe.

### Gemini Proxy Over Direct Browser Model Calls

Chosen to protect model API keys, enforce authentication/tier checks, and centralize usage logging.

### Deterministic Analysis Plus LLM Narrative

Chosen because financial analysis needs repeatable calculations and traceability, while document parsing and narrative synthesis benefit from LLM capabilities.

## Known Architectural Hotspots

- `store.ts` is intentionally powerful but broad; changes can affect many modules.
- `services/spreadsheetImportService.ts` deliberately keeps figures away from the model: amounts, dates, descriptions, and balances are read literally from the cells, and a model is used only to label unrecognisable columns (answering with indices) and to categorise the deduplicated description list. Preserve that split when editing it.
- `services/geminiService.ts` contains many AI schemas/prompts and should be edited carefully.
- `services/pdfService.ts` is shared by several report exports.
- `firestore.rules` controls billing/admin/org visibility and should be reviewed with any metadata schema change.
- The local-first storage model means multi-device workflows depend on case export/import or case index metadata, not automatic cloud case sync.

## Future Architecture Considerations

- Add formal Playwright coverage for critical auth, parse, billing, report, and export workflows.
- Split `store.ts` into module-local stores where shared cross-module state is not required.
- Add explicit architecture diagrams for data flow, auth/billing lifecycle, and AI request lifecycle.
- Add automated Firestore rules tests for billing, org, and audit collections.
- Consider server-side collaboration only if product requirements justify centralized case evidence storage and its compliance burden.

## AI finding preparation

`modules/Investigations/aiPreparation.ts` prepares exact cited bank/payment-app rows or matched business/personal transfers, preserving the original AI claim separately. The existing finding-decision store holds versioned evidence snapshots and human approval; source changes invalidate readiness. See [preparation specification](INVESTIGATE_PREPARATION_SPEC.md) for data flow, supported methods and explicit unsupported outcomes.
