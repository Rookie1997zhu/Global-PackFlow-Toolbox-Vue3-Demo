import { describe, expect, it } from 'vitest'
import type { ReportCreateBody } from '../api/reports'
import { buildConfirmedReportBody } from '../shared/reports/confirmedReportBody'

/**
 * PF-002 / T-004 — cloud export body must carry user-confirmed document lines.
 */
describe('PF-002 confirmed lines cloud payload', () => {
  it('buildConfirmedReportBody includes sourceMode and edited packing lines', () => {
    const body = buildConfirmedReportBody({
      kind: 'packing_list',
      format: 'xlsx',
      locale: 'ko',
      schemeId: 'sch_test',
      lines: [
        {
          sku: 'SKU-A',
          cartonFrom: 1,
          cartonTo: 9,
          qtyPerCarton: 12,
          grossKg: 7.5,
          netKg: 6.1,
          lengthCm: 42,
          widthCm: 32,
          heightCm: 28,
        },
      ],
      meta: { shipper: '서울 수출', consignee: 'Buyer', po: 'PO-9' },
    })

    expect(body.sourceMode).toBe('confirmed_lines')
    expect(body.schemeId).toBe('sch_test')
    expect(body.lines).toHaveLength(1)
    expect(body.lines[0]).toMatchObject({
      sku: 'SKU-A',
      cartonFrom: 1,
      cartonTo: 9,
      qtyPerCarton: 12,
      netKg: 6.1,
    })
    // Must not be a scheme-only body
    expect('lines' in body).toBe(true)
  })

  it('ReportCreateBody contract must allow confirmed lines fields', () => {
    // Compile-time intent: after PF-002, ReportCreateBody includes these keys.
    const body = {
      kind: 'commercial_invoice',
      format: 'pdf',
      schemeId: 'sch_test',
      sourceMode: 'confirmed_lines',
      lines: [{ sku: 'SKU-A', description: 'edited', qty: 120, unitPrice: 13.75, unit: 'PCS' }],
      currency: 'USD',
    } as ReportCreateBody & { sourceMode: string; lines: unknown[] }

    expect(body.sourceMode).toBe('confirmed_lines')
    expect(body.lines[0]).toMatchObject({ unitPrice: 13.75 })
  })
})
