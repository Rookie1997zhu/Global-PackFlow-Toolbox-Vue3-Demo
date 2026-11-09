export type LengthUnit = 'mm' | 'cm' | 'm' | 'in'
export type MassUnit = 'kg' | 'lb'
export type VolumeUnit = 'cm3' | 'L' | 'm3' | 'ft3'
export type QuantityKind = 'length' | 'mass' | 'volume'

/** Factors to SI base: length→m, mass→kg, volume→m³ */
export const unitDefs: Record<QuantityKind, Record<string, number>> = {
  length: { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 },
  mass: { g: 0.001, kg: 1, lb: 0.45359237 },
  volume: { cm3: 0.000001, L: 0.001, m3: 1, ft3: 0.028316846592 },
}

export const lengthUnits: LengthUnit[] = ['mm', 'cm', 'm', 'in']
export const massUnits: MassUnit[] = ['kg', 'lb']

export function convert(value: number, kind: QuantityKind, from: string, to: string): number {
  const table = unitDefs[kind]
  const fromFactor = table[from]
  const toFactor = table[to]
  if (!fromFactor || !toFactor || !Number.isFinite(value)) return NaN
  return (value * fromFactor) / toFactor
}

export function toBase(value: number, kind: QuantityKind, from: string): number {
  const factor = unitDefs[kind][from]
  if (!factor || !Number.isFinite(value)) return NaN
  return value * factor
}

export function fromBase(value: number, kind: QuantityKind, to: string): number {
  const factor = unitDefs[kind][to]
  if (!factor || !Number.isFinite(value)) return NaN
  return value / factor
}

/** Storage length unit is cm. */
export function lengthToCm(value: number, unit: LengthUnit): number {
  if (unit === 'cm') return value
  return convert(value, 'length', unit, 'cm')
}

export function lengthFromCm(value: number, unit: LengthUnit): number {
  if (unit === 'cm') return value
  return convert(value, 'length', 'cm', unit)
}

/** Storage mass unit is kg. */
export function massToKg(value: number, unit: MassUnit): number {
  if (unit === 'kg') return value
  return convert(value, 'mass', unit, 'kg')
}

export function massFromKg(value: number, unit: MassUnit): number {
  if (unit === 'kg') return value
  return convert(value, 'mass', 'kg', unit)
}
