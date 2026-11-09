import { describe, expect, it } from 'vitest'
import { compareFreight, computeFreightLine, type FreightRateConfig } from '../tools/freight-comparison/useFreight'

const express: FreightRateConfig = {
  id: 'express',
  labelKey: 'shipExpress',
  rate: 5,
  minCharge: 100,
  fixedFee: 10,
  percentSurcharge: 10,
  currency: 'USD',
  etaDays: 3,
  basis: 'chargeableKg',
}

const sea: FreightRateConfig = {
  id: 'sea',
  labelKey: 'shipSeaLcl',
  rate: 100,
  minCharge: 0,
  fixedFee: 20,
  percentSurcharge: 0,
  currency: 'USD',
  etaDays: 25,
  basis: 'cbm',
}

const seaEur: FreightRateConfig = {
  ...sea,
  id: 'sea-eur',
  currency: 'EUR',
  rate: 90,
  fixedFee: 10,
}

describe('freight comparison', () => {
  it('applies min charge, fixed fee and percent surcharge', () => {
    const line = computeFreightLine(express, 10, 1, 'none')
    expect(line.baseAmount).toBeCloseTo(50, 6)
    expect(line.afterMin).toBeCloseTo(100, 6)
    expect(line.afterFixed).toBeCloseTo(110, 6)
    expect(line.total).toBeCloseTo(121, 6)
  })

  it('sorts by total and reports delta from cheapest when same currency', () => {
    const result = compareFreight([express, sea], 10, 2, 'none', {
      displayCurrency: 'USD',
      ratesToDisplay: { USD: 1 },
    })
    expect(result.comparable).toBe(true)
    expect(result.cheapestId).toBe('express')
    expect(result.options[0].id).toBe('express')
    expect(result.options[0].deltaFromCheapest).toBeCloseTo(0, 6)
    expect(result.options[1].deltaFromCheapest).toBeCloseTo(220 - 121, 6)
  })

  it('disables cheapest ranking when FX is missing for mixed currencies', () => {
    const result = compareFreight([express, seaEur], 10, 2, 'none', {
      displayCurrency: 'USD',
      ratesToDisplay: { USD: 1 },
    })
    expect(result.comparable).toBe(false)
    expect(result.cheapestId).toBeNull()
    expect(result.missingCurrencies).toContain('EUR')
    expect(result.options.every((o) => o.deltaFromCheapest === null)).toBe(true)
  })

  it('ranks after FX conversion when rates are provided', () => {
    const result = compareFreight([express, seaEur], 10, 2, 'none', {
      displayCurrency: 'USD',
      ratesToDisplay: { USD: 1, EUR: 1.2 },
      fxAsOf: '2026-11-09',
    })
    // seaEur: 2*90+10 = 190 EUR → 228 USD; express 121 USD → express wins
    expect(result.comparable).toBe(true)
    expect(result.cheapestId).toBe('express')
    const sea = result.options.find((o) => o.id === 'sea-eur')
    expect(sea?.convertedTotal).toBeCloseTo(228, 6)
  })

  it('uses CBM basis for sea and chargeable kg for express', () => {
    const seaLine = computeFreightLine(sea, 999, 1.5, 'none')
    expect(seaLine.billableQty).toBeCloseTo(1.5, 6)
    const airLine = computeFreightLine(
      { ...express, id: 'air', minCharge: 0, fixedFee: 0, percentSurcharge: 0 },
      12.4,
      9,
      'round',
    )
    expect(airLine.billableQty).toBe(12)
  })
})
