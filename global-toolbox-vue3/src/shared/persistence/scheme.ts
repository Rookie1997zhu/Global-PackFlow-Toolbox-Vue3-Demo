import type { Cargo } from '../types/cargo'

export const SCHEME_VERSION = 1 as const

export type CargoScheme = {
  version: typeof SCHEME_VERSION
  id: string
  name: string
  updatedAt: string
  locale?: string
  cargo: Cargo[]
  meta?: Record<string, unknown>
  /** Present for cloud-backed schemes (optimistic lock). */
  rowVersion?: number
}

export function createSchemeId(): string {
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildScheme(input: {
  name: string
  cargo: Cargo[]
  locale?: string
  id?: string
  meta?: Record<string, unknown>
  rowVersion?: number
}): CargoScheme {
  return {
    version: SCHEME_VERSION,
    id: input.id || createSchemeId(),
    name: input.name.trim() || 'Untitled',
    updatedAt: new Date().toISOString(),
    locale: input.locale,
    cargo: input.cargo.map((c) => ({ ...c })),
    meta: input.meta,
    rowVersion: input.rowVersion,
  }
}

export function parseSchemeJson(raw: string): CargoScheme {
  const data = JSON.parse(raw) as CargoScheme
  if (!data || data.version !== SCHEME_VERSION || !Array.isArray(data.cargo)) {
    throw new Error('errSchemeInvalid')
  }
  if (!data.id || !data.name) throw new Error('errSchemeInvalid')
  return {
    version: SCHEME_VERSION,
    id: String(data.id),
    name: String(data.name),
    updatedAt: String(data.updatedAt || new Date().toISOString()),
    locale: data.locale,
    cargo: data.cargo.map((c) => ({
      sku: String(c.sku ?? ''),
      length: Number(c.length) || 0,
      width: Number(c.width) || 0,
      height: Number(c.height) || 0,
      weight: Number(c.weight) || 0,
      qty: Number(c.qty) || 0,
      price: Number(c.price) || 0,
    })),
    meta: data.meta,
  }
}

export function serializeScheme(scheme: CargoScheme): string {
  return JSON.stringify(scheme, null, 2)
}
