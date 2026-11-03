import type { LogEntry } from '../../src/types'

export declare const LOG_LIMIT: number
export declare const prependLog: (existing: LogEntry[], fresh: LogEntry[]) => LogEntry[]
