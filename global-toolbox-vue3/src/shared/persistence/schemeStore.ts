import { buildScheme, parseSchemeJson, serializeScheme, type CargoScheme } from './scheme'
import type { Cargo } from '../types/cargo'

const DB_NAME = 'packflow-demo'
const DB_VERSION = 1
const STORE = 'schemes'
const LAST_KEY = 'packflow.scheme.autoRestore'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('errSchemeDb'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('errSchemeDb'))
    tx.onabort = () => reject(tx.error || new Error('errSchemeDb'))
  })
}

export async function listSchemes(): Promise<CargoScheme[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = (req.result as CargoScheme[]) || []
      rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      resolve(rows)
    }
    req.onerror = () => reject(req.error || new Error('errSchemeDb'))
  })
}

export async function saveScheme(scheme: CargoScheme): Promise<CargoScheme> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(scheme)
  await txDone(tx)
  setLastSchemeId(scheme.id)
  return scheme
}

export async function getScheme(id: string): Promise<CargoScheme | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as CargoScheme) || null)
    req.onerror = () => reject(req.error || new Error('errSchemeDb'))
  })
}

export async function deleteScheme(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
  if (getLastSchemeId() === id) localStorage.removeItem(LAST_KEY)
}

export async function saveCargoAsScheme(input: {
  name: string
  cargo: Cargo[]
  locale?: string
  id?: string
}): Promise<CargoScheme> {
  return saveScheme(buildScheme(input))
}

export function exportSchemeFile(scheme: CargoScheme): void {
  const blob = new Blob([serializeScheme(scheme)], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${scheme.name || 'scheme'}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function importSchemeFile(file: File): Promise<CargoScheme> {
  const text = await file.text()
  const scheme = parseSchemeJson(text)
  return saveScheme(scheme)
}

export function getAutoRestoreEnabled(): boolean {
  const v = localStorage.getItem('packflow.scheme.autoRestoreEnabled')
  return v !== '0'
}

export function setAutoRestoreEnabled(on: boolean): void {
  localStorage.setItem('packflow.scheme.autoRestoreEnabled', on ? '1' : '0')
}

export function getLastSchemeId(): string | null {
  return localStorage.getItem(LAST_KEY)
}

export function setLastSchemeId(id: string): void {
  localStorage.setItem(LAST_KEY, id)
}

export async function loadLatestScheme(): Promise<CargoScheme | null> {
  if (!getAutoRestoreEnabled()) return null
  const last = getLastSchemeId()
  if (last) {
    const found = await getScheme(last)
    if (found) return found
  }
  const all = await listSchemes()
  return all[0] || null
}
