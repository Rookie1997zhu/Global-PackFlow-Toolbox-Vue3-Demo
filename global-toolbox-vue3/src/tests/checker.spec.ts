import { describe, expect, it } from 'vitest'
import { parseCsv } from '../shared/export/csv'
import {
  loadCheckerFile,
  matchCheckerRows,
  parseCheckerTable,
  summarizeDiffs,
} from '../tools/document-checker/useChecker'

const KR_EXPECTED = `품명,카톤번호,PO,수량,단위,총중량,순중량,금액
SKU-A 선물박스,1,PO-KR-2026-01,120,PCS,900,828,1500
SKU-B 액세서리,121,PO-KR-2026-01,80,PCS,416,384,336
SKU-C 부품,201,PO-KR-2026-01,40,PCS,456,420,720`

const KR_ACTUAL = `품명,카톤번호,PO,수량,단위,총중량,순중량,금액
SKU-A 선물박스,1,PO-KR-2026-01,120,PCS,900,828,1500
SKU-B 액세서리,121,PO-KR-2026-01,78,BOX,400,384,320
SKU-C 부품,201,PO-KR-2026-01,40,PCS,456,420,720
SKU-D 신규,301,PO-KR-2026-01,10,PCS,50,45,100`

describe('document checker', () => {
  it('parses headers and matches qty/weight/amount/unit', () => {
    const expected = parseCheckerTable(
      [
        ['SKU', 'Carton', 'Qty', 'Weight', 'Amount', 'Unit'],
        ['A', '1', '10', '5', '100', 'PCS'],
        ['B', '2', '2', '3', '20', 'PCS'],
      ],
      'expected',
    ).rows
    const actual = parseCheckerTable(
      [
        ['sku', 'ctn', 'quantity', 'gross_kg', 'value', 'uom'],
        ['A', '1', '10', '5', '100', 'PCS'],
        ['B', '2', '3', '3.5', '22', 'BOX'],
      ],
      'actual',
    ).rows

    const diffs = matchCheckerRows(expected, actual)
    const kinds = diffs.map((d) => d.kind)
    expect(kinds).toContain('ok')
    expect(kinds).toContain('qty_mismatch')
    expect(kinds).toContain('weight_mismatch')
    expect(kinds).toContain('amount_mismatch')
    expect(kinds).toContain('unit_mismatch')
    const summary = summarizeDiffs(diffs)
    expect(summary.passed).toBe(1)
    expect(summary.failed).toBe(1)
  })

  it('detects missing and duplicate keys', () => {
    const expected = parseCheckerTable(
      [
        ['SKU', 'Qty'],
        ['A', '1'],
        ['A', '1'],
        ['C', '1'],
      ],
      'expected',
    ).rows
    const actual = parseCheckerTable(
      [
        ['SKU', 'Qty'],
        ['A', '1'],
        ['B', '1'],
      ],
      'actual',
    ).rows
    const diffs = matchCheckerRows(expected, actual)
    expect(diffs.some((d) => d.kind === 'duplicate_expected')).toBe(true)
    expect(diffs.some((d) => d.kind === 'missing_actual')).toBe(true)
    expect(diffs.some((d) => d.kind === 'missing_expected')).toBe(true)
  })

  it('rejects legacy .xls with a clear error code', async () => {
    const file = new File(['not-a-real-xls'], 'legacy.xls', { type: 'application/vnd.ms-excel' })
    const result = await loadCheckerFile(file, 'expected')
    expect(result.rows).toEqual([])
    expect(result.errorCode).toBe('errCheckerXlsUnsupported')
  })

  it('KR golden fixtures hit qty/weight/amount/unit/missing with fixHint rows', () => {
    const expected = parseCheckerTable(parseCsv(KR_EXPECTED), 'expected').rows
    const actual = parseCheckerTable(parseCsv(KR_ACTUAL), 'actual').rows
    expect(expected).toHaveLength(3)
    expect(actual).toHaveLength(4)

    const diffs = matchCheckerRows(expected, actual, 'sku+carton')
    const kinds = diffs.map((d) => d.kind)
    expect(kinds).toContain('ok')
    expect(kinds).toContain('qty_mismatch')
    expect(kinds).toContain('weight_mismatch')
    expect(kinds).toContain('amount_mismatch')
    expect(kinds).toContain('unit_mismatch')
    expect(kinds).toContain('missing_expected')

    const qtyDiff = diffs.find((d) => d.kind === 'qty_mismatch')
    expect(qtyDiff?.expectedRow).toBe(2)
    expect(qtyDiff?.actualRow).toBe(2)
    expect(qtyDiff?.fixHint).toMatch(/qty 80/)
    expect(qtyDiff?.fixHint).toMatch(/qty 78/)

    const summary = summarizeDiffs(diffs)
    expect(summary.passed).toBe(2)
    expect(summary.failed).toBe(2)
  })

  it('supports po+sku match mode', () => {
    const expected = parseCheckerTable(parseCsv(KR_EXPECTED), 'expected', 'po+sku').rows
    const actual = parseCheckerTable(parseCsv(KR_ACTUAL), 'actual', 'po+sku').rows
    const diffs = matchCheckerRows(expected, actual, 'po+sku')
    expect(diffs.some((d) => d.key.includes('po-kr-2026-01'))).toBe(true)
    expect(diffs.some((d) => d.kind === 'qty_mismatch')).toBe(true)
  })
})

