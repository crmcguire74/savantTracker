// ⏱️ Optional timer: pull from monday on the interval an admin chose (Admin screen), or the
// MONDAY_SYNC_INTERVAL_MINUTES default.
//
// A one-minute tick reads the current interval, so a change in the Admin screen applies at once with
// no restart. A pull happens only when the interval has passed since the last run. Each pull first
// compares monday's board fingerprint and stops if nothing changed (see service.js).
//
// Rules: only when the token is set; never retires (removing records always needs a person and an
// approval code); one run at a time; a failure is logged and remembered, not thrown. With several
// App Service instances each would pull. That is safe (the merge is idempotent and writes use
// optimistic concurrency) but wasteful, so keep the app on one instance.

export const TICK_MS = 60_000
const SLACK_MS = 5_000

export function startScheduler({ sync, setIntervalImpl = setInterval, clearIntervalImpl = clearInterval, log = console, now = () => Date.now() }) {
  if (!sync.live) return null

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const minutes = await sync.currentInterval()
      if (minutes <= 0) return
      const last = await sync.lastRun()
      if (last?.at && now() - Date.parse(last.at) < minutes * 60_000 - SLACK_MS) return
      const report = await sync.run({ apply: true, retire: false, trigger: 'schedule', skipIfUnchanged: true })
      log.log(
        report.unchanged
          ? 'monday sync: no change in monday'
          : `monday sync: ${JSON.stringify(report.summary)}${report.written ? '' : ' (no changes)'}`,
      )
    } catch (error) {
      log.error(`monday sync failed: ${error.message}`)
    } finally {
      running = false
    }
  }

  const timer = setIntervalImpl(tick, TICK_MS)
  timer.unref?.()
  return { tick, stop: () => clearIntervalImpl(timer) }
}
