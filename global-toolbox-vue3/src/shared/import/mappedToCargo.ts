import type { Cargo } from '../types/cargo'
import type { MappedRow } from './sheetMapping'

/** Map sheet rows into shared cargo (cm / kg). */
export function mappedToCargo(rows: MappedRow[]): Cargo[] {
  return rows.map((row, i) => {
    const qty = Math.max(0, Math.floor(row.boxCount || row.qty || 0)) || 1
    return {
      sku: row.sku || row.description || `SKU-${i + 1}`,
      length: row.lengthCm || 40,
      width: row.widthCm || 30,
      height: row.heightCm || 20,
      weight: row.grossKg || 5,
      qty,
      price: row.unitPrice || (row.amount > 0 && qty > 0 ? row.amount / qty : 0),
    }
  })
}
