import { describe, expect, it } from 'vitest'
import { applyMapping, detectColumnMapping } from '../shared/import/sheetMapping'
import { mappedToPalletCartons } from '../integrations/pallet/mappedToPalletCartons'
import { pack } from '../integrations/pallet/packing'
import { DEFAULT_PALLET_PRESET, configFromPreset, getPalletPreset } from '../integrations/pallet/presets'

describe('pallet presets and import', () => {
  it('defaults to T11 1100×1100', () => {
    expect(DEFAULT_PALLET_PRESET).toBe('T11')
    const p = getPalletPreset('T11')
    expect(p.l).toBe(1100)
    expect(p.w).toBe(1100)
    const cfg = configFromPreset('T11')
    expect(cfg.l).toBe(1100)
    expect(cfg.w).toBe(1100)
  })

  it('maps Korean cm rows to mm cartons', () => {
    const table = [
      ['품명', '수량', '총중량', '가로', '세로', '높이', '박스수'],
      ['SKU-A', '10', '7.5', '42', '32', '28', '10'],
    ]
    const cartons = mappedToPalletCartons(applyMapping(table, detectColumnMapping(table[0])))
    expect(cartons[0].name).toBe('SKU-A')
    expect(cartons[0].l).toBe(420)
    expect(cartons[0].w).toBe(320)
    expect(cartons[0].h).toBe(280)
    expect(cartons[0].qty).toBe(10)
    expect(cartons[0].kg).toBeCloseTo(7.5, 6)
  })

  it('reports structured unplaced reasons for oversized cartons', () => {
    const cfg = configFromPreset('T11')
    const result = pack(cfg, [
      { id: 1, name: 'HUGE', l: 2000, w: 2000, h: 500, qty: 2, kg: 10, color: '#000', stackable: true },
    ])
    expect(result.packedBoxes).toBe(0)
    expect(result.unplaced[0].reasonCode).toBe('errPalletTooLarge')
  })

  it('reports overweight single carton', () => {
    const cfg = configFromPreset('T11')
    const result = pack(cfg, [
      { id: 1, name: 'HEAVY', l: 400, w: 300, h: 200, qty: 1, kg: 5000, color: '#000', stackable: true },
    ])
    expect(result.unplaced[0].reasonCode).toBe('errPalletOverweight')
  })
})
