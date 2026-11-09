import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { applyRounding, type RoundingRule } from '../cbm-calculator/useCbm'
import { csv, download } from '../../shared/export/csv'
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
  minCharge: number
  fixedFee: number
  percentSurcharge: number
  currency: string
  etaDays: number
  deltaFromCheapest: number
}

export type FreightComparisonResult = {
  options: FreightLineResult[]
  cheapestId: string | null
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function computeFreightLine(
  config: FreightRateConfig,
  chargeableKg: number,
  cbm: number,
  rounding: RoundingRule,
): Omit<FreightLineResult, 'deltaFromCheapest'> {
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
    currency: config.currency || 'USD',
    etaDays: n(config.etaDays),
  }
}

export function compareFreight(
  configs: FreightRateConfig[],
  chargeableKg: number,
  cbm: number,
  rounding: RoundingRule,
): FreightComparisonResult {
  const lines = configs.map((c) => computeFreightLine(c, chargeableKg, cbm, rounding))
  const sorted = [...lines].sort((a, b) => a.total - b.total)
  const cheapest = sorted[0]?.total ?? 0
  const cheapestId = sorted[0]?.id ?? null
  const options = sorted.map((line) => ({
    ...line,
    deltaFromCheapest: line.total - cheapest,
  }))
  return { options, cheapestId }
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
      rate: 95,
      minCharge: 120,
      fixedFee: 35,
      percentSurcharge: 0,
      currency: 'USD',
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
  },
  labelOf: (key: string) => string,
): void {
  const rows: (string | number)[][] = [
    [headers.note, meta.disclaimer],
    [headers.chargeable, meta.chargeableKg, headers.volume, meta.cbm, headers.rounding, meta.rounding],
    [
      headers.mode,
      headers.billable,
      headers.rate,
      headers.minCharge,
      headers.fixedFee,
      headers.surcharge,
      headers.total,
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
      Number(o.deltaFromCheapest.toFixed(2)),
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
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let y = 800

  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text, {
      x: 40,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.12, 0.2, 0.3),
    })
    y -= size + 8
  }

  draw(meta.title, 16, true)
  draw(meta.disclaimer, 9)
  draw(
    `Chargeable kg: ${meta.chargeableKg.toFixed(2)}  |  CBM: ${meta.cbm.toFixed(3)}  |  Rounding: ${meta.rounding}`,
    10,
  )
  y -= 6

  for (const o of result.options) {
    draw(
      `${labelOf(o.labelKey)}  ${o.currency} ${o.total.toFixed(2)}  (Δ ${o.deltaFromCheapest.toFixed(2)})  ETA ${o.etaDays}d`,
      11,
      o.id === result.cheapestId,
    )
    draw(
      `  billable=${o.billableQty.toFixed(3)} rate=${o.rate} min=${o.minCharge} fixed=${o.fixedFee} surcharge=${o.percentSurcharge}%`,
      9,
    )
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'freight-comparison.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
