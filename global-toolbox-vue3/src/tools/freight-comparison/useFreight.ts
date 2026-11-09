import { applyRounding, type RoundingRule } from '../cbm-calculator/useCbm'
import { csv, download } from '../../shared/export/csv'
import { createKoreanPdfWriter } from '../../shared/export/pdf'
import { sanitizeNonNegative } from '../../shared/validation'

export type FreightBasis = 'chargeableKg' | 'cbm'

export type FreightRateConfig = {
  id: string
  labelKey: string
  rate: number
  minCharge: number
  fixedFee: number
  percentSurcharge: number
  currency: string
  etaDays: number
  basis: FreightBasis
}

export type FreightFxOptions = {
  displayCurrency: string
  /** Units of displayCurrency per 1 unit of source currency. displayCurrency itself should be 1. */
  ratesToDisplay: Record<string, number>
  fxAsOf?: string
}

export type FreightLineResult = {
  id: string
  labelKey: string
  basis: FreightBasis
  billableQty: number
  rate: number
  baseAmount: number
  afterMin: number
  afterFixed: number
  total: number
  convertedTotal: number | null
  fxRate: number | null
  minCharge: number
  fixedFee: number
  percentSurcharge: number
  currency: string
  etaDays: number
  deltaFromCheapest: number | null
}

export type FreightComparisonResult = {
  options: FreightLineResult[]
  cheapestId: string | null
  comparable: boolean
  displayCurrency: string
  fxAsOf: string
  missingCurrencies: string[]
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

function normCurrency(code: string): string {
  return String(code || 'USD').trim().toUpperCase() || 'USD'
}

export function computeFreightLine(
  config: FreightRateConfig,
  chargeableKg: number,
  cbm: number,
  rounding: RoundingRule,
): Omit<FreightLineResult, 'deltaFromCheapest' | 'convertedTotal' | 'fxRate'> {
  const rawQty = config.basis === 'cbm' ? cbm : chargeableKg
  const billableQty = applyRounding(n(rawQty), rounding)
  const rate = n(config.rate)
  const baseAmount = billableQty * rate
  const afterMin = Math.max(baseAmount, n(config.minCharge))
  const afterFixed = afterMin + n(config.fixedFee)
  const total = afterFixed * (1 + n(config.percentSurcharge) / 100)

  return {
    id: config.id,
    labelKey: config.labelKey,
    basis: config.basis,
    billableQty,
    rate,
    baseAmount,
    afterMin,
    afterFixed,
    total,
    minCharge: n(config.minCharge),
    fixedFee: n(config.fixedFee),
    percentSurcharge: n(config.percentSurcharge),
    currency: normCurrency(config.currency),
    etaDays: n(config.etaDays),
  }
}

function resolveFxRate(
  currency: string,
  displayCurrency: string,
  ratesToDisplay: Record<string, number>,
): number | null {
  const from = normCurrency(currency)
  const to = normCurrency(displayCurrency)
  if (from === to) return 1
  const map: Record<string, number> = {}
  for (const [k, v] of Object.entries(ratesToDisplay || {})) {
    map[normCurrency(k)] = Number(v)
  }
  map[to] = 1
  const rate = map[from]
  if (!Number.isFinite(rate) || rate <= 0) return null
  return rate
}

/** Compare freight options. Mixed currencies without FX suppress cheapest ranking. */
export function compareFreight(
  configs: FreightRateConfig[],
  chargeableKg: number,
  cbm: number,
  rounding: RoundingRule,
  fx: FreightFxOptions = { displayCurrency: 'USD', ratesToDisplay: { USD: 1 } },
): FreightComparisonResult {
  const displayCurrency = normCurrency(fx.displayCurrency || 'USD')
  const fxAsOf = String(fx.fxAsOf || '').trim()
  const lines = configs.map((c) => computeFreightLine(c, chargeableKg, cbm, rounding))
  const missingCurrencies: string[] = []
  const enriched = lines.map((line) => {
    const fxRate = resolveFxRate(line.currency, displayCurrency, fx.ratesToDisplay)
    if (fxRate === null && !missingCurrencies.includes(line.currency)) {
      missingCurrencies.push(line.currency)
    }
    return {
      ...line,
      convertedTotal: fxRate === null ? null : line.total * fxRate,
      fxRate,
      deltaFromCheapest: null as number | null,
    }
  })

  const comparable = missingCurrencies.length === 0 && enriched.every((o) => o.convertedTotal !== null)
  if (!comparable) {
    return {
      options: enriched,
      cheapestId: null,
      comparable: false,
      displayCurrency,
      fxAsOf,
      missingCurrencies,
    }
  }

  const sorted = [...enriched].sort((a, b) => (a.convertedTotal ?? 0) - (b.convertedTotal ?? 0))
  const cheapest = sorted[0]?.convertedTotal ?? 0
  const cheapestId = sorted[0]?.id ?? null
  const options = sorted.map((line) => ({
    ...line,
    deltaFromCheapest: (line.convertedTotal ?? 0) - cheapest,
  }))
  return {
    options,
    cheapestId,
    comparable: true,
    displayCurrency,
    fxAsOf,
    missingCurrencies: [],
  }
}

export function defaultFreightConfigs(): FreightRateConfig[] {
  return [
    {
      id: 'express',
      labelKey: 'shipExpress',
      rate: 6.8,
      minCharge: 25,
      fixedFee: 0,
      percentSurcharge: 0,
      currency: 'USD',
      etaDays: 3,
      basis: 'chargeableKg',
    },
    {
      id: 'air',
      labelKey: 'shipAir',
      rate: 4.2,
      minCharge: 40,
      fixedFee: 0,
      percentSurcharge: 5,
      currency: 'USD',
      etaDays: 5,
      basis: 'chargeableKg',
    },
    {
      id: 'sea',
      labelKey: 'shipSeaLcl',
      rate: 85,
      minCharge: 110,
      fixedFee: 30,
      percentSurcharge: 0,
      currency: 'EUR',
      etaDays: 28,
      basis: 'cbm',
    },
  ]
}

export function exportFreightCsv(
  result: FreightComparisonResult,
  meta: { chargeableKg: number; cbm: number; rounding: RoundingRule; disclaimer: string },
  headers: {
    mode: string
    total: string
    converted: string
    delta: string
    currency: string
    eta: string
    rate: string
    billable: string
    minCharge: string
    fixedFee: string
    surcharge: string
    chargeable: string
    volume: string
    rounding: string
    note: string
    displayCurrency: string
  },
  labelOf: (key: string) => string,
): void {
  const rows: (string | number)[][] = [
    [headers.note, meta.disclaimer],
    [
      headers.chargeable,
      meta.chargeableKg,
      headers.volume,
      meta.cbm,
      headers.rounding,
      meta.rounding,
      headers.displayCurrency,
      result.displayCurrency,
    ],
    [
      headers.mode,
      headers.billable,
      headers.rate,
      headers.minCharge,
      headers.fixedFee,
      headers.surcharge,
      headers.total,
      headers.converted,
      headers.delta,
      headers.currency,
      headers.eta,
    ],
    ...result.options.map((o) => [
      labelOf(o.labelKey),
      Number(o.billableQty.toFixed(4)),
      o.rate,
      o.minCharge,
      o.fixedFee,
      o.percentSurcharge,
      Number(o.total.toFixed(2)),
      o.convertedTotal === null ? '' : Number(o.convertedTotal.toFixed(2)),
      o.deltaFromCheapest === null ? '' : Number(o.deltaFromCheapest.toFixed(2)),
      o.currency,
      o.etaDays,
    ]),
  ]
  download('freight-comparison.csv', csv(rows))
}

export async function exportFreightPdf(
  result: FreightComparisonResult,
  meta: { chargeableKg: number; cbm: number; rounding: RoundingRule; disclaimer: string; title: string },
  labelOf: (key: string) => string,
): Promise<void> {
  const writer = await createKoreanPdfWriter()
  writer.drawLine(meta.title, 16, true)
  writer.drawLine(meta.disclaimer, 9)
  writer.drawLine(
    `Chargeable kg: ${meta.chargeableKg.toFixed(2)}  |  CBM: ${meta.cbm.toFixed(3)}  |  Rounding: ${meta.rounding}`,
    10,
  )
  writer.drawLine(
    `Display: ${result.displayCurrency}${result.fxAsOf ? `  FX as of ${result.fxAsOf}` : ''}${
      result.comparable ? '' : '  |  cheapest ranking disabled (missing FX)'
    }`,
    9,
  )
  writer.drawLine('')

  for (const o of result.options) {
    const isCheapest = result.comparable && o.id === result.cheapestId
    const delta =
      o.deltaFromCheapest === null ? 'Δ n/a' : `Δ ${result.displayCurrency} ${o.deltaFromCheapest.toFixed(2)}`
    const converted =
      o.convertedTotal === null ? 'converted n/a' : `= ${result.displayCurrency} ${o.convertedTotal.toFixed(2)}`
    writer.drawLine(
      `${labelOf(o.labelKey)}  ${o.currency} ${o.total.toFixed(2)}  ${converted}  (${delta})  ETA ${o.etaDays}d${
        isCheapest ? '  ★' : ''
      }`,
      11,
      isCheapest,
    )
    writer.drawLine(
      `  billable=${o.billableQty.toFixed(3)} rate=${o.rate} min=${o.minCharge} fixed=${o.fixedFee} surcharge=${o.percentSurcharge}%`,
      9,
    )
  }

  await writer.finish('freight-comparison.pdf')
}
