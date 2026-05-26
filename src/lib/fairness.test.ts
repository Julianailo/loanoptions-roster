import { describe, it, expect } from 'vitest'
import { generateRoster } from './fairness'
import { computeExclusions } from './exclusions'
import { SEED_BROKERS } from '../data/brokers'
import type { Broker } from '../types'

const baseExclusions = () => computeExclusions({
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  excludeMothersDay: true,
  excludeFathersDay: true,
  customExclusions: [],
})

const baseOpts = () => ({
  brokers: SEED_BROKERS,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  blackouts: [],
  minBrokersPerDay: 2,
  rampWindowMonths: 6,
  existingShifts: [],
  exclusions: baseExclusions(),
})

describe('generateRoster — coverage', () => {
  it('fills every non-excluded Sat/Sun with exactly 2 brokers', () => {
    const exclusions = baseExclusions()
    const { shifts, warnings } = generateRoster({ ...baseOpts(), exclusions })
    expect(warnings).toEqual([])

    const filledByDate = new Map<string, number>()
    for (const s of shifts) {
      if (exclusions.has(s.date)) continue
      if (s.brokerId) filledByDate.set(s.date, (filledByDate.get(s.date) ?? 0) + 1)
    }
    for (const [date, count] of filledByDate) {
      expect(count, `non-excluded date ${date}`).toBe(2)
    }
  })

  it('leaves excluded days unassigned', () => {
    const exclusions = baseExclusions()
    const { shifts } = generateRoster({ ...baseOpts(), exclusions })
    for (const s of shifts) {
      if (exclusions.has(s.date)) {
        expect(s.brokerId).toBeNull()
        expect(s.locked).toBe(true)
      }
    }
  })
})

describe('generateRoster — fairness', () => {
  it('keeps every regular-pool broker within ±2 of the average', () => {
    const exclusions = baseExclusions()
    const { counts } = generateRoster({ ...baseOpts(), exclusions })
    const values = [...counts.values()]
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    for (const v of values) {
      expect(Math.abs(v - avg)).toBeLessThanOrEqual(2)
    }
  })

  it('is deterministic — same inputs produce same output', () => {
    const exclusions = baseExclusions()
    const a = generateRoster({ ...baseOpts(), exclusions })
    const b = generateRoster({ ...baseOpts(), exclusions })
    expect(a.shifts).toEqual(b.shifts)
    expect([...a.counts.entries()]).toEqual([...b.counts.entries()])
  })
})

describe('generateRoster — opt-ins', () => {
  it('places Dylan on every non-excluded Saturday when opt-in Saturdays is on', () => {
    const brokers: Broker[] = SEED_BROKERS.map(b =>
      b.id === 'dylan-c' ? { ...b, optInSaturdays: true } : b
    )
    const exclusions = baseExclusions()
    const { shifts } = generateRoster({ ...baseOpts(), brokers, exclusions })

    const allSatDates = new Set(
      shifts
        .filter(s => s.dayType === 'SATURDAY' && !exclusions.has(s.date))
        .map(s => s.date)
    )
    const dylanSatDates = new Set(
      shifts
        .filter(s => s.dayType === 'SATURDAY' && s.brokerId === 'dylan-c')
        .map(s => s.date)
    )
    expect(dylanSatDates.size).toBe(allSatDates.size)
  })
})

describe('generateRoster — blackouts', () => {
  it('never assigns a broker on their blackout date', () => {
    const exclusions = baseExclusions()
    const blackoutDate = '2026-01-03' // first Saturday of 2026
    const { shifts } = generateRoster({
      ...baseOpts(),
      exclusions,
      blackouts: [{ id: 'bo1', brokerId: 'thomas-n', date: blackoutDate, reason: 'wedding' }],
    })
    const onDate = shifts.filter(s => s.date === blackoutDate)
    expect(onDate.some(s => s.brokerId === 'thomas-n')).toBe(false)
  })
})

describe('generateRoster — locked / manual override preservation', () => {
  it('keeps locked existing shifts unchanged', () => {
    const exclusions = baseExclusions()
    const lockedShift = {
      date: '2026-01-03',
      dayType: 'SATURDAY' as const,
      slotIndex: 0,
      brokerId: 'flynn-d',
      manualOverride: false,
      locked: true,
    }
    const { shifts } = generateRoster({
      ...baseOpts(),
      exclusions,
      existingShifts: [lockedShift],
    })
    const match = shifts.find(s => s.date === '2026-01-03' && s.slotIndex === 0)
    expect(match?.brokerId).toBe('flynn-d')
    expect(match?.locked).toBe(true)
  })

  it('keeps manualOverride existing shifts unchanged', () => {
    const exclusions = baseExclusions()
    const manualShift = {
      date: '2026-01-04',
      dayType: 'SUNDAY' as const,
      slotIndex: 1,
      brokerId: 'issy-i',
      manualOverride: true,
      locked: false,
    }
    const { shifts } = generateRoster({
      ...baseOpts(),
      exclusions,
      existingShifts: [manualShift],
    })
    const match = shifts.find(s => s.date === '2026-01-04' && s.slotIndex === 1)
    expect(match?.brokerId).toBe('issy-i')
    expect(match?.manualOverride).toBe(true)
  })
})

describe('generateRoster — new-broker ramp', () => {
  it('does not modify pre-lock shifts when a new broker is added later', () => {
    const exclusions = baseExclusions()

    // First pass: generate Jan–Apr without the new broker
    const phase1 = generateRoster({
      ...baseOpts(),
      startDate: '2026-01-01',
      endDate: '2026-04-30',
      exclusions: computeExclusions({
        startDate: '2026-01-01',
        endDate: '2026-04-30',
        excludeMothersDay: true,
        excludeFathersDay: true,
        customExclusions: [],
      }),
    })
    // Mark them locked
    const lockedPhase1 = phase1.shifts.map(s => ({ ...s, locked: true }))

    // Second pass: add a new broker on 1 May, regenerate full year
    const newBrokers: Broker[] = [
      ...SEED_BROKERS,
      {
        id: 'newbie-x',
        firstName: 'Newbie',
        lastName: 'X.',
        preference: 'NO_PREFERENCE',
        optInSaturdays: false,
        optInSundays: false,
        availableExtra: false,
        active: true,
        joinedAt: '2026-05-01',
      },
    ]
    const phase2 = generateRoster({
      ...baseOpts(),
      brokers: newBrokers,
      exclusions,
      existingShifts: lockedPhase1,
      lockBeforeDate: '2026-05-01',
    })

    // Jan–Apr assignments must be identical
    for (const s of lockedPhase1) {
      const after = phase2.shifts.find(x => x.date === s.date && x.slotIndex === s.slotIndex)
      expect(after?.brokerId, `unchanged @ ${s.date}#${s.slotIndex}`).toBe(s.brokerId)
    }
    // Newbie should appear sometime from May onward
    const newbieShifts = phase2.shifts.filter(s => s.brokerId === 'newbie-x')
    expect(newbieShifts.length).toBeGreaterThan(0)
    for (const s of newbieShifts) {
      expect(s.date >= '2026-05-01').toBe(true)
    }
  })
})
