import { describe, expect, it } from 'vitest'
import type { Cargo } from '../shared/types/cargo'
import {
  buildCloudVerifyCargoRows,
  buildCloudVerifyParams,
} from '../tools/container-loading/cloudVerifyCargo'

describe('PF-003 cloud verify must not clobber price or SKU constraints', () => {
  const shared: Cargo[] = [
    {
      sku: 'SKU-A',
      length: 42,
      width: 32,
      height: 28,
      weight: 7.5,
      qty: 10,
      price: 12.5,
    },
    {
      sku: 'SKU-B',
      length: 36,
      width: 28,
      height: 22,
      weight: 5.2,
      qty: 5,
      price: 8,
    },
  ]

  const skus = [
    {
      name: 'SKU-A',
      length: 420,
      width: 320,
      height: 280,
      weight: 7.5,
      qty: 10,
      allowRotate: false,
      stackable: false,
    },
    {
      name: 'SKU-B',
      length: 360,
      width: 280,
      height: 220,
      weight: 5.2,
      qty: 5,
      allowRotate: true,
      stackable: true,
    },
  ]

  it('preserves shared Cargo.price instead of writing 0', () => {
    const rows = buildCloudVerifyCargoRows(skus, shared)
    expect(rows.find((r) => r.sku === 'SKU-A')?.price).toBe(12.5)
    expect(rows.find((r) => r.sku === 'SKU-B')?.price).toBe(8)
    expect(rows.every((r) => r.price !== 0)).toBe(true)
  })

  it('sends per-SKU allowRotate and stackable in job params', () => {
    const params = buildCloudVerifyParams(skus, '40HQ')
    expect(params.containerPreset).toBe('40HQ')
    expect(params.skus).toHaveLength(2)
    const a = params.skus.find((s) => s.id === 'SKU-A')
    const b = params.skus.find((s) => s.id === 'SKU-B')
    expect(a).toMatchObject({ allowRotate: false, stackable: false })
    expect(b).toMatchObject({ allowRotate: true, stackable: true })
    // Must not collapse to a single global allowRotate from Array.every
    expect(params.allowRotate).not.toBe(false)
  })
})
