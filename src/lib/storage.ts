import type { FunnelConfig, Preset } from './types'

const DB_NAME = 'pipeline-flux'
const DB_VERSION = 1
const STORE_CONFIG = 'config'
const STORE_PRESETS = 'presets'
const CONFIG_KEY = 'active'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_CONFIG)) db.createObjectStore(STORE_CONFIG)
      if (!db.objectStoreNames.contains(STORE_PRESETS)) db.createObjectStore(STORE_PRESETS, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const t = db.transaction(store, mode)
          const req = run(t.objectStore(store))
          req.onsuccess = () => resolve(req.result as T)
          req.onerror = () => resolve(null)
          t.onabort = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export function loadConfig(): Promise<FunnelConfig | null> {
  return tx<FunnelConfig>(STORE_CONFIG, 'readonly', (s) => s.get(CONFIG_KEY))
}

export function saveConfig(config: FunnelConfig): Promise<unknown> {
  return tx(STORE_CONFIG, 'readwrite', (s) => s.put(config, CONFIG_KEY))
}

export function loadPresets(): Promise<Preset[]> {
  return tx<Preset[]>(STORE_PRESETS, 'readonly', (s) => s.getAll()).then((r) => r ?? [])
}

export function savePreset(preset: Preset): Promise<unknown> {
  return tx(STORE_PRESETS, 'readwrite', (s) => s.put(preset))
}

export function deletePreset(id: string): Promise<unknown> {
  return tx(STORE_PRESETS, 'readwrite', (s) => s.delete(id))
}
