import { describe, expect, it } from 'vitest'
import { mappedToCargo, mappedToCargoStrict } from '../shared/import/mappedToCargo'
import { applyMapping, detectColumnMapping } from '../shared/import/sheetMapping'

describe('mappedToCargo (no demo defaults)', () => {
  it('maps complete Korean rows', () => {
    const table = [
      ['품명', '수량', '총중량', '가로', '세로', '높이'],
      ['SKU-A', '60', '7.5', '42', '32', '28'],
    ]
    const cargo = mappedToCargo(applyMapping(table, detectColumnMapping(table[0])))
    expect(cargo).toHaveLength(1)
    expect(cargo[0]).toMatchObject({ sku: 'SKU-A', qty: 60, length: 42, width: 32, height: 28, weight: 7.5 })
  })

  it('skips rows missing dimensions instead of filling 40x30x20/5', () => {
    const table = [
      ['품명', '수량', '총중량'],
      ['SKU-X', '10', '5'],
    ]
    const result = mappedToCargoStrict(applyMapping(table, detectColumnMapping(table[0])))
    expect(result.cargo).toEqual([])
    expect(result.skipped[0]?.code).toBe('CARGO_DIMENSIONS_REQUIRED')
  })
})
