import {
  createSchemeApi,
  deleteSchemeApi,
  importDemoSchemeApi,
  listSchemesApi,
  updateSchemeApi,
  type ApiScheme,
} from '../../api/schemes'
import { buildScheme, type CargoScheme } from './scheme'
import type { Cargo } from '../types/cargo'

export function apiSchemeToCargoScheme(api: ApiScheme): CargoScheme {
  return {
    version: 1,
    id: api.id,
    name: api.name,
    updatedAt: api.updatedAt,
    locale: api.locale || undefined,
    cargo: (api.cargo || []).map((c) => ({ ...c })),
    meta: api.meta || {},
    rowVersion: api.rowVersion,
  }
}

export function cargoSchemeToApiBody(scheme: CargoScheme): {
  version: number
  name: string
  locale?: string
  cargo: Cargo[]
  meta: Record<string, unknown>
  rowVersion?: number
  id?: string
} {
  return {
    version: 1,
    name: scheme.name,
    locale: scheme.locale,
    cargo: scheme.cargo.map((c) => ({ ...c })),
    meta: scheme.meta || {},
    rowVersion: scheme.rowVersion,
    id: scheme.id,
  }
}

export async function cloudListSchemes(teamId?: string): Promise<CargoScheme[]> {
  const page = await listSchemesApi(teamId)
  return page.items.map(apiSchemeToCargoScheme)
}

export async function cloudSaveCargoAsScheme(input: {
  name: string
  cargo: Cargo[]
  locale?: string
  id?: string
  rowVersion?: number
  meta?: Record<string, unknown>
}): Promise<CargoScheme> {
  if (input.id && input.rowVersion != null) {
    const updated = await updateSchemeApi(input.id, {
      version: 1,
      name: input.name,
      locale: input.locale,
      cargo: input.cargo,
      meta: input.meta || {},
      rowVersion: input.rowVersion,
    })
    return apiSchemeToCargoScheme(updated)
  }
  const created = await createSchemeApi({
    version: 1,
    name: input.name,
    locale: input.locale,
    cargo: input.cargo,
    meta: input.meta || {},
  })
  return apiSchemeToCargoScheme(created)
}

export async function cloudDeleteScheme(id: string): Promise<void> {
  await deleteSchemeApi(id)
}

export async function cloudImportLocalScheme(scheme: CargoScheme): Promise<CargoScheme> {
  const body = cargoSchemeToApiBody(scheme)
  const imported = await importDemoSchemeApi({
    version: 1,
    id: body.id,
    name: body.name,
    locale: body.locale,
    cargo: body.cargo,
    meta: body.meta,
  })
  return apiSchemeToCargoScheme(imported)
}

/** Pure helper for tests / local preview of mapping. */
export function mapRoundTripSample(): CargoScheme {
  const sample: ApiScheme = {
    version: 1,
    id: 'sch_test',
    name: 'Sample',
    updatedAt: '2026-11-10T00:00:00.000Z',
    locale: 'ko',
    cargo: [{ sku: 'A', length: 42, width: 32, height: 28, weight: 7.5, qty: 120, price: 12.5 }],
    meta: {},
    rowVersion: 3,
  }
  const mapped = apiSchemeToCargoScheme(sample)
  return buildScheme({
    name: mapped.name,
    cargo: mapped.cargo,
    locale: mapped.locale,
    id: mapped.id,
    meta: mapped.meta,
    rowVersion: mapped.rowVersion,
  })
}
