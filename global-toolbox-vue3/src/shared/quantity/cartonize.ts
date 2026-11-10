/**
 * V1.3.1 PF-001 — piece/carton quantity helpers.
 * Do not invent PCS/CTN from bare Cargo.qty without an explicit basis.
 */

export type QuantityBasis = 'piece' | 'carton' | 'unknown'

export type ConfirmedQuantity = {
  sku: string
  pieceQty: number
  piecesPerCarton: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  grossKgPerCarton?: number
  /** Absent / null means unconfirmed — must not fabricate from gross×0.92 */
  netKgPerCarton?: number | null
}

export type CartonizeResult = {
  cartonCount: number
  totalQty: number
  qtyPerCarton: number
  lastCartonQty: number
  lines: Array<{
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
  }>
  needsReview: boolean
  legacyQuantityBasis: QuantityBasis
}

export function resolveLegacyQuantity(cargo: {
  qty: number
  quantityBasis?: QuantityBasis
  pieceQty?: number
  piecesPerCarton?: number
}): { basis: QuantityBasis; needsReview: boolean } {
  if (
    cargo.pieceQty != null &&
    cargo.pieceQty > 0 &&
    cargo.piecesPerCarton != null &&
    cargo.piecesPerCarton > 0
  ) {
    return { basis: 'piece', needsReview: false }
  }
  if (cargo.quantityBasis === 'piece' || cargo.quantityBasis === 'carton') {
    return { basis: cargo.quantityBasis, needsReview: false }
  }
  return { basis: 'unknown', needsReview: true }
}

export function cartonizeConfirmed(input: ConfirmedQuantity): CartonizeResult {
  const pieceQty = Math.max(0, Math.floor(Number(input.pieceQty) || 0))
  const per = Math.max(1, Math.floor(Number(input.piecesPerCarton) || 0))
  if (pieceQty <= 0) {
    return {
      cartonCount: 0,
      totalQty: 0,
      qtyPerCarton: per,
      lastCartonQty: 0,
      lines: [],
      needsReview: true,
      legacyQuantityBasis: 'piece',
    }
  }
  const full = Math.floor(pieceQty / per)
  const rem = pieceQty % per
  const cartonCount = full + (rem > 0 ? 1 : 0)
  const lastCartonQty = rem > 0 ? rem : per
  const gross = Number(input.grossKgPerCarton) || 0
  const net =
    input.netKgPerCarton === undefined || input.netKgPerCarton === null
      ? null
      : Number(input.netKgPerCarton)
  const dims = {
    lengthCm: Number(input.lengthCm) || 0,
    widthCm: Number(input.widthCm) || 0,
    heightCm: Number(input.heightCm) || 0,
  }
  const lines: CartonizeResult['lines'] = []
  if (full > 0) {
    lines.push({
      sku: input.sku,
      cartonFrom: 1,
      cartonTo: full,
      qtyPerCarton: per,
      grossKg: gross,
      netKg: net,
      ...dims,
    })
  }
  if (rem > 0) {
    const from = full + 1
    lines.push({
      sku: input.sku,
      cartonFrom: from,
      cartonTo: from,
      qtyPerCarton: rem,
      lastCartonQty: rem,
      grossKg: gross,
      netKg: net,
      ...dims,
    })
  } else if (lines.length === 1) {
    lines[0].lastCartonQty = per
  }
  // T-001 expects a single span when evenly divisible
  if (rem === 0 && full > 0) {
    return {
      cartonCount,
      totalQty: pieceQty,
      qtyPerCarton: per,
      lastCartonQty: per,
      lines: [
        {
          sku: input.sku,
          cartonFrom: 1,
          cartonTo: full,
          qtyPerCarton: per,
          lastCartonQty: per,
          grossKg: gross,
          netKg: net,
          ...dims,
        },
      ],
      needsReview: net == null,
      legacyQuantityBasis: 'piece',
    }
  }
  return {
    cartonCount,
    totalQty: pieceQty,
    qtyPerCarton: per,
    lastCartonQty,
    lines,
    needsReview: net == null,
    legacyQuantityBasis: 'piece',
  }
}

export function validateFormalPackingNet(
  lines: Array<{ netKg: number | null | undefined; grossKg: number }>,
): string[] {
  const codes: string[] = []
  for (const line of lines) {
    if (line.netKg == null || Number.isNaN(Number(line.netKg))) {
      codes.push('errPackingNetUnconfirmed')
    } else if (Number(line.netKg) > Number(line.grossKg) + 1e-9) {
      codes.push('errPackingNetGross')
    }
  }
  return [...new Set(codes)]
}
