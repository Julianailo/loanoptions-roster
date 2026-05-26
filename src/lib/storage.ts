import type { RosterConfig } from '../types'
import { SEED_BROKERS } from '../data/brokers'

export const STORAGE_KEY = 'loanoptions-roster:v1'

export const DEFAULT_CONFIG: RosterConfig = {
  brokers: SEED_BROKERS,
  blackouts: [],
  customExclusions: [],
  shifts: [],
  settings: {
    minBrokersPerDay: 2,
    excludeMothersDay: true,
    excludeFathersDay: true,
    rampWindowMonths: 6,
    targetDeviation: 2,
  },
  meta: {
    version: 1,
    updatedAt: new Date().toISOString(),
  },
}

export function loadConfig(): RosterConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as RosterConfig
    // Light schema-check
    if (!parsed.brokers || !parsed.settings) return DEFAULT_CONFIG
    return parsed
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(cfg: RosterConfig) {
  if (typeof window === 'undefined') return
  try {
    cfg.meta = { ...cfg.meta, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function downloadJSON(cfg: RosterConfig, filename = 'loanoptions-roster.json') {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function readJSONFile(file: File): Promise<RosterConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!parsed.brokers || !parsed.settings) {
          reject(new Error('Invalid config: missing brokers or settings'))
          return
        }
        resolve(parsed)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
