import { csv, download, normalizeHeader, parseCsv } from '../../shared/export/csv'
import { downloadXlsx, parseXlsx } from '../../shared/export/xlsx'
import { sanitizeNonNegative } from '../../shared/validation'

export type CheckerRow = {
  key: string
  sku: string
  carton: string
  qty: number
  weight: number
  amount: number
  unit: string
  source: 'expected' | 'actual'
  rawIndex: number
}

export type DiffKind =
  | 'ok'
  | 'missing_actual'
  | 'missing_expected'
  | 'duplicate_expected'
  | 'duplicate_actual'
  | 'qty_mismatch'
  | 'weight_mismatch'
  | 'amount_mismatch'
  | 'unit_mismatch'

export type DiffRow = {
  key: string
  sku: string
  carton: string
  kind: DiffKind
  expectedQty?: number
  actualQty?: number
  expectedWeight?: number
  actualWeight?: number
  expectedAmount?: number
  actualAmount?: number
  expectedUnit?: string
  actualUnit?: string
  messageCode: string
}

const HEADER_MAP: Record<string, keyof Omit<CheckerRow, 'key' | 'source' | 'rawIndex'>> = {
  sku: 'sku',
  item: 'sku',
  part: 'sku',
  carton: 'carton',
  cartonno: 'carton',
  ctn: 'carton',
  ctnno: 'carton',
  qty: 'qty',
  quantity: 'qty',
  weight: 'weight',
  gross: 'weight',
  grosskg: 'weight',
  amount: 'amount',
  value: 'amount',
  total: 'amount',
  unit: 'unit',
  uom: 'unit',
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

function makeKey(sku: string, carton: string): string {
  const s = sku.trim().toLowerCase()
  const c = carton.trim().toLowerCase()
  if (s && c) return `${s}::${c}`
  if (s) return `sku::${s}`
  if (c) return `ctn::${c}`
  return ''
}

export function parseCheckerTable(
  rows: string[][],
  source: 'expected' | 'actual',
): { rows: CheckerRow[]; errorCode?: string } {
  if (!rows.length) return { rows: [], errorCode: 'errCheckerEmpty' }
  const header = rows[0].map(normalizeHeader)
  const idx: Partial<Record<keyof typeof HEADER_MAP extends never ? string : string, number>> = {}
  header.forEach((h, i) => {
    const mapped = HEADER_MAP[h]
    if (mapped && idx[mapped] === undefined) idx[mapped] = i
  })
  if (idx.sku === undefined && idx.carton === undefined) {
    return { rows: [], errorCode: 'errCheckerHeader' }
  }

  const out: CheckerRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const sku = idx.sku !== undefined ? String(cells[idx.sku] ?? '').trim() : ''
    const carton = idx.carton !== undefined ? String(cells[idx.carton] ?? '').trim() : ''
    const key = makeKey(sku, carton)
    if (!key) continue
    out.push({
      key,
      sku,
      carton,
      qty: n(cells[idx.qty ?? -1]),
      weight: n(cells[idx.weight ?? -1]),
      amount: n(cells[idx.amount ?? -1]),
      unit: idx.unit !== undefined ? String(cells[idx.unit] ?? '').trim() : '',
      source,
      rawIndex: r,
    })
  }
  return { rows: out }
}

export async function loadCheckerFile(
  file: File,
  source: 'expected' | 'actual',
): Promise<{ rows: CheckerRow[]; errorCode?: string }> {
  const name = file.name.toLowerCase()
  let table: string[][]
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    table = await parseXlsx(file)
  } else {
    table = parseCsv(await file.text())
  }
  return parseCheckerTable(table, source)
}

function near(a: number, b: number, eps = 0.011): boolean {
  return Math.abs(a - b) < eps
}

export function matchCheckerRows(expected: CheckerRow[], actual: CheckerRow[]): DiffRow[] {
  const expGroups = new Map<string, CheckerRow[]>()
  const actGroups = new Map<string, CheckerRow[]>()
  for (const row of expected) {
    const list = expGroups.get(row.key) || []
    list.push(row)
    expGroups.set(row.key, list)
  }
  for (const row of actual) {
    const list = actGroups.get(row.key) || []
    list.push(row)
    actGroups.set(row.key, list)
  }

  const keys = new Set([...expGroups.keys(), ...actGroups.keys()])
  const diffs: DiffRow[] = []

  for (const key of keys) {
    const expList = expGroups.get(key) || []
    const actList = actGroups.get(key) || []
    const sample = expList[0] || actList[0]
    const base = {
      key,
      sku: sample.sku,
      carton: sample.carton,
    }

    if (expList.length > 1) {
      diffs.push({ ...base, kind: 'duplicate_expected', messageCode: 'diffDupExpected' })
    }
    if (actList.length > 1) {
      diffs.push({ ...base, kind: 'duplicate_actual', messageCode: 'diffDupActual' })
    }
    if (!actList.length) {
      diffs.push({
        ...base,
        kind: 'missing_actual',
        expectedQty: expList[0]?.qty,
        expectedWeight: expList[0]?.weight,
        expectedAmount: expList[0]?.amount,
        expectedUnit: expList[0]?.unit,
        messageCode: 'diffMissingActual',
      })
      continue
    }
    if (!expList.length) {
      diffs.push({
        ...base,
        kind: 'missing_expected',
        actualQty: actList[0]?.qty,
        actualWeight: actList[0]?.weight,
        actualAmount: actList[0]?.amount,
        actualUnit: actList[0]?.unit,
        messageCode: 'diffMissingExpected',
      })
      continue
    }

    const e = expList[0]
    const a = actList[0]
    let matched = true
    if (!near(e.qty, a.qty)) {
      matched = false
      diffs.push({
        ...base,
        kind: 'qty_mismatch',
        expectedQty: e.qty,
        actualQty: a.qty,
        messageCode: 'diffQty',
      })
    }
    if (!near(e.weight, a.weight)) {
      matched = false
      diffs.push({
        ...base,
        kind: 'weight_mismatch',
        expectedWeight: e.weight,
        actualWeight: a.weight,
        messageCode: 'diffWeight',
      })
    }
    if (!near(e.amount, a.amount)) {
      matched = false
      diffs.push({
        ...base,
        kind: 'amount_mismatch',
        expectedAmount: e.amount,
        actualAmount: a.amount,
        messageCode: 'diffAmount',
      })
    }
    if ((e.unit || a.unit) && e.unit.toLowerCase() !== a.unit.toLowerCase()) {
      matched = false
      diffs.push({
        ...base,
        kind: 'unit_mismatch',
        expectedUnit: e.unit,
        actualUnit: a.unit,
        messageCode: 'diffUnit',
      })
    }
    if (matched && expList.length === 1 && actList.length === 1) {
      diffs.push({
        ...base,
        kind: 'ok',
        expectedQty: e.qty,
        actualQty: a.qty,
        expectedWeight: e.weight,
        actualWeight: a.weight,
        expectedAmount: e.amount,
        actualAmount: a.amount,
        expectedUnit: e.unit,
        actualUnit: a.unit,
        messageCode: 'diffOk',
      })
    }
  }

  return diffs.sort((a, b) => a.key.localeCompare(b.key))
}

export function summarizeDiffs(diffs: DiffRow[]): { passed: number; failed: number; totalKeys: number } {
  const keys = new Set(diffs.map((d) => d.key))
  const failedKeys = new Set(diffs.filter((d) => d.kind !== 'ok').map((d) => d.key))
  return {
    passed: [...keys].filter((k) => !failedKeys.has(k)).length,
    failed: failedKeys.size,
    totalKeys: keys.size,
  }
}

export function exportDiffCsv(diffs: DiffRow[], labels: Record<string, string>): void {
  download(
    'document-diff.csv',
    csv([
      [labels.key, labels.sku, labels.carton, labels.kind, labels.expected, labels.actual, labels.message],
      ...diffs.map((d) => [
        d.key,
        d.sku,
        d.carton,
        d.kind,
        [d.expectedQty, d.expectedWeight, d.expectedAmount, d.expectedUnit].filter((x) => x !== undefined).join(' | '),
        [d.actualQty, d.actualWeight, d.actualAmount, d.actualUnit].filter((x) => x !== undefined).join(' | '),
        d.messageCode,
      ]),
    ]),
  )
}

export async function exportDiffXlsx(diffs: DiffRow[], labels: Record<string, string>): Promise<void> {
  await downloadXlsx('document-diff.xlsx', [
    {
      name: 'Diff',
      rows: [
        [labels.key, labels.sku, labels.carton, labels.kind, labels.expected, labels.actual, labels.message],
        ...diffs.map((d) => [
          d.key,
          d.sku,
          d.carton,
          d.kind,
          [d.expectedQty, d.expectedWeight, d.expectedAmount, d.expectedUnit].filter((x) => x !== undefined).join(' | '),
          [d.actualQty, d.actualWeight, d.actualAmount, d.actualUnit].filter((x) => x !== undefined).join(' | '),
          d.messageCode,
        ]),
      ],
    },
  ])
}
