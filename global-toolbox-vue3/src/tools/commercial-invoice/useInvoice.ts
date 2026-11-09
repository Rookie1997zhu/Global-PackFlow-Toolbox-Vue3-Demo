import { csv, download } from '../../shared/export/csv'
import { createKoreanPdfWriter } from '../../shared/export/pdf'
import { downloadXlsx } from '../../shared/export/xlsx'
import type { MappedRow } from '../../shared/import/sheetMapping'
import type { Cargo } from '../../shared/types/cargo'
import { sanitizeNonNegative } from '../../shared/validation'

export type InvoiceLine = {
  sku: string
  description: string
  qty: number
  unitPrice: number
  unit: string
}

export type InvoiceMeta = {
  seller: string
  buyer: string
  invoiceNo: string
  po: string
  currency: string
  incoterms: string
  paymentTerms: string
}

export type InvoiceTotals = {
  lineTotal: number
  computedTotal: number
  consistent: boolean
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function linesFromCargo(cargo: Cargo[]): InvoiceLine[] {
  return cargo.map((c) => ({
    sku: c.sku,
    description: c.sku,
    qty: n(c.qty),
    unitPrice: n(c.price),
    unit: 'PCS',
  }))
}

export function linesFromMapped(rows: MappedRow[]): InvoiceLine[] {
  return rows.map((row) => {
    const qty = n(row.qty) || n(row.boxCount) || 1
    let unitPrice = n(row.unitPrice)
    if (!unitPrice && row.amount > 0 && qty > 0) unitPrice = row.amount / qty
    return {
      sku: row.sku || `SKU`,
      description: row.description || row.sku || '',
      qty,
      unitPrice,
      unit: row.unit || 'PCS',
    }
  })
}

export function lineAmount(line: InvoiceLine): number {
  return n(line.qty) * n(line.unitPrice)
}

export function computeInvoiceTotals(lines: InvoiceLine[]): InvoiceTotals {
  const computedTotal = lines.reduce((s, line) => s + lineAmount(line), 0)
  return {
    lineTotal: computedTotal,
    computedTotal,
    consistent: true,
  }
}

export function validateInvoice(meta: InvoiceMeta, lines: InvoiceLine[]): string[] {
  const codes: string[] = []
  if (!meta.seller.trim()) codes.push('errInvoiceSeller')
  if (!meta.buyer.trim()) codes.push('errInvoiceBuyer')
  if (!meta.invoiceNo.trim()) codes.push('errInvoiceNo')
  if (!meta.currency.trim()) codes.push('errInvoiceCurrency')
  if (!meta.incoterms.trim()) codes.push('errInvoiceIncoterms')
  if (!meta.paymentTerms.trim()) codes.push('errInvoicePayment')
  if (!lines.length) codes.push('errInvoiceLines')
  for (const line of lines) {
    if (!line.sku.trim()) codes.push('errInvoiceSku')
    if (n(line.qty) <= 0) codes.push('errInvoiceQty')
  }
  return [...new Set(codes)]
}

export function exportInvoiceCsv(meta: InvoiceMeta, lines: InvoiceLine[], labels: Record<string, string>): void {
  const totals = computeInvoiceTotals(lines)
  const rows: (string | number)[][] = [
    [labels.invoice, meta.invoiceNo],
    [labels.seller, meta.seller],
    [labels.buyer, meta.buyer],
    [labels.po, meta.po],
    [labels.currency, meta.currency],
    [labels.incoterms, meta.incoterms],
    [labels.payment, meta.paymentTerms],
    [],
    [labels.sku, labels.description, labels.qty, labels.unit, labels.unitPrice, labels.amount],
    ...lines.map((line) => [
      line.sku,
      line.description,
      line.qty,
      line.unit,
      line.unitPrice,
      Number(lineAmount(line).toFixed(2)),
    ]),
    [labels.total, '', '', '', '', Number(totals.computedTotal.toFixed(2))],
  ]
  download('commercial-invoice.csv', csv(rows))
}

export async function exportInvoiceXlsx(
  meta: InvoiceMeta,
  lines: InvoiceLine[],
  labels: Record<string, string>,
): Promise<void> {
  const totals = computeInvoiceTotals(lines)
  await downloadXlsx('commercial-invoice.xlsx', [
    {
      name: 'Invoice',
      rows: [
        [labels.invoice, meta.invoiceNo],
        [labels.seller, meta.seller],
        [labels.buyer, meta.buyer],
        [labels.po, meta.po],
        [labels.currency, meta.currency],
        [labels.incoterms, meta.incoterms],
        [labels.payment, meta.paymentTerms],
        [],
        [labels.sku, labels.description, labels.qty, labels.unit, labels.unitPrice, labels.amount],
        ...lines.map((line) => [
          line.sku,
          line.description,
          line.qty,
          line.unit,
          line.unitPrice,
          Number(lineAmount(line).toFixed(2)),
        ]),
        [labels.total, '', '', '', '', Number(totals.computedTotal.toFixed(2))],
      ],
    },
  ])
}

export async function exportInvoicePdf(
  meta: InvoiceMeta,
  lines: InvoiceLine[],
  title: string,
  disclaimer: string,
): Promise<void> {
  const writer = await createKoreanPdfWriter()
  writer.drawLine(title, 16, true)
  writer.drawLine(`Invoice: ${meta.invoiceNo}  PO: ${meta.po}`)
  writer.drawLine(`Seller: ${meta.seller}`)
  writer.drawLine(`Buyer: ${meta.buyer}`)
  writer.drawLine(`Currency: ${meta.currency}  Incoterms: ${meta.incoterms}`)
  writer.drawLine(`Payment: ${meta.paymentTerms}`)
  writer.drawLine('')
  for (const line of lines) {
    writer.drawLine(
      `${line.sku} | ${line.description} | ${line.qty} ${line.unit} @ ${n(line.unitPrice).toFixed(2)} = ${lineAmount(line).toFixed(2)}`,
    )
  }
  const totals = computeInvoiceTotals(lines)
  writer.drawLine(`TOTAL ${meta.currency} ${totals.computedTotal.toFixed(2)}`, 12, true)
  writer.drawLine('')
  writer.drawLine(disclaimer, 8)
  writer.drawLine('Customs declarations are not auto-generated.', 8)
  await writer.finish('commercial-invoice.pdf')
}
