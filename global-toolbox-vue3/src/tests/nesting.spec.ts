import { describe, expect, it } from 'vitest'
import {
  createSampleParts,
  placementInsideSheet,
  placementsOverlap,
  runNesting,
  type NestingInput,
} from '../tools/sheet-nesting/useNesting'

function baseInput(strategy: 'maxrects' | 'guillotine'): NestingInput {
  return {
    sheetWidth: 1200,
    sheetHeight: 900,
    margin: 10,
    kerf: 5,
    strategy,
    parts: createSampleParts(),
  }
}

function assertValid(result: Exclude<ReturnType<typeof runNesting>, { error: string }>) {
  for (let i = 0; i < result.placements.length; i++) {
    const a = result.placements[i]
    expect(placementInsideSheet(a, result.sheetWidth, result.sheetHeight, result.margin)).toBe(true)
    for (let j = i + 1; j < result.placements.length; j++) {
      expect(placementsOverlap(a, result.placements[j])).toBe(false)
    }
  }
}

describe('sheet nesting', () => {
  it('maxrects packs sample parts without overlap or overflow', () => {
    const result = runNesting(baseInput('maxrects'))
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.placements.length).toBeGreaterThan(0)
    expect(result.sheetCount).toBeGreaterThan(0)
    assertValid(result)
    const required = result.partSummaries.reduce((s, p) => s + p.required, 0)
    expect(result.placements.length + result.unplaced.length).toBe(required)
  })

  it('guillotine packs sample parts without overlap or overflow', () => {
    const result = runNesting(baseInput('guillotine'))
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.placements.length).toBeGreaterThan(0)
    assertValid(result)
  })

  it('is deterministic for identical inputs', () => {
    const a = runNesting(baseInput('maxrects'))
    const b = runNesting(baseInput('maxrects'))
    expect(a).toEqual(b)
    const c = runNesting(baseInput('guillotine'))
    const d = runNesting(baseInput('guillotine'))
    expect(c).toEqual(d)
  })

  it('marks oversized parts as unplaced', () => {
    const result = runNesting({
      sheetWidth: 500,
      sheetHeight: 400,
      margin: 10,
      kerf: 5,
      strategy: 'maxrects',
      parts: [{ id: 'huge', name: 'Huge', width: 2000, height: 1000, qty: 1, allowRotate: true }],
    })
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.placements.length).toBe(0)
    expect(result.unplaced.length).toBe(1)
    expect(result.unplaced[0].reason).toBe('errNestingPartTooLarge')
  })
})
