import Holidays from 'date-holidays'
import { addDays, format, getDay, parseISO } from 'date-fns'
import type { ExcludedDate } from '../types'

const hd = new Holidays('AU', 'NSW')

/**
 * NSW gazetted public holidays that fall on a Saturday or Sunday for the given year.
 * Includes substitute days (e.g., when 1 Jan is a Sat, a Mon substitute appears too,
 * but we only return the Sat/Sun occurrence here).
 */
export function nswWeekendHolidays(year: number): ExcludedDate[] {
  const all = hd.getHolidays(year) ?? []
  const out: ExcludedDate[] = []
  for (const h of all) {
    const d = h.date ? parseISO(String(h.date).slice(0, 10)) : null
    if (!d) continue
    const dow = getDay(d)
    if (dow !== 0 && dow !== 6) continue
    // Skip 'observed' substitute holidays — they're always weekdays anyway
    if (h.type && h.type === 'observance') continue
    out.push({
      date: format(d, 'yyyy-MM-dd'),
      reason: h.name,
      source: 'PUBLIC_HOLIDAY',
    })
  }
  // Dedup by date (some libraries return multiple entries on the same day)
  const seen = new Map<string, ExcludedDate>()
  for (const e of out) {
    if (!seen.has(e.date)) seen.set(e.date, e)
    else seen.set(e.date, { ...e, reason: `${seen.get(e.date)!.reason}, ${e.reason}` })
  }
  return [...seen.values()]
}

/** Australian Mother's Day — 2nd Sunday of May. */
export function mothersDay(year: number): ExcludedDate {
  let d = new Date(year, 4, 1) // May
  while (getDay(d) !== 0) d = addDays(d, 1)
  d = addDays(d, 7)
  return {
    date: format(d, 'yyyy-MM-dd'),
    reason: "Mother's Day",
    source: 'CULTURAL',
  }
}

/** Australian Father's Day — 1st Sunday of September. */
export function fathersDay(year: number): ExcludedDate {
  let d = new Date(year, 8, 1) // September
  while (getDay(d) !== 0) d = addDays(d, 1)
  return {
    date: format(d, 'yyyy-MM-dd'),
    reason: "Father's Day",
    source: 'CULTURAL',
  }
}

export interface ExclusionOpts {
  startDate: string
  endDate: string
  excludeMothersDay: boolean
  excludeFathersDay: boolean
  customExclusions: ExcludedDate[]
}

/**
 * Returns a Map of date → ExcludedDate covering the inclusive [start, end] range.
 * Priority (later wins): public holiday → cultural → manual.
 */
export function computeExclusions(opts: ExclusionOpts): Map<string, ExcludedDate> {
  const startYear = parseISO(opts.startDate).getFullYear()
  const endYear = parseISO(opts.endDate).getFullYear()

  const all: ExcludedDate[] = []
  for (let y = startYear; y <= endYear; y++) {
    all.push(...nswWeekendHolidays(y))
    if (opts.excludeMothersDay) all.push(mothersDay(y))
    if (opts.excludeFathersDay) all.push(fathersDay(y))
  }
  all.push(...opts.customExclusions)

  const map = new Map<string, ExcludedDate>()
  for (const e of all) {
    if (e.date >= opts.startDate && e.date <= opts.endDate) {
      map.set(e.date, e)
    }
  }
  return map
}
