import type { Locale } from '../i18n'
import { homeMeta, TOOL_BY_SLUG, type ToolSeoEntry } from './toolRegistry'
import { GUIDE_BY_ID, type GuideId } from './guides'

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  let el = document.head.querySelector<HTMLLinkElement>(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    if (hreflang) el.setAttribute('hreflang', hreflang)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function absolutePath(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const clean = path.replace(/^\//, '')
  return `${window.location.origin}${base}${clean}`
}

export function applyHomeMeta(locale: Locale) {
  const meta = homeMeta(locale)
  document.title = meta.title
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale
  upsertMeta('description', meta.description)
  const path = `${locale}/`
  upsertLink('canonical', absolutePath(path))
  for (const loc of ['en', 'zh', 'ko'] as Locale[]) {
    upsertLink('alternate', absolutePath(`${loc}/`), loc === 'zh' ? 'zh-CN' : loc)
  }
}

export function applyToolMeta(locale: Locale, entry: ToolSeoEntry) {
  document.title = `${entry.title[locale]} | PackFlow`
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale
  upsertMeta('description', entry.description[locale])
  const path = `${locale}/tools/${entry.slug}/`
  upsertLink('canonical', absolutePath(path))
  for (const loc of ['en', 'zh', 'ko'] as Locale[]) {
    upsertLink('alternate', absolutePath(`${loc}/tools/${entry.slug}/`), loc === 'zh' ? 'zh-CN' : loc)
  }
}

export function applyGuideMeta(locale: Locale, guideId: GuideId) {
  const g = GUIDE_BY_ID[guideId]
  document.title = `${g.title[locale]} | PackFlow`
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale
  upsertMeta('description', g.summary[locale])
  const path = `${locale}/guides/${guideId}/`
  upsertLink('canonical', absolutePath(path))
  for (const loc of ['en', 'zh', 'ko'] as Locale[]) {
    upsertLink('alternate', absolutePath(`${loc}/guides/${guideId}/`), loc === 'zh' ? 'zh-CN' : loc)
  }
}

export function resolveToolEntry(slug: string): ToolSeoEntry | null {
  return TOOL_BY_SLUG[slug] || null
}
