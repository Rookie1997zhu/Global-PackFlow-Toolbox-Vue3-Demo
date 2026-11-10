/**
 * V1.3.1 PF-003 — cloud verify cargo/params without clobbering shared price.
 */
import type { Cargo } from '../../shared/types/cargo'

export type LocalSkuLike = {
  name: string
  length: number
  width: number
  height: number
  weight: number
  qty: number
  allowRotate: boolean
  stackable: boolean
  color?: string
}

export function buildCloudVerifyCargoRows(
  skus: LocalSkuLike[],
  sharedCargo: Cargo[],
): Cargo[] {
  const bySku = new Map(sharedCargo.map((c) => [c.sku, c]))
  return skus.map((s) => {
    const prev = bySku.get(s.name)
    return {
      sku: s.name,
      length: s.length / 10,
      width: s.width / 10,
      height: s.height / 10,
      weight: s.weight,
      qty: s.qty,
      price: prev?.price ?? 0,
      quantityBasis: prev?.quantityBasis,
      pieceQty: prev?.pieceQty,
      piecesPerCarton: prev?.piecesPerCarton,
      netKg: prev?.netKg,
      allowRotate: s.allowRotate,
      stackable: s.stackable,
    }
  })
}

export function buildCloudVerifyParams(skus: LocalSkuLike[], presetId: string): {
  containerPreset: string
  skus: Array<{ id: string; allowRotate: boolean; stackable: boolean }>
  allowRotate?: boolean
} {
  return {
    containerPreset: presetId,
    skus: skus.map((s) => ({
      id: s.name,
      allowRotate: s.allowRotate,
      stackable: s.stackable,
    })),
    // Keep a coarse flag for older servers; per-SKU list is authoritative.
    allowRotate: skus.some((s) => s.allowRotate),
  }
}
