// 🧭 Pure mapping from monday column values to tracker project fields.
// No network, no state, no mutation: easy to test, easy to read.
//
// Columns are found by TITLE, not by column id. Ids differ between boards
// built from the same template, titles do not. The aliases cover the short
// forms the monday UI truncates ("Original End D…") so a rename to the full
// title keeps working.

export const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** tracker field key -> accepted monday column titles (normalized on compare). */
export const FIELD_COLUMNS = Object.freeze({
  businessOwner: ['Business Owner'],
  executionOwner: ['Delivery Owner'],
  projectManager: ['Project Manager', 'PM'],
  scope: ['Scope'],
  rag: ['RAG Status', 'RAG', 'Health'],
  trending: ['Trend'],
  phase: ['Phase'],
  validation: ['Validation'],
  progress: ['Project Progress', 'Progress'],
  startDate: ['Start Date'],
  originalEndDate: ['Original End Date', 'Original End'],
  forecastEndDate: ['Forecast End Date', 'Forecast End'],
  keyRisk: ['Key Risk / Blocker', 'Key Risk', 'Key Risk / Blockers'],
  dependencies: ['Dependencies'],
  decisionNeeded: ['Decision Needed'],
  nextMilestone: ['Next Milestone'],
  nextMilestoneDate: ['Next Milestone Date'],
})

/** monday owns these. The tracker keeps issues, decisionOutcome and planLink. */
export const SYNCED_FIELDS = Object.freeze(Object.keys(FIELD_COLUMNS))

/** A board counts as a project register only if it carries all of these. */
export const REQUIRED_FIELDS = Object.freeze(['rag', 'businessOwner', 'executionOwner', 'progress'])

/** Display labels, mirrored from FIELD_LABELS in src/constants.ts (a test keeps them equal). */
export const FIELD_LABELS = Object.freeze({
  businessOwner: 'Business owner',
  executionOwner: 'Delivery owner',
  projectManager: 'Project manager',
  scope: 'Scope',
  planLink: 'Plan link',
  startDate: 'Start date',
  originalEndDate: 'Original end date',
  forecastEndDate: 'Forecast end date',
  nextMilestone: 'Next milestone',
  nextMilestoneDate: 'Next milestone date',
  dependencies: 'Dependencies',
  keyRisk: 'Key risk / blocker',
  decisionNeeded: 'Decision needed',
  decisionOutcome: 'Decision made',
  rag: 'RAG status',
  trending: 'Trend',
  phase: 'Phase',
  validation: 'Validation',
  progress: 'Progress',
})

// ───────────────────────────── columns ─────────────────────────────

/** { fieldKey: columnId } for every tracker field this board has a column for. */
export function resolveColumns(columns = []) {
  const byTitle = new Map(columns.map((column) => [norm(column.title), column.id]))
  return Object.fromEntries(
    SYNCED_FIELDS.flatMap((field) => {
      const hit = FIELD_COLUMNS[field].map(norm).find((title) => byTitle.has(title))
      return hit ? [[field, byTitle.get(hit)]] : []
    }),
  )
}

export function isProjectRegister(columns = []) {
  const resolved = resolveColumns(columns)
  return REQUIRED_FIELDS.every((field) => field in resolved)
}

export const missingFields = (columns = []) => {
  const resolved = resolveColumns(columns)
  return SYNCED_FIELDS.filter((field) => !(field in resolved))
}

// ───────────────────────────── values ─────────────────────────────

const RAG = new Map([
  ['on track', 'green'],
  ['green', 'green'],
  ['at risk', 'amber'],
  ['amber', 'amber'],
  ['yellow', 'amber'],
  ['off track', 'red'],
  ['red', 'red'],
])

const TREND = new Map([
  ['improving', 'improving'],
  ['declining', 'declining'],
  ['flat', 'stable'],
  ['stable', 'stable'],
  ['steady', 'stable'],
])

// Current PMO phases first, then the retired ones, same landing spots as LEGACY_PHASE.
const PHASE = new Map([
  ['discovery', 'discovery'],
  ['planning', 'planning'],
  ['execution', 'execution'],
  ['review', 'review'],
  ['launch', 'launch'],
  ['stabilize', 'stabilize'],
  ['closed', 'closed'],
  ['design', 'planning'],
  ['build', 'execution'],
  ['uat', 'review'],
  ['continuous improvement', 'stabilize'],
  ['close', 'closed'],
])

const VALIDATION = new Map([
  ['not started', 'not_started'],
  ['pending', 'pending'],
  ['in progress', 'in_progress'],
  ['completed', 'completed'],
  ['n a', 'na'],
])

const asText = (value) => (typeof value === 'string' ? value.trim() : '')

/** monday's placeholder label for an unset RAG status. Reads as blank, not as an error. */
const PLACEHOLDER_LABELS = new Set(['project health'])

const parseEnum = (table) => (raw) => table.get(norm(raw))

// monday's "N/A" phase means "not set". null = leave the field alone, with no warning.
const parsePhase = (raw) => {
  const key = norm(raw)
  if (key === 'n a') return null
  return key.startsWith('multi phase') ? 'multi_phase' : PHASE.get(key)
}

const parseDate = (raw) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(asText(raw))
  return match ? match[1] : undefined
}

const parseProgress = (raw) => {
  const match = /-?\d+(?:\.\d+)?/.exec(asText(raw))
  return match ? Math.max(0, Math.min(100, Math.round(Number(match[0])))) : undefined
}

const parseText = (raw) => asText(raw) || undefined

export const PARSERS = Object.freeze({
  rag: parseEnum(RAG),
  trending: parseEnum(TREND),
  phase: parsePhase,
  validation: parseEnum(VALIDATION),
  progress: parseProgress,
  startDate: parseDate,
  originalEndDate: parseDate,
  forecastEndDate: parseDate,
  nextMilestoneDate: parseDate,
})

const parserFor = (field) => PARSERS[field] ?? parseText

/** monday gives `text` for most columns and `display_value` for mirrors and formulas. */
const cellText = (cell) => (cell ? (cell.text ?? cell.display_value ?? '') : '')

/**
 * One monday item -> { mondayId, title, updatedAt, fields, warnings }.
 * `fields` holds only values monday actually has. A blank cell is absent,
 * so a blank never overwrites what someone typed into the tracker.
 */
export function mapItem(item, columnIds) {
  const cells = new Map((item.column_values ?? []).map((cell) => [cell.id, cell]))
  const warnings = []

  const fields = Object.fromEntries(
    SYNCED_FIELDS.flatMap((field) => {
      const id = columnIds[field]
      if (!id) return []
      const raw = cellText(cells.get(id))
      if (asText(raw) === '' || PLACEHOLDER_LABELS.has(norm(raw))) return []
      const parsed = parserFor(field)(raw)
      if (parsed === null) return []
      if (parsed === undefined) {
        warnings.push(`"${item.name}": could not read ${FIELD_LABELS[field]} value "${asText(raw)}".`)
        return []
      }
      return [[field, parsed]]
    }),
  )

  return {
    mondayId: String(item.id),
    title: asText(item.name),
    updatedAt: item.updated_at ?? '',
    fields,
    warnings,
  }
}
