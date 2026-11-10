import { apiRequest, ensureCsrf } from './http'
import type { Cargo } from '../shared/types/cargo'

export type ApiScheme = {
  version: number
  id: string
  name: string
  updatedAt: string
  locale?: string | null
  cargo: Cargo[]
  meta?: Record<string, unknown>
  rowVersion: number
  revisionNo?: number
  teamId?: string
  imported?: boolean
  deduped?: boolean
}

export type SchemeListPayload = {
  items: ApiScheme[]
  page: number
  pageSize: number
  total: number
}

export async function listSchemesApi(teamId?: string): Promise<SchemeListPayload> {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  return apiRequest<SchemeListPayload>(`/api/v1/schemes/${q}`)
}

export async function createSchemeApi(body: {
  version: number
  name: string
  locale?: string
  cargo: Cargo[]
  meta?: Record<string, unknown>
  teamId?: string
}): Promise<ApiScheme> {
  await ensureCsrf()
  return apiRequest('/api/v1/schemes/', { method: 'POST', json: body })
}

export async function updateSchemeApi(
  id: string,
  body: {
    version: number
    name: string
    locale?: string
    cargo: Cargo[]
    meta?: Record<string, unknown>
    rowVersion: number
  },
): Promise<ApiScheme> {
  await ensureCsrf()
  return apiRequest(`/api/v1/schemes/${encodeURIComponent(id)}/`, {
    method: 'PUT',
    json: body,
    headers: { 'If-Match': String(body.rowVersion) },
  })
}

export async function deleteSchemeApi(id: string): Promise<void> {
  await ensureCsrf()
  await apiRequest(`/api/v1/schemes/${encodeURIComponent(id)}/`, { method: 'DELETE' })
}

export async function importDemoSchemeApi(body: {
  version: number
  id?: string
  name: string
  locale?: string
  cargo: Cargo[]
  meta?: Record<string, unknown>
  teamId?: string
}): Promise<ApiScheme> {
  await ensureCsrf()
  return apiRequest('/api/v1/schemes/import-demo/', { method: 'POST', json: body })
}
