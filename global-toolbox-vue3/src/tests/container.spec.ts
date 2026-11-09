import { describe, expect, it } from 'vitest'
import {
  collides,
  inBounds,
  packContainer,
  type LoadSku,
  type PackInput,
} from '../tools/container-loading/packing'

const baseSkus: LoadSku[] = [
  {
    id: 'a',
    name: 'A',
    length: 1200,
    width: 800,
    height: 600,
    weight: 50,
    qty: 8,
    allowRotate: true,
    stackable: true,
    color: '#0e7490',
  },
  {
    id: 'b',
    name: 'B',
    length: 1000,
    width: 600,
    height: 500,
    weight: 40,
    qty: 6,
    allowRotate: false,
    stackable: true,
    color: '#0369a1',
  },
]

function input(over?: Partial<PackInput['container']>, skus = baseSkus): PackInput {
  return {
    container: {
      length: 5890,
      width: 2350,
      height: 2390,
      maxPayload: 28000,
      ...over,
    },
    skus,
  }
}

describe('container packing', () => {
  it('packs without overlap or out-of-bounds', () => {
    const result = packContainer(input())
    expect(result.packedCount).toBeGreaterThan(0)
    for (let i = 0; i < result.placements.length; i++) {
      const a = result.placements[i]
      expect(inBounds(a, input().container)).toBe(true)
      for (let j = i + 1; j < result.placements.length; j++) {
        expect(collides(a, result.placements[j])).toBe(false)
      }
    }
  })

  it('is deterministic', () => {
    expect(packContainer(input())).toEqual(packContainer(input()))
  })

  it('respects no-rotate by keeping l/w orientation', () => {
    const result = packContainer(
      input(undefined, [
        {
          id: 'nr',
          name: 'NoRotate',
          length: 1500,
          width: 400,
          height: 400,
          weight: 20,
          qty: 4,
          allowRotate: false,
          stackable: true,
          color: '#111',
        },
      ]),
    )
    for (const p of result.placements) {
      expect(p.rotated).toBe(false)
      expect(p.l).toBe(1500)
      expect(p.w).toBe(400)
    }
  })

  it('marks overweight remainder as unplaced', () => {
    const result = packContainer(
      input(
        { maxPayload: 90 },
        [
          {
            id: 'heavy',
            name: 'Heavy',
            length: 800,
            width: 600,
            height: 500,
            weight: 50,
            qty: 4,
            allowRotate: true,
            stackable: true,
            color: '#222',
          },
        ],
      ),
    )
    expect(result.packedCount).toBeLessThanOrEqual(1)
    expect(result.unplaced.reduce((s, u) => s + u.qty, 0)).toBeGreaterThan(0)
    expect(result.packedWeight).toBeLessThanOrEqual(90 + 1e-6)
  })

  it('rejects oversized SKUs', () => {
    const result = packContainer(
      input(undefined, [
        {
          id: 'huge',
          name: 'Huge',
          length: 9000,
          width: 3000,
          height: 3000,
          weight: 10,
          qty: 1,
          allowRotate: true,
          stackable: true,
          color: '#333',
        },
      ]),
    )
    expect(result.packedCount).toBe(0)
    expect(result.unplaced[0]?.reason).toBe('errContainerPartTooLarge')
  })
})
