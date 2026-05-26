import type { Broker } from '../types'

// Stable IDs so localStorage state survives reloads and config exports are diff-friendly.
const mkId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const today = '2026-01-01'

export const SEED_BROKERS: Broker[] = [
  { firstName: 'Thomas',    lastName: 'N.' },
  { firstName: 'Eugene',    lastName: 'L.' },
  { firstName: 'Pankaj',    lastName: 'B.' },
  { firstName: 'Jason',     lastName: 'A.' },
  { firstName: 'Brad',      lastName: 'P.' },
  { firstName: 'Elias',     lastName: 'E.' },
  { firstName: 'Brandon',   lastName: 'T.' },
  { firstName: 'Cristian',  lastName: 'A.' },
  { firstName: 'Dylan',     lastName: 'C.' },   // likely opt-in every Saturday — toggle in UI
  { firstName: 'Lauryn',    lastName: 'D.' },
  { firstName: 'Angus',     lastName: 'P.' },
  { firstName: 'Tony',      lastName: 'T.' },
  { firstName: 'Sarah',                    },
  { firstName: 'Chantelle', lastName: 'S.' },
  { firstName: 'Josh',      lastName: 'C.' },
  { firstName: 'Issy',      lastName: 'I.' },
  { firstName: 'Flynn',     lastName: 'D.' },
].map(({ firstName, lastName }) => ({
  id: mkId([firstName, lastName].filter(Boolean).join('-')),
  firstName,
  lastName,
  preference: 'NO_PREFERENCE' as const,
  optInSaturdays: false,
  optInSundays: false,
  availableExtra: false,
  active: true,
  joinedAt: today,
}))

export const fullName = (b: Pick<Broker, 'firstName' | 'lastName'>) =>
  [b.firstName, b.lastName].filter(Boolean).join(' ')

export const initials = (b: Pick<Broker, 'firstName' | 'lastName'>) =>
  `${b.firstName[0] ?? ''}${b.lastName?.[0] ?? ''}`.toUpperCase()
