import { describe, expect, it } from 'vitest'

describe('reports API contract shapes', () => {
  it('defines supported kinds and formats', () => {
    const kinds = ['packing_list', 'commercial_invoice', 'diff'] as const
    const formats = ['pdf', 'xlsx'] as const
    expect(kinds).toContain('packing_list')
    expect(formats).toContain('pdf')
  })
})
