/** Container loading heuristic: candidate corners, horizontal rotation, support check, payload cap.
 * Feasible layout only — not global optimum or safety certification. */

export type LoadSku = {
  id: string
  name: string
  length: number
  width: number
  height: number
  weight: number
  qty: number
  allowRotate: boolean
  stackable: boolean
  color: string
}

export type Placement = {
  skuId: string
  name: string
  x: number
  y: number
  z: number
  l: number
  w: number
  h: number
  weight: number
  color: string
  unitId: string
  rotated: boolean
}

export type ContainerConfig = {
  length: number
  width: number
  height: number
  maxPayload: number
}

export type PackInput = {
  container: ContainerConfig
  skus: LoadSku[]
}

export type PackResult = {
  placements: Placement[]
  unplaced: { skuId: string; name: string; qty: number; reason: string }[]
  packedCount: number
  totalCount: number
  packedWeight: number
  packedVolumeMm3: number
  containerVolumeMm3: number
  volumeUtilPct: number
  weightUtilPct: number
  strategy: string
  warnings: string[]
}

type Unit = LoadSku & { unitId: string }
type Point = { x: number; y: number; z: number }

const EPS = 1e-6
const MAX_UNITS = 400
const MAX_ATTEMPTS = 6
const COLORS = ['#0e7490', '#0369a1', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#4338ca', '#047857']

const key = (p: Point) => `${p.x}|${p.y}|${p.z}`
const overlap = (a: number, al: number, b: number, bl: number) => Math.min(a + al, b + bl) - Math.max(a, b) > EPS

export function collides(a: Placement, b: Placement) {
  return overlap(a.x, a.l, b.x, b.l) && overlap(a.y, a.w, b.y, b.w) && overlap(a.z, a.h, b.z, b.h)
}

export function inBounds(b: Placement, c: ContainerConfig) {
  return (
    b.x >= -EPS &&
    b.y >= -EPS &&
    b.z >= -EPS &&
    b.x + b.l <= c.length + EPS &&
    b.y + b.w <= c.width + EPS &&
    b.z + b.h <= c.height + EPS
  )
}

function areaUnion(rects: { x1: number; y1: number; x2: number; y2: number }[]): number {
  if (!rects.length) return 0
  const xs = [...new Set(rects.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b)
  let area = 0
  for (let i = 0; i < xs.length - 1; i++) {
    const lo = xs[i]
    const hi = xs[i + 1]
    if (hi - lo < EPS) continue
    const spans = rects
      .filter((r) => r.x1 < hi - EPS && r.x2 > lo + EPS)
      .map((r) => [r.y1, r.y2] as const)
      .sort((a, b) => a[0] - b[0])
    let begin = 0
    let end = 0
    let covered = 0
    for (const [s, e] of spans) {
      if (e <= end) continue
      if (s > end) {
        covered += Math.max(0, end - begin)
        begin = s
      }
      end = e
    }
    covered += Math.max(0, end - begin)
    area += (hi - lo) * covered
  }
  return area
}

export function supported(b: Placement, placed: Placement[]) {
  if (Math.abs(b.z) < EPS) return true
  const contacts = placed.filter(
    (p) => Math.abs(p.z + p.h - b.z) < EPS && overlap(p.x, p.l, b.x, b.l) && overlap(p.y, p.w, b.y, b.w),
  )
  if (!contacts.length || contacts.some((p) => p.unitId.endsWith('!'))) return false
  const rects = contacts.map((p) => ({
    x1: Math.max(p.x, b.x),
    x2: Math.min(p.x + p.l, b.x + b.l),
    y1: Math.max(p.y, b.y),
    y2: Math.min(p.y + p.w, b.y + b.w),
  }))
  return areaUnion(rects) >= b.l * b.w - EPS
}

function orientations(u: Unit): [number, number, boolean][] {
  if (!u.allowRotate || u.length === u.width) return [[u.length, u.width, false]]
  return [
    [u.length, u.width, false],
    [u.width, u.length, true],
  ]
}

function candidates(placed: Placement[], c: ContainerConfig): Point[] {
  // Prefer recent boxes so candidate generation stays near-linear for large N.
  const recent = placed.length > 48 ? placed.slice(-48) : placed
  const xs = [0, ...recent.map((b) => b.x + b.l)]
  const ys = [0, ...recent.map((b) => b.y + b.w)]
  const zs = [0, ...recent.map((b) => b.z + b.h)]
  const points: Point[] = []
  const seen = new Set<string>()
  const push = (p: Point) => {
    if (p.x >= 0 && p.y >= 0 && p.z >= 0 && p.x < c.length && p.y < c.width && p.z < c.height) {
      const k = key(p)
      if (!seen.has(k)) {
        seen.add(k)
        points.push(p)
      }
    }
  }
  // Floor grid from recent extremes only (full n×n grid was freezing ~200+ units).
  const xStep = Math.max(1, Math.ceil(xs.length / 12))
  const yStep = Math.max(1, Math.ceil(ys.length / 12))
  for (let i = 0; i < xs.length; i += xStep) {
    for (let j = 0; j < ys.length; j += yStep) push({ x: xs[i], y: ys[j], z: 0 })
  }
  for (const z of zs) {
    if (z === 0) continue
    for (const b of recent) {
      if (Math.abs(b.z + b.h - z) > EPS) continue
      push({ x: b.x, y: b.y, z })
      for (let i = 0; i < xs.length; i += xStep) push({ x: xs[i], y: b.y, z })
      for (let j = 0; j < ys.length; j += yStep) push({ x: b.x, y: ys[j], z })
    }
  }
  const cap = placed.length > 80 ? 48 : placed.length > 40 ? 72 : 96
  return points.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x).slice(0, cap)
}

function score(b: Placement, c: ContainerConfig, placed: Placement[], variant: number) {
  const height = b.z / Math.max(1, c.height)
  const center = Math.abs(b.x + b.l / 2 - c.length / 2) / c.length + Math.abs(b.y + b.w / 2 - c.width / 2) / c.width
  const edge = b.x / c.length + b.y / c.width
  const neighbors = placed.reduce(
    (n, p) => n + (Math.abs(p.x + p.l - b.x) < EPS ? 1 : 0) + (Math.abs(p.y + p.w - b.y) < EPS ? 1 : 0),
    0,
  )
  return variant % 2 === 0
    ? height * 100 + center * 8 + edge * 2 - neighbors * 0.3
    : height * 100 + edge * 6 + center * 2 - neighbors * 0.5
}

function pick(u: Unit, placed: Placement[], weight: number, c: ContainerConfig, variant: number): Placement | null {
  if (weight + u.weight > c.maxPayload + EPS) return null
  let best: Placement | null = null
  let bestScore = Infinity
  const pts = candidates(placed, c)
  // First feasible low-z placement is enough once many boxes are already packed.
  const greedy = placed.length >= 60
  for (const pt of pts) {
    for (const [l, w, rotated] of orientations(u)) {
      const b: Placement = {
        skuId: u.id,
        name: u.name,
        x: pt.x,
        y: pt.y,
        z: pt.z,
        l,
        w,
        h: u.height,
        weight: u.weight,
        color: u.color,
        unitId: u.unitId + (u.stackable ? '' : '!'),
        rotated,
      }
      if (!inBounds(b, c) || placed.some((q) => collides(b, q)) || !supported(b, placed)) continue
      if (greedy) return b
      const s = score(b, c, placed, variant)
      if (s < bestScore - EPS) {
        bestScore = s
        best = b
      }
    }
  }
  return best
}

function ordering(units: Unit[], variant: number): Unit[] {
  const arr = [...units]
  const volume = (u: Unit) => u.length * u.width * u.height
  const foot = (u: Unit) => u.length * u.width
  const longest = (u: Unit) => Math.max(u.length, u.width, u.height)
  return arr.sort((a, b) => {
    let diff = 0
    switch (variant) {
      case 0:
        diff = volume(b) - volume(a)
        break
      case 1:
        diff = longest(b) - longest(a)
        break
      case 2:
        diff = foot(b) - foot(a)
        break
      case 3:
        diff = b.weight - a.weight
        break
      case 4:
        diff = (b.stackable ? 1 : 0) - (a.stackable ? 1 : 0) || volume(b) - volume(a)
        break
      default:
        diff = b.height - a.height || volume(b) - volume(a)
    }
    return diff || a.unitId.localeCompare(b.unitId)
  })
}

function attempt(units: Unit[], c: ContainerConfig, variant: number) {
  const placed: Placement[] = []
  let weight = 0
  const missing: Unit[] = []
  for (const u of ordering(units, variant)) {
    const b = pick(u, placed, weight, c, variant)
    if (b) {
      placed.push(b)
      weight += u.weight
    } else {
      missing.push(u)
    }
  }
  return { placed, missing, weight }
}

export function validatePack(placements: Placement[], c: ContainerConfig): string[] {
  const errors: string[] = []
  const weight = placements.reduce((s, b) => s + b.weight, 0)
  if (weight > c.maxPayload + EPS) errors.push('errContainerOverweight')
  for (let j = 0; j < placements.length; j++) {
    const b = placements[j]
    if (!inBounds(b, c)) errors.push('errContainerOutOfBounds')
    if (!supported(b, placements.filter((_, k) => k !== j))) errors.push('errContainerSupport')
    for (let k = 0; k < j; k++) if (collides(b, placements[k])) errors.push('errContainerOverlap')
  }
  return [...new Set(errors)]
}

/** Bounds / overlap / payload only — used when full support re-check would freeze the UI. */
export function validatePackLight(placements: Placement[], c: ContainerConfig): string[] {
  const errors: string[] = []
  const weight = placements.reduce((s, b) => s + b.weight, 0)
  if (weight > c.maxPayload + EPS) errors.push('errContainerOverweight')
  for (let j = 0; j < placements.length; j++) {
    const b = placements[j]
    if (!inBounds(b, c)) errors.push('errContainerOutOfBounds')
    for (let k = 0; k < j; k++) if (collides(b, placements[k])) errors.push('errContainerOverlap')
  }
  return [...new Set(errors)]
}

export function colorForIndex(i: number): string {
  return COLORS[i % COLORS.length]
}

export function packContainer(input: PackInput): PackResult {
  const c = input.container
  const containerVolumeMm3 = c.length * c.width * c.height
  const totalCount = input.skus.reduce((s, u) => s + (Number.isFinite(u.qty) ? Math.max(0, Math.floor(u.qty)) : 0), 0)
  const empty = (warnings: string[], unplaced: PackResult['unplaced'] = []): PackResult => ({
    placements: [],
    unplaced,
    packedCount: 0,
    totalCount,
    packedWeight: 0,
    packedVolumeMm3: 0,
    containerVolumeMm3,
    volumeUtilPct: 0,
    weightUtilPct: 0,
    strategy: '',
    warnings,
  })

  if (![c.length, c.width, c.height, c.maxPayload].every((v) => Number.isFinite(v) && v > 0)) {
    return empty(['errContainerInvalid'], input.skus.map((s) => ({ skuId: s.id, name: s.name, qty: s.qty, reason: 'errContainerInvalid' })))
  }

  const warnings: string[] = []
  const units: Unit[] = []
  const unplacedMap = new Map<string, { skuId: string; name: string; qty: number; reason: string }>()

  const miss = (skuId: string, name: string, n: number, reason: string) => {
    const prev = unplacedMap.get(skuId)
    if (prev) prev.qty += n
    else unplacedMap.set(skuId, { skuId, name, qty: n, reason })
  }

  input.skus.forEach((u, idx) => {
    const n = Number.isFinite(u.qty) ? Math.max(0, Math.floor(u.qty)) : 0
    if (![u.length, u.width, u.height, u.weight].every((v) => Number.isFinite(v) && v > 0)) {
      miss(u.id, u.name, n, 'errContainerSkuInvalid')
      return
    }
    const fits =
      (u.length <= c.length && u.width <= c.width && u.height <= c.height) ||
      (u.allowRotate && u.width <= c.length && u.length <= c.width && u.height <= c.height)
    if (!fits) {
      miss(u.id, u.name, n, 'errContainerPartTooLarge')
      return
    }
    const allowed = Math.max(0, Math.min(n, MAX_UNITS - units.length))
    const color = u.color || colorForIndex(idx)
    for (let i = 0; i < allowed; i++) {
      units.push({ ...u, color, unitId: `${u.id}-${i}` })
    }
    if (n > allowed) miss(u.id, u.name, n - allowed, 'errContainerTooMany')
  })

  if (totalCount > MAX_UNITS) warnings.push('errContainerTooMany')

  let best: { placed: Placement[]; missing: Unit[]; weight: number } | null = null
  let bestVariant = 0
  // Large N: fewer strategy passes — each pass is O(n · candidates · collisions).
  const attempts = units.length > 80 ? 1 : units.length > 40 ? 2 : Math.min(MAX_ATTEMPTS, 3)
  for (let variant = 0; variant < attempts; variant++) {
    const trial = attempt(units, c, variant)
    const better =
      !best ||
      trial.missing.length < best.missing.length ||
      (trial.missing.length === best.missing.length && trial.placed.length > best.placed.length)
    if (better) {
      best = trial
      bestVariant = variant
    }
    if (trial.missing.length === 0) break
  }

  for (const u of best?.missing || []) {
    miss(u.id, u.name, 1, u.weight + (best?.weight || 0) > c.maxPayload ? 'errContainerOverweight' : 'errContainerUnplaced')
  }

  const placements = best?.placed || []
  const packedWeight = placements.reduce((s, b) => s + b.weight, 0)
  const packedVolumeMm3 = placements.reduce((s, b) => s + b.l * b.w * b.h, 0)
  // Full support re-check is O(n²); for large packs rely on placement-time checks.
  const geomErrors =
    placements.length > 80
      ? validatePackLight(placements, c)
      : validatePack(placements, c)
  warnings.push(...geomErrors)
  warnings.push('containerSafetyHint')

  const strategies = ['volume', 'longestEdge', 'footprint', 'weight', 'nonStackFirst', 'height']

  return {
    placements,
    unplaced: [...unplacedMap.values()],
    packedCount: placements.length,
    totalCount,
    packedWeight,
    packedVolumeMm3,
    containerVolumeMm3,
    volumeUtilPct: containerVolumeMm3 > 0 ? (packedVolumeMm3 / containerVolumeMm3) * 100 : 0,
    weightUtilPct: c.maxPayload > 0 ? (packedWeight / c.maxPayload) * 100 : 0,
    strategy: strategies[bestVariant] || 'volume',
    warnings,
  }
}
