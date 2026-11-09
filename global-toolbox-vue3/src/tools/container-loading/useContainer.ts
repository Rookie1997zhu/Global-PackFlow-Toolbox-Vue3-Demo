import { csv, download } from '../../shared/export/csv'
import type { Cargo } from '../../shared/types/cargo'
import { colorForIndex, type LoadSku, type PackResult } from './packing'
import { getPreset, type ContainerPreset } from './containers'

export type LocalSku = LoadSku

export function cargoToSkus(cargo: Cargo[]): LocalSku[] {
  return cargo.map((c, i) => ({
    id: `sku-${i}-${c.sku}`,
    name: c.sku || `SKU-${i + 1}`,
    length: Math.max(0, Number(c.length) || 0) * 10,
    width: Math.max(0, Number(c.width) || 0) * 10,
    height: Math.max(0, Number(c.height) || 0) * 10,
    weight: Math.max(0, Number(c.weight) || 0),
    qty: Math.max(0, Math.floor(Number(c.qty) || 0)),
    allowRotate: true,
    stackable: true,
    color: colorForIndex(i),
  }))
}

export function resolveContainer(
  presetId: string,
  custom: { length: number; width: number; height: number; maxPayload: number },
): { preset: ContainerPreset; length: number; width: number; height: number; maxPayload: number } {
  const preset = getPreset(presetId)
  if (presetId === 'custom') {
    return {
      preset,
      length: custom.length,
      width: custom.width,
      height: custom.height,
      maxPayload: custom.maxPayload,
    }
  }
  return {
    preset,
    length: preset.length,
    width: preset.width,
    height: preset.height,
    maxPayload: preset.maxPayload,
  }
}

export function groupUnplacedReasons(
  unplaced: PackResult['unplaced'],
  t: (k: string) => string,
): { reason: string; qty: number; names: string[] }[] {
  const map = new Map<string, { reason: string; qty: number; names: string[] }>()
  for (const u of unplaced) {
    const label = t(u.reason)
    const prev = map.get(u.reason)
    if (prev) {
      prev.qty += u.qty
      if (!prev.names.includes(u.name)) prev.names.push(u.name)
    } else {
      map.set(u.reason, { reason: label, qty: u.qty, names: [u.name] })
    }
  }
  return [...map.values()]
}

export function exportPackCsv(result: PackResult, containerLabel: string, t: (k: string) => string): void {
  const rows: (string | number)[][] = [
    [t('containerType'), containerLabel, t('volumeUtil'), Number(result.volumeUtilPct.toFixed(2)), t('payloadUtil'), Number(result.weightUtilPct.toFixed(2))],
    [t('containerPacked'), result.packedCount, t('containerUnpacked'), result.totalCount - result.packedCount],
    [t('containerSafetyHint')],
    [],
    ['SKU', 'X', 'Y', 'Z', 'L', 'W', 'H', t('weight'), t('orientation')],
    ...result.placements.map((p) => [
      p.name,
      Number(p.x.toFixed(1)),
      Number(p.y.toFixed(1)),
      Number(p.z.toFixed(1)),
      p.l,
      p.w,
      p.h,
      p.weight,
      p.rotated ? '90' : '0',
    ]),
    [],
    [t('containerUnplaced'), 'SKU', t('colQty'), t('nestingReason')],
    ...result.unplaced.map((u) => [u.name, u.qty, t(u.reason)]),
    [],
    [t('unplacedByReason')],
    ...groupUnplacedReasons(result.unplaced, t).map((g) => [g.reason, g.qty, g.names.join('; ')]),
  ]
  download('container-loading.csv', csv(rows))
}

export function exportPackJson(result: PackResult, meta: Record<string, unknown>): void {
  const payload = JSON.stringify({ meta, result }, null, 2)
  download('container-loading.json', payload, 'application/json;charset=utf-8')
}

export function exportSvgPng(svgMarkup: string, filename: string): void {
  const svg = svgMarkup.replace(/^<\?xml[^>]*>\s*/i, '')
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || 1200
    canvas.height = img.naturalHeight || 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    canvas.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }, 'image/png')
    URL.revokeObjectURL(url)
  }
  img.src = url
}
