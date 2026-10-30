# Repository Map

> Current navigation and review periods: [Current views and workflows](CURRENT_WORKFLOWS.md) (reviewed October 27, 2026).


Use this document as the first-pass navigation guide before crawling the repo. It is intended to reduce broad file searches and point work toward the smallest relevant slice of the codebase.

## Current summary and documentation entry points

Current user steps: [CURRENT_WORKFLOWS.md](CURRENT_WORKFLOWS.md). Release/source assessment: [RELEASE_REVIEW_2026-10-27.md](RELEASE_REVIEW_2026-10-27.md). Compact dashboard: `NoviceFinancialPicture.tsx`, `NoviceRoleSnapshot.tsx`, `NoviceDashboardControls.tsx`, `summaryPresentation.ts` in `modules/DashboardLanding/`. Shared downloads: `components/FinancialReviewDownloads.tsx`; spending rows/PDF: `utils/spendingReview.ts`, `services/spendingReviewPdf.ts`. Shared current Help: `components/CurrentWorkflowHelp.tsx`, mounted in both Help modes. The exported customer Word guide is in `documentation/`, not a `documents/` directory.

## Start Here
- App entry: `index.tsx` mounts `App.tsx`.
- App shell: `App.tsx` handles auth, initial data loading, and view switching.
- Navigation model: there is no React Router. Screen selection is driven by `activeView` in `types.ts` and the global Zustand store in `store.ts`.
- Build shape: Vite multi-page app with `index.html` as the public/marketing surface and `app.html` as the authenticated shell.

## Efficient Crawl Order
1. Read `App.tsx`, `types.ts`, and `store.ts` for any change that affects app flow, navigation, auth, or shared data.
2. Open the relevant feature module in `modules/<FeatureName>/`.
3. Only then branch into supporting files in `services/`, `utils/`, `components/`, or `pages/` that the feature imports.
4. Avoid backup or duplicate directories unless the active code explicitly imports them.

## Primary Surfaces
### App Shell
- `index.tsx`: React mount.
- `App.tsx`: auth bootstrap, module data loading, top-level rendering switch.
- `types.ts`: app-wide enums and shared types, including active view selection.
- `store.ts`: central Zustand store for shell state, module state, persistence actions, imports/exports, AI actions, and notifications.

### Pages
- `pages/LoginPage.tsx`: auth entry page.
- `pages/OnboardingPage.tsx`: onboarding flow.

### Feature Modules
- `modules/StatementAnalyzer/StatementAnalyzer.tsx`: document ingestion and parsing workflows for statements, tax docs, affidavits, Cash App, and business financials. Also owns the joint/commingled estate attribution layer and the full Novice/Advanced Bates production workspaces (see `ARCHITECTURE.md`).
- `modules/Investigations/Investigations.tsx`: canonical Investigate workspace: Start & reports → Findings, with the focused AI wizard embedded and reports exportable as PDFs. It adapts deterministic Findings Program results plus focused/comprehensive reports into one role-aware finding inbox, preserves source lineage and review decisions, turns missing evidence into discovery drafts, and saves supported findings directly into new or existing exhibit packets from the review drawer. Court Prep later handles packet review, Bates numbering, and export. The shell uses `fraud-finder`; legacy `asset-tracer` navigation mounts the same workspace. Both modes show one Investigate entry. See `docs/INVESTIGATIONS_ARCHITECTURE.md`.
- `modules/CourtPrep/CourtPrep.tsx`: proceeding-specific exhibit sets for a petition, motion, hearing, deposition, or trial — progressively building Thrive chart/report, custom-upload, transaction-summary, document, or other exhibits under proceeding-local labels. It embeds the shared Bates transaction after source selection without auto-downloading, requires every PDF source to be locked before Ready/export, and emits matching PDF/XLSX transaction tables with retained counterpart markers on explicit download. `activeView === 'court-prep'`, sidebar entry in both modes. See its own README.
- `modules/FraudFinder/FraudFinder.tsx`: legacy source-engine UI retained during migration. Its focused/comprehensive analysis services, saved reports, and adapters feed the canonical Investigations workspace; it is no longer the component mounted for the primary `fraud-finder` route.
- `modules/AssetManager/AssetManager.tsx`: assets, debts, income, children, and novice/advanced views.
- `modules/SettlementAgreement/SettlementAgreement.tsx`: AI proposals, manual settlement worksheets, fairness assessment uploads.
- `modules/DiscoveryManager/DiscoveryManager.tsx`: discovery requests, responses, and PDF / 201(k) output.
- `modules/DashboardLanding/DashboardLandingPage.tsx`: live cross-module dashboard synthesis, spouse/business/date filters, role dashboards, settlement snapshots, P2P summaries, money-flow cards, red-flag summaries, and dashboard PDF export.
- `modules/ForensicDashboard/ForensicDashboard.tsx`: production Data Analysis surface with chart-heavy analytics, transfer detection, cash-flow review, P2P exposure, and business/person scope filtering. Rendered at `activeView === 'dashboard-sandbox'`.
- `modules/DataAnalysis/`: shared type definitions (`types.ts`) consumed by `ForensicDashboard`; no standalone UI of its own.
- `modules/Help/HelpPage.tsx`: help surface (novice and advanced guides, FAQs).
- `modules/Settings/SettingsPage.tsx` with shared `components/AccountConfigurationSettings.tsx` and `components/PeopleAndCardsSettings.tsx`: profile/case settings, People & Cards setup, account configuration, PWA/demo/upgrade tools, audit export, and reset surfaces.
- `modules/Admin/AdminPage.tsx`: administrator-only user role and system administration surface (`activeView === 'admin'`).
- `modules/OrganizationTeam/OrganizationTeam.tsx`: firm/team membership and organization-level tooling (`activeView === 'organization-team'`).
- `modules/ClientsCases/ClientsCases.tsx`: case switcher for tiers with multiple client cases (`activeView === 'clients-cases'`, gated by the `multiplePersonalCases` tier feature).
- `modules/Sandbox/Sandbox.tsx`: administrator-only development testbed (`activeView === 'dashboard'`); not a production surface — see its own README.
- `modules/Dashboard2/`: deprecated, contains no active implementation — see its own README.

Every module above except `Dashboard2` has its own `README.md` documenting behavior, data sources, and known constraints in more depth than this map.

## Income and portfolio navigation

- User workflows: `docs/INCOME_REVIEW_GUIDE.md`, `docs/PORTFOLIO_GUIDE.md`; draft release copy: `docs/UNRELEASED_UPDATES.md`.
- Optional payroll: `components/PayrollRecordsPanel.tsx` (on-demand Get/Verify Records entry), `components/PayrollWorkspace.tsx`, `EmploymentEditor.tsx`; contracts `src/contracts/payroll.ts`; extraction `utils/paystubExtraction.ts`; deterministic matching `utils/payroll.ts`; lifecycle registry `services/documentCollections.ts`. User guide: `docs/PAYROLL_GUIDE.md`.
- Consolidated dashboard review: `components/IncomePeriodReview.tsx`, `IncomeReviewDetails.tsx`, `IncomeBasisComparison.tsx`; deterministic period/basis/flag builders: `utils/incomePeriodReview.ts`, `incomeReviewPresentation.ts`.
- Income PDF: `services/incomeReviewPdf.ts` supplies paginated vector/text content to the branded standalone and dashboard exporters in `services/pdfService.ts`.
- Dashboard dates: `components/DashboardDateRange.tsx` buffers native and segmented Start/End inputs as one focus group; `utils/dashboardDateDraft.ts` validates the atomic commit.
- Shared information controls: `components/InfoTooltip.tsx` + `.css`, `DashboardCardReview.tsx`, `utils/dashboardCardInfo.ts`.
- Portfolios: `src/contracts/portfolio.ts`, `utils/portfolio.ts`, `portfolioEntry.ts`; `components/PortfolioWorkspace.tsx`, `PortfolioHoldingsEditor.tsx`, `PortfolioMarketPrices.tsx`.
- Parsing/import: `services/portfolioImportService.ts`, `geminiService.ts`. Quotes: `hooks/useHoldingQuotes.ts`, `services/holdingQuoteService.ts`, `cryptoPriceService.ts`, authenticated `functions/src/holdingQuote.ts`.
- Suggestions: `utils/suggestedExhibits.ts` → Court Prep. Similar AI flag matching: `utils/redFlagConsolidation.ts` → report cleanup and `modules/Investigations/investigationModel.ts`.

## Shared Dependencies By Concern
### Services
- `services/dbService.ts`: IndexedDB persistence for documents, fraud, discovery, settlement, audit logs, and layouts.
- `services/aiCreditGate.ts`: Credit pre-flight checks and post-success debit callable used by AI workflows; reads `usage_counters/{uid}` and calls `deductAiCredits`.
- `services/geminiService.ts`: Gemini request construction and response validation through the
  authenticated `callGemini` Firebase Cloud Function; the browser does not receive the provider key.
- `services/pdfService.ts`: offscreen React rendering plus `html2canvas` and `jsPDF` export pipeline.
- `services/pdfTextExtractor.ts`: PDF text extraction utilities.
- `services/spreadsheetImportService.ts`: XLSX/XLS/CSV transaction import. Cells are read literally; a model only labels ambiguous columns and categorises deduplicated descriptions, never restating a figure.
- `services/batesService.ts`: PDF page counting and Bates stamping primitives.
- `services/batesProductionService.ts`: verifies source hashes, stamps a continuous named production, hashes derivatives, and builds the complete ZIP before state mutation.
- `services/exhibitPackageService.ts`: verifies exhibit sources, enforces locked ranges for every PDF source, re-stamps those PDFs, preserves native non-PDF originals, and builds exhibit ZIP/index/manifest outputs.
- `services/fraudDiscoveryReview.ts` + `fraudDiscoveryRunner.ts`: whole-selection rule checks on focused AI reports, source/year recovery, append-only observations and explicit coverage. `utils/fraudBatchDocuments.ts` routes every parsed financial collection into AI blocks by its stamped type.
- `services/findingsProgramService.ts`: adapts deterministic analysis, card-funding, continuity,
  distribution, and missing-month passes into one finding/clear/not-run result per catalogue test.
- `services/transactionExhibitWorkbookService.ts`: creates the Excel companion to a transaction
  exhibit, including signed amounts, source/Bates references, and retained match markers.

### Utilities
- `utils/featureFlags.ts`: beta gating and login-disable behavior.
- `utils/interAccountTransfer.ts`: transfer-detection logic used by analytics surfaces.
- `utils/p2p.ts`: peer-to-peer transaction helpers.
- `utils/statementAnalyzerConfig.ts`: analyzer-specific configuration.
- `utils/caseMentor.ts`: pure builders for the Novice-Mode guided analysis — six ordered passes over the case, each degrading to a `waiting` state when its inputs are absent.
- `utils/cardInsights.ts`: pure builders for per-card findings (observation, meaning, next step, action target) behind the badge on each novice card, plus `CardVerdict` and `VERDICT_LABEL`. Three verdicts, never two: `not_checked`, `review`, `clear`. A builder with nothing to read returns `not_checked`, so an input-less card can never print a tick.
- `utils/caseFigures.ts`: the only place the case's money figures are named. `CaseFigureKey` separates `observedInflow` (money arriving, **not** income) from `identifiedIncome`, `employmentIncome`, `declaredIncomeAffidavit`, `reportedIncomeTax`, `reconstructedGrossWages`, `unverifiedDeposits`, `internalTransfersIn`, and `liquidCash`. Also owns `TaxBasis`; a `mixed` basis is never differenced against anything.
- `utils/forensicPolicy.ts`: every materiality threshold the detectors screen against, versioned and case-scoped. A detector reads its figures here and never writes one down. `isCaseModified` marks a case that changed a published default.
- `utils/findingOrigin.ts`: the one place "which engine produced this?" becomes words. `FindingOrigin` is `rule | model | reviewer | mixed`; an unrecognised engine resolves to `model`, not `rule`. `splitByOrigin` prints the split beside a headline count.
- `utils/dashboardTimeline.ts`: pure builder for the one case timeline shared by every role, with `TIMELINE_PROVENANCE`, `TIMELINE_CONFIRMED`, and `describeTimelineConfirmation`. No date is model-authored.
- `utils/paralegalQueue.ts`: pure builder for the six paralegal work queues. `ParalegalSectionState` is `action | clear | waiting-on-records`, so an empty section with no inputs never reads as resolved. `now` is an argument, not a clock read.
- `utils/dashboardCardSources.ts` with `src/contracts/dashboardCard.ts`, `dashboardCardRegistry.ts`, and `dashboardCardIds.frozen.ts`: frozen per-card identity and the source-record contract. A card names the records it actually read or names none; there is deliberately no scope-wide fallback.
- `utils/instrumentDiscovery.ts`: `isInstrumentObservedInLedger` reuses the same observation pass discovery runs on, so a card the statements still cite cannot be removed and silently recreated.
- `utils/legalIntelligenceEvidence.ts`: `legalReviewLabel` maps a comparison to one of `Untested`, `Partial`, `Flagged`, `Supported`. Nothing here calls anything a violation or fraud.
- `utils/findingsProgram.ts`: standing-test catalogue, record requirements, summaries, safe filing-date
  resolution, and finding ranking. A clean result requires an explicit examination scope from the service.
- `utils/cardFundingPairs.ts`: deterministic matching of card-payment credits to exact-amount
  withdrawals on other accounts, plus untraced-card summaries.
- `utils/balanceContinuity.ts`: period-to-period statement balance, gap, and overlap checks.
- `utils/unclaimedDistributions.ts`: business-to-owner transfer totals reconciled to tax-return distributions.
- `utils/batesAllocation.ts`, `utils/batesCitation.ts`, and `utils/batesProduction.ts`: range allocation, source-page citations, production validation, load-file/manifest values, and safe filenames.

### Components
- `components/NotificationToaster.tsx`: notification surface called out in manual verification guidance.
- `components/ModuleErrorBoundary.tsx`: module-level crash containment.
- `components/Sidebar.tsx` and `components/Header.tsx`: shell layout primitives.
- `components/CaseMentor.tsx`: renders the guided-analysis passes on the novice dashboard and novice Reports.
- `components/CardInsights.tsx`: the per-card flag button and findings drawer shown in Novice Mode.
- `components/FindingsProgramCard.tsx`, `FindingsProgramStrip.tsx`, and
  `FindingsProgramLedger.tsx`: role-sized entry points for active, clear, blocked, and set-aside
  deterministic results.
- `components/FindingCard.tsx` and `FindingDecisionControls.tsx`: source-linked finding detail,
  Court Prep/discovery actions, and persistent reviewed/not-issue decisions.
- `components/NoviceHelpDrawer.tsx` and `components/HelpContextModal.tsx`: the floating "?" contextual help for novice and advanced modes respectively — not part of `modules/Help/`.

### Canonical Investigations Slice

- Source-attribution audit and loan/bank tracing safeguards: `docs/INVESTIGATE_EVIDENCE_AUDIT_2026-09-07.md`; regression fixtures: `services/findingEvidenceAudit.spec.ts`.

- Workspace: `modules/Investigations/Investigations.tsx`. AI wizard: `modules/FraudFinder/components/FindAdditionalFraudModal.tsx`.
- Coverage and PDF reports: `components/InvestigationCoverage.tsx`, `components/InvestigationReportDialog.tsx`, and `reportSources.ts` within `modules/Investigations/`.
- Canonical read model and source adapters: `modules/Investigations/investigationModel.ts` + `modules/Investigations/types.ts`. This is a derived model over existing persisted findings and reports, not another finding database.
- AI exhibit preparation: `modules/Investigations/aiPreparation.ts`; snapshot decisions reuse `findingDecisions`. See `docs/INVESTIGATE_PREPARATION_SPEC.md`.
- Current exact workflows: `docs/INVESTIGATE_GUIDE.md`, `docs/COURT_PREP_GUIDE.md`; shared in-app help steps: `modules/Help/investigationWorkflow.ts`.
- Progressive finding summary: `modules/Investigations/components/InvestigationFindingCard.tsx`.
- Source/subject tag matching and plain-language titles: `modules/Investigations/findingPresentation.ts`; review completion filters: `modules/Investigations/findingFilters.ts`.
- Evidence review and disposition workflow: `modules/Investigations/components/FindingReviewDrawer.tsx`.
- Finding-to-exhibit source picker and composition preview:
  `modules/Investigations/components/FindingExhibitPlanner.tsx`.
- Finding-to-packet validation and immutable exhibit-set construction:
  `utils/findingExhibitSets.ts`. Investigations persists the returned set directly; the contained
  drawer does not use the legacy session handoff or navigate to Court Prep.
- Finding-dependent demonstrative selection/rendering:
  `utils/findingDemonstratives.ts` + `components/FindingDemonstrativeCard.tsx`. The pure selector
  recommends comparison, timeline, ranked-bar, key-number, or evidence-grid formats from retained
  finding rows and saves a reproducible definition; it does not call AI.
- Source engines behind separate explicit AI-wizard and rules-based actions: `services/findingsProgramService.ts`, `store.ts#startFraudAnalysis`, and `store.ts#startComprehensiveAnalysis`.
- Downstream lineage: `DiscoveryRequestItem.sourceFindingIds` and `ExhibitGroup.sourceFindingIds` preserve canonical finding IDs through discovery and saved exhibit packets.
- Current consolidation review and coverage limits: `docs/INVESTIGATE_REVIEW_2026-09-07.md`.
- Architecture, rollout, and migration boundaries: `docs/INVESTIGATIONS_ARCHITECTURE.md`.
- User-facing AI, rules-based analysis, evidence, and exhibit boundaries:
  `docs/AI_AND_FORENSIC_ANALYSIS.md`.
- Extended standing checks: `utils/extendedFindings.ts` and its spec; same-person income regressions: `services/incomeScope.spec.ts`. Methods and inputs: `docs/INVESTIGATE_CHECKS.md`.
- Finding-local source decisions: `modules/Investigations/components/FindingCitationPanel.tsx` and `modules/Investigations/citationReview.ts`; stored alongside existing finding decisions, bound to the reviewed evidence snapshot.
- Resolver and consolidation scenarios: `modules/Investigations/investigationModel.spec.ts`.

### Court Production Slice

- Novice entry: `modules/StatementAnalyzer/NoviceGetRecords.tsx` → Document Library → `NoviceBatesProduction.tsx`.
- Advanced entry: `modules/StatementAnalyzer/components/DocumentManager.tsx` → Create Production.
- Exhibit-local entry: `modules/CourtPrep/components/InlineBatesNumbering.tsx`, called only with the selected still-unnumbered PDF subset.
- Shared state/action: `store.ts#createBatesProduction`.
- Package engine: `services/batesProductionService.ts` + `utils/batesProduction.ts`.
- Atomic persistence: `services/dbService.ts#commitBatesProduction`.
- Types: `BatesProductionEvent`, `BatesProductionDocument`, and `BatesLock` in `modules/StatementAnalyzer/types.ts`.
- Tests: `services/batesProductionService.spec.ts`, `utils/batesProduction.spec.ts`, `utils/batesAllocation.spec.ts`, and `utils/batesCitation.spec.ts`.

### Court Prep Module (Exhibit Preparation)

A standalone module, not a slice of Statement Analyzer — see `modules/CourtPrep/README.md`.

- Shared organizer: `modules/CourtPrep/CourtPrep.tsx` (collapsible packet/exhibit panels, five `contentKind` builders, associated records, source-PDF readiness gate, overflow-safe horizontal action rows, and a mobile Actions menu).
- Novice and Advanced entry: sidebar → **Court Prep** (`View: 'court-prep'`), routed in `App.tsx`.
- Advanced contextual shortcut: `modules/StatementAnalyzer/components/DocumentManager.tsx` → Build Exhibit Set (opens `CourtPrep.tsx` as a modal, preloaded with the current selection).
- Any-card picker: `modules/CourtPrep/components/DashboardExhibitPicker.tsx` stays visually absent on ordinary Dashboard and Reports & Analysis visits. Court Prep activates its temporary selection ribbon, which delegates configuration saving and export-only capture/Bates gating to `modules/CourtPrep/components/VisualExhibitAction.tsx`. Saved view/card locators reopen the live card; no rendered PDF bytes are stored on save. Exact `data-exhibit-source-ids` are preferred; the fallback is the active scope and must be reviewed.
- Account-first transaction exhibit selection: `modules/CourtPrep/components/TransactionExhibitBuilder.tsx` + `utils/transactionExhibit.ts` group linked statement periods by canonical account and derive supporting source-document IDs from selected rows. A saved transaction card reopens this builder with its accounts, rows, title, note, and retained match markers restored; saving replaces configuration and reconciles supporting records without rendering. `transactionExhibit.worker.ts` filters and sorts a lightweight index and finds opposite-side candidates across the full index, independent of display filters. Ordinary transfers use a two-day posting window; recognizable card payments use seven days. Suggestions enter the selected set immediately and remain removable in the candidate panel, while `@tanstack/react-virtual` mounts only visible transaction choices.
- Model/validation: `modules/CourtPrep/exhibitTypes.ts` + `utils/exhibitSets.ts`.
- PDF/package: `services/pdfService.ts#buildVisualExhibitPdf` renders live-card exhibits and
  finding-generated visuals; generated findings add a selectable-text data/method appendix.
  Transaction-summary rendering + `services/transactionExhibitWorkbookService.ts` provides the
  transaction XLSX, and `services/exhibitPackageService.ts` rejects unnumbered PDF exhibit sources
  even if a caller bypasses UI validation.
- Persistence: `store.ts#upsertExhibitSet` → IndexedDB app meta `exhibitSets`; custom-upload bytes use `dbService.saveExhibitUploadRecord` under the `exhibit-upload::<uploadId>` source-archive owner; full case export/import includes both.
- Tests: `utils/exhibitSets.spec.ts` and `services/exhibitPackageService.spec.ts`.

## Known Hotspots
- `store.ts` is the main coupling point. Changes there can affect multiple modules.
- `App.tsx` eagerly loads module data after auth and controls top-level rendering. Small edits can have app-wide effects.
- Credit mutations are server-only. `usage_counters/{uid}` may be read client-side, but successful AI flows must route debits through `services/aiCreditGate.ts` and the `deductAiCredits` Cloud Function.
- `services/pdfService.ts` is shared export infrastructure and currently pulls some settlement PDFs from Asset Manager component paths.

## Known Oddities
- There is stale/duplicate code at the repo root and in `services/`: a root-level `dbService.ts` (the active one is `services/dbService.ts`) and `services/geminiService copy.BAKANDWORKING.ts`. Confirm the active import path before editing either area.
- `modules/SettlementAIWizard.tsx` (loose file directly under `modules/`) is orphaned — nothing imports it. The active component is `modules/SettlementAgreement/components/SettlementAIWizard.tsx`.
- `modules/Dashboard2/` is a deprecated stub (see its README); `modules/Sandbox/` is the current administrator-only testbed. Neither is a production surface.
- `services/supabaseClient.ts` appears dormant and reads `process.env.SUPABASE_ANON_KEY`, which is a Vite smell if it becomes active.
- `firebase.js` contains hardcoded Firebase client config; that may be intentional for Firebase, but it does not match the repo's general `.env` guidance.

## QA Scripts
- `docs/qa/` holds one-off manual QA walkthroughs for features that have since shipped (e.g. `docs/qa/TESTING_JOINT_ESTATE.md`). These are historical checklists, not living documentation — check the referenced feature's module README or `docs/JOINT_ESTATE_AUDIT.md` for current behavior.

## Verified Commands
- `npm run dev`: starts Vite on port `3000` per `vite.config.ts`.
- `npm run build`: production build to `dist/`.
- `npm run preview`: local preview of the production build.

## Testing Reality
- `npm run test` runs the Vitest suite for deterministic utilities and services.
- `npm run build` validates the production Vite bundle.
- Manual verification should include login, navigation through the affected module, and checking notifications via `NotificationToaster`.
