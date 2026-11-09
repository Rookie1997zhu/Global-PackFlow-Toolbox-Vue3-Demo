import type { Config } from './packing'

export type PalletPresetId = 'T11' | 'T12' | 'custom'

export type PalletPreset = {
  id: PalletPresetId
  labelKey: string
  l: number
  w: number
  h: number
  maxHeight: number
  maxWeight: number
  palletKg: number
}

/** Korea-first defaults: T11 1100×1100, T12 1200×1000 (mm). */
export const PALLET_PRESETS: PalletPreset[] = [
  {
    id: 'T11',
    labelKey: 'palletPresetT11',
    l: 1100,
    w: 1100,
    h: 150,
    maxHeight: 1600,
    maxWeight: 1000,
    palletKg: 20,
  },
  {
    id: 'T12',
    labelKey: 'palletPresetT12',
    l: 1200,
    w: 1000,
    h: 150,
    maxHeight: 1600,
    maxWeight: 1000,
    palletKg: 20,
  },
  {
    id: 'custom',
    labelKey: 'palletPresetCustom',
    l: 1200,
    w: 1000,
    h: 150,
    maxHeight: 1600,
    maxWeight: 1000,
    palletKg: 20,
  },
]

export const DEFAULT_PALLET_PRESET: PalletPresetId = 'T11'

export function getPalletPreset(id: PalletPresetId): PalletPreset {
  return PALLET_PRESETS.find((p) => p.id === id) || PALLET_PRESETS[0]
}

export function configFromPreset(id: PalletPresetId, overrides?: Partial<Config>): Config {
  const p = getPalletPreset(id)
  return {
    l: overrides?.l ?? p.l,
    w: overrides?.w ?? p.w,
    h: overrides?.h ?? p.h,
    maxHeight: overrides?.maxHeight ?? p.maxHeight,
    maxWeight: overrides?.maxWeight ?? p.maxWeight,
    palletKg: overrides?.palletKg ?? p.palletKg,
  }
}
