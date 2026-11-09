import { normalizeHeader, parseCsv } from '../export/csv'
import { parseXlsx } from '../export/xlsx'
import { sanitizeNonNegative } from '../validation'

export type SheetField =
  | 'sku'
  | 'description'
  | 'po'
  | 'carton'
  | 'qty'
  | 'unit'
  | 'grossKg'
  | 'netKg'
  | 'amount'
  | 'unitPrice'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'boxCount'

export type ColumnMapping = Partial<Record<SheetField, number>>

export type MappedRow = {
  rawIndex: number
  sku: string
  description: string
  po: string
  carton: string
  qty: number
  unit: string
  grossKg: number
  netKg: number
  amount: number
  unitPrice: number
  lengthCm: number
  widthCm: number
  heightCm: number
  boxCount: number
}

export type RowIssue = {
  rawIndex: number
  code: string
  field?: SheetField
}

export const SHEET_FIELDS: SheetField[] = [
  'sku',
  'description',
  'po',
  'carton',
  'qty',
  'unit',
  'grossKg',
  'netKg',
  'amount',
  'unitPrice',
  'lengthCm',
  'widthCm',
  'heightCm',
  'boxCount',
]

/** Normalized header aliases → canonical field (KO + EN). */
export const FIELD_ALIASES: Record<string, SheetField> = {
  // sku / item name
  sku: 'sku',
  item: 'sku',
  part: 'sku',
  name: 'sku',
  품명: 'sku',
  상품명: 'sku',
  품목: 'sku',
  제품명: 'sku',
  // description / spec
  description: 'description',
  desc: 'description',
  spec: 'description',
  규격: 'description',
  사양: 'description',
  // po
  po: 'po',
  ponumber: 'po',
  purchaseorder: 'po',
  발주번호: 'po',
  발주: 'po',
  // carton
  carton: 'carton',
  cartonno: 'carton',
  ctn: 'carton',
  ctnno: 'carton',
  카톤번호: 'carton',
  박스번호: 'carton',
  상자번호: 'carton',
  // qty
  qty: 'qty',
  quantity: 'qty',
  pcs: 'qty',
  수량: 'qty',
  수량pcs: 'qty',
  // box count
  boxcount: 'boxCount',
  boxes: 'boxCount',
  cartons: 'boxCount',
  박스수: 'boxCount',
  상자수: 'boxCount',
  // unit
  unit: 'unit',
  uom: 'unit',
  단위: 'unit',
  // weights
  weight: 'grossKg',
  gross: 'grossKg',
  grosskg: 'grossKg',
  grossweight: 'grossKg',
  총중량: 'grossKg',
  총중: 'grossKg',
  net: 'netKg',
  netkg: 'netKg',
  netweight: 'netKg',
  순중량: 'netKg',
  순중: 'netKg',
  // money
  amount: 'amount',
  value: 'amount',
  total: 'amount',
  금액: 'amount',
  합계금액: 'amount',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  단가: 'unitPrice',
  // dimensions
  length: 'lengthCm',
  lengthcm: 'lengthCm',
  l: 'lengthCm',
  가로: 'lengthCm',
  길이: 'lengthCm',
  width: 'widthCm',
  widthcm: 'widthCm',
  w: 'widthCm',
  세로: 'widthCm',
  폭: 'widthCm',
  height: 'heightCm',
  heightcm: 'heightCm',
  h: 'heightCm',
  높이: 'heightCm',
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export async function loadSheetFile(file: File): Promise<{ rows: string[][]; errorCode?: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    return { rows: [], errorCode: 'errCheckerXlsUnsupported' }
  }
  if (name.endsWith('.xlsx')) {
    return { rows: await parseXlsx(file) }
  }
  return { rows: parseCsv(await file.text()) }
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  headers.forEach((h, i) => {
    const key = normalizeHeader(h)
    const field = FIELD_ALIASES[key]
    if (field && mapping[field] === undefined) mapping[field] = i
  })
  return mapping
}

export function applyMapping(table: string[][], mapping: ColumnMapping): MappedRow[] {
  if (table.length < 2) return []
  const out: MappedRow[] = []
  for (let r = 1; r < table.length; r++) {
    const cells = table[r]
    const cell = (field: SheetField) => {
      const idx = mapping[field]
      if (idx === undefined) return ''
      return String(cells[idx] ?? '').trim()
    }
    const sku = cell('sku')
    const description = cell('description') || sku
    out.push({
      rawIndex: r,
      sku,
      description,
      po: cell('po'),
      carton: cell('carton'),
      qty: n(cell('qty')),
      unit: cell('unit'),
      grossKg: n(cell('grossKg')),
      netKg: n(cell('netKg')),
      amount: n(cell('amount')),
      unitPrice: n(cell('unitPrice')),
      lengthCm: n(cell('lengthCm')),
      widthCm: n(cell('widthCm')),
      heightCm: n(cell('heightCm')),
      boxCount: n(cell('boxCount')),
    })
  }
  return out
}

export function validateMappedRows(rows: MappedRow[]): RowIssue[] {
  const issues: RowIssue[] = []
  const cartonSeen = new Map<string, number>()
  for (const row of rows) {
    if (!row.sku.trim() && !row.carton.trim()) {
      issues.push({ rawIndex: row.rawIndex, code: 'errImportEmptyKey' })
      continue
    }
    if (!row.sku.trim()) issues.push({ rawIndex: row.rawIndex, code: 'errImportSku', field: 'sku' })
    if (row.qty <= 0 && row.boxCount <= 0) {
      issues.push({ rawIndex: row.rawIndex, code: 'errImportQty', field: 'qty' })
    }
    if (row.netKg > 0 && row.grossKg > 0 && row.netKg > row.grossKg + 1e-9) {
      issues.push({ rawIndex: row.rawIndex, code: 'errImportNetGross', field: 'netKg' })
    }
    if (row.carton) {
      const prev = cartonSeen.get(row.carton.toLowerCase())
      if (prev !== undefined) {
        issues.push({ rawIndex: row.rawIndex, code: 'errImportDupCarton', field: 'carton' })
      } else {
        cartonSeen.set(row.carton.toLowerCase(), row.rawIndex)
      }
    }
  }
  return issues
}

export function previewRows(table: string[][], limit = 10): string[][] {
  return table.slice(0, Math.max(1, limit + 1))
}
