/** Shared cargo row stored in cm / kg / USD. */
export type QuantityBasis = 'piece' | 'carton' | 'unknown'

export type Cargo = {
  sku: string
  length: number
  width: number
  height: number
  weight: number
  qty: number
  price: number
  /** Explicit meaning of qty / packing counts — absent means unknown (needs review). */
  quantityBasis?: QuantityBasis
  pieceQty?: number
  piecesPerCarton?: number
  /** Per-carton net kg when known; never invent from gross×0.92 */
  netKg?: number | null
  allowRotate?: boolean
  stackable?: boolean
}

export type CargoRow = Cargo & {
  cbm: number
  totalWeight: number
  totalPrice: number
}

export function createSampleCargo(): Cargo[] {
  return [
    {
      sku: 'SKU-A / Gift box',
      length: 42,
      width: 32,
      height: 28,
      weight: 7.5,
      qty: 24,
      price: 12.5,
      quantityBasis: 'carton',
    },
    {
      sku: 'SKU-B / Accessories',
      length: 36,
      width: 28,
      height: 22,
      weight: 5.2,
      qty: 18,
      price: 8.9,
      quantityBasis: 'carton',
    },
    {
      sku: 'SKU-C / Parts',
      length: 52,
      width: 38,
      height: 34,
      weight: 11.4,
      qty: 12,
      price: 24,
      quantityBasis: 'carton',
    },
  ]
}

export function createEmptyCargo(index: number): Cargo {
  return {
    sku: `SKU-${index}`,
    length: 40,
    width: 30,
    height: 25,
    weight: 5,
    qty: 10,
    price: 10,
    quantityBasis: 'carton',
  }
}
