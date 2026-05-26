import { describe, it, expect } from 'vitest'
import {
  computeExclusions,
  mothersDay,
  fathersDay,
  nswWeekendHolidays,
} from './exclusions'

describe('cultural exclusions', () => {
  it("Mother's Day is the 2nd Sunday of May", () => {
    // 2026: first Sunday of May = 3 May, second = 10 May
    expect(mothersDay(2026).date).toBe('2026-05-10')
    // 2027: first Sun of May = 2 May, second = 9 May
    expect(mothersDay(2027).date).toBe('2027-05-09')
  })

  it("Father's Day is the 1st Sunday of September (AU)", () => {
    // 2026: first Sunday of September = 6 Sep
    expect(fathersDay(2026).date).toBe('2026-09-06')
    // 2027: first Sunday of September = 5 Sep
    expect(fathersDay(2027).date).toBe('2027-09-05')
  })
})

describe('NSW weekend holidays', () => {
  it('includes Easter Sunday', () => {
    // Easter Sunday 2026 = 5 April
    const hols = nswWeekendHolidays(2026)
    expect(hols.some(h => h.date === '2026-04-05')).toBe(true)
  })

  it('does not include weekdays', () => {
    const hols = nswWeekendHolidays(2026)
    for (const h of hols) {
      const d = new Date(h.date)
      const dow = d.getDay()
      expect(dow === 0 || dow === 6).toBe(true)
    }
  })
})

describe('computeExclusions', () => {
  it('merges public, cultural, and custom exclusions in range', () => {
    const map = computeExclusions({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      excludeMothersDay: true,
      excludeFathersDay: true,
      customExclusions: [
        { date: '2026-07-04', reason: 'Company offsite', source: 'MANUAL' },
      ],
    })
    expect(map.has('2026-05-10')).toBe(true) // Mother's Day
    expect(map.has('2026-09-06')).toBe(true) // Father's Day
    expect(map.has('2026-07-04')).toBe(true) // Custom
    expect(map.has('2026-04-05')).toBe(true) // Easter Sunday
  })

  it('respects the date range', () => {
    const map = computeExclusions({
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      excludeMothersDay: true,
      excludeFathersDay: true,
      customExclusions: [],
    })
    expect(map.has('2026-05-10')).toBe(false) // out of range
    expect(map.has('2026-09-06')).toBe(false) // out of range
  })
})
