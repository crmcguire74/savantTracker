// 🧾 CSV that Excel opens cleanly: RFC 4180 quoting, CRLF line ends, and a
// byte-order mark so names with accents survive the double-click.

export type Cell = string | number | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: Cell): string {
  let text = value === null || value === undefined ? '' : String(value)
  // A free-text field that starts like a formula would run as one in Excel.
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
