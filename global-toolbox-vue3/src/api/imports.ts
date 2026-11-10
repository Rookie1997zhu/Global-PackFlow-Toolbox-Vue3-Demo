import { apiRequest, ensureCsrf } from './http'
import type { ApiScheme } from './schemes'
import type { ApiShipment } from './shipments'
import type { Cargo } from '../shared/types/cargo'

export type ImportIssue = {
  rawIndex: number
  code: string
  field?: string
  message?: string
  count?: number
}

export type ImportSheetInfo = {
  index: number
  name: string
}

export type ImportPreviewDto = {
  id: string
  fileId: string
  status: string
  mapping: Record<string, number>
  suggestedMapping: Record<string, number>
  headers: string[]
  issues: ImportIssue[]
  previewRows: string[][]
  rowCount: number
  mappedSample: unknown[]
  sheetIndex?: number
  sheets?: ImportSheetInfo[]
  teamId: string
}

export type ImportCommitDto = {
  import: ImportPreviewDto
  scheme?: ApiScheme
  cargo?: Cargo[]
  shipment?: ApiShipment
  skippedRows?: number
  issues?: ImportIssue[]
}

export type MappingTemplateDto = {
  id: string
  name: string
  mapping: Record<string, number>
  sheetHint?: string
  teamId: string
  createdAt?: string
  updatedAt?: string
}

export async function importPreview(
  fileId: string,
  mapping?: Record<string, number>,
  sheetIndex?: number,
): Promise<ImportPreviewDto> {
  const body: Record<string, unknown> = { fileId }
  if (mapping) body.mapping = mapping
  if (sheetIndex !== undefined && sheetIndex !== null) body.sheetIndex = sheetIndex
  return apiRequest<ImportPreviewDto>('/api/v1/imports/preview/', {
    method: 'POST',
    json: body,
  })
}

export async function importCommit(
  importId: string,
  body: {
    name?: string
    mapping?: Record<string, number>
    targetSchemeId?: string
    targetShipmentId?: string
    target?: 'scheme' | 'shipment'
    shipmentNo?: string
    sheetIndex?: number
  } = {},
): Promise<ImportCommitDto> {
  return apiRequest<ImportCommitDto>(`/api/v1/imports/${importId}/commit/`, {
    method: 'POST',
    json: body,
  })
}

export async function listMappingTemplates(): Promise<{ items: MappingTemplateDto[] }> {
  return apiRequest('/api/v1/import-mapping-templates/')
}

export async function saveMappingTemplate(body: {
  name: string
  mapping: Record<string, number>
  sheetHint?: string
}): Promise<MappingTemplateDto> {
  await ensureCsrf()
  return apiRequest('/api/v1/import-mapping-templates/', {
    method: 'POST',
    json: body,
  })
}

export async function deleteMappingTemplate(id: string): Promise<void> {
  await ensureCsrf()
  await apiRequest(`/api/v1/import-mapping-templates/${id}/`, { method: 'DELETE' })
}
