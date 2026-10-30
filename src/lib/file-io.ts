// 💿 File in, file out. No capability layer, no host APIs: a Blob and an
// anchor on the way out, a FileReader on the way in. Works from a local file,
// an intranet share, or any static host.

import { AppFileError, parseAppFile, serializeAppFile, type AppFile, type ParseResult } from '../data/appfile'

export function appFileName(tag?: string): string {
  const stamp = new Date().toISOString()
  const day = stamp.slice(0, 10)
  const time = stamp.slice(11, 16).replace(':', '')
  return `savant-initiatives-tracker-${day}-${time}${tag ? `-${tag}` : ''}.json`
}

/** Hands the browser a JSON file to save. Returns the name it was offered as. */
export function downloadAppFile(file: AppFile, tag?: string): string {
  const name = appFileName(tag)
  downloadText(name, serializeAppFile(file), 'application/json')
  return name
}

/** Hands the browser any text file to save, under the given name. */
export function downloadText(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}

/** Reads a picked file into a validated, normalized app file. */
export async function loadAppFile(file: File): Promise<ParseResult> {
  const text = await readFileAsText(file)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AppFileError('That file is not valid JSON.')
  }
  return parseAppFile(parsed)
}

export { AppFileError }
