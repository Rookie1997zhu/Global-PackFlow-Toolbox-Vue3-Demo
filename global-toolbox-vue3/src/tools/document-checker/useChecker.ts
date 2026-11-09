import { csv, download, parseCsv } from '../../shared/export/csv'
import { createKoreanPdfWriter } from '../../shared/export/pdf'
import { downloadXlsx } from '../../shared/export/xlsx'
import {
  applyMapping,
  detectColumnMapping,
  type ColumnMapping,
  type MappedRow,
} from '../../shared/import/sheetMapping'
import { sanitizeNonNegative } from '../../shared/validation'

export type MatchKeyMode = 'sku+carton' | 'sku' | 'carton' | 'po+sku'

export type CheckerRow = {
  key: string
  sku: string
  carton: string
  po: string
  qty: number
  weight: number
  netKg: number
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
  | 'net_mismatch'
  | 'amount_mismatch'
  | 'unit_mismatch'

export type DiffRow = {
  key: string
  sku: string
  carton: string
  po: string
  kind: DiffKind
  expectedQty?: number
  actualQty?: number
  expectedWeight?: number
  actualWeight?: number
  expectedNetKg?: number
  actualNetKg?: number
  expectedAmount?: number
  actualAmount?: number
  expectedUnit?: string
  actualUnit?: string
  expectedRow?: number
  actualRow?: number
  messageCode: string
  fixHint: string
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function makeMatchKey(row: Pick<CheckerRow, 'sku' | 'carton' | 'po'>, mode: MatchKeyMode): string {
  const s = row.sku.trim().toLowerCase()
  const c = row.carton.trim().toLowerCase()
  const p = row.po.trim().toLowerCase()
  if (mode === 'sku') return s ? `sku::${s}` : ''
  if (mode === 'carton') return c ? `ctn::${c}` : ''
  if (mode === 'po+sku') {
    if (p && s) return `${p}::${s}`
    if (s) return `sku::${s}`
    return ''
  }
  // sku+carton
  if (s && c) return `${s}::${c}`
  if (s) return `sku::${s}`
  if (c) return `ctn::${c}`
  return ''
}

export function mappedToCheckerRows(
  mapped: MappedRow[],
  source: 'expected' | 'actual',
  mode: MatchKeyMode,
): CheckerRow[] {
  const out: CheckerRow[] = []
  for (const row of mapped) {
    const base = {
      sku: row.sku,
      carton: row.carton,
      po: row.po,
      qty: row.qty || row.boxCount,
      weight: row.grossKg,
      netKg: row.netKg,
      amount: row.amount || (row.unitPrice > 0 && row.qty > 0 ? row.unitPrice * row.qty : 0),
      unit: row.unit,
      source,
      rawIndex: row.rawIndex,
    }
    const key = makeMatchKey(base, mode)
    if (!key) continue
    out.push({ ...base, key })
  }
  return out
}

/** Backward-compatible auto parse (detect mapping, no UI). */
export function parseCheckerTable(
  rows: string[][],
  source: 'expected' | 'actual',
  mode: MatchKeyMode = 'sku+carton',
): { rows: CheckerRow[]; errorCode?: string; mapping?: ColumnMapping } {
  if (!rows.length) return { rows: [], errorCode: 'errCheckerEmpty' }
  const mapping = detectColumnMapping(rows[0] || [])
  if (mapping.sku === undefined && mapping.carton === undefined) {
    return { rows: [], errorCode: 'errCheckerHeader', mapping }
  }
  const mapped = applyMapping(rows, mapping)
  return { rows: mappedToCheckerRows(mapped, source, mode), mapping }
}

export async function loadCheckerFile(
  file: File,
  source: 'expected' | 'actual',
  mode: MatchKeyMode = 'sku+carton',
): Promise<{ rows: CheckerRow[]; errorCode?: string }> {
  const { loadSheetFile } = await import('../../shared/import/sheetMapping')
  const loaded = await loadSheetFile(file)
  if (loaded.errorCode) return { rows: [], errorCode: loaded.errorCode }
  return parseCheckerTable(loaded.rows, source, mode)
}

function near(a: number, b: number, eps = 0.011): boolean {
  return Math.abs(a - b) < eps
}

function hint(
  kind: DiffKind,
  e?: CheckerRow,
  a?: CheckerRow,
): string {
  const er = e ? e.rawIndex : '-'
  const ar = a ? a.rawIndex : '-'
  switch (kind) {
    case 'missing_actual':
      return `Expected row ${er} missing in actual`
    case 'missing_expected':
      return `Actual row ${ar} missing in expected`
    case 'duplicate_expected':
      return `Duplicate key in expected (row ${er})`
    case 'duplicate_actual':
      return `Duplicate key in actual (row ${ar})`
    case 'qty_mismatch':
      return `Expected row ${er} qty ${e?.qty} ≠ actual row ${ar} qty ${a?.qty}`
    case 'weight_mismatch':
      return `Expected row ${er} gross ${e?.weight} ≠ actual row ${ar} gross ${a?.weight}`
    case 'net_mismatch':
      return `Expected row ${er} net ${e?.netKg} ≠ actual row ${ar} net ${a?.netKg}`
    case 'amount_mismatch':
      return `Expected row ${er} amount ${e?.amount} ≠ actual row ${ar} amount ${a?.amount}`
    case 'unit_mismatch':
      return `Expected row ${er} unit ${e?.unit || '-'} ≠ actual row ${ar} unit ${a?.unit || '-'}`
    default:
      return `Matched rows ${er} / ${ar}`
  }
}

export function matchCheckerRows(
  expected: CheckerRow[],
  actual: CheckerRow[],
  mode: MatchKeyMode = 'sku+carton',
): DiffRow[] {
  const rekey = (rows: CheckerRow[]) =>
    rows.map((r) => ({ ...r, key: makeMatchKey(r, mode) })).filter((r) => r.key)

  const expGroups = new Map<string, CheckerRow[]>()
  const actGroups = new Map<string, CheckerRow[]>()
  for (const row of rekey(expected)) {
    const list = expGroups.get(row.key) || []
    list.push(row)
    expGroups.set(row.key, list)
  }
  for (const row of rekey(actual)) {
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
      po: sample.po,
    }

    if (expList.length > 1) {
      diffs.push({
        ...base,
        kind: 'duplicate_expected',
        expectedRow: expList[0].rawIndex,
        messageCode: 'diffDupExpected',
        fixHint: hint('duplicate_expected', expList[0]),
      })
    }
    if (actList.length > 1) {
      diffs.push({
        ...base,
        kind: 'duplicate_actual',
        actualRow: actList[0].rawIndex,
        messageCode: 'diffDupActual',
        fixHint: hint('duplicate_actual', undefined, actList[0]),
      })
    }
    if (!actList.length) {
      const e = expList[0]
      diffs.push({
        ...base,
        kind: 'missing_actual',
        expectedQty: e?.qty,
        expectedWeight: e?.weight,
        expectedNetKg: e?.netKg,
        expectedAmount: e?.amount,
        expectedUnit: e?.unit,
        expectedRow: e?.rawIndex,
        messageCode: 'diffMissingActual',
        fixHint: hint('missing_actual', e),
      })
      continue
    }
    if (!expList.length) {
      const a = actList[0]
      diffs.push({
        ...base,
        kind: 'missing_expected',
        actualQty: a?.qty,
        actualWeight: a?.weight,
        actualNetKg: a?.netKg,
        actualAmount: a?.amount,
        actualUnit: a?.unit,
        actualRow: a?.rawIndex,
        messageCode: 'diffMissingExpected',
        fixHint: hint('missing_expected', undefined, a),
      })
      continue
    }

    const e = expList[0]
    const a = actList[0]
    let matched = true
    const pushMismatch = (kind: DiffKind, messageCode: string, extra: Partial<DiffRow>) => {
      matched = false
      diffs.push({
        ...base,
        kind,
        expectedRow: e.rawIndex,
        actualRow: a.rawIndex,
        messageCode,
        fixHint: hint(kind, e, a),
        ...extra,
      })
    }

    if (!near(e.qty, a.qty)) {
      pushMismatch('qty_mismatch', 'diffQty', { expectedQty: e.qty, actualQty: a.qty })
    }
    if (!near(e.weight, a.weight)) {
      pushMismatch('weight_mismatch', 'diffWeight', { expectedWeight: e.weight, actualWeight: a.weight })
    }
    if ((e.netKg > 0 || a.netKg > 0) && !near(e.netKg, a.netKg)) {
      pushMismatch('net_mismatch', 'diffNet', { expectedNetKg: e.netKg, actualNetKg: a.netKg })
    }
    if (!near(e.amount, a.amount)) {
      pushMismatch('amount_mismatch', 'diffAmount', { expectedAmount: e.amount, actualAmount: a.amount })
    }
    if ((e.unit || a.unit) && e.unit.toLowerCase() !== a.unit.toLowerCase()) {
      pushMismatch('unit_mismatch', 'diffUnit', { expectedUnit: e.unit, actualUnit: a.unit })
    }
    if (matched && expList.length === 1 && actList.length === 1) {
      diffs.push({
        ...base,
        kind: 'ok',
        expectedQty: e.qty,
        actualQty: a.qty,
        expectedWeight: e.weight,
        actualWeight: a.weight,
        expectedNetKg: e.netKg,
        actualNetKg: a.netKg,
        expectedAmount: e.amount,
        actualAmount: a.amount,
        expectedUnit: e.unit,
        actualUnit: a.unit,
        expectedRow: e.rawIndex,
        actualRow: a.rawIndex,
        messageCode: 'diffOk',
        fixHint: hint('ok', e, a),
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
      [
        labels.key,
        labels.sku,
        labels.carton,
        labels.po || 'PO',
        labels.kind,
        labels.expected,
        labels.actual,
        labels.message,
        labels.fixHint || 'Fix hint',
        labels.expectedRow || 'Expected row',
        labels.actualRow || 'Actual row',
      ],
      ...diffs.map((d) => [
        d.key,
        d.sku,
        d.carton,
        d.po,
        d.kind,
        [d.expectedQty, d.expectedWeight, d.expectedNetKg, d.expectedAmount, d.expectedUnit]
          .filter((x) => x !== undefined && x !== '')
          .join(' | '),
        [d.actualQty, d.actualWeight, d.actualNetKg, d.actualAmount, d.actualUnit]
          .filter((x) => x !== undefined && x !== '')
          .join(' | '),
        d.messageCode,
        d.fixHint,
        d.expectedRow ?? '',
        d.actualRow ?? '',
      ]),
    ]),
  )
}

export async function exportDiffXlsx(diffs: DiffRow[], labels: Record<string, string>): Promise<void> {
  await downloadXlsx('document-diff.xlsx', [
    {
      name: 'Diff',
      rows: [
        [
          labels.key,
          labels.sku,
          labels.carton,
          labels.po || 'PO',
          labels.kind,
          labels.expected,
          labels.actual,
          labels.message,
          labels.fixHint || 'Fix hint',
          labels.expectedRow || 'Expected row',
          labels.actualRow || 'Actual row',
        ],
        ...diffs.map((d) => [
          d.key,
          d.sku,
          d.carton,
          d.po,
          d.kind,
          [d.expectedQty, d.expectedWeight, d.expectedNetKg, d.expectedAmount, d.expectedUnit]
            .filter((x) => x !== undefined && x !== '')
            .join(' | '),
          [d.actualQty, d.actualWeight, d.actualNetKg, d.actualAmount, d.actualUnit]
            .filter((x) => x !== undefined && x !== '')
            .join(' | '),
          d.messageCode,
          d.fixHint,
          d.expectedRow ?? '',
          d.actualRow ?? '',
        ]),
      ],
    },
  ])
}

export async function exportDiffPdf(diffs: DiffRow[], title: string): Promise<void> {
  const writer = await createKoreanPdfWriter()
  writer.drawLine(title, 16, true)
  writer.drawLine(`Differences: ${diffs.length}`)
  writer.drawLine('')
  for (const d of diffs) {
    writer.drawLine(`[${d.kind}] ${d.sku || d.carton || d.key}`)
    writer.drawLine(`  ${d.fixHint}`, 9)
  }
  await writer.finish('document-diff.pdf')
}

export async function loadSampleCsv(url: string): Promise<string[][]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load sample ${url}`)
  return parseCsv(await res.text())
}
