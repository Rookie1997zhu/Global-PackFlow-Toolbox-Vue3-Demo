import { describe, expect, it } from 'vitest'
import {
  applyMapping,
  detectColumnMapping,
  loadSheetFile,
  validateMappedRows,
} from '../shared/import/sheetMapping'

describe('sheetMapping', () => {
  it('detects Korean packing-list headers', () => {
    const headers = ['품명', '규격', 'PO', '카톤번호', '수량', '단위', '총중량', '순중량', '가로', '세로', '높이', '박스수']
    const mapping = detectColumnMapping(headers)
    expect(mapping.sku).toBe(0)
    expect(mapping.description).toBe(1)
    expect(mapping.po).toBe(2)
    expect(mapping.carton).toBe(3)
    expect(mapping.qty).toBe(4)
    expect(mapping.unit).toBe(5)
    expect(mapping.grossKg).toBe(6)
    expect(mapping.netKg).toBe(7)
    expect(mapping.lengthCm).toBe(8)
    expect(mapping.widthCm).toBe(9)
    expect(mapping.heightCm).toBe(10)
    expect(mapping.boxCount).toBe(11)
  })

  it('applies mapping and keeps rawIndex', () => {
    const table = [
      ['품명', '카톤번호', '수량', '총중량', '순중량'],
      ['SKU-A', '1', '10', '5', '4.5'],
      ['SKU-B', '2', '3', '2', '1.8'],
    ]
    const mapping = detectColumnMapping(table[0])
    const rows = applyMapping(table, mapping)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ rawIndex: 1, sku: 'SKU-A', carton: '1', qty: 10, grossKg: 5, netKg: 4.5 })
    expect(rows[1].rawIndex).toBe(2)
  })

  it('flags empty qty, net>gross, and duplicate carton', () => {
    const table = [
      ['품명', '카톤번호', '수량', '총중량', '순중량'],
      ['A', '9', '0', '5', '6'],
      ['B', '9', '2', '3', '2'],
      ['', '', '1', '1', '1'],
    ]
    const rows = applyMapping(table, detectColumnMapping(table[0]))
    const codes = validateMappedRows(rows).map((i) => i.code)
    expect(codes).toContain('errImportQty')
    expect(codes).toContain('errImportNetGross')
    expect(codes).toContain('errImportDupCarton')
    expect(codes).toContain('errImportEmptyKey')
  })

  it('rejects legacy .xls', async () => {
    const file = new File(['x'], 'legacy.xls', { type: 'application/vnd.ms-excel' })
    const result = await loadSheetFile(file)
    expect(result.rows).toEqual([])
    expect(result.errorCode).toBe('errCheckerXlsUnsupported')
  })
})
