# Dashboard, analytics, and document loading

> Current navigation and review periods: [Current views and workflows](CURRENT_WORKFLOWS.md) (reviewed October 27, 2026).

The shared role-dashboard pipeline prepares transfer context and canonical income comparisons in dedicated Web Workers. Its remaining aggregation yields in transaction batches. A calculation identity ties results to the current sources, scope, dates, and retry attempt; changing those inputs immediately shows the loading state instead of figures from the previous scope. Switching presentation roles reuses the shared computation.

Advanced analytics prepares income ledgers and transfer context in workers, then runs its transaction aggregation in `forensicAggregation.worker.ts`. The pure aggregation in `forensicAggregation.ts` preserves the previous calculation rules. Reconciliation uses a separate worker only when its panel mounts. Novice Reports retains its on-demand visual worker and now uses the same cancellation and stale-result handling.

`useWorkerCalculation` paints a local loading state before posting the case to a worker. `calculateInWorker` releases workers after success, error, or abort. Navigation and input changes cancel obsolete work; errors show a retry action rather than silently displaying zero totals. No case data is sent to a server by these workers. Structured cloning and React/chart rendering still happen on the browser's main thread.

Document Analyzer loads the selected advanced subview or novice panel through local Suspense boundaries. The toolbar and progress banners can render before the subview bundle is ready. Role dashboards and document views select only the store fields they use, with shallow equality, so unrelated progress and notification updates do not trigger them.

## Documentation of visible preparation

Dashboard reviews and PDF actions expose a text-labelled preparation state with organization branding. Do not read a pending comparison as zero findings. The editor for optional payroll is loaded on request in record workspaces. Scope results can be reused across navigation while relevant source/profile edits invalidate them; caching is not a promise of a fixed page-load time. See [current controls](CURRENT_WORKFLOWS.md).

## Verification

- `npm run test -- utils/calculateInWorker.spec.ts modules/ForensicDashboard/forensicAggregation.spec.ts utils/p2p.spec.ts utils/caseFigures.spec.ts utils/laneReconciliation.spec.ts modules/ForensicDashboard/noviceReportsCalculations.spec.ts`
- `npm run build`
- `npm run typecheck:changed` (compare existing errors with HEAD).
- Signed-in smoke checks: all four role dashboards in both modes; advanced analytics overview and each detail tab; scope changes; reconciliation; novice Reports visuals; novice document library and verification; all advanced document subviews. Confirm local loading indicators, completed content, and no module error boundary.

On 2026-09-23, the targeted suite passed 113 tests and the production build passed. The signed-in checks used a populated case with 205 records and 33,664 transactions. Ten changed-file TypeScript diagnostics were also present in unchanged HEAD. Existing large app/chart chunk warnings remain; this work does not claim that all rendering work runs off the main thread or establish a controlled before/after timing benchmark.

## Paystubs and employers

`utils/payroll.worker.ts` handles payroll matching, on-demand allocation checks, draft previews, payroll/income projection and selected source decoding. `utils/payrollBackground.ts` prepares source-free bank-credit/pay-event inputs and preserves source-document identities when applying transaction evidence patches. The matcher indexes credits once by posting day and cents instead of scanning the entire ledger for every pay event. `PayrollWorkspace` uses the shared cancellation/retry hook; only expanded paystub bodies mount, within initially collapsed years. Compact evidence panels defer their bank input and worker until opened.

`services/payrollRefresh.ts` coalesces payroll save refreshes, paints before preparing inputs, cancels superseded jobs and checks all captured source references before applying a response. Errors expose retry without reverting the saved source record or claiming matching succeeded. Employer-only profile saves skip unrelated reference-metadata rewrites, business/family passes and actor discovery; non-payroll profile edits retain their existing path. Paystub collection persistence retains its existing full-collection replacement contract. Only changed bank statement records are queued for cooperative persistence after a successful projection.

A local headless-browser development check with a fictional case of 80 paystubs and 12,080 bank credits measured tab readiness at about 9.5s before / 1.1s after, and review opening at about 4.9s before / 0.07s after. Across repeat checks, optimized employer/paystub save interactions returned in about 0.10–0.15s. Employer saves produced no observed long main-thread tasks; paystub saves had none in the first check and a 71–78ms task in later checks, rather than the previous multi-second tasks. These are one-session development measurements, not a production performance guarantee. Structured cloning, input preparation, React rendering, encryption and persistence still incur browser work.

## Login and shared findings (October 2026)

The standing 50-check findings program and canonical evidence indexing now run in separate shared Web Workers. Equivalent mounted readers reuse one in-flight calculation and the latest completed result. Two animation frames allow loading indicators to paint before input cloning begins. A source-reference change immediately hides the previous result; navigation cancels work with no remaining readers. Investigate, findings cards, exhibit suggestions and forensic-report prerequisites show loading/error/retry states instead of reporting a pending calculation as an empty case.

Login no longer eagerly imports the PDF export stack or warms analytics and the admin sandbox in the background. Those bundles load when requested. The shell and release-notes panel use shallow store subscriptions so unrelated progress updates do not repeatedly render them. Document Parser already uses local Suspense spinners, and Data Analysis retains its existing aggregation workers and adds the shared spinner to account-flow preparation.

A synthetic baseline with 12,000 statement rows measured about 81 ms of synchronous standing-check work and an 81 ms delay to the next scheduled callback. This identifies a blocking path, not an overall login benchmark. Worker input/output cloning, case hydration, encryption, bundle evaluation and React/chart rendering still use the main thread. No case information leaves the browser for these calculations.

Regression checks: `utils/sharedWorkerCalculation.spec.ts` covers sharing, paint scheduling, cancellation, stale responses, errors and retries; `services/caseFindingsCalculation.spec.ts` covers standing checks, cloneable outputs, source identities, duplicate row IDs and trashed-document exclusions. `utils/accountCashFlow.spec.ts` verifies eight named categories without changing totals or transaction provenance.

Validation for this change: 306 test files passed (4,465 tests; 13 skipped), production build passed, and all 27 changed TypeScript files passed the changed-file check. Emulator smoke checks covered login with a populated case, release-note scrolling through 20 entries, advanced Cash Flow, Investigate, Document Parser, novice record navigation, novice Investigate loading/completion, dark novice Case visuals, and the forensic report composer. A missing-date Cash App row exposed an existing Cash Flow trend crash; the dated chart now excludes invalid dates with boundary regression coverage. These are functional development checks, not a production login speed comparison.

## Dashboard income cards (October 25, 2026)

Interactive spouse income/spending comparisons now run in `spouseComparison.worker.ts` rather than inside React's render-time memo. The existing deterministic builder is shared with synchronous report capture, preserving all figures, attribution rules and source references. A local loading/error/retry surface appears while the worker runs.

`useFinancialContext` shares transfer context between Dashboard and Data Analysis, including return navigation. `useSpouseComparison` and `useIncomePeriodReview` reuse the latest completed calculation across role-card remounts. The review compares source references plus person/business/date filter values, rather than the new wrapper objects created by each role. Changed evidence or filters immediately withhold old results. Pending requests are cancelled when their last reader unmounts; completed results remain in memory for reuse. Neither results nor case data are put in the service worker's offline cache.

A synthetic Node worker-thread check using 12,120 fictional seed transactions measured 281 ms of synchronous spouse-comparison work, versus 29 ms to post the input to a worker and 93 ms until the next main-thread task. Worker and synchronous outputs matched exactly. This isolates the calculation boundary; it is not a browser dashboard-load benchmark or production speed guarantee. Browser structured cloning, remaining dashboard aggregation and chart rendering still incur main-thread work.

## Initial-load trace review (October 25, 2026)

The supplied Chrome `Dashboard Trace.json` and `Data Analysis Trace.json` both include application startup and local case hydration. On the page renderer thread, Dashboard contains nine tasks longer than 50 ms (about 3.03 seconds combined; worst 1.09 seconds); Data Analysis contains seven (about 2.71 seconds combined; worst 1.03 seconds). These are task durations, not time-to-interactive measurements. The recordings also contain browser/profiler/extension work and, in the Dashboard recording, activity from another renderer. Those costs must not all be attributed to the selected page.

The sampled minified `jx` function maps to `decryptRecord`: approximately 804 ms of Dashboard samples and 649 ms of Data Analysis samples land in its decrypt/decode/JSON-parse continuation. Records at least 256 KiB now decrypt and parse in `dbRecordDecryption.worker.ts`. The non-extractable CryptoKey is structured-cloned to this same-origin local worker; no key export, storage-format change or server request is involved. Large decodes are queued so concurrent collection reads cannot spawn dozens of workers. Workers terminate after each result/error; one failed record does not poison the queue. Small and legacy records retain the local path. Output cloning and IndexedDB reads still cost main-thread time.

Dashboard's income-review worker samples attribute about 5.18 seconds to `bankCashflowTransactions`. It rebuilt the entire account/transfer index for every statement, repeatedly across people and years. WeakMap indexes now reuse each immutable source array; replacement arrays invalidate the indexes. Derived transaction rows remain fresh, preserving caller isolation, bundled-account attribution, transfer-purpose overrides and exact amounts. The helper is shared by Dashboard and Data Analysis income/cash-flow preparation.

The dashboard no longer imports or mounts `ReportReadinessCard`, including the attorney/paralegal and forensic detail paths. Its record subscription, idle report-model preparation and readiness calculation therefore do not start from this surface while the report feature is in progress.

A fictional Node benchmark with 120 statements, 12,000 rows, eight accounts, 6,000 linked transfers and three reporting years reduced the complete income-period review from 3.40 seconds to 0.70 seconds (about 79%). Serialized results before and after were identical. This isolates the repeated-index bottleneck; it does not establish an equivalent reduction in production page-load time. A real browser check decoded a 1,544,836-byte encrypted fixture through the new worker, verified Unicode/nested records and mixed legacy batches, confirmed the key remained non-extractable, and rejected corrupt ciphertext.

Regression coverage: `cashflowScope.spec.ts`, `incomePeriodReview.spec.ts`, `dbEncryption.spec.ts`, `dbRecordDecryption.spec.ts`, and the shared worker lifecycle tests. Signed-in emulator checks cover the seeded Dashboard roles, advanced Data Analysis, novice Reports and Case visuals. Trace samples also show finding-topic matching and React rendering costs; those remain follow-up profiling targets. The production app/PDF chunks still emit existing Vite size warnings. A fresh trace of the same case/device is needed to quantify the overall startup improvement.

Validation: `npm test -- --maxWorkers=2` passed all 322 files / 4,617 tests (13 skipped), and changed-file typechecking passed all eight changed TypeScript files. Default-concurrency runs passed their assertions but intermittently reported Vitest's `onTaskUpdate` RPC timeout; the bounded full run exited cleanly. An existing Dashboard source-report-ID access needed a type guard because ordinary source flags do not carry aggregate report IDs.

## Navigation and scope retention (October 26, 2026)

Reviewed the October 26 `Trace-prosedashboard-refresh1.json`, `Investigate-load.json`,
`Return-prosedashboard.json`, and `forensic.json` recordings. The return trace includes another
Dashboard aggregation and income/cash-flow worker executions. The initial-load recordings
include local encrypted-record hydration; some end before the whole case-load measure finishes,
so they cannot establish a complete first-load duration. CPU samples from overlapping worker
threads must not be added together as page wait time.

The shared calculator previously kept one current entry. A different live scope cancelled that
entry even while another reader still needed it. Each scope now has an independent entry;
equivalent readers deduplicate work, and four inactive results are retained in memory. Pending
work is aborted when its last reader leaves. Retry and explicit reset hide old results and
restart the affected calculations. Both the calculator and case-loader yield through posted
browser tasks rather than animation frames, allowing work to continue in hidden tabs.

`useWorkerCalculation` now uses the same resource, so P2P, reconciliation, account cash flow,
and analytics results survive unmount/remount. Advanced analytics supplies explicit immutable
source/filter dependencies for its derived worker payloads; recreating scoped arrays and maps
on remount no longer invalidates identical evidence. Dashboard retains four completed aggregate
results keyed on the original sources, profile, scope, dates, retry and current day. Replaced
source arrays, account/transfer edits, case imports and filter changes select new results; record
counts alone are never cache keys. Its independent income and cash-flow workers run together.

Novice Investigate no longer indexes every statement transaction or builds an Advanced overlap
register before a finding is opened. Advanced review prepares those inputs when needed. The case
loader shows a labelled progress panel in the content area rather than a blank screen while
saved records hydrate. This retains the gate against rendering figures from a partially loaded
case.

These caches are bounded and memory-only. Existing `public/sw.js` already caches Vite's hashed
assets (including worker scripts); case calculations remain local Web Workers. Financial
results and source documents are not written to the service-worker HTTP cache. Full reloads
still hydrate encrypted IndexedDB records; structured cloning and React/chart rendering still
cost browser time. A same-device production trace with the original case is needed to quantify
whole-page improvement.
