import { createAndDownloadReport, type ReportCreateBody, type ReportDto } from '../../api/reports'
import { isLoggedIn } from '../auth/session'
import { saveCargoAsScheme } from '../persistence/schemeRepository'
import type { Cargo } from '../types/cargo'
import type { Locale } from '../../i18n'

export async function ensureSchemeId(opts: {
  name: string
  cargo: Cargo[]
  locale: Locale
}): Promise<string> {
  const saved = await saveCargoAsScheme({
    name: opts.name,
    cargo: opts.cargo,
    locale: opts.locale,
  })
  return saved.id
}

export async function cloudGenerateReport(
  body: ReportCreateBody,
): Promise<ReportDto> {
  if (!isLoggedIn.value) {
    throw new Error('cloudReportNeedLogin')
  }
  return createAndDownloadReport(body)
}
