import { describe, expect, it } from 'vitest'
import {
  computeInvoiceTotals,
  lineAmount,
  linesFromCargo,
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
})
