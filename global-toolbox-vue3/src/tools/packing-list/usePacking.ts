import { csv, download } from '../../shared/export/csv'
import { createKoreanPdfWriter } from '../../shared/export/pdf'
import { downloadXlsx } from '../../shared/export/xlsx'
import type { MappedRow } from '../../shared/import/sheetMapping'
import {
  cartonizeConfirmed,
  resolveLegacyQuantity,
  validateFormalPackingNet,
} from '../../shared/quantity/cartonize'
import type { Cargo } from '../../shared/types/cargo'
import { sanitizeNonNegative } from '../../shared/validation'

export type PackingLine = {
  id: string
  sku: string
  cartonFrom: number
  cartonTo: number
  qtyPerCarton: number
  lastCartonQty?: number
  grossKg: number
  netKg: number | null
  lengthCm: number
  widthCm: number
  heightCm: number
  needsReview?: boolean
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
      if (line.netKg != null) acc.netKg += n(line.netKg) * cartons
      acc.cbm += lineCbm(line)
      return acc
    },
    { cartonCount: 0, totalQty: 0, grossKg: 0, netKg: 0, cbm: 0 },
  )
}

export function packingFromCargo(cargo: Cargo[]): PackingLine[] {
  const lines: PackingLine[] = []
  let nextCarton = 1
  cargo.forEach((c, i) => {
    const legacy = resolveLegacyQuantity(c)
    const unitGw = n(c.weight)
    const netExplicit =
      c.netKg === undefined || c.netKg === null ? null : n(c.netKg)

    if (
      c.pieceQty != null &&
      c.pieceQty > 0 &&
      c.piecesPerCarton != null &&
      c.piecesPerCarton > 0
    ) {
      const packed = cartonizeConfirmed({
        sku: c.sku,
        pieceQty: c.pieceQty,
        piecesPerCarton: c.piecesPerCarton,
        lengthCm: n(c.length),
        widthCm: n(c.width),
        heightCm: n(c.height),
        grossKgPerCarton: unitGw,
        netKgPerCarton: netExplicit,
      })
      for (const row of packed.lines) {
        const cartons = row.cartonTo - row.cartonFrom + 1
        const from = nextCarton
        const to = nextCarton + cartons - 1
        nextCarton = to + 1
        lines.push({
          id: `pl-${i}-${c.sku}-${from}`,
          sku: row.sku,
          cartonFrom: from,
          cartonTo: to,
          qtyPerCarton: row.qtyPerCarton,
          lastCartonQty: row.lastCartonQty,
          grossKg: row.grossKg,
          netKg: row.netKg,
          lengthCm: row.lengthCm,
          widthCm: row.widthCm,
          heightCm: row.heightCm,
          needsReview: packed.needsReview,
        })
      }
      return
    }

    if (c.quantityBasis === 'carton') {
      const qty = Math.max(1, Math.floor(n(c.qty)))
      const from = nextCarton
      const to = nextCarton + qty - 1
      nextCarton = to + 1
      lines.push({
        id: `pl-${i}-${c.sku}`,
        sku: c.sku,
        cartonFrom: from,
        cartonTo: to,
        qtyPerCarton: 1,
        grossKg: unitGw,
        netKg: netExplicit,
        lengthCm: n(c.length),
        widthCm: n(c.width),
        heightCm: n(c.height),
        needsReview: netExplicit == null,
      })
      return
    }

    // Bare qty / unknown basis — do not invent CTN×1 or GW×0.92
    lines.push({
      id: `pl-${i}-${c.sku}`,
      sku: c.sku,
      cartonFrom: 1,
      cartonTo: 1,
      qtyPerCarton: 0,
      grossKg: unitGw,
      netKg: netExplicit,
      lengthCm: n(c.length),
      widthCm: n(c.width),
      heightCm: n(c.height),
      needsReview: legacy.needsReview,
    })
  })
  return lines
}

/** Build packing lines from mapped sheet rows (Korean/English Excel). */
export function packingFromMapped(rows: MappedRow[]): PackingLine[] {
  let fallbackCarton = 1
  return rows.map((row, i) => {
    const hasBox = row.boxCount > 0
    const boxCount = Math.max(1, Math.floor(row.boxCount || row.qty || 1))
    const cartonFrom = row.carton
      ? Math.max(1, Math.floor(Number(row.carton)) || fallbackCarton)
      : fallbackCarton
    const cartonTo = cartonFrom + boxCount - 1
    fallbackCarton = cartonTo + 1
    const qtyPerCarton =
      hasBox && row.qty > 0
        ? Math.max(1, Math.round(row.qty / row.boxCount))
        : hasBox
          ? 1
          : Math.max(1, Math.floor(row.qty) || 1)
    const netKg =
      row.netKg != null && row.netKg > 0 ? row.netKg : null
    return {
      id: `pl-map-${i}-${row.sku || i}`,
      sku: row.sku || row.description || `SKU-${i + 1}`,
      cartonFrom,
      cartonTo,
      qtyPerCarton: hasBox ? qtyPerCarton : Math.max(1, Math.floor(row.qty) || 1),
      grossKg: row.grossKg || 1,
      netKg,
      lengthCm: row.lengthCm || 40,
      widthCm: row.widthCm || 30,
      heightCm: row.heightCm || 20,
      needsReview: netKg == null,
    }
  })
}

export function validatePackingLines(lines: PackingLine[]): string[] {
  const codes: string[] = []
  for (const line of lines) {
    if (!String(line.sku).trim()) codes.push('errPackingSku')
    if (n(line.cartonTo) < n(line.cartonFrom)) codes.push('errPackingCartonRange')
    if (line.netKg != null && n(line.netKg) > n(line.grossKg) + 1e-9) {
      codes.push('errPackingNetGross')
    }
  }
  codes.push(...validateFormalPackingNet(lines))
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
      line.netKg == null ? '' : Number((n(line.netKg) * cartonCountOf(line)).toFixed(3)),
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
