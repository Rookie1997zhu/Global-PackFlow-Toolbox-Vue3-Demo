import type { Locale } from '../../i18n'

export function formatNumber(value: number, locale: Locale, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const tag = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : 'en-US'
  return value.toLocaleString(tag, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}
