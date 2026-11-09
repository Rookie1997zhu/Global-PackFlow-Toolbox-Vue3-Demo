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

  it('distinguishes shipment, perSku and perPiece charge modes', () => {
    const mixed: Cargo[] = [
      { sku: 'LIGHT', length: 60, width: 40, height: 40, weight: 1, qty: 2, price: 0 },
      { sku: 'HEAVY', length: 20, width: 20, height: 20, weight: 20, qty: 3, price: 0 },
    ]
    // LIGHT unit vol = 16; HEAVY unit vol ≈ 1.333
    const shipment = computeCbmTotals(mixed, 6000, 'none', 'shipment')
    const perSku = computeCbmTotals(mixed, 6000, 'none', 'perSku')
    // shipment: gross=62; vol≈36 → 62; perSku: 32+60=92
    expect(shipment.chargeableKg).toBeCloseTo(62, 4)
    expect(perSku.chargeableKg).toBeCloseTo(92, 4)

    // ceil makes per-piece diverge from per-SKU: unit vol 4.1 → ceil 5 * 2 = 10; line vol 8.2 → ceil 9
    const pieceCase: Cargo[] = [
      { sku: 'P', length: 41, width: 30, height: 20, weight: 1, qty: 2, price: 0 },
    ]
    const perSkuCeil = computeCbmTotals(pieceCase, 6000, 'ceil', 'perSku')
    const perPieceCeil = computeCbmTotals(pieceCase, 6000, 'ceil', 'perPiece')
    expect(perSkuCeil.chargeableKg).toBe(9)
    expect(perPieceCeil.chargeableKg).toBe(10)
  })
})
