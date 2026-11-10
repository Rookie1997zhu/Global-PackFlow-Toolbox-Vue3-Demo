import { apiRequest, ensureCsrf } from './http'
import type { ReportDto, ReportFormat, ReportKind } from './reports'

export type ShipmentParties = {
  customer?: string
  seller?: string
  shipper?: string
  consignee?: string
  buyer?: string
  po?: string
  incoterms?: string
  currency?: string
  paymentTerms?: string
}

export type ShipmentProductLine = {
  sku: string
  description?: string
  pieceQty: number
  unit?: string
  unitPrice?: number
  currency?: string
}

export type ShipmentCartonBatch = {
  sku: string
  piecesPerCarton: number
  cartonCount: number
  lastCartonQty?: number | null
  grossKg?: number
  netKg?: number | null
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

export type ShipmentPayload = {
  parties: ShipmentParties
  productLines: ShipmentProductLine[]
  cartonBatches: ShipmentCartonBatch[]
  checklist?: Record<string, unknown>
}

export type ShipmentStatus = 'draft' | 'ready' | 'confirmed' | 'shipped' | 'archived'

export type ApiShipment = {
  id: string
  shipmentNo: string
  status: ShipmentStatus
  rowVersion: number
  revisionNo?: number | null
  contentHash?: string | null
  payload: ShipmentPayload
  teamId: string
  createdAt?: string
  updatedAt?: string
  archivedAt?: string | null
}

export type ShipmentListPayload = {
  items: ApiShipment[]
  page: number
  pageSize: number
  total: number
}

export type ShipmentDocumentLink = {
  id: string
  purpose: 'pl' | 'ci' | 'diff'
  revisionNo?: number | null
  snapshotId: string
  createdAt?: string
}

export type ShipmentPlanLink = {
  id: string
  planType: string
  label: string
  revisionNo?: number | null
  calculationJobId?: string | null
  inputHash?: string
  resultHash?: string
  createdAt?: string
}

export type ShipmentEventItem = {
  id: string
  eventType: string
  reason: string
  meta?: Record<string, unknown>
  actorId?: string | null
  createdAt?: string
}

export async function listShipmentsApi(params?: {
  teamId?: string
  q?: string
  status?: string
  page?: number
}): Promise<ShipmentListPayload> {
  const qs = new URLSearchParams()
  if (params?.teamId) qs.set('teamId', params.teamId)
  if (params?.q) qs.set('q', params.q)
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiRequest<ShipmentListPayload>(`/api/v1/shipments/${suffix}`)
}

export async function createShipmentApi(body: {
  shipmentNo: string
  payload?: ShipmentPayload
  teamId?: string
}): Promise<ApiShipment> {
  await ensureCsrf()
  return apiRequest('/api/v1/shipments/', { method: 'POST', json: body })
}

export async function getShipmentApi(id: string): Promise<ApiShipment> {
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/`)
}

export async function updateShipmentApi(
  id: string,
  body: {
    payload: ShipmentPayload
    rowVersion: number
    shipmentNo?: string
    reason?: string
  },
): Promise<ApiShipment> {
  await ensureCsrf()
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/`, {
    method: 'PUT',
    json: body,
    headers: { 'If-Match': String(body.rowVersion) },
  })
}

export async function transitionShipmentStatusApi(
  id: string,
  body: { status: ShipmentStatus; rowVersion?: number; reason?: string },
): Promise<ApiShipment> {
  await ensureCsrf()
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/status/`, {
    method: 'POST',
    json: body,
  })
}

export async function listShipmentRevisionsApi(id: string): Promise<{
  items: Array<{
    revisionNo: number
    schemaVersion: number
    contentHash: string
    createdAt: string
    creatorId?: string | null
  }>
}> {
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/revisions/`)
}

export async function restoreShipmentRevisionApi(id: string, rev: number): Promise<ApiShipment> {
  await ensureCsrf()
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/revisions/${rev}/restore/`, {
    method: 'POST',
    json: {},
  })
}

export async function createShipmentReportApi(
  id: string,
  body: { kind: ReportKind; format: ReportFormat; locale?: string; formal?: boolean },
): Promise<
  ReportDto & {
    shipmentRevision?: { shipmentId: string; revisionNo: number }
    shipmentDocumentId?: string
  }
> {
  await ensureCsrf()
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/reports/`, {
    method: 'POST',
    json: body,
  })
}

export async function listShipmentDocumentsApi(id: string): Promise<{ items: ShipmentDocumentLink[] }> {
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/documents/`)
}

export async function listShipmentPlansApi(id: string): Promise<{ items: ShipmentPlanLink[] }> {
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/plans/`)
}

export async function linkShipmentPlanApi(
  id: string,
  body: { calculationJobId?: string; planType?: string; label?: string },
): Promise<ShipmentPlanLink> {
  await ensureCsrf()
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/plans/`, {
    method: 'POST',
    json: body,
  })
}

export async function listShipmentEventsApi(id: string): Promise<{ items: ShipmentEventItem[] }> {
  return apiRequest(`/api/v1/shipments/${encodeURIComponent(id)}/events/`)
}

export function emptyShipmentPayload(): ShipmentPayload {
  return {
    parties: {
      customer: '',
      seller: '',
      shipper: '',
      consignee: '',
      buyer: '',
      po: '',
      incoterms: '',
      currency: 'USD',
      paymentTerms: '',
    },
    productLines: [],
    cartonBatches: [],
    checklist: {},
  }
}
