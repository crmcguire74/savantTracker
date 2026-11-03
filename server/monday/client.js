// 🔌 Thin monday.com GraphQL client. One job: send a query, return `data`,
// and survive the two failures monday really has: rate limits and blips.
//
// The token comes from the environment (an App Service setting backed by Key
// Vault in Azure). Use a service account or a firm OAuth app, never a
// personal token: a personal token dies when its owner changes roles.
//
// `fetchImpl` and `sleep` are injectable so tests need no network and no waits.

const ENDPOINT = 'https://api.monday.com/v2'
const DEFAULT_API_VERSION = '2026-04'

export class MondayError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'MondayError'
    this.status = details.status
    this.errors = details.errors ?? []
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const retryable = (status) => status === 429 || status >= 500

export function createMondayClient({
  token = process.env.MONDAY_API_TOKEN,
  apiVersion = process.env.MONDAY_API_VERSION || DEFAULT_API_VERSION,
  endpoint = ENDPOINT,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxAttempts = 4,
} = {}) {
  if (!token) throw new MondayError('MONDAY_API_TOKEN is not set.')

  async function query(gql, variables = {}) {
    let lastError = new MondayError('monday request failed.')

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: token,
            'API-Version': apiVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: gql, variables }),
        })
      } catch (error) {
        lastError = new MondayError(`Cannot reach monday.com: ${error.message}`)
        if (attempt < maxAttempts) await sleep(500 * 2 ** (attempt - 1))
        continue
      }

      if (retryable(response.status)) {
        lastError = new MondayError(`monday.com answered ${response.status}.`, { status: response.status })
        const wait = Number(response.headers?.get?.('retry-after')) * 1000 || 500 * 2 ** (attempt - 1)
        if (attempt < maxAttempts) await sleep(wait)
        continue
      }

      const body = await response.json().catch(() => null)
      if (!response.ok || !body) {
        throw new MondayError(`monday.com answered ${response.status}.`, { status: response.status })
      }
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        throw new MondayError(body.errors.map((error) => error.message).join('; '), {
          status: response.status,
          errors: body.errors,
        })
      }
      return body.data
    }

    throw lastError
  }

  return { query }
}
