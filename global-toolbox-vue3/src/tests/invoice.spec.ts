import { describe, expect, it } from 'vitest'
import { applyMapping, detectColumnMapping } from '../shared/import/sheetMapping'
import {
  computeInvoiceTotals,
  lineAmount,
  linesFromCargo,
  linesFromMapped,
  validateInvoice,
} from '../tools/commercial-invoice/useInvoice'

describe('commercial invoice', () => {
  it('sums line amounts consistently', () => {
    const lines = linesFromCargo([
      { sku: 'A', length: 1, width: 1, height: 1, weight: 1, qty: 4, price: 2.5 },
      { sku: 'B', length: 1, width: 1, height: 1, weight: 1, qty: 2, price: 10 },
    ])
    expect(lineAmount(lines[0])).toBeCloseTo(10, 6)
    expect(lineAmount(lines[1])).toBeCloseTo(20, 6)
    expect(computeInvoiceTotals(lines).computedTotal).toBeCloseTo(30, 6)
  })

  it('requires seller buyer currency incoterms payment', () => {
    const codes = validateInvoice(
      {
        seller: '',
        buyer: '',
        invoiceNo: '',
        po: '',
        currency: '',
        incoterms: '',
        paymentTerms: '',
      },
      [],
    )
    expect(codes).toEqual(
      expect.arrayContaining([
        'errInvoiceSeller',
        'errInvoiceBuyer',
        'errInvoiceNo',
        'errInvoiceCurrency',
        'errInvoiceIncoterms',
        'errInvoicePayment',
        'errInvoiceLines',
      ]),
    )
  })

  it('builds invoice lines from Korean mapped rows', () => {
    const table = [
      ['품명', '규격', '수량', '단위', '단가', '금액'],
      ['SKU-A', 'Gift box', '120', 'PCS', '12.5', '1500'],
    ]
    const lines = linesFromMapped(applyMapping(table, detectColumnMapping(table[0])))
    expect(lines[0]).toMatchObject({ sku: 'SKU-A', description: 'Gift box', qty: 120, unitPrice: 12.5, unit: 'PCS' })
    expect(lineAmount(lines[0])).toBeCloseTo(1500, 6)
  })
})
