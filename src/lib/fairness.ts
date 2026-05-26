import { addDays, differenceInDays, differenceInMonths, format, getDay, parseISO } from 'date-fns'
import type { Blackout, Broker, DayType, ExcludedDate, Shift } from '../types'

export interface GenerateOpts {
  brokers: Broker[]
  startDate: string
  endDate: string
  exclusions: Map<string, ExcludedDate>
  blackouts: Blackout[]
  minBrokersPerDay: number
  rampWindowMonths: number
  /** Existing assignments — past months, manual overrides, locks. Carried forward. */
  existingShifts: Shift[]
  /** Dates strictly before this are considered locked (immutable). */
  lockBeforeDate?: string
}

export interface GenerateResult {
  shifts: Shift[]
  warnings: string[]
  counts: Map<string, number>
}

// Cheap deterministic hash (FNV-1a). Used only as a stable tiebreaker.
function fnv1a(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

interface ScoreCtx {
  shiftsSoFar: number
  prevWorkRecency: number | null // days since last shift, null if never
  rampWindowMonths: number
  asOf: Date
  date: string
}

function score(b: Broker, dayType: DayType, ctx: ScoreCtx): number {
  // Lower score = preferred candidate.
  // Primary signal: shifts so far (heavily weighted).
  let s = ctx.shiftsSoFar * 1000

  // Preference bonus
  if (b.preference === dayType) s -= 25
  else if (b.preference !== 'NO_PREFERENCE') s += 25

  // Recency penalty: worked last weekend? avoid back-to-back if possible
  if (ctx.prevWorkRecency !== null && ctx.prevWorkRecency <= 7) s += 200
  else if (ctx.prevWorkRecency !== null && ctx.prevWorkRecency <= 14) s += 50

  // New-broker ramp: small downward (preference) bias for the first N months
  const months = differenceInMonths(ctx.asOf, parseISO(b.joinedAt))
  if (months >= 0 && months < ctx.rampWindowMonths) {
    s -= (ctx.rampWindowMonths - months) * 15
  }

  // Stable tiebreaker (sub-integer)
  s += (fnv1a(`${b.id}|${ctx.date}`) % 1000) / 1000

  return s
}

/**
 * Generate a fair Sat/Sun roster. Pure function — no side effects.
 * See /docs/fairness.md for the full algorithm description.
 */
export function generateRoster(opts: GenerateOpts): GenerateResult {
  const {
    brokers,
    startDate,
    endDate,
    exclusions,
    blackouts,
    minBrokersPerDay,
    rampWindowMonths,
    existingShifts,
    lockBeforeDate,
  } = opts

  // Index blackouts by broker
  const blackoutByBroker = new Map<string, Set<string>>()
  for (const bo of blackouts) {
    if (!blackoutByBroker.has(bo.brokerId)) blackoutByBroker.set(bo.brokerId, new Set())
    blackoutByBroker.get(bo.brokerId)!.add(bo.date)
  }
  const hasBlackout = (brokerId: string, date: string): boolean =>
    blackoutByBroker.get(brokerId)?.has(date) ?? false

  // Index existing shifts
  const existingByKey = new Map<string, Shift>()
  for (const s of existingShifts) existingByKey.set(`${s.date}#${s.slotIndex}`, s)

  // Counts: include carried-forward (locked / pre-lock / manual override) assignments
  const counts = new Map<string, number>()
  for (const b of brokers) counts.set(b.id, 0)
  for (const s of existingShifts) {
    const carried = s.brokerId && (s.locked || s.manualOverride ||
      (lockBeforeDate ? s.date < lockBeforeDate : false))
    if (carried && s.brokerId) {
      counts.set(s.brokerId, (counts.get(s.brokerId) ?? 0) + 1)
    }
  }

  // Last-shift date per broker (for recency penalty)
  const lastShift = new Map<string, string>()
  for (const s of existingShifts) {
    if (!s.brokerId) continue
    const prev = lastShift.get(s.brokerId)
    if (!prev || s.date > prev) lastShift.set(s.brokerId, s.date)
  }

  const shifts: Shift[] = []
  const warnings: string[] = []

  let cursor = parseISO(startDate)
  const end = parseISO(endDate)

  while (cursor <= end) {
    const dateStr = format(cursor, 'yyyy-MM-dd')
    const dow = getDay(cursor)

    // Only Sat/Sun
    if (dow !== 0 && dow !== 6) {
      cursor = addDays(cursor, 1)
      continue
    }

    const dayType: DayType = dow === 6 ? 'SATURDAY' : 'SUNDAY'
    const excluded = exclusions.has(dateStr)
    const isPreLock = lockBeforeDate ? dateStr < lockBeforeDate : false

    // Track who's been placed on this date already (across slots) to prevent duplicates
    const placedToday = new Set<string>()
    for (const s of shifts) {
      if (s.date === dateStr && s.brokerId) placedToday.add(s.brokerId)
    }

    for (let slot = 0; slot < minBrokersPerDay; slot++) {
      const key = `${dateStr}#${slot}`
      const existing = existingByKey.get(key)

      if (excluded) {
        shifts.push({
          date: dateStr,
          dayType,
          slotIndex: slot,
          brokerId: null,
          manualOverride: false,
          locked: true,
        })
        continue
      }

      // Carry forward locked / manual / pre-lock entries verbatim
      if (existing && (existing.locked || existing.manualOverride || isPreLock)) {
        shifts.push(existing)
        if (existing.brokerId) placedToday.add(existing.brokerId)
        continue
      }

      // Step 1: opt-ins for this day type (treat as a separate pool, ranked by current count)
      const optInCandidates = brokers.filter(b =>
        b.active &&
        !placedToday.has(b.id) &&
        !hasBlackout(b.id, dateStr) &&
        ((dayType === 'SATURDAY' && b.optInSaturdays) ||
         (dayType === 'SUNDAY' && b.optInSundays))
      )

      let chosen: Broker | null = null

      if (optInCandidates.length > 0) {
        optInCandidates.sort((a, b) => {
          const d = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0)
          if (d !== 0) return d
          return fnv1a(`${a.id}|${dateStr}`) - fnv1a(`${b.id}|${dateStr}`)
        })
        chosen = optInCandidates[0]
      } else {
        // Step 2: regular pool — anyone active and eligible, including opt-in brokers
        // for whom their day already filled (treat them as regulars on the other day type).
        const pool = brokers.filter(b => {
          if (!b.active) return false
          if (placedToday.has(b.id)) return false
          if (hasBlackout(b.id, dateStr)) return false
          // Brokers fully opted-in to BOTH stay in opt-in lane only
          if (b.optInSaturdays && b.optInSundays) return false
          // If broker is opted in to THIS day type, they would have been picked above
          // (so we'd never get here unless they were already placed today)
          return true
        })

        if (pool.length === 0) {
          warnings.push(`No eligible broker for ${dateStr} (slot ${slot})`)
          shifts.push({
            date: dateStr,
            dayType,
            slotIndex: slot,
            brokerId: null,
            manualOverride: false,
            locked: false,
          })
          continue
        }

        const scored = pool.map(b => {
          const last = lastShift.get(b.id)
          const recency = last ? differenceInDays(cursor, parseISO(last)) : null
          return {
            b,
            score: score(b, dayType, {
              shiftsSoFar: counts.get(b.id) ?? 0,
              prevWorkRecency: recency !== null && recency >= 0 ? recency : null,
              rampWindowMonths,
              asOf: cursor,
              date: dateStr,
            }),
          }
        })
        scored.sort((a, b) => a.score - b.score)
        chosen = scored[0].b
      }

      counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1)
      lastShift.set(chosen.id, dateStr)
      placedToday.add(chosen.id)
      shifts.push({
        date: dateStr,
        dayType,
        slotIndex: slot,
        brokerId: chosen.id,
        manualOverride: false,
        locked: false,
      })
    }

    cursor = addDays(cursor, 1)
  }

  return { shifts, warnings, counts }
}

/**
 * Summary stats for the Fairness Dashboard.
 */
export interface FairnessStat {
  brokerId: string
  shifts: number
  deviation: number // shifts - average (rounded to 1dp)
}

export function fairnessStats(counts: Map<string, number>, regularPoolIds: string[]): {
  average: number
  stats: FairnessStat[]
} {
  const values = regularPoolIds.map(id => counts.get(id) ?? 0)
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const stats: FairnessStat[] = regularPoolIds.map(id => ({
    brokerId: id,
    shifts: counts.get(id) ?? 0,
    deviation: Math.round(((counts.get(id) ?? 0) - average) * 10) / 10,
  }))
  return { average: Math.round(average * 10) / 10, stats }
}
