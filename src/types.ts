export type Preference = 'SATURDAY' | 'SUNDAY' | 'NO_PREFERENCE'
export type DayType = 'SATURDAY' | 'SUNDAY'

export interface Broker {
  id: string
  firstName: string
  lastName?: string
  preference: Preference
  optInSaturdays: boolean
  optInSundays: boolean
  availableExtra: boolean
  active: boolean
  joinedAt: string // ISO date
}

export interface Blackout {
  id: string
  brokerId: string
  date: string // ISO YYYY-MM-DD
  reason?: string
}

export type ExclusionSource = 'PUBLIC_HOLIDAY' | 'CULTURAL' | 'MANUAL'

export interface ExcludedDate {
  date: string // ISO YYYY-MM-DD
  reason: string
  source: ExclusionSource
}

export interface Shift {
  date: string // ISO YYYY-MM-DD
  dayType: DayType
  slotIndex: number // 0..N-1 (default 2 slots per day)
  brokerId: string | null // null = unfilled
  manualOverride: boolean
  locked: boolean
}

export interface RosterConfig {
  brokers: Broker[]
  blackouts: Blackout[]
  customExclusions: ExcludedDate[] // user-added only; holidays computed dynamically
  shifts: Shift[]
  settings: {
    minBrokersPerDay: number
    excludeMothersDay: boolean
    excludeFathersDay: boolean
    rampWindowMonths: number
    targetDeviation: number
  }
  meta: {
    version: number
    updatedAt: string
  }
}
