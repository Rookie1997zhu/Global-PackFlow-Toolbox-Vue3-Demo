import { describe, expect, it } from 'vitest'
import { packingFromCargo, computePackingTotals } from '../tools/packing-list/usePacking'
import { linesFromCargo, computeInvoiceTotals } from '../tools/commercial-invoice/useInvoice'
import {
  cartonizeConfirmed,
  resolveLegacyQuantity,
  validateFormalPackingNet,
} from '../shared/quantity/cartonize'

/**
 * PF-001 / T-001..T-003 — expected correct quantity & net-weight semantics.
 * These must fail until V1.3.1 implementation lands.
 */
describe('PF-001 quantity semantics and net weight', () => {
  it('T-001: 120 PCS / 12 PCS per carton => 10 CTN and CI 120 PCS', () => {
    const packed = cartonizeConfirmed({
      sku: 'SKU-A',
      pieceQty: 120,
      piecesPerCarton: 12,
      lengthCm: 42,
      widthCm: 32,
      heightCm: 28,
      grossKgPerCarton: 7.5,
      netKgPerCarton: null,
    })
    expect(packed.cartonCount).toBe(10)
    expect(packed.totalQty).toBe(120)
    expect(packed.qtyPerCarton).toBe(12)
    expect(packed.lines[0].qtyPerCarton).toBe(12)
    expect(packed.lines[0].cartonTo - packed.lines[0].cartonFrom + 1).toBe(10)

    // Invoice side must stay in PCS, not cartons
    const invoiceQty = packed.totalQty
    expect(invoiceQty).toBe(120)
  })

  it('T-002: 121 PCS / 12 => 11 cartons with last carton 1 (not padded to 132)', () => {
    const packed = cartonizeConfirmed({
      sku: 'SKU-A',
      pieceQty: 121,
      piecesPerCarton: 12,
      grossKgPerCarton: 7.5,
      netKgPerCarton: 6.1,
    })
    expect(packed.cartonCount).toBe(11)
    expect(packed.lastCartonQty).toBe(1)
    expect(packed.totalQty).toBe(121)
    expect(packed.totalQty).not.toBe(132)
  })

  it('T-001 negative: bare Cargo.qty without basis must not invent PCS or CTN', () => {
    const legacy = resolveLegacyQuantity({ qty: 120 })
    expect(legacy.basis).toBe('unknown')
    expect(legacy.needsReview).toBe(true)

    // Current packingFromCargo treats qty as carton count — that must stop for formal docs.
    const lines = packingFromCargo([
      { sku: 'SKU-A', length: 42, width: 32, height: 28, weight: 7.5, qty: 120, price: 12.5 },
    ])
    const totals = computePackingTotals(lines)
    // Formal path must not silently produce 120 CTN × 1 PCS from ambiguous qty.
    expect(totals.cartonCount).not.toBe(120)
    expect(lines[0].qtyPerCarton).not.toBe(1)
  })

  it('T-003: missing net weight must not fabricate gross×0.92', () => {
    const lines = packingFromCargo([
      { sku: 'SKU-A', length: 42, width: 32, height: 28, weight: 7.5, qty: 10, price: 12.5 },
    ])
    expect(lines[0].netKg).not.toBeCloseTo(7.5 * 0.92, 5)

    const codes = validateFormalPackingNet(
      lines.map((l) => ({ netKg: l.netKg, grossKg: l.grossKg })),
    )
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.some((c) => /net|unconfirmed|NW/i.test(c))).toBe(true)
  })

  it('CI and PL piece totals match when quantity is confirmed', () => {
    const packed = cartonizeConfirmed({
      sku: 'SKU-A',
      pieceQty: 120,
      piecesPerCarton: 12,
      grossKgPerCarton: 7.5,
      netKgPerCarton: 6.1,
    })
    // Until CargoScheme gains piece fields, invoice-from-cargo alone is insufficient;
    // confirmed pieceQty must drive both documents.
    expect(packed.totalQty).toBe(120)
    const invoice = linesFromCargo([
      {
        sku: 'SKU-A',
        length: 42,
        width: 32,
        height: 28,
        weight: 7.5,
        qty: packed.totalQty,
        price: 12.5,
      },
    ])
    expect(invoice[0].qty).toBe(120)
    expect(invoice[0].unit).toBe('PCS')
    expect(computeInvoiceTotals(invoice).computedTotal).toBeCloseTo(1500, 6)
  })
})
