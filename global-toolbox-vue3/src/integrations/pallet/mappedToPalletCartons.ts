import type { MappedRow } from '../../shared/import/sheetMapping'
import type { Carton } from './packing'

const PALETTE = ['#5385dc', '#33ad99', '#eead61', '#ad85e9', '#e9778e', '#6ba7bd']

/** Convert mapped sheet rows (cm / kg) into pallet cartons (mm / kg). */
export function mappedToPalletCartons(rows: MappedRow[]): Carton[] {
  return rows.map((row, i) => {
    const qty = Math.max(0, Math.floor(row.boxCount || row.qty || 0))
    const l = Math.max(1, Math.round((row.lengthCm || 40) * 10))
    const w = Math.max(1, Math.round((row.widthCm || 30) * 10))
    const h = Math.max(1, Math.round((row.heightCm || 20) * 10))
    return {
      id: i + 1,
      name: row.sku || row.description || `SKU-${i + 1}`,
      l,
      w,
      h,
      qty: qty || 1,
      kg: row.grossKg > 0 ? row.grossKg : 5,
      color: PALETTE[i % PALETTE.length],
      stackable: true,
    }
  })
}
