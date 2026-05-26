import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Broker, ExcludedDate, Shift } from '../types'
import { initials } from '../data/brokers'
import WeekendDetail from './WeekendDetail'

interface Props {
  brokers: Broker[]
  shifts: Shift[]
  exclusionsFor: (start: string, end: string) => Map<string, ExcludedDate>
  onUpdateShift: (date: string, slotIndex: number, brokerId: string | null) => void
  onToggleLock: (date: string, slotIndex: number) => void
  blackouts: { brokerId: string; date: string; reason?: string }[]
}

const MONTH_LABEL = (d: Date) => format(d, 'MMMM yyyy')

export default function Calendar({
  brokers,
  shifts,
  exclusionsFor,
  onUpdateShift,
  onToggleLock,
  blackouts,
}: Props) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Mon
  const days: Date[] = useMemo(() => {
    const out: Date[] = []
    let d = gridStart
    for (let i = 0; i < 42; i++) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [gridStart])

  const exclusions = useMemo(
    () =>
      exclusionsFor(
        format(gridStart, 'yyyy-MM-dd'),
        format(addDays(gridStart, 41), 'yyyy-MM-dd')
      ),
    [exclusionsFor, gridStart]
  )

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const arr = map.get(s.date) ?? []
      arr.push(s)
      map.set(s.date, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.slotIndex - b.slotIndex)
    return map
  }, [shifts])

  const brokerById = useMemo(() => {
    const m = new Map<string, Broker>()
    for (const b of brokers) m.set(b.id, b)
    return m
  }, [brokers])

  const blackoutsByDate = useMemo(() => {
    const m = new Map<string, { brokerId: string; date: string; reason?: string }[]>()
    for (const bo of blackouts) {
      const arr = m.get(bo.date) ?? []
      arr.push(bo)
      m.set(bo.date, arr)
    }
    return m
  }, [blackouts])

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            className="btn-ghost px-2"
            aria-label="Previous month"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            ‹
          </button>
          <h2 className="text-xl font-bold tracking-tight">{MONTH_LABEL(cursor)}</h2>
          <button
            className="btn-ghost px-2"
            aria-label="Next month"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            ›
          </button>
          <button
            className="btn-secondary ml-auto text-xs"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
          <input
            type="month"
            value={format(cursor, 'yyyy-MM')}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (y && m) setCursor(new Date(y, m - 1, 1))
            }}
            className="input w-auto text-xs hidden sm:block"
          />
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-500">
          {dayHeaders.map((h, i) => (
            <div key={h} className={`text-center py-1 ${i >= 5 ? 'text-brand-700' : ''}`}>
              {h}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map(d => {
            const dateStr = format(d, 'yyyy-MM-dd')
            const dow = getDay(d) // 0=Sun, 6=Sat
            const isWeekend = dow === 0 || dow === 6
            const inMonth = isSameMonth(d, monthStart)
            const isToday = isSameDay(d, new Date())
            const exclusion = exclusions.get(dateStr)
            const dayShifts = shiftsByDate.get(dateStr) ?? []
            const dayBlackouts = blackoutsByDate.get(dateStr) ?? []
            const selected = selectedDate === dateStr

            const baseClasses = [
              'relative aspect-square sm:aspect-[1.1/1] rounded-xl p-1.5 sm:p-2',
              'flex flex-col text-left transition',
              !inMonth ? 'opacity-40' : '',
              isWeekend
                ? 'bg-brand-50/60 border border-brand-100 hover:border-brand-300 cursor-pointer'
                : 'bg-ink-50 border border-transparent',
              selected ? 'ring-2 ring-brand-600 border-brand-300' : '',
            ].join(' ')

            const handleClick = () => {
              if (!isWeekend) return
              setSelectedDate(dateStr)
            }

            return (
              <button
                key={dateStr}
                onClick={handleClick}
                disabled={!isWeekend}
                className={baseClasses}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs sm:text-sm font-bold ${isToday ? 'text-brand-600' : 'text-ink-900'}`}
                  >
                    {format(d, 'd')}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600" aria-label="Today" />
                  )}
                </div>

                {exclusion && (
                  <div className="mt-0.5">
                    <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      No shift
                    </div>
                    <div className="text-[10px] sm:text-xs text-ink-700 leading-tight line-clamp-2">
                      {exclusion.reason}
                    </div>
                  </div>
                )}

                {isWeekend && !exclusion && (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {dayShifts.map(s => {
                      const b = s.brokerId ? brokerById.get(s.brokerId) : null
                      const isOptIn =
                        b &&
                        ((s.dayType === 'SATURDAY' && b.optInSaturdays) ||
                          (s.dayType === 'SUNDAY' && b.optInSundays))
                      return (
                        <span
                          key={s.slotIndex}
                          className={`inline-flex items-center gap-1 rounded-full text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 ${
                            b
                              ? 'bg-white text-brand-700 border border-brand-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                          title={b ? `${b.firstName} ${b.lastName ?? ''}` : 'Unassigned'}
                        >
                          {b ? initials(b) : '?'}
                          {isOptIn && <span aria-hidden>★</span>}
                          {s.locked && <span aria-hidden>🔒</span>}
                          {s.manualOverride && <span aria-hidden>✎</span>}
                        </span>
                      )
                    })}
                    {dayBlackouts.length > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold w-4 h-4"
                        title={`${dayBlackouts.length} blackout${dayBlackouts.length > 1 ? 's' : ''}`}
                      >
                        {dayBlackouts.length}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-50 border border-brand-100" /> Weekend
          </span>
          <span className="inline-flex items-center gap-1.5">★ Opt-in</span>
          <span className="inline-flex items-center gap-1.5">🔒 Locked</span>
          <span className="inline-flex items-center gap-1.5">✎ Manual</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-50 border border-red-200" /> Blackout
          </span>
        </div>
      </div>

      <div>
        <WeekendDetail
          dateStr={selectedDate}
          brokers={brokers}
          shifts={shifts}
          exclusionsFor={exclusionsFor}
          onClose={() => setSelectedDate(null)}
          onUpdateShift={onUpdateShift}
          onToggleLock={onToggleLock}
          blackouts={blackouts}
        />
      </div>
    </div>
  )
}
