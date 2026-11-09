import { csv, download } from './csv'
import { createKoreanPdfWriter } from './pdf'

export type LoadGuideLayerItem = {
  sku: string
  l: number
  w: number
  h: number
  x: number
  y: number
  z: number
}

export type LoadGuideLayer = {
  index: number
  z: number
  items: LoadGuideLayerItem[]
}

export type LoadGuideUnplaced = {
  name: string
  qty: number
  reason: string
}

export type LoadGuideInput = {
  title: string
  specLabel: string
  utilizationLabel?: string
  packedLabel: string
  unplacedLabel: string
  layerLabel: string
  disclaimer: string
  layers: LoadGuideLayer[]
  unplaced: LoadGuideUnplaced[]
  metaLines?: string[]
}

/** Bucket placements by Z height into printable layers (sorted ascending). */
export function bucketLayersByZ(
  items: LoadGuideLayerItem[],
  eps = 1e-6,
): LoadGuideLayer[] {
  const zs = [...new Set(items.map((i) => i.z))].sort((a, b) => a - b)
  return zs.map((z, index) => ({
    index: index + 1,
    z,
    items: items.filter((i) => Math.abs(i.z - z) < eps),
  }))
}

/** Group unplaced rows by reason code/label for summaries. */
export function groupUnplacedByReason(
  rows: LoadGuideUnplaced[],
): { reason: string; qty: number; names: string[] }[] {
  const map = new Map<string, { reason: string; qty: number; names: string[] }>()
  for (const row of rows) {
    const key = row.reason || 'unknown'
    const prev = map.get(key)
    if (prev) {
      prev.qty += row.qty
      if (!prev.names.includes(row.name)) prev.names.push(row.name)
    } else {
      map.set(key, { reason: key, qty: row.qty, names: [row.name] })
    }
  }
  return [...map.values()]
}

export async function exportLoadGuidePdf(input: LoadGuideInput, filename = 'load-guide.pdf'): Promise<void> {
  const writer = await createKoreanPdfWriter()
  writer.drawLine(input.title, 16, true)
  writer.drawLine(input.specLabel, 11)
  for (const line of input.metaLines || []) writer.drawLine(line, 10)
  writer.drawLine(input.packedLabel, 10)
  writer.drawLine(input.unplacedLabel, 10)
  if (input.utilizationLabel) writer.drawLine(input.utilizationLabel, 10)
  writer.drawLine('')
  writer.drawLine(input.disclaimer, 9)
  writer.drawLine('')

  for (const layer of input.layers) {
    writer.drawLine(`${input.layerLabel} ${layer.index} (Z=${Math.round(layer.z)} mm) · ${layer.items.length}`, 12, true)
    for (const item of layer.items) {
      writer.drawLine(
        `  ${item.sku}  ${Math.round(item.l)}×${Math.round(item.w)}×${Math.round(item.h)} @ (${Math.round(item.x)},${Math.round(item.y)})`,
        9,
      )
    }
    writer.drawLine('')
  }

  if (input.unplaced.length) {
    writer.drawLine(input.unplacedLabel, 12, true)
    const groups = groupUnplacedByReason(input.unplaced)
    for (const g of groups) {
      writer.drawLine(`  [${g.reason}] ×${g.qty}: ${g.names.join(', ')}`, 9)
    }
  }

  await writer.finish(filename)
}

export function exportLoadGuideCsv(
  input: LoadGuideInput,
  filename = 'load-guide.csv',
): void {
  const rows: (string | number)[][] = [
    [input.title],
    [input.specLabel],
    ...(input.metaLines || []).map((m) => [m]),
    [input.packedLabel],
    [input.unplacedLabel],
    [input.disclaimer],
    [],
    [input.layerLabel, 'Z', 'SKU', 'L', 'W', 'H', 'X', 'Y'],
  ]
  for (const layer of input.layers) {
    for (const item of layer.items) {
      rows.push([
        layer.index,
        Math.round(layer.z),
        item.sku,
        Math.round(item.l),
        Math.round(item.w),
        Math.round(item.h),
        Math.round(item.x),
        Math.round(item.y),
      ])
    }
  }
  rows.push([])
  rows.push(['Unplaced', 'Qty', 'Reason'])
  for (const u of input.unplaced) {
    rows.push([u.name, u.qty, u.reason])
  }
  rows.push([])
  rows.push(['Reason summary'])
  for (const g of groupUnplacedByReason(input.unplaced)) {
    rows.push([g.reason, g.qty, g.names.join('; ')])
  }
  download(filename, csv(rows))
}
