import { apiRequest, ensureCsrf, getCsrfToken } from './http'

export type CalcJob = {
  jobId: string
  status: string
  engine: string
  engineVersion?: string | null
  schemeId?: string | null
  schemeRevision?: number | null
  inputHash: string
  params?: Record<string, unknown>
  errorCode?: string | null
  errorMessage?: string | null
  statusUrl: string
  resultUrl: string
}

export type CalcResult = {
  jobId: string
  status: string
  serverVerified: boolean
  engineVersion?: string | null
  inputHash?: string
  pack?: Record<string, unknown>
  message?: string
}

export async function createCalculationJob(input: {
  schemeId: string
  schemeRevision?: number
  params?: Record<string, unknown>
  idempotencyKey: string
}): Promise<CalcJob> {
  if (!getCsrfToken()) await ensureCsrf()
  return apiRequest<CalcJob>('/api/v1/calculations/jobs/', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    json: {
      engine: 'container',
      schemeId: input.schemeId,
      schemeRevision: input.schemeRevision,
      params: input.params || { containerPreset: '40HQ', allowRotate: true },
    },
  })
}

export async function getCalculationJob(jobId: string): Promise<CalcJob> {
  return apiRequest<CalcJob>(`/api/v1/calculations/jobs/${jobId}/`)
}

export async function getCalculationResult(jobId: string): Promise<CalcResult> {
  return apiRequest<CalcResult>(`/api/v1/calculations/jobs/${jobId}/result/`)
}

export async function fetchUsage(): Promise<{
  used: number
  remaining: number
  quota: number
}> {
  return apiRequest('/api/v1/usage/')
}

export async function pollCalculationResult(
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<CalcResult> {
  const interval = opts.intervalMs ?? 800
  const timeout = opts.timeoutMs ?? 60000
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const job = await getCalculationJob(jobId)
    if (job.status === 'succeeded') return getCalculationResult(jobId)
    if (job.status === 'failed' || job.status === 'canceled') {
      return {
        jobId,
        status: job.status,
        serverVerified: false,
        engineVersion: job.engineVersion,
        message: job.errorMessage || job.status,
      }
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('Calculation timed out')
}
