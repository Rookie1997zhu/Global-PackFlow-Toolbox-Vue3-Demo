import { describe, expect, it } from 'vitest'
import type { Cargo } from '../shared/types/cargo'
import { validateCargoRow } from '../shared/validation'
import { applyRounding, computeCbmTotals, importCargoCsv } from '../tools/cbm-calculator/useCbm'
import { csv } from '../shared/export/csv'

const sample: Cargo[] = [
  { sku: 'A', length: 40, width: 30, height: 20, weight: 5, qty: 10, price: 1 },
]

describe('cbm calculator', () => {
  it('computes volume, volumetric and chargeable weight', () => {
    const totals = computeCbmTotals(sample, 6000, 'none')
    // 40*30*20/1e6 * 10 = 0.24 m³
    expect(totals.cbm).toBeCloseTo(0.24, 6)
    expect(totals.grossKg).toBeCloseTo(50, 6)
    // volumetric = 40*30*20/6000*10 = 40
    expect(totals.volumetricKg).toBeCloseTo(40, 6)
    expect(totals.chargeableKg).toBeCloseTo(50, 6)
  })

  it('applies rounding rules', () => {
    expect(applyRounding(10.2, 'none')).toBeCloseTo(10.2, 6)
    expect(applyRounding(10.2, 'round')).toBe(10)
    expect(applyRounding(10.2, 'ceil')).toBe(11)
    const ceilTotals = computeCbmTotals(
      [{ sku: 'B', length: 41, width: 30, height: 20, weight: 1, qty: 1, price: 0 }],
      6000,
      'ceil',
    )
    // raw volumetric = 41*30*20/6000 = 4.1 → ceil 5; chargeable max(1,5)=5
    expect(ceilTotals.volumetricKg).toBe(5)
    expect(ceilTotals.chargeableKg).toBe(5)
  })

  it('flags invalid rows', () => {
    const bad = validateCargoRow({
      sku: '',
      length: -1,
      width: 10,
      height: 10,
      weight: 1,
      qty: 1,
      price: 0,
    })
    expect(bad.valid).toBe(false)
    expect(bad.errors.sku).toBe('errSkuRequired')
    expect(bad.errors.length).toBe('errNegative')
  })

  it('imports cargo CSV with cm/kg headers', () => {
    const text = csv([
      ['SKU', 'Length cm', 'Width cm', 'Height cm', 'Weight kg', 'Qty', 'Unit price USD'],
      ['X', '50', '40', '30', '8', '2', '3'],
    ])
    const result = importCargoCsv(text, 'cm', 'kg')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].sku).toBe('X')
    expect(result.rows[0].length).toBe(50)
    expect(result.rows[0].weight).toBe(8)
    expect(result.rows[0].qty).toBe(2)
  })
})
