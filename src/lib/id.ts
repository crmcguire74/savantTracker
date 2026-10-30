// 🆔 Ids keep the artifact's readable `prefix-timestamp-random` shape so
// records exported from the old tracker and records created here sort and
// read the same way.

export const uid = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`

export const nowISO = (): string => new Date().toISOString()

export const dateOnly = (iso: string): string => (iso ? String(iso).slice(0, 10) : '')

export const daysSince = (iso: string): number | null => {
  if (!iso) return null
  const parsed = new Date(iso).getTime()
  if (Number.isNaN(parsed)) return null
  return Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000))
}
