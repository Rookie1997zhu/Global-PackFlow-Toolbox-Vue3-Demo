import { PDFDocument, StandardFonts } from 'pdf-lib'
import { csv, download } from '../../shared/export/csv'
import { downloadXlsx } from '../../shared/export/xlsx'
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
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let y = 800
  const draw = (text: string, size = 10, useBold = false) => {
    page.drawText(text.slice(0, 110), { x: 40, y, size, font: useBold ? bold : font })
    y -= size + 6
  }
  draw(title, 16, true)
  draw(`Invoice: ${meta.invoiceNo}  PO: ${meta.po}`)
  draw(`Seller: ${meta.seller}`)
  draw(`Buyer: ${meta.buyer}`)
  draw(`Currency: ${meta.currency}  Incoterms: ${meta.incoterms}`)
  draw(`Payment: ${meta.paymentTerms}`)
  y -= 4
  for (const line of lines.slice(0, 35)) {
    draw(
      `${line.sku} | ${line.description} | ${line.qty} ${line.unit} @ ${n(line.unitPrice).toFixed(2)} = ${lineAmount(line).toFixed(2)}`,
    )
  }
  const totals = computeInvoiceTotals(lines)
  draw(`TOTAL ${meta.currency} ${totals.computedTotal.toFixed(2)}`, 12, true)
  y -= 8
  draw(disclaimer, 8)
  draw('Customs declarations are not auto-generated.', 8)
  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'commercial-invoice.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
