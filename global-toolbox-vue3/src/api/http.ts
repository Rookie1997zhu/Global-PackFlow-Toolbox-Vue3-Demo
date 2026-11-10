/** Shared fetch helper: cookies + CSRF + PackFlow {ok,data} envelope. */

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly errors: unknown

  constructor(opts: { code: string; message: string; status: number; errors?: unknown }) {
    super(opts.message)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.errors = opts.errors
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; code?: string; message?: string; errors?: unknown }

let csrfToken: string | null = null

export function getCsrfToken(): string | null {
  return csrfToken
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export async function ensureCsrf(): Promise<string> {
  const res = await fetch('/api/v1/auth/csrf/', {
    method: 'GET',
    credentials: 'include',
  })
  const body = (await res.json()) as Envelope<{ csrfToken: string }>
  if (!res.ok || !body || body.ok !== true) {
    throw new ApiError({
      code: 'CSRF_FAILED',
      message: 'Failed to obtain CSRF token',
      status: res.status,
    })
  }
  csrfToken = body.data.csrfToken
  return csrfToken
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {})
  const method = (init.method || 'GET').toUpperCase()
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (method !== 'GET' && method !== 'HEAD') {
    if (!csrfToken) await ensureCsrf()
    if (csrfToken) headers.set('X-CSRFToken', csrfToken)
  }

  const res = await fetch(path, {
    ...init,
    method,
    credentials: 'include',
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })

  if (res.status === 204) {
    return undefined as T
  }

  let body: Envelope<T> | null = null
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    body = null
  }

  if (!res.ok || !body || body.ok !== true) {
    const errBody = body && body.ok === false ? body : null
    throw new ApiError({
      code: errBody?.code || (res.status === 409 ? 'CONFLICT' : 'API_ERROR'),
      message: errBody?.message || `Request failed (${res.status})`,
      status: res.status,
      errors: errBody?.errors,
    })
  }
  return body.data
}
