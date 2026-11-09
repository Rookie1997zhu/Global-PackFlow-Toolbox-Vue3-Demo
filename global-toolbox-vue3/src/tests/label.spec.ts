import { describe, expect, it } from 'vitest'
import { buildCartonCodes } from '../tools/shipping-label/barcode'
import { buildLabelItems, defaultLabelSettings } from '../tools/shipping-label/useLabel'

describe('shipping labels', () => {
  it('builds batch carton codes with padding', () => {
    const codes = buildCartonCodes('PO-9', 1, 3, 12)
    expect(codes).toHaveLength(3)
    expect(codes[0].code).toBe('PO-9-001')
    expect(codes[2].label).toBe('003 / 012')
  })

  it('builds printable label items from settings', () => {
    const settings = defaultLabelSettings(10)
    settings.cartonFrom = 2
    settings.cartonTo = 4
    settings.barcodeKind = 'qr'
    const items = buildLabelItems(settings)
    expect(items).toHaveLength(3)
    expect(items[0].index).toBe(2)
    expect(items[0].barcodeKind).toBe('qr')
    expect(items[0].widthMm).toBeGreaterThanOrEqual(40)
  })
})
