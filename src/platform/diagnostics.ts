// 🩺 Module faults. Every failure the platform contains (a render crash, a
// bundle that would not load, a manifest function that threw) is reported
// here with the module's id, so one place can forward them to telemetry.
// Attach a sink with `onModuleFault`; nothing else needs to change.

export type FaultPhase = 'render' | 'load' | 'manifest'

export interface ModuleFault {
  moduleId: string
  phase: FaultPhase
  error: unknown
  at: string
  componentStack?: string
}

const MAX_RECENT = 20
const recent: ModuleFault[] = []
const listeners = new Set<(fault: ModuleFault) => void>()

export function reportModuleFault(fault: Omit<ModuleFault, 'at'>): void {
  const entry: ModuleFault = { ...fault, at: new Date().toISOString() }
  recent.push(entry)
  if (recent.length > MAX_RECENT) recent.shift()
  console.error(`[module:${fault.moduleId}] ${fault.phase} failed`, fault.error)
  for (const listener of listeners) {
    try {
      listener(entry)
    } catch {
      // A broken telemetry sink must not take the app down with it.
    }
  }
}

export function onModuleFault(listener: (fault: ModuleFault) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The last few faults, newest last. */
export function recentModuleFaults(): readonly ModuleFault[] {
  return [...recent]
}

/**
 * Runs module-supplied code that the shell calls outside the module's error
 * boundary (manifest callbacks). A throw is reported and the fallback used.
 */
export function guard<T>(moduleId: string, fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (error) {
    reportModuleFault({ moduleId, phase: 'manifest', error })
    return fallback
  }
}
