import { describe, expect, it } from 'vitest'
import { matchCheckerRows, parseCheckerTable, summarizeDiffs } from '../tools/document-checker/useChecker'

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
})
