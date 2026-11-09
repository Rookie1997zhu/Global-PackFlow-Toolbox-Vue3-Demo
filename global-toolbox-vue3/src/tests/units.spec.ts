import { describe, expect, it } from 'vitest'
import { convert, lengthFromCm, lengthToCm, massFromKg, massToKg } from '../shared/units'

describe('units', () => {
  it('converts cm ↔ in', () => {
    expect(lengthToCm(1, 'in')).toBeCloseTo(2.54, 6)
    expect(lengthFromCm(2.54, 'in')).toBeCloseTo(1, 6)
  })

  it('converts kg ↔ lb', () => {
    expect(massToKg(1, 'lb')).toBeCloseTo(0.45359237, 8)
    expect(massFromKg(0.45359237, 'lb')).toBeCloseTo(1, 8)
  })

  it('converts mm to m via convert()', () => {
    expect(convert(1000, 'length', 'mm', 'm')).toBeCloseTo(1, 10)
  })
})
