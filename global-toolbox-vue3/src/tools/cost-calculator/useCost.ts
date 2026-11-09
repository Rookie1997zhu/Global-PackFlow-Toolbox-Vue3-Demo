import { csv, download } from '../../shared/export/csv'
import { downloadXlsx } from '../../shared/export/xlsx'
import { sanitizeNonNegative } from '../../shared/validation'

export type CostInputs = {
  materialPerUnit: number
  laborPerUnit: number
  wastePct: number
  storage: number
  transport: number
  taxPct: number
  markupPct: number
  currency: string
  qty: number
}

export type CostBreakdown = {
  material: number
  labor: number
  waste: number
  storage: number
  transport: number
  subtotalBeforeTax: number
  tax: number
  costTotal: number
  markedUpTotal: number
  costPerUnit: number
  markedUpPerUnit: number
  grossMarginPct: number
  currency: string
}

export type CostValidationIssue = {
  field: keyof CostInputs | 'general'
  code: string
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

function clampPct(v: unknown): number {
  const x = n(v)
  return Math.min(100, x)
}

export function validateCostInputs(input: CostInputs): CostValidationIssue[] {
  const issues: CostValidationIssue[] = []
  const pctFields: (keyof CostInputs)[] = ['wastePct', 'taxPct', 'markupPct']
  for (const field of pctFields) {
    const raw = Number(input[field])
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      issues.push({ field, code: 'errCostPctRange' })
    }
  }
  if (!String(input.currency ?? '').trim()) {
    issues.push({ field: 'currency', code: 'errCostCurrency' })
  }
  return issues
}

/** Compute packaging/logistics cost with waste, storage, tax and markup. */
export function computeCost(input: CostInputs): CostBreakdown {
  const qty = n(input.qty)
  const material = qty * n(input.materialPerUnit)
  const labor = qty * n(input.laborPerUnit)
  const waste = (material + labor) * (clampPct(input.wastePct) / 100)
  const storage = n(input.storage)
  const transport = n(input.transport)
  const subtotalBeforeTax = material + labor + waste + storage + transport
  const tax = subtotalBeforeTax * (clampPct(input.taxPct) / 100)
  const costTotal = subtotalBeforeTax + tax
  const markedUpTotal = costTotal * (1 + clampPct(input.markupPct) / 100)
  const costPerUnit = qty > 0 ? costTotal / qty : 0
  const markedUpPerUnit = qty > 0 ? markedUpTotal / qty : 0
  const grossMarginPct = markedUpTotal > 0 ? ((markedUpTotal - costTotal) / markedUpTotal) * 100 : 0
  return {
    material,
    labor,
    waste,
    storage,
    transport,
    subtotalBeforeTax,
    tax,
    costTotal,
    markedUpTotal,
    costPerUnit,
    markedUpPerUnit,
    grossMarginPct,
    currency: String(input.currency || 'USD').trim() || 'USD',
  }
}

export type CostScenario = { name: string; input: CostInputs; result: CostBreakdown }

export function compareScenarios(a: CostScenario, b: CostScenario): {
  deltaTotal: number
  deltaPerUnit: number
  cheaper: 'A' | 'B' | 'tie'
} {
  const deltaTotal = a.result.markedUpTotal - b.result.markedUpTotal
  const deltaPerUnit = a.result.markedUpPerUnit - b.result.markedUpPerUnit
  const cheaper =
    Math.abs(deltaTotal) < 0.005 ? 'tie' : deltaTotal < 0 ? 'A' : 'B'
  return { deltaTotal, deltaPerUnit, cheaper }
}

export function exportCostComparisonCsv(
  scenarios: CostScenario[],
  labels: Record<string, string>,
): void {
  const rows: (string | number)[][] = [
    [labels.scenario, labels.currency, labels.qty, labels.costTotal, labels.markedUp, labels.perUnit, labels.margin],
    ...scenarios.map((s) => [
      s.name,
      s.result.currency,
      s.input.qty,
      Number(s.result.costTotal.toFixed(2)),
      Number(s.result.markedUpTotal.toFixed(2)),
      Number(s.result.markedUpPerUnit.toFixed(4)),
      Number(s.result.grossMarginPct.toFixed(2)),
    ]),
  ]
  download('cost-comparison.csv', csv(rows))
}

export async function exportCostComparisonXlsx(scenarios: CostScenario[], labels: Record<string, string>): Promise<void> {
  const rows: (string | number)[][] = [
    [labels.scenario, labels.currency, labels.qty, labels.costTotal, labels.markedUp, labels.perUnit, labels.margin],
    ...scenarios.map((s) => [
      s.name,
      s.result.currency,
      s.input.qty,
      Number(s.result.costTotal.toFixed(2)),
      Number(s.result.markedUpTotal.toFixed(2)),
      Number(s.result.markedUpPerUnit.toFixed(4)),
      Number(s.result.grossMarginPct.toFixed(2)),
    ]),
  ]
  await downloadXlsx('cost-comparison.xlsx', [{ name: 'Comparison', rows }])
}

export function defaultCostInputs(qty: number, overrides: Partial<CostInputs> = {}): CostInputs {
  return {
    materialPerUnit: 1.1,
    laborPerUnit: 0.22,
    wastePct: 3,
    storage: 40,
    transport: 350,
    taxPct: 0,
    markupPct: 15,
    currency: 'USD',
    qty,
    ...overrides,
  }
}
