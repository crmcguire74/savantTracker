// 🧱 Route wiring, independent of where documents actually live.
//
// `createApp({ store })` takes anything shaped like server/cosmos.js, which
// means the routes are testable against an in-memory store with no Azure
// and no network. index.js composes this with the real Cosmos store.
//
// Routes the browser's RestAdapter expects:
//   GET    /api/documents?prefix=tracker/
//   GET    /api/documents/:key
//   PUT    /api/documents/:key      body { value }, header If-Match: "<version>"
//   DELETE /api/documents/:key
//   GET    /api/stream?keys=a,b     server-sent events
// Plus /api/me for identity and role, and /api/health for the probe.

import express from 'express'
import compression from 'compression'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readIdentity, requireAdmin, requireEditor, requireReader } from './auth.js'

const here = dirname(fileURLToPath(import.meta.url))

// The access policy decides who sees which views and reports; only an admin
// may change it. Matches DOC_KEYS.access in src/data/repository.ts.
const ADMIN_DOCUMENTS = new Set(['tracker.access'])

const requireWriter = (request, response, next) =>
  ADMIN_DOCUMENTS.has(request.params.key) ? requireAdmin(request, response, next) : requireEditor(request, response, next)

const ifMatchVersion = (request) => {
  const header = request.headers['if-match']
  if (!header) return undefined
  const parsed = Number(String(header).replace(/"/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function createApp({ store, staticRoot = join(here, '..', 'dist'), serveStatic = true }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(
    compression({
      filter: (req, res) => !req.path.startsWith('/api/stream') && compression.filter(req, res),
    }),
  )
  app.use(express.json({ limit: '10mb' }))

  const isConflict = (error) => error?.name === 'ConflictError'

  const fail = (response, error) => {
    console.error(error)
    response.status(500).json({ error: 'Storage request failed.' })
  }

  app.get('/api/health', async (_request, response) => {
    try {
      await store.ping()
      response.json({ ok: true })
    } catch (error) {
      console.error(error)
      response.status(503).json({ ok: false, error: 'Cannot reach the database.' })
    }
  })

  app.get('/api/me', (request, response) => {
    const identity = readIdentity(request)
    if (!identity) {
      response.status(401).json({ error: 'Not signed in.' })
      return
    }
    response.json({
      id: identity.id,
      name: identity.name,
      roles: identity.roles,
      canWrite: identity.canWrite,
      isAdmin: identity.isAdmin,
      // true when the server has no real sign-in behind it, so the browser
      // knows to keep offering the "set your name" prompt.
      local: identity.source === 'local-dev',
    })
  })

  app.use('/api/documents', requireReader)
  app.use('/api/stream', requireReader)

  app.get('/api/documents', async (request, response) => {
    try {
      response.json(await store.listDocuments(String(request.query.prefix ?? '')))
    } catch (error) {
      fail(response, error)
    }
  })

  app.get('/api/documents/:key', async (request, response) => {
    try {
      const found = await store.readDocument(request.params.key)
      if (!found) {
        response.status(404).json({ error: 'Not found' })
        return
      }
      response.json(found.doc)
    } catch (error) {
      fail(response, error)
    }
  })

  app.put('/api/documents/:key', requireWriter, async (request, response) => {
    try {
      response.json(await store.writeDocument(request.params.key, request.body?.value, ifMatchVersion(request)))
    } catch (error) {
      if (isConflict(error)) {
        response.status(409).json({ error: 'Version conflict', version: error.currentVersion })
        return
      }
      fail(response, error)
    }
  })

  app.delete('/api/documents/:key', requireWriter, async (request, response) => {
    try {
      await store.deleteDocument(request.params.key, ifMatchVersion(request))
      response.status(204).end()
    } catch (error) {
      if (isConflict(error)) {
        response.status(409).json({ error: 'Version conflict', version: error.currentVersion })
        return
      }
      fail(response, error)
    }
  })

  /**
   * Server-sent events. The Cosmos change feed is the precise tool, but it
   * wants a lease container and a long-lived worker. For three documents
   * and a handful of viewers, polling versions server-side and pushing only
   * on a change costs almost nothing and keeps browsers in sync in seconds.
   */
  app.get('/api/stream', async (request, response) => {
    const keys = String(request.query.keys ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .slice(0, 10)

    if (keys.length === 0) {
      response.status(400).json({ error: 'No keys requested.' })
      return
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.write(': connected\n\n')

    const seen = new Map()
    let stopped = false

    const poll = async () => {
      if (stopped) return
      try {
        for (const key of keys) {
          const found = await store.readDocument(key)
          const version = found?.doc.version ?? 0
          if (seen.has(key) && seen.get(key) !== version) {
            // Unnamed event on purpose: EventSource.onmessage only fires for
            // the default event type, and that is what the client listens on.
            response.write(`data: ${JSON.stringify({ key, version })}\n\n`)
          }
          seen.set(key, version)
        }
      } catch (error) {
        console.error('stream poll failed', error)
      }
    }

    await poll()
    const timer = setInterval(poll, Number(process.env.STREAM_POLL_MS || 5000))
    const heartbeat = setInterval(() => response.write(': ping\n\n'), 25000)

    request.on('close', () => {
      stopped = true
      clearInterval(timer)
      clearInterval(heartbeat)
    })
  })

  if (serveStatic) {
    // Hashed assets cache hard; index.html, the service worker and the app
    // manifest never do, so a deploy takes effect on the next refresh and
    // installed copies notice the new sw.js on their next update check.
    const revalidate = new Set(['index.html', 'sw.js', 'manifest.webmanifest'])
    app.use(
      express.static(staticRoot, {
        index: false,
        setHeaders: (response, path) => {
          const normalized = path.split('\\').join('/')
          const name = normalized.slice(normalized.lastIndexOf('/') + 1)
          if (revalidate.has(name)) response.setHeader('Cache-Control', 'no-cache')
          else if (normalized.includes('/assets/'))
            response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          if (name === 'manifest.webmanifest') response.setHeader('Content-Type', 'application/manifest+json')
        },
      }),
    )

    app.get('*', (request, response) => {
      if (request.path.startsWith('/api/')) {
        response.status(404).json({ error: 'No such API route.' })
        return
      }
      response.sendFile(join(staticRoot, 'index.html'))
    })
  }

  return app
}
