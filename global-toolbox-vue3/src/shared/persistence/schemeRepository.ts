import type { Cargo } from '../types/cargo'
import type { CargoScheme } from './scheme'
import {
  cloudDeleteScheme,
  cloudImportLocalScheme,
  cloudListSchemes,
  cloudSaveCargoAsScheme,
} from './cloudSchemeAdapter'
import * as local from './schemeStore'

export type SchemeMode = 'local' | 'cloud'

let mode: SchemeMode = 'local'

export function getSchemeMode(): SchemeMode {
  return mode
}

export function setSchemeMode(next: SchemeMode): void {
  mode = next
}

export async function listSchemes(): Promise<CargoScheme[]> {
  if (mode === 'cloud') return cloudListSchemes()
  return local.listSchemes()
}

export async function saveCargoAsScheme(input: {
  name: string
  cargo: Cargo[]
  locale?: string
  id?: string
  rowVersion?: number
}): Promise<CargoScheme> {
  if (mode === 'cloud') return cloudSaveCargoAsScheme(input)
  return local.saveCargoAsScheme(input)
}

export async function deleteScheme(id: string): Promise<void> {
  if (mode === 'cloud') return cloudDeleteScheme(id)
  return local.deleteScheme(id)
}

export async function importSchemeFile(file: File): Promise<CargoScheme> {
  // File import always parses locally first; persist via current mode.
  const scheme = await local.importSchemeFile(file)
  if (mode === 'cloud') {
    // Local importSchemeFile already wrote IndexedDB; also push to cloud as new/import.
    return cloudImportLocalScheme(scheme)
  }
  return scheme
}

export {
  exportSchemeFile,
  getAutoRestoreEnabled,
  setAutoRestoreEnabled,
  loadLatestScheme,
  getScheme,
} from './schemeStore'

export async function syncLocalSchemesToCloud(): Promise<{ uploaded: number }> {
  if (mode !== 'cloud') return { uploaded: 0 }
  const locals = await local.listSchemes()
  let uploaded = 0
  for (const scheme of locals) {
    await cloudImportLocalScheme(scheme)
    uploaded += 1
  }
  return { uploaded }
}

export async function loadLatestForMode(): Promise<CargoScheme | null> {
  if (mode === 'cloud') {
    const all = await cloudListSchemes()
    return all[0] || null
  }
  return local.loadLatestScheme()
}
