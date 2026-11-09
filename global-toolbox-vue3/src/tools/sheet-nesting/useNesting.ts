import { csv, download } from '../../shared/export/csv'
import { sanitizeNonNegative } from '../../shared/validation'

export type NestingStrategy = 'maxrects' | 'guillotine'

export type NestingPartSpec = {
  id: string
  name: string
  width: number
  height: number
  qty: number
  allowRotate: boolean
}

export type NestingInput = {
  sheetWidth: number
  sheetHeight: number
  margin: number
  kerf: number
  strategy: NestingStrategy
  parts: NestingPartSpec[]
}

export type Placement = {
  sheetIndex: number
  partId: string
  name: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
  instanceIndex: number
}

export type PartSummary = {
  partId: string
  name: string
  required: number
  placed: number
}

export type NestingResult = {
  strategy: NestingStrategy
  sheetWidth: number
  sheetHeight: number
  margin: number
  kerf: number
  sheetCount: number
  placements: Placement[]
  unplaced: { partId: string; name: string; width: number; height: number; reason: string }[]
  partSummaries: PartSummary[]
  usedArea: number
  sheetAreaTotal: number
  utilizationPct: number
  wasteArea: number
}

type FreeRect = { x: number; y: number; w: number; h: number }

type Item = {
  partId: string
  name: string
  width: number
  height: number
  allowRotate: boolean
  instanceIndex: number
  area: number
}

export const MAX_NESTING_INSTANCES = 5000

const COLORS = ['#0e7490', '#0369a1', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#4338ca', '#047857']

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function createSampleParts(): NestingPartSpec[] {
  return [
    { id: 'p1', name: 'Panel A', width: 260, height: 190, qty: 12, allowRotate: true },
    { id: 'p2', name: 'Panel B', width: 180, height: 120, qty: 16, allowRotate: true },
    { id: 'p3', name: 'Panel C', width: 320, height: 80, qty: 8, allowRotate: false },
  ]
}

export function expandInstances(parts: NestingPartSpec[]): Item[] | { error: string } {
  const items: Item[] = []
  for (const p of parts) {
    const qty = Math.floor(n(p.qty))
    const w = n(p.width)
    const h = n(p.height)
    if (!p.id || w <= 0 || h <= 0 || qty < 0) continue
    for (let i = 0; i < qty; i++) {
      items.push({
        partId: p.id,
        name: p.name || p.id,
        width: w,
        height: h,
        allowRotate: !!p.allowRotate,
        instanceIndex: i,
        area: w * h,
      })
    }
  }
  if (items.length > MAX_NESTING_INSTANCES) return { error: 'errNestingTooMany' }
  items.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area
    if (a.partId !== b.partId) return a.partId < b.partId ? -1 : 1
    return a.instanceIndex - b.instanceIndex
  })
  return items
}

function fits(free: FreeRect, pw: number, ph: number): boolean {
  return pw <= free.w + 1e-9 && ph <= free.h + 1e-9
}

/** MaxRects: split free rects intersecting the used rect, then prune contained. */
function splitMaxRects(freeList: FreeRect[], used: FreeRect): FreeRect[] {
  const next: FreeRect[] = []
  for (const f of freeList) {
    if (
      used.x >= f.x + f.w ||
      used.x + used.w <= f.x ||
      used.y >= f.y + f.h ||
      used.y + used.h <= f.y
    ) {
      next.push(f)
      continue
    }
    if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h })
    if (used.x + used.w < f.x + f.w) {
      next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - (used.x + used.w), h: f.h })
    }
    if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y })
    if (used.y + used.h < f.y + f.h) {
      next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - (used.y + used.h) })
    }
  }
  return pruneFreeRects(next)
}

function pruneFreeRects(list: FreeRect[]): FreeRect[] {
  const out: FreeRect[] = []
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.w <= 0 || a.h <= 0) continue
    let contained = false
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue
      const b = list[j]
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        contained = true
        break
      }
    }
    if (!contained) out.push(a)
  }
  return out
}

function scoreBssf(free: FreeRect, pw: number, ph: number): [number, number] {
  const leftoverW = free.w - pw
  const leftoverH = free.h - ph
  const shortSide = Math.min(leftoverW, leftoverH)
  const longSide = Math.max(leftoverW, leftoverH)
  return [shortSide, longSide]
}

function scoreBaf(free: FreeRect, pw: number, ph: number): number {
  return free.w * free.h - pw * ph
}

type Orient = { pw: number; ph: number; rotated: boolean; partW: number; partH: number }

function orientations(item: Item, kerf: number): Orient[] {
  const out: Orient[] = [
    { pw: item.width + kerf, ph: item.height + kerf, rotated: false, partW: item.width, partH: item.height },
  ]
  if (item.allowRotate && (item.width !== item.height || kerf === 0)) {
    out.push({
      pw: item.height + kerf,
      ph: item.width + kerf,
      rotated: true,
      partW: item.height,
      partH: item.width,
    })
  }
  return out
}

function findMaxRectsPlacement(
  freeList: FreeRect[],
  item: Item,
  kerf: number,
): { freeIndex: number; orient: Orient } | null {
  let best: { freeIndex: number; orient: Orient; short: number; long: number } | null = null
  for (let i = 0; i < freeList.length; i++) {
    const free = freeList[i]
    for (const orient of orientations(item, kerf)) {
      if (!fits(free, orient.pw, orient.ph)) continue
      const [short, long] = scoreBssf(free, orient.pw, orient.ph)
      if (
        !best ||
        short < best.short - 1e-9 ||
        (Math.abs(short - best.short) < 1e-9 && long < best.long - 1e-9) ||
        (Math.abs(short - best.short) < 1e-9 &&
          Math.abs(long - best.long) < 1e-9 &&
          (orient.rotated ? 1 : 0) < (best.orient.rotated ? 1 : 0))
      ) {
        best = { freeIndex: i, orient, short, long }
      }
    }
  }
  return best ? { freeIndex: best.freeIndex, orient: best.orient } : null
}

function findGuillotinePlacement(
  freeList: FreeRect[],
  item: Item,
  kerf: number,
): { freeIndex: number; orient: Orient; splitHorizontal: boolean } | null {
  let best: {
    freeIndex: number
    orient: Orient
    waste: number
    splitHorizontal: boolean
  } | null = null

  for (let i = 0; i < freeList.length; i++) {
    const free = freeList[i]
    for (const orient of orientations(item, kerf)) {
      if (!fits(free, orient.pw, orient.ph)) continue
      const waste = scoreBaf(free, orient.pw, orient.ph)
      // Prefer the split that yields more usable leftover area balance
      const remW = free.w - orient.pw
      const remH = free.h - orient.ph
      const splitHorizontal = remH * free.w >= remW * free.h
      if (
        !best ||
        waste < best.waste - 1e-9 ||
        (Math.abs(waste - best.waste) < 1e-9 && (orient.rotated ? 1 : 0) < (best.orient.rotated ? 1 : 0)) ||
        (Math.abs(waste - best.waste) < 1e-9 &&
          (orient.rotated ? 1 : 0) === (best.orient.rotated ? 1 : 0) &&
          i < best.freeIndex)
      ) {
        best = { freeIndex: i, orient, waste, splitHorizontal }
      }
    }
  }
  return best
    ? { freeIndex: best.freeIndex, orient: best.orient, splitHorizontal: best.splitHorizontal }
    : null
}

function splitGuillotine(free: FreeRect, used: FreeRect, splitHorizontal: boolean): FreeRect[] {
  const next: FreeRect[] = []
  if (splitHorizontal) {
    // bottom leftover
    if (free.h - used.h > 0) next.push({ x: free.x, y: free.y + used.h, w: free.w, h: free.h - used.h })
    // right leftover beside placed
    if (free.w - used.w > 0) next.push({ x: free.x + used.w, y: free.y, w: free.w - used.w, h: used.h })
  } else {
    if (free.w - used.w > 0) next.push({ x: free.x + used.w, y: free.y, w: free.w - used.w, h: free.h })
    if (free.h - used.h > 0) next.push({ x: free.x, y: free.y + used.h, w: used.w, h: free.h - used.h })
  }
  return next.filter((r) => r.w > 0 && r.h > 0)
}

function packSheet(
  strategy: NestingStrategy,
  effW: number,
  effH: number,
  kerf: number,
  items: Item[],
  sheetIndex: number,
  margin: number,
): { placements: Placement[]; remaining: Item[] } {
  let freeList: FreeRect[] = [{ x: 0, y: 0, w: effW, h: effH }]
  const placements: Placement[] = []
  const remaining: Item[] = []

  for (const item of items) {
    if (strategy === 'maxrects') {
      const found = findMaxRectsPlacement(freeList, item, kerf)
      if (!found) {
        remaining.push(item)
        continue
      }
      const free = freeList[found.freeIndex]
      const used: FreeRect = { x: free.x, y: free.y, w: found.orient.pw, h: found.orient.ph }
      placements.push({
        sheetIndex,
        partId: item.partId,
        name: item.name,
        x: margin + free.x,
        y: margin + free.y,
        w: found.orient.partW,
        h: found.orient.partH,
        rotated: found.orient.rotated,
        instanceIndex: item.instanceIndex,
      })
      freeList = splitMaxRects(freeList, used)
    } else {
      const found = findGuillotinePlacement(freeList, item, kerf)
      if (!found) {
        remaining.push(item)
        continue
      }
      const free = freeList[found.freeIndex]
      const used: FreeRect = { x: free.x, y: free.y, w: found.orient.pw, h: found.orient.ph }
      placements.push({
        sheetIndex,
        partId: item.partId,
        name: item.name,
        x: margin + free.x,
        y: margin + free.y,
        w: found.orient.partW,
        h: found.orient.partH,
        rotated: found.orient.rotated,
        instanceIndex: item.instanceIndex,
      })
      const others = freeList.filter((_, idx) => idx !== found.freeIndex)
      freeList = [...others, ...splitGuillotine(free, used, found.splitHorizontal)]
    }
  }

  return { placements, remaining }
}

export function runNesting(input: NestingInput): NestingResult | { error: string } {
  const sheetWidth = n(input.sheetWidth)
  const sheetHeight = n(input.sheetHeight)
  const margin = n(input.margin)
  const kerf = n(input.kerf)
  const strategy = input.strategy === 'guillotine' ? 'guillotine' : 'maxrects'

  if (sheetWidth <= 0 || sheetHeight <= 0) return { error: 'errNestingSheetInvalid' }
  const effW = sheetWidth - 2 * margin
  const effH = sheetHeight - 2 * margin
  if (effW <= 0 || effH <= 0) return { error: 'errNestingMarginInvalid' }

  const expanded = expandInstances(input.parts)
  if ('error' in expanded) return expanded

  const unplaced: NestingResult['unplaced'] = []
  let queue = expanded
  const placements: Placement[] = []
  let sheetIndex = 0

  // Filter items that can never fit even alone
  const fitQueue: Item[] = []
  for (const item of queue) {
    const orients = orientations(item, kerf)
    const canFit = orients.some((o) => o.pw <= effW + 1e-9 && o.ph <= effH + 1e-9)
    if (!canFit) {
      unplaced.push({
        partId: item.partId,
        name: item.name,
        width: item.width,
        height: item.height,
        reason: 'errNestingPartTooLarge',
      })
    } else {
      fitQueue.push(item)
    }
  }
  queue = fitQueue

  while (queue.length) {
    const before = queue.length
    const packed = packSheet(strategy, effW, effH, kerf, queue, sheetIndex, margin)
    if (packed.placements.length === 0) {
      for (const item of packed.remaining) {
        unplaced.push({
          partId: item.partId,
          name: item.name,
          width: item.width,
          height: item.height,
          reason: 'errNestingUnplaced',
        })
      }
      break
    }
    placements.push(...packed.placements)
    queue = packed.remaining
    sheetIndex++
    if (queue.length === before) {
      // safety: no progress
      for (const item of queue) {
        unplaced.push({
          partId: item.partId,
          name: item.name,
          width: item.width,
          height: item.height,
          reason: 'errNestingUnplaced',
        })
      }
      break
    }
  }

  const sheetCount = placements.length ? Math.max(...placements.map((p) => p.sheetIndex)) + 1 : 0
  const usedArea = placements.reduce((s, p) => s + p.w * p.h, 0)
  const sheetAreaTotal = sheetCount * sheetWidth * sheetHeight
  const utilizationPct = sheetAreaTotal > 0 ? (usedArea / sheetAreaTotal) * 100 : 0
  const wasteArea = Math.max(0, sheetAreaTotal - usedArea)

  const partMap = new Map<string, PartSummary>()
  for (const p of input.parts) {
    partMap.set(p.id, { partId: p.id, name: p.name || p.id, required: Math.floor(n(p.qty)), placed: 0 })
  }
  for (const pl of placements) {
    const row = partMap.get(pl.partId)
    if (row) row.placed += 1
  }

  return {
    strategy,
    sheetWidth,
    sheetHeight,
    margin,
    kerf,
    sheetCount,
    placements,
    unplaced,
    partSummaries: [...partMap.values()],
    usedArea,
    sheetAreaTotal,
    utilizationPct,
    wasteArea,
  }
}

export function buildNestingSvg(result: NestingResult, sheetIndex = 0): string {
  const W = result.sheetWidth
  const H = result.sheetHeight
  const items = result.placements.filter((p) => p.sheetIndex === sheetIndex)
  const colorOf = (id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    return COLORS[hash % COLORS.length]
  }

  const rects = items
    .map((p) => {
      const label = escapeXml(`${p.name}${p.rotated ? ' ↻' : ''}`)
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${colorOf(p.partId)}" fill-opacity="0.35" stroke="${colorOf(p.partId)}" stroke-width="1.5"/><text x="${p.x + 4}" y="${p.y + 14}" font-size="11" font-family="Arial,sans-serif" fill="#123654">${label}</text>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/><rect x="${result.margin}" y="${result.margin}" width="${Math.max(0, W - 2 * result.margin)}" height="${Math.max(0, H - 2 * result.margin)}" fill="none" stroke="#cbd5e1" stroke-dasharray="6 4"/>${rects}</svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function exportNestingSvg(result: NestingResult, sheetIndex = 0): void {
  const svg = buildNestingSvg(result, sheetIndex)
  download(`nesting-sheet-${sheetIndex + 1}.svg`, svg, 'image/svg+xml;charset=utf-8')
}

export function exportNestingCsv(
  result: NestingResult,
  headers: {
    strategy: string
    sheets: string
    util: string
    waste: string
    part: string
    required: string
    placed: string
    sheet: string
    x: string
    y: string
    w: string
    h: string
    rotated: string
    unplaced: string
    reason: string
  },
  strategyLabel: string,
): void {
  const rows: (string | number)[][] = [
    [headers.strategy, strategyLabel, headers.sheets, result.sheetCount, headers.util, Number(result.utilizationPct.toFixed(2)), headers.waste, Number(result.wasteArea.toFixed(2))],
    [],
    [headers.part, headers.required, headers.placed],
    ...result.partSummaries.map((p) => [p.name, p.required, p.placed]),
    [],
    [headers.sheet, headers.part, headers.x, headers.y, headers.w, headers.h, headers.rotated],
    ...result.placements.map((p) => [
      p.sheetIndex + 1,
      p.name,
      Number(p.x.toFixed(3)),
      Number(p.y.toFixed(3)),
      Number(p.w.toFixed(3)),
      Number(p.h.toFixed(3)),
      p.rotated ? 'yes' : 'no',
    ]),
    [],
    [headers.unplaced, headers.part, headers.w, headers.h, headers.reason],
    ...result.unplaced.map((u) => [u.name, u.width, u.height, u.reason]),
  ]
  download('nesting-results.csv', csv(rows))
}

/** Helpers for tests */
export function placementsOverlap(a: Placement, b: Placement): boolean {
  if (a.sheetIndex !== b.sheetIndex) return false
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

export function placementInsideSheet(p: Placement, sheetW: number, sheetH: number, margin: number): boolean {
  return (
    p.x >= margin - 1e-6 &&
    p.y >= margin - 1e-6 &&
    p.x + p.w <= sheetW - margin + 1e-6 &&
    p.y + p.h <= sheetH - margin + 1e-6
  )
}
