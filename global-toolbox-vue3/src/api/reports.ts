import { apiRequest, ensureCsrf, getCsrfToken, ApiError } from './http'

export type ReportKind = 'packing_list' | 'commercial_invoice' | 'diff'
export type ReportFormat = 'pdf' | 'xlsx'

export type ReportDto = {
  id: string
  kind: ReportKind
  format: ReportFormat
  locale: string
  status: string
  templateVersion: string
  sourceRevision?: { schemeId: string; revisionNo: number } | null
  fileId?: string | null
  expiresAt: string
  createdAt: string
  teamId: string
  downloadUrl: string
  diffSummary?: { total: number; failed: number } | null
}

export type ReportCreateBody = {
  kind: ReportKind
  format: ReportFormat
  locale?: string
  schemeId?: string
  revisionNo?: number
  title?: string
  shipper?: string
  consignee?: string
  po?: string
  seller?: string
  buyer?: string
  invoiceNo?: string
  currency?: string
  incoterms?: string
  paymentTerms?: string
  matchMode?: string
  expected?: Record<string, unknown>[]
  actual?: Record<string, unknown>[]
}

export async function createReport(body: ReportCreateBody): Promise<ReportDto> {
  return apiRequest<ReportDto>('/api/v1/reports/', {
    method: 'POST',
    json: body,
  })
}

export async function listReports(page = 1, pageSize = 20): Promise<{
  items: ReportDto[]
  page: number
  pageSize: number
  total: number
}> {
  return apiRequest(`/api/v1/reports/?page=${page}&pageSize=${pageSize}`)
}

export async function downloadReport(reportId: string, filenameHint?: string): Promise<void> {
  if (!getCsrfToken()) await ensureCsrf()
  const res = await fetch(`/api/v1/reports/${reportId}/download/`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    let code = 'API_ERROR'
    let message = `Download failed (${res.status})`
    try {
      const json = (await res.json()) as { ok?: boolean; code?: string; message?: string }
      if (json && json.ok === false) {
        code = json.code || code
        message = json.message || message
      }
    } catch {
      /* ignore */
    }
    throw new ApiError({ code, message, status: res.status })
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = /filename="?([^";]+)"?/i.exec(cd)
  const name = match?.[1] || filenameHint || `report-${reportId}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createAndDownloadReport(body: ReportCreateBody): Promise<ReportDto> {
  const report = await createReport(body)
  await downloadReport(report.id, `${report.kind}.${report.format}`)
  return report
}
