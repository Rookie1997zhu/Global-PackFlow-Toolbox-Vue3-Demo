import type { Cargo } from '../types/cargo'
import type { MappedRow } from './sheetMapping'

export type MappedCargoSkip = {
  rawIndex: number
  code: string
}

export type MappedCargoResult = {
  cargo: Cargo[]
  skipped: MappedCargoSkip[]
}

/**
 * Map sheet rows into shared cargo (cm / kg).
 * Missing dimensions/weight are skipped — never filled with demo defaults.
 */
export function mappedToCargoStrict(rows: MappedRow[]): MappedCargoResult {
  const cargo: Cargo[] = []
  const skipped: MappedCargoSkip[] = []
  rows.forEach((row, i) => {
    const length = row.lengthCm
    const width = row.widthCm
    const height = row.heightCm
    const weight = row.grossKg
    if (!(length > 0 && width > 0 && height > 0 && weight > 0)) {
      skipped.push({ rawIndex: row.rawIndex, code: 'CARGO_DIMENSIONS_REQUIRED' })
      return
    }
    const qty = Math.max(0, Math.floor(row.boxCount || row.qty || 0))
    if (qty <= 0) {
      skipped.push({ rawIndex: row.rawIndex, code: 'errImportQty' })
      return
    }
    cargo.push({
      sku: row.sku || row.description || `SKU-${i + 1}`,
      length,
      width,
      height,
      weight,
      qty,
      price: row.unitPrice || (row.amount > 0 && qty > 0 ? row.amount / qty : 0),
    })
  })
  return { cargo, skipped }
}

/** Valid cargo rows only (drops incomplete dimension/weight rows). */
export function mappedToCargo(rows: MappedRow[]): Cargo[] {
  return mappedToCargoStrict(rows).cargo
}
