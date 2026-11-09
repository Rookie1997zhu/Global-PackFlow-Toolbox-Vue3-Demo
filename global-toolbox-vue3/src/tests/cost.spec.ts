import { describe, expect, it } from 'vitest'
import {
  compareScenarios,
  computeCost,
  defaultCostInputs,
  validateCostInputs,
} from '../tools/cost-calculator/useCost'

describe('cost calculator', () => {
  it('computes waste, tax, markup and gross margin', () => {
    const input = defaultCostInputs(10, {
      materialPerUnit: 2,
      laborPerUnit: 1,
      wastePct: 10,
      storage: 5,
      transport: 15,
      taxPct: 10,
      markupPct: 20,
    })
    const result = computeCost(input)
    // material 20 + labor 10 = 30; waste 3; +storage5 +transport15 = 53; tax 5.3; cost 58.3
    expect(result.material).toBeCloseTo(20, 6)
    expect(result.labor).toBeCloseTo(10, 6)
    expect(result.waste).toBeCloseTo(3, 6)
    expect(result.subtotalBeforeTax).toBeCloseTo(53, 6)
    expect(result.tax).toBeCloseTo(5.3, 6)
    expect(result.costTotal).toBeCloseTo(58.3, 6)
    expect(result.markedUpTotal).toBeCloseTo(69.96, 4)
    expect(result.grossMarginPct).toBeCloseTo(((69.96 - 58.3) / 69.96) * 100, 4)
  })

  it('validates percentage range and currency', () => {
    const bad = validateCostInputs(defaultCostInputs(1, { wastePct: 120, currency: '  ' }))
    expect(bad.some((i) => i.code === 'errCostPctRange')).toBe(true)
    expect(bad.some((i) => i.code === 'errCostCurrency')).toBe(true)
  })

  it('compares A/B scenarios', () => {
    const a = {
      name: 'A',
      input: defaultCostInputs(5, { transport: 100, markupPct: 0 }),
      result: computeCost(defaultCostInputs(5, { transport: 100, markupPct: 0 })),
    }
    const b = {
      name: 'B',
      input: defaultCostInputs(5, { transport: 80, markupPct: 0 }),
      result: computeCost(defaultCostInputs(5, { transport: 80, markupPct: 0 })),
    }
    const cmp = compareScenarios(a, b)
    expect(cmp.cheaper).toBe('B')
    expect(cmp.deltaTotal).toBeGreaterThan(0)
  })
})
