import { csv, download } from '../../shared/export/csv'
import { createKoreanPdfWriter } from '../../shared/export/pdf'
import { downloadXlsx } from '../../shared/export/xlsx'
import type { MappedRow } from '../../shared/import/sheetMapping'
import type { Cargo } from '../../shared/types/cargo'
import { sanitizeNonNegative } from '../../shared/validation'

export type PackingLine = {
  id: string
  sku: string
  cartonFrom: number
  cartonTo: number
  qtyPerCarton: number
  grossKg: number
  netKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type PackingTotals = {
  cartonCount: number
  totalQty: number
  grossKg: number
  netKg: number
  cbm: number
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function cartonCountOf(line: PackingLine): number {
  const from = Math.max(1, Math.floor(n(line.cartonFrom)))
  const to = Math.max(from, Math.floor(n(line.cartonTo)))
  return to - from + 1
}

export function lineCbm(line: PackingLine): number {
  const cartons = cartonCountOf(line)
  return ((n(line.lengthCm) * n(line.widthCm) * n(line.heightCm)) / 1e6) * cartons
}

export function computePackingTotals(lines: PackingLine[]): PackingTotals {
  return lines.reduce(
    (acc, line) => {
      const cartons = cartonCountOf(line)
      acc.cartonCount += cartons
      acc.totalQty += cartons * n(line.qtyPerCarton)
      acc.grossKg += n(line.grossKg) * cartons
      acc.netKg += n(line.netKg) * cartons
      acc.cbm += lineCbm(line)
      return acc
    },
    { cartonCount: 0, totalQty: 0, grossKg: 0, netKg: 0, cbm: 0 },
  )
}

export function packingFromCargo(cargo: Cargo[]): PackingLine[] {
  let nextCarton = 1
  return cargo.map((c, i) => {
    const qty = Math.max(1, Math.floor(n(c.qty)))
    const from = nextCarton
    const to = nextCarton + qty - 1
    nextCarton = to + 1
    const unitGw = n(c.weight)
    return {
      id: `pl-${i}-${c.sku}`,
      sku: c.sku,
      cartonFrom: from,
      cartonTo: to,
      qtyPerCarton: 1,
      grossKg: unitGw,
      netKg: Math.max(0, unitGw * 0.92),
      lengthCm: n(c.length),
      widthCm: n(c.width),
      heightCm: n(c.height),
    }
  })
}

/** Build packing lines from mapped sheet rows (Korean/English Excel). */
export function packingFromMapped(rows: MappedRow[]): PackingLine[] {
  let fallbackCarton = 1
  return rows.map((row, i) => {
    const boxCount = Math.max(1, Math.floor(row.boxCount || row.qty || 1))
    const cartonFrom = row.carton ? Math.max(1, Math.floor(Number(row.carton)) || fallbackCarton) : fallbackCarton
    const cartonTo = cartonFrom + boxCount - 1
    fallbackCarton = cartonTo + 1
    const qtyPerCarton =
      row.boxCount > 0 && row.qty > 0 ? Math.max(1, Math.round(row.qty / row.boxCount)) : Math.max(1, Math.floor(row.qty) || 1)
    return {
      id: `pl-map-${i}-${row.sku || i}`,
      sku: row.sku || row.description || `SKU-${i + 1}`,
      cartonFrom,
      cartonTo,
      qtyPerCarton: row.boxCount > 0 ? qtyPerCarton : Math.max(1, Math.floor(row.qty) || 1),
      grossKg: row.grossKg || 1,
      netKg: row.netKg || Math.max(0, (row.grossKg || 1) * 0.92),
      lengthCm: row.lengthCm || 40,
      widthCm: row.widthCm || 30,
      heightCm: row.heightCm || 20,
    }
  })
}

export function validatePackingLines(lines: PackingLine[]): string[] {
  const codes: string[] = []
  for (const line of lines) {
    if (!String(line.sku).trim()) codes.push('errPackingSku')
    if (n(line.cartonTo) < n(line.cartonFrom)) codes.push('errPackingCartonRange')
    if (n(line.netKg) > n(line.grossKg) + 1e-9) codes.push('errPackingNetGross')
  }
  return [...new Set(codes)]
}

function detailRows(lines: PackingLine[], labels: Record<string, string>): (string | number)[][] {
  const totals = computePackingTotals(lines)
  return [
    [
      labels.sku,
      labels.cartonFrom,
      labels.cartonTo,
      labels.cartons,
      labels.qtyPerCarton,
      labels.gross,
      labels.net,
      labels.l,
      labels.w,
      labels.h,
      labels.cbm,
    ],
    ...lines.map((line) => [
      line.sku,
      line.cartonFrom,
      line.cartonTo,
      cartonCountOf(line),
      line.qtyPerCarton,
      Number((n(line.grossKg) * cartonCountOf(line)).toFixed(3)),
      Number((n(line.netKg) * cartonCountOf(line)).toFixed(3)),
      line.lengthCm,
      line.widthCm,
      line.heightCm,
      Number(lineCbm(line).toFixed(4)),
    ]),
    [
      labels.total,
      '',
      '',
      totals.cartonCount,
      totals.totalQty,
      Number(totals.grossKg.toFixed(3)),
      Number(totals.netKg.toFixed(3)),
      '',
      '',
      '',
      Number(totals.cbm.toFixed(4)),
    ],
  ]
}

export function exportPackingCsv(
  lines: PackingLine[],
  meta: { shipper: string; consignee: string; po: string },
  labels: Record<string, string>,
): void {
  const rows: (string | number)[][] = [
    [labels.shipper, meta.shipper],
    [labels.consignee, meta.consignee],
    [labels.po, meta.po],
    [],
    ...detailRows(lines, labels),
  ]
  download('packing-list.csv', csv(rows))
}

export async function exportPackingXlsx(
  lines: PackingLine[],
  meta: { shipper: string; consignee: string; po: string },
  labels: Record<string, string>,
): Promise<void> {
  await downloadXlsx('packing-list.xlsx', [
    {
      name: 'Packing List',
      rows: [
        [labels.shipper, meta.shipper],
        [labels.consignee, meta.consignee],
        [labels.po, meta.po],
        [],
        ...detailRows(lines, labels),
      ],
    },
  ])
}

export async function exportPackingPdf(
  lines: PackingLine[],
  meta: { shipper: string; consignee: string; po: string; title: string },
): Promise<void> {
  const writer = await createKoreanPdfWriter()
  writer.drawLine(meta.title, 16, true)
  writer.drawLine(`Shipper: ${meta.shipper}`)
  writer.drawLine(`Consignee: ${meta.consignee}`)
  writer.drawLine(`PO: ${meta.po}`)
  writer.drawLine('')
  for (const line of lines) {
    writer.drawLine(
      `${line.sku} CTN ${line.cartonFrom}-${line.cartonTo} x${line.qtyPerCarton} GW ${n(line.grossKg).toFixed(2)}kg CBM ${lineCbm(line).toFixed(3)}`,
    )
  }
  const totals = computePackingTotals(lines)
  writer.drawLine(
    `TOTAL cartons=${totals.cartonCount} qty=${totals.totalQty} GW=${totals.grossKg.toFixed(2)} NW=${totals.netKg.toFixed(2)} CBM=${totals.cbm.toFixed(3)}`,
    11,
    true,
  )
  await writer.finish('packing-list.pdf')
}
