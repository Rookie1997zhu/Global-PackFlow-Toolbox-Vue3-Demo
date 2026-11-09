import { describe, expect, it } from 'vitest'
import { GUIDES } from '../seo/guides'
import {
  TOOL_SEO,
  homeMeta,
  isLocale,
  slugFromToolId,
  toolIdFromSlug,
} from '../seo/toolRegistry'

describe('seo registry', () => {
  it('maps every tool id to a unique slug and back', () => {
    const slugs = new Set<string>()
    for (const tool of TOOL_SEO) {
      expect(slugFromToolId(tool.id)).toBe(tool.slug)
      expect(toolIdFromSlug(tool.slug)).toBe(tool.id)
      expect(slugs.has(tool.slug)).toBe(false)
      slugs.add(tool.slug)
      for (const loc of ['en', 'zh', 'ko'] as const) {
        expect(tool.title[loc].length).toBeGreaterThan(2)
        expect(tool.description[loc].length).toBeGreaterThan(2)
        expect(tool.body[loc].length).toBeGreaterThan(2)
      }
    }
    expect(TOOL_SEO).toHaveLength(13)
  })

  it('covers four Korea guides with localized content', () => {
    expect(GUIDES.map((g) => g.id)).toEqual([
      'container-from-excel',
      'invoice-pl-check',
      't11-pallet',
      'open-tool-from-link',
    ])
    for (const g of GUIDES) {
      expect(g.steps.ko.length).toBeGreaterThanOrEqual(3)
      expect(g.title.ko.length).toBeGreaterThan(2)
    }
  })

  it('provides home meta and locale guard', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('jp')).toBe(false)
    expect(homeMeta('ko').title).toMatch(/PackFlow/)
  })
})
