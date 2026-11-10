/**
 * V1.3.1 PF-002 — confirmed PL/CI lines enter createReport body.
 */
import type { ReportCreateBody, ReportKind, ReportFormat } from '../../api/reports'

export type ConfirmedPackingLine = {
  sku: string
  cartonFrom: number
  cartonTo: number
  qtyPerCarton: number
  grossKg: number
  netKg: number | null
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

export type ConfirmedInvoiceLine = {
  sku: string
  description: string
  qty: number
  unitPrice: number
  unit: string
}

export function buildConfirmedReportBody(opts: {
  kind: ReportKind
  format: ReportFormat
  locale?: string
  schemeId: string
  lines: ConfirmedPackingLine[] | ConfirmedInvoiceLine[]
  meta?: Partial<ReportCreateBody>
  formal?: boolean
}): ReportCreateBody & {
  sourceMode: 'confirmed_lines'
  lines: ConfirmedPackingLine[] | ConfirmedInvoiceLine[]
} {
  const { meta = {}, ...rest } = opts
  return {
    ...meta,
    kind: rest.kind,
    format: rest.format,
    locale: rest.locale,
    schemeId: rest.schemeId,
    sourceMode: 'confirmed_lines',
    lines: rest.lines,
    formal: rest.formal ?? true,
  }
}
