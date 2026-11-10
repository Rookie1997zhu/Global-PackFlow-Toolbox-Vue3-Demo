import { describe, expect, it, beforeEach } from 'vitest'
import {
  apiSchemeToCargoScheme,
  cargoSchemeToApiBody,
  mapRoundTripSample,
} from '../shared/persistence/cloudSchemeAdapter'
import {
  getSchemeMode,
  setSchemeMode,
} from '../shared/persistence/schemeRepository'
import type { ApiScheme } from '../api/schemes'

describe('cloud scheme adapter mapping', () => {
  it('maps API scheme to CargoScheme with rowVersion', () => {
    const api: ApiScheme = {
      version: 1,
      id: 'sch_abc',
      name: 'KR week',
      updatedAt: '2026-11-10T01:00:00.000Z',
      locale: 'ko',
      cargo: [{ sku: 'A', length: 42, width: 32, height: 28, weight: 7.5, qty: 120, price: 12.5 }],
      meta: { note: 'x' },
      rowVersion: 4,
    }
    const mapped = apiSchemeToCargoScheme(api)
    expect(mapped.id).toBe('sch_abc')
    expect(mapped.rowVersion).toBe(4)
    expect(mapped.cargo[0].length).toBe(42)
    const body = cargoSchemeToApiBody(mapped)
    expect(body.rowVersion).toBe(4)
    expect(body.cargo[0].sku).toBe('A')
  })

  it('round-trips sample via buildScheme helpers', () => {
    const sample = mapRoundTripSample()
    expect(sample.id).toBe('sch_test')
    expect(sample.rowVersion).toBe(3)
    expect(sample.cargo).toHaveLength(1)
  })
})

describe('scheme repository mode', () => {
  beforeEach(() => {
    setSchemeMode('local')
  })

  it('defaults to local and can switch to cloud', () => {
    expect(getSchemeMode()).toBe('local')
    setSchemeMode('cloud')
    expect(getSchemeMode()).toBe('cloud')
    setSchemeMode('local')
    expect(getSchemeMode()).toBe('local')
  })
})
