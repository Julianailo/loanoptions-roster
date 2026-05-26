import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Blackout, Broker, ExcludedDate, RosterConfig, Shift } from '../types'
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../lib/storage'
import { computeExclusions } from '../lib/exclusions'
import { generateRoster } from '../lib/fairness'

export interface RosterActions {
  setConfig: (next: RosterConfig) => void
  resetToSeed: () => void

  addBroker: (b: Omit<Broker, 'id'>) => void
  updateBroker: (id: string, patch: Partial<Broker>) => void
  removeBroker: (id: string) => void

  addBlackout: (b: Omit<Blackout, 'id'>) => void
  removeBlackout: (id: string) => void

  addCustomExclusion: (e: ExcludedDate) => void
  removeCustomExclusion: (date: string) => void

  updateShift: (date: string, slotIndex: number, brokerId: string | null) => void
  toggleLock: (date: string, slotIndex: number) => void

  regenerate: (opts: { startDate: string; endDate: string; lockBeforeDate?: string }) => {
    warnings: string[]
  }

  updateSettings: (patch: Partial<RosterConfig['settings']>) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function useRoster(): {
  config: RosterConfig
  exclusionsForRange: (startDate: string, endDate: string) => Map<string, ExcludedDate>
  actions: RosterActions
} {
  const [config, setConfigState] = useState<RosterConfig>(() => loadConfig())

  useEffect(() => {
    saveConfig(config)
  }, [config])

  const setConfig = useCallback((next: RosterConfig) => setConfigState(next), [])

  const resetToSeed = useCallback(() => setConfigState({ ...DEFAULT_CONFIG, shifts: [] }), [])

  const addBroker = useCallback((b: Omit<Broker, 'id'>) => {
    setConfigState(prev => ({
      ...prev,
      brokers: [...prev.brokers, { ...b, id: uid() }],
    }))
  }, [])

  const updateBroker = useCallback((id: string, patch: Partial<Broker>) => {
    setConfigState(prev => ({
      ...prev,
      brokers: prev.brokers.map(b => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }, [])

  const removeBroker = useCallback((id: string) => {
    setConfigState(prev => ({
      ...prev,
      brokers: prev.brokers.filter(b => b.id !== id),
      blackouts: prev.blackouts.filter(bo => bo.brokerId !== id),
      shifts: prev.shifts.map(s => (s.brokerId === id ? { ...s, brokerId: null } : s)),
    }))
  }, [])

  const addBlackout = useCallback((b: Omit<Blackout, 'id'>) => {
    setConfigState(prev => ({
      ...prev,
      blackouts: [...prev.blackouts, { ...b, id: uid() }],
    }))
  }, [])

  const removeBlackout = useCallback((id: string) => {
    setConfigState(prev => ({
      ...prev,
      blackouts: prev.blackouts.filter(b => b.id !== id),
    }))
  }, [])

  const addCustomExclusion = useCallback((e: ExcludedDate) => {
    setConfigState(prev => ({
      ...prev,
      customExclusions: [...prev.customExclusions.filter(x => x.date !== e.date), e],
    }))
  }, [])

  const removeCustomExclusion = useCallback((date: string) => {
    setConfigState(prev => ({
      ...prev,
      customExclusions: prev.customExclusions.filter(x => x.date !== date),
    }))
  }, [])

  const updateShift = useCallback((date: string, slotIndex: number, brokerId: string | null) => {
    setConfigState(prev => {
      const idx = prev.shifts.findIndex(s => s.date === date && s.slotIndex === slotIndex)
      if (idx === -1) return prev
      const next = [...prev.shifts]
      next[idx] = { ...next[idx], brokerId, manualOverride: true }
      return { ...prev, shifts: next }
    })
  }, [])

  const toggleLock = useCallback((date: string, slotIndex: number) => {
    setConfigState(prev => {
      const idx = prev.shifts.findIndex(s => s.date === date && s.slotIndex === slotIndex)
      if (idx === -1) return prev
      const next = [...prev.shifts]
      next[idx] = { ...next[idx], locked: !next[idx].locked }
      return { ...prev, shifts: next }
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<RosterConfig['settings']>) => {
    setConfigState(prev => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  }, [])

  const exclusionsForRange = useCallback(
    (startDate: string, endDate: string) =>
      computeExclusions({
        startDate,
        endDate,
        excludeMothersDay: config.settings.excludeMothersDay,
        excludeFathersDay: config.settings.excludeFathersDay,
        customExclusions: config.customExclusions,
      }),
    [config.settings.excludeMothersDay, config.settings.excludeFathersDay, config.customExclusions]
  )

  const regenerate = useCallback(
    (opts: { startDate: string; endDate: string; lockBeforeDate?: string }) => {
      const exclusions = computeExclusions({
        startDate: opts.startDate,
        endDate: opts.endDate,
        excludeMothersDay: config.settings.excludeMothersDay,
        excludeFathersDay: config.settings.excludeFathersDay,
        customExclusions: config.customExclusions,
      })

      // Keep existing shifts outside the regeneration range untouched
      const outsideRange: Shift[] = config.shifts.filter(
        s => s.date < opts.startDate || s.date > opts.endDate
      )
      // Inside-range existing shifts feed into the generator (so locks/manual are preserved)
      const insideRange: Shift[] = config.shifts.filter(
        s => s.date >= opts.startDate && s.date <= opts.endDate
      )

      const { shifts, warnings } = generateRoster({
        brokers: config.brokers,
        startDate: opts.startDate,
        endDate: opts.endDate,
        exclusions,
        blackouts: config.blackouts,
        minBrokersPerDay: config.settings.minBrokersPerDay,
        rampWindowMonths: config.settings.rampWindowMonths,
        existingShifts: insideRange,
        lockBeforeDate: opts.lockBeforeDate,
      })

      setConfigState(prev => ({
        ...prev,
        shifts: [...outsideRange, ...shifts].sort((a, b) =>
          a.date === b.date ? a.slotIndex - b.slotIndex : a.date.localeCompare(b.date)
        ),
      }))

      return { warnings }
    },
    [config.brokers, config.blackouts, config.customExclusions, config.settings, config.shifts]
  )

  const actions: RosterActions = useMemo(
    () => ({
      setConfig,
      resetToSeed,
      addBroker,
      updateBroker,
      removeBroker,
      addBlackout,
      removeBlackout,
      addCustomExclusion,
      removeCustomExclusion,
      updateShift,
      toggleLock,
      regenerate,
      updateSettings,
    }),
    [
      setConfig,
      resetToSeed,
      addBroker,
      updateBroker,
      removeBroker,
      addBlackout,
      removeBlackout,
      addCustomExclusion,
      removeCustomExclusion,
      updateShift,
      toggleLock,
      regenerate,
      updateSettings,
    ]
  )

  return { config, exclusionsForRange, actions }
}
