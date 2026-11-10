import { describe, expect, it } from 'vitest'
import { buildScheme, parseSchemeJson, serializeScheme } from '../shared/persistence/scheme'
import { mappedToCargo } from '../shared/import/mappedToCargo'
import { applyMapping, detectColumnMapping } from '../shared/import/sheetMapping'

describe('cargo scheme serialize', () => {
  it('round-trips scheme JSON', () => {
    const scheme = buildScheme({
      name: 'KR week',
      locale: 'ko',
      cargo: [{ sku: 'A', length: 40, width: 30, height: 20, weight: 5, qty: 10, price: 1 }],
    })
    const again = parseSchemeJson(serializeScheme(scheme))
    expect(again.version).toBe(1)
    expect(again.name).toBe('KR week')
    expect(again.cargo[0].sku).toBe('A')
    expect(again.cargo[0].qty).toBe(10)
  })

  it('rejects invalid scheme', () => {
    expect(() => parseSchemeJson('{"version":2,"cargo":[]}')).toThrow('errSchemeInvalid')
  })

  it('maps sheet rows into cargo for container import', () => {
    const table = [
      ['품명', '수량', '총중량', '가로', '세로', '높이'],
      ['SKU-A', '60', '7.5', '42', '32', '28'],
    ]
    const cargo = mappedToCargo(applyMapping(table, detectColumnMapping(table[0])))
    expect(cargo[0]).toMatchObject({ sku: 'SKU-A', qty: 60, length: 42, weight: 7.5 })
  })

  it('does not invent demo dimensions for incomplete sheet rows', () => {
    const table = [
      ['품명', '수량'],
      ['SKU-Y', '3'],
    ]
    const cargo = mappedToCargo(applyMapping(table, detectColumnMapping(table[0])))
    expect(cargo).toEqual([])
  })
})
