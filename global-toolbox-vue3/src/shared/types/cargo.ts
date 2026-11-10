/** Shared cargo row stored in cm / kg / USD. */
export type Cargo = {
  sku: string
  length: number
  width: number
  height: number
  weight: number
  qty: number
  price: number
}

export type CargoRow = Cargo & {
  cbm: number
  totalWeight: number
  totalPrice: number
}

export function createSampleCargo(): Cargo[] {
  return [
    { sku: 'SKU-A / Gift box', length: 42, width: 32, height: 28, weight: 7.5, qty: 24, price: 12.5 },
    { sku: 'SKU-B / Accessories', length: 36, width: 28, height: 22, weight: 5.2, qty: 18, price: 8.9 },
    { sku: 'SKU-C / Parts', length: 52, width: 38, height: 34, weight: 11.4, qty: 12, price: 24 },
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
  }
}
