// 📦 The capture file: a raw copy of what the sync reads from monday.
//
// One capture holds the folder tree, the columns of each initiative board and the items of each
// project register. Saved from a live read (npm run monday:capture, or the Admin screen) or
// hand-built for a test. The sync replays it through the same code that handles a live read, so
// a test run proves the real mapping, merge and retire rules without a monday token.
//
// Plain JavaScript, no imports from node, so the browser can use it too.

export const CAPTURE_FORMAT = 'monday-capture'
export const CAPTURE_VERSION = 1

export class CaptureError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CaptureError'
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Returns the capture when it is well formed. Throws CaptureError with a plain-language reason. */
export function validateCapture(capture) {
  if (!isObject(capture)) throw new CaptureError('This is not a monday capture file.')
  if (capture.format !== CAPTURE_FORMAT) {
    throw new CaptureError(`Expected a "${CAPTURE_FORMAT}" file, but this one says "${String(capture.format)}".`)
  }
  if (capture.version !== CAPTURE_VERSION) {
    throw new CaptureError(`Capture version ${String(capture.version)} is not supported. Expected ${CAPTURE_VERSION}.`)
  }
  if (!Array.isArray(capture.folders)) throw new CaptureError('The capture has no "folders" list.')
  if (!Array.isArray(capture.boards)) throw new CaptureError('The capture has no "boards" list.')

  capture.folders.forEach((folder, index) => {
    if (!isObject(folder) || folder.id === undefined || typeof folder.name !== 'string') {
      throw new CaptureError(`Folder ${index + 1} needs an id and a name.`)
    }
  })
  capture.boards.forEach((board, index) => {
    if (!isObject(board) || board.id === undefined || typeof board.name !== 'string') {
      throw new CaptureError(`Board ${index + 1} needs an id and a name.`)
    }
    if (!Array.isArray(board.columns)) throw new CaptureError(`Board "${board.name}" has no "columns" list.`)
    if (!Array.isArray(board.items)) throw new CaptureError(`Board "${board.name}" has no "items" list.`)
    board.items.forEach((item, itemIndex) => {
      if (!isObject(item) || item.id === undefined || typeof item.name !== 'string' || !Array.isArray(item.column_values)) {
        throw new CaptureError(`Item ${itemIndex + 1} on board "${board.name}" needs an id, a name and column_values.`)
      }
    })
  })
  return capture
}

/** Counts for a preview line: "6 pillar folders, 35 boards, 27 items". */
export function describeCapture(capture) {
  return {
    capturedAt: typeof capture.capturedAt === 'string' ? capture.capturedAt : '',
    workspaceId: capture.workspaceId === undefined ? '' : String(capture.workspaceId),
    folders: capture.folders.length,
    boards: capture.boards.length,
    items: capture.boards.reduce((sum, board) => sum + board.items.length, 0),
  }
}
