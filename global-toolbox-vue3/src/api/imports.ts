import { apiRequest } from './http'
import type { ApiScheme } from './schemes'
import type { Cargo } from '../shared/types/cargo'

export type ImportIssue = {
  rawIndex: number
  code: string
  field?: string
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
  teamId: string
}

export type ImportCommitDto = {
  import: ImportPreviewDto
  scheme: ApiScheme
  cargo: Cargo[]
}

export async function importPreview(fileId: string, mapping?: Record<string, number>): Promise<ImportPreviewDto> {
  return apiRequest<ImportPreviewDto>('/api/v1/imports/preview/', {
    method: 'POST',
    json: mapping ? { fileId, mapping } : { fileId },
  })
}

export async function importCommit(
  importId: string,
  body: { name?: string; mapping?: Record<string, number>; targetSchemeId?: string } = {},
): Promise<ImportCommitDto> {
  return apiRequest<ImportCommitDto>(`/api/v1/imports/${importId}/commit/`, {
    method: 'POST',
    json: body,
  })
}
