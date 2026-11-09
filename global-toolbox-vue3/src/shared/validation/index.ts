import type { Cargo } from '../types/cargo'

export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; value: number; code: string }

const EXTREME_MAX = 1e9

export function sanitizeNonNegative(v: unknown): number {
  return Math.max(0, Number(v) || 0)
}

export function validateNumber(
  raw: unknown,
  opts: { allowZero?: boolean; allowEmptyAsZero?: boolean; max?: number } = {},
): ValidationResult {
  const allowZero = opts.allowZero !== false
  const max = opts.max ?? EXTREME_MAX

  if (raw === '' || raw === null || raw === undefined) {
    if (opts.allowEmptyAsZero) return { ok: true, value: 0 }
    return { ok: false, value: 0, code: 'errEmpty' }
  }

  const num = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(num)) return { ok: false, value: 0, code: 'errNotNumber' }
  if (num < 0) return { ok: false, value: num, code: 'errNegative' }
  if (!allowZero && num === 0) return { ok: false, value: 0, code: 'errZero' }
  if (Math.abs(num) > max) return { ok: false, value: num, code: 'errExtreme' }
  return { ok: true, value: num }
}

export type CargoFieldErrors = Partial<Record<keyof Cargo | 'row', string>>

export function validateCargoRow(row: Cargo): { valid: boolean; errors: CargoFieldErrors } {
  const errors: CargoFieldErrors = {}
  const sku = String(row.sku ?? '').trim()
  if (!sku) errors.sku = 'errSkuRequired'

  const length = validateNumber(row.length, { allowZero: false })
  if (!length.ok) errors.length = length.code

  const width = validateNumber(row.width, { allowZero: false })
  if (!width.ok) errors.width = width.code

  const height = validateNumber(row.height, { allowZero: false })
  if (!height.ok) errors.height = height.code

  const weight = validateNumber(row.weight, { allowZero: true })
  if (!weight.ok) errors.weight = weight.code

  const qty = validateNumber(row.qty, { allowZero: true })
  if (!qty.ok) errors.qty = qty.code

  const price = validateNumber(row.price, { allowZero: true })
  if (!price.ok) errors.price = price.code

  return { valid: Object.keys(errors).length === 0, errors }
}
