import { describe, expect, it } from 'vitest'
import { applyMapping, detectColumnMapping } from '../shared/import/sheetMapping'
import {
  computePackingTotals,
  cartonCountOf,
  lineCbm,
  packingFromCargo,
  packingFromMapped,
  validatePackingLines,
} from '../tools/packing-list/usePacking'

describe('packing list', () => {
  it('builds carton ranges from cargo and totals consistently', () => {
    const lines = packingFromCargo([
      {
        sku: 'A',
        length: 40,
        width: 30,
        height: 20,
        weight: 5,
        qty: 2,
        price: 1,
        quantityBasis: 'carton',
        netKg: 4.5,
      },
      {
        sku: 'B',
        length: 50,
        width: 40,
        height: 30,
        weight: 8,
        qty: 1,
        price: 2,
        quantityBasis: 'carton',
        netKg: 7,
      },
    ])
    expect(lines[0].cartonFrom).toBe(1)
    expect(lines[0].cartonTo).toBe(2)
    expect(lines[1].cartonFrom).toBe(3)
    expect(lines[1].cartonTo).toBe(3)
    expect(cartonCountOf(lines[0])).toBe(2)
    const totals = computePackingTotals(lines)
    expect(totals.cartonCount).toBe(3)
    expect(totals.totalQty).toBe(3)
    expect(totals.cbm).toBeCloseTo(lineCbm(lines[0]) + lineCbm(lines[1]), 6)
  })

  it('flags net > gross and inverted carton range', () => {
    const codes = validatePackingLines([
      {
        id: '1',
        sku: 'X',
        cartonFrom: 5,
        cartonTo: 2,
        qtyPerCarton: 1,
        grossKg: 1,
        netKg: 2,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
      },
    ])
    expect(codes).toContain('errPackingCartonRange')
    expect(codes).toContain('errPackingNetGross')
  })

  it('builds packing lines from Korean mapped rows', () => {
    const table = [
      ['품명', '카톤번호', '수량', '총중량', '순중량', '가로', '세로', '높이', '박스수'],
      ['SKU-A', '1', '120', '7.5', '6.9', '42', '32', '28', '120'],
    ]
    const lines = packingFromMapped(applyMapping(table, detectColumnMapping(table[0])))
    expect(lines[0].sku).toBe('SKU-A')
    expect(lines[0].cartonFrom).toBe(1)
    expect(lines[0].cartonTo).toBe(120)
    expect(lines[0].qtyPerCarton).toBe(1)
    expect(lines[0].grossKg).toBeCloseTo(7.5, 6)
  })
})
