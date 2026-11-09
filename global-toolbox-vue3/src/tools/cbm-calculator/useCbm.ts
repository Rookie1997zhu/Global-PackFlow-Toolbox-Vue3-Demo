import type { Cargo } from '../../shared/types/cargo'
import { sanitizeNonNegative, validateCargoRow, type CargoFieldErrors } from '../../shared/validation'
import {
  lengthFromCm,
  lengthToCm,
  massFromKg,
  massToKg,
  type LengthUnit,
  type MassUnit,
} from '../../shared/units'
import { csv, download, normalizeHeader, parseCsv } from '../../shared/export/csv'

export type RoundingRule = 'none' | 'round' | 'ceil'

/** perPiece = each carton max(w,vol); perSku = line max then sum; shipment = ticket-level max. */
export type ChargeMode = 'perPiece' | 'perSku' | 'shipment'

export type CbmRowResult = {
  sku: string
  qty: number
  cbm: number
  grossKg: number
  volumetricKg: number
  chargeableKg: number
  errors: CargoFieldErrors
  valid: boolean
}

export type CbmTotals = {
  cbm: number
  grossKg: number
  volumetricKg: number
  chargeableKg: number
  chargeMode: ChargeMode
  rows: CbmRowResult[]
  hasErrors: boolean
}

export function applyRounding(value: number, rule: RoundingRule): number {
  if (!Number.isFinite(value)) return NaN
  if (rule === 'ceil') return Math.ceil(value)
  if (rule === 'round') return Math.round(value)
  return value
}

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

export function computeCbmTotals(
  cargo: Cargo[],
  divisor: number,
  rounding: RoundingRule,
  chargeMode: ChargeMode = 'shipment',
): CbmTotals {
  const safeDivisor = Math.max(1, n(divisor) || 6000)
  const mode: ChargeMode = chargeMode || 'shipment'

  const rows: CbmRowResult[] = cargo.map((c) => {
    const { valid, errors } = validateCargoRow(c)
    const qty = Math.max(0, n(c.qty))
    const unitVolRaw = (n(c.length) * n(c.width) * n(c.height)) / safeDivisor
    const unitGross = n(c.weight)
    const cbm = (n(c.length) * n(c.width) * n(c.height) * qty) / 1e6
    const grossKg = unitGross * qty
    const volumetricRaw = unitVolRaw * qty
    const volumetricKg = applyRounding(volumetricRaw, rounding)

    let chargeableKg: number
    if (mode === 'perPiece') {
      // Round per-piece billable then multiply by qty (carrier-style piece rating).
      const perPiece = applyRounding(Math.max(unitGross, unitVolRaw), rounding)
      chargeableKg = perPiece * qty
    } else if (mode === 'perSku') {
      chargeableKg = applyRounding(Math.max(grossKg, volumetricRaw), rounding)
    } else {
      // shipment: row shows line max for transparency; ticket total uses shipment rule below.
      chargeableKg = applyRounding(Math.max(grossKg, volumetricRaw), rounding)
    }

    return {
      sku: c.sku,
      qty,
      cbm,
      grossKg,
      volumetricKg,
      chargeableKg,
      errors,
      valid,
    }
  })

  const cbm = rows.reduce((s, r) => s + r.cbm, 0)
  const grossKg = rows.reduce((s, r) => s + r.grossKg, 0)
  const volumetricRaw = cargo.reduce(
    (s, c) => s + (n(c.length) * n(c.width) * n(c.height) * n(c.qty)) / safeDivisor,
    0,
  )
  const volumetricKg = applyRounding(volumetricRaw, rounding)

  let chargeableKg: number
  if (mode === 'perPiece' || mode === 'perSku') {
    chargeableKg = rows.reduce((s, r) => s + r.chargeableKg, 0)
  } else {
    chargeableKg = applyRounding(Math.max(grossKg, volumetricRaw), rounding)
  }

  return {
    cbm,
    grossKg,
    volumetricKg,
    chargeableKg,
    chargeMode: mode,
    rows,
    hasErrors: rows.some((r) => !r.valid),
  }
}

export type DisplayCargo = {
  sku: string
  length: number
  width: number
  height: number
  weight: number
  qty: number
  price: number
}

export function cargoToDisplay(c: Cargo, lengthUnit: LengthUnit, massUnit: MassUnit): DisplayCargo {
  return {
    sku: c.sku,
    length: lengthFromCm(c.length, lengthUnit),
    width: lengthFromCm(c.width, lengthUnit),
    height: lengthFromCm(c.height, lengthUnit),
    weight: massFromKg(c.weight, massUnit),
    qty: c.qty,
    price: c.price,
  }
}

export function displayToCargo(d: DisplayCargo, lengthUnit: LengthUnit, massUnit: MassUnit): Cargo {
  return {
    sku: d.sku,
    length: lengthToCm(d.length, lengthUnit),
    width: lengthToCm(d.width, lengthUnit),
    height: lengthToCm(d.height, lengthUnit),
    weight: massToKg(d.weight, massUnit),
    qty: d.qty,
    price: d.price,
  }
}

type HeaderMap = Record<string, number>

function mapHeaders(headerRow: string[]): HeaderMap {
  const map: HeaderMap = {}
  headerRow.forEach((h, i) => {
    map[normalizeHeader(h)] = i
  })
  return map
}

function pick(map: HeaderMap, row: string[], keys: string[]): string {
  for (const key of keys) {
    const idx = map[key]
    if (idx !== undefined) return row[idx] ?? ''
  }
  return ''
}

/** Import CSV into storage units (cm/kg). Optional lengthUnit/massUnit columns or tool defaults. */
export function importCargoCsv(
  text: string,
  defaultLengthUnit: LengthUnit,
  defaultMassUnit: MassUnit,
): { ok: true; rows: Cargo[] } | { ok: false; code: string } {
  const table = parseCsv(text)
  if (table.length < 2) return { ok: false, code: 'errCsvEmpty' }
  const map = mapHeaders(table[0])
  const hasExplicitLengthCm = map.lengthcm !== undefined
  const hasExplicitWeightKg = map.weightkg !== undefined

  const rows: Cargo[] = []
  for (let i = 1; i < table.length; i++) {
    const row = table[i]
    const sku = pick(map, row, ['sku', 'skuitem', 'name', 'item'])
    const lengthRaw = Number(pick(map, row, ['lengthcm', 'length', 'l']))
    const widthRaw = Number(pick(map, row, ['widthcm', 'width', 'w']))
    const heightRaw = Number(pick(map, row, ['heightcm', 'height', 'h']))
    const weightRaw = Number(pick(map, row, ['weightkg', 'weight', 'wt']))
    const qty = Number(pick(map, row, ['qty', 'quantity', 'pcs']))
    const price = Number(pick(map, row, ['unitpriceusd', 'unitprice', 'price']) || 0)
    const lengthUnitRaw = pick(map, row, ['lengthunit', 'dimunit']) as LengthUnit
    const massUnitRaw = pick(map, row, ['weightunit', 'massunit']) as MassUnit

    const resolvedLengthUnit = (['mm', 'cm', 'm', 'in'] as LengthUnit[]).includes(lengthUnitRaw)
      ? lengthUnitRaw
      : hasExplicitLengthCm
        ? 'cm'
        : defaultLengthUnit
    const resolvedMassUnit = (['kg', 'lb'] as MassUnit[]).includes(massUnitRaw)
      ? massUnitRaw
      : hasExplicitWeightKg
        ? 'kg'
        : defaultMassUnit

    rows.push(
      displayToCargo(
        {
          sku: sku || `SKU-${i}`,
          length: lengthRaw,
          width: widthRaw,
          height: heightRaw,
          weight: weightRaw,
          qty: Number.isFinite(qty) ? qty : 0,
          price: Number.isFinite(price) ? price : 0,
        },
        resolvedLengthUnit,
        resolvedMassUnit,
      ),
    )
  }
  if (!rows.length) return { ok: false, code: 'errCsvEmpty' }
  return { ok: true, rows }
}

export function exportCbmResultsCsv(
  totals: CbmTotals,
  divisor: number,
  rounding: RoundingRule,
  headers: {
    sku: string
    qty: string
    cbm: string
    gross: string
    volumetric: string
    chargeable: string
    divisor: string
    rounding: string
    total: string
    chargeMode?: string
  },
): void {
  const rows: (string | number)[][] = [
    [headers.divisor, divisor, headers.rounding, rounding, headers.chargeMode || 'mode', totals.chargeMode],
    [
      headers.sku,
      headers.qty,
      headers.cbm,
      headers.gross,
      headers.volumetric,
      headers.chargeable,
    ],
    ...totals.rows.map((r) => [
      r.sku,
      r.qty,
      Number(r.cbm.toFixed(6)),
      Number(r.grossKg.toFixed(4)),
      Number(r.volumetricKg.toFixed(4)),
      Number(r.chargeableKg.toFixed(4)),
    ]),
    [
      headers.total,
      '',
      Number(totals.cbm.toFixed(6)),
      Number(totals.grossKg.toFixed(4)),
      Number(totals.volumetricKg.toFixed(4)),
      Number(totals.chargeableKg.toFixed(4)),
    ],
  ]
  download('cbm-results.csv', csv(rows))
}
