import { describe, expect, it } from 'vitest'
import { bucketLayersByZ, groupUnplacedByReason } from '../shared/export/loadGuide'

describe('load guide helpers', () => {
  it('buckets placements by Z into layers', () => {
    const layers = bucketLayersByZ([
      { sku: 'A', l: 1, w: 1, h: 1, x: 0, y: 0, z: 150 },
      { sku: 'B', l: 1, w: 1, h: 1, x: 0, y: 0, z: 350 },
      { sku: 'C', l: 1, w: 1, h: 1, x: 10, y: 0, z: 150 },
    ])
    expect(layers).toHaveLength(2)
    expect(layers[0].index).toBe(1)
    expect(layers[0].items).toHaveLength(2)
    expect(layers[1].items[0].sku).toBe('B')
  })

  it('groups unplaced by reason', () => {
    const groups = groupUnplacedByReason([
      { name: 'A', qty: 2, reason: 'errPalletTooLarge' },
      { name: 'B', qty: 1, reason: 'errPalletUnplaced' },
      { name: 'A', qty: 1, reason: 'errPalletTooLarge' },
    ])
    const large = groups.find((g) => g.reason === 'errPalletTooLarge')
    expect(large?.qty).toBe(3)
    expect(large?.names).toEqual(['A'])
  })
})
