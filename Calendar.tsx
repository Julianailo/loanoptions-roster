import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns'
import type { Broker, ExcludedDate, Shift } from '../types'
import { fullName } from '../data/brokers'
import WeekendDetail from './WeekendDetail'
import { downloadMonthsRosterPDF } from '../lib/pdf'

interface Props {
  brokers: Broker[]
  shifts: Shift[]
  exclusionsFor: (start: string, end: string) => Map<string, ExcludedDate>
  onUpdateShift: (date: string, slotIndex: number, brokerId: string | null) => void
  onToggleLock: (date: string, slotIndex: number) => void
  blackouts: { brokerId: string; date: string; reason?: string }[]
}

const MONTH_LABEL = (d: Date) => format(d, 'MMMM yyyy')

function getWeekendsInMonth(monthStart: Date): Date[] {
  const saturdays: Date[] = []
  let d = monthStart
  while (isSameMonth(d, monthStart)) {
    if (getDay(d) === 6) saturdays.push(new Date(d))
    d = addDays(d, 1)
  }
  return saturdays
}

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
  const [downloading, setDownloading] = useState(false)

  const monthStart = startOfMonth(cursor)

  const weekends = useMemo(() => getWeekendsInMonth(monthStart), [monthStart])

  // Compute exclusions for the full month range
  const monthEndStr = format(addDays(addMonths(monthStart, 1), -1), 'yyyy-MM-dd')
  const exclusions = useMemo(
    () => exclusionsFor(format(monthStart, 'yyyy-MM-dd'), monthEndStr),
    [exclusionsFor, monthStart, monthEndStr]
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

  function handleDownloadPDF() {
    setDownloading(true)
    try {
      const thisMonth = startOfMonth(cursor)
      const nextMonth = startOfMonth(addMonths(cursor, 1))
      downloadMonthsRosterPDF({
        months: [thisMonth, nextMonth],
        shifts,
        brokers,
        exclusionsFor,
        blackouts,
      })
    } finally {
      setDownloading(false)
    }
  }

  function BrokerPills({ dateStr, dayType }: { dateStr: string; dayType: 'SATURDAY' | 'SUNDAY' }) {
    const dayShifts = shiftsByDate.get(dateStr) ?? []
    const exclusion = exclusions.get(dateStr)
    const dayBlackouts = blackoutsByDate.get(dateStr) ?? []
    const isToday = isSameDay(new Date(dateStr + 'T00:00:00'), new Date())

    if (exclusion) {
      return (
        <div className="flex flex-col justify-center h-full">
          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">No shift</span>
          <span className="text-xs text-ink-500 leading-tight">{exclusion.reason}</span>
        </div>
      )
    }

    if (dayShifts.length === 0) {
      return <span className="text-xs text-ink-400 italic">No roster yet</span>
    }

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {dayShifts.map(s => {
          const b = s.brokerId ? brokerById.get(s.brokerId) : null
          const isOptIn =
            b &&
            ((dayType === 'SATURDAY' && b.optInSaturdays) ||
              (dayType === 'SUNDAY' && b.optInSundays))
          return (
            <span
              key={s.slotIndex}
              className={`inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-1 ${
                b
                  ? 'bg-white text-brand-700 border border-brand-200 shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              } ${isToday ? 'ring-1 ring-brand-400' : ''}`}
              title={b ? fullName(b) : 'Unassigned'}
            >
              {b ? fullName(b) : '? Unassigned'}
              {isOptIn && <span aria-hidden className="text-brand-400">★</span>}
              {s.locked && <span aria-hidden>🔒</span>}
              {s.manualOverride && <span aria-hidden>✎</span>}
            </span>
          )
        })}
        {dayBlackouts.length > 0 && (
          <span
            className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold px-2 py-0.5"
            title={`${dayBlackouts.length} blackout${dayBlackouts.length > 1 ? 's' : ''}`}
          >
            {dayBlackouts.length} blackout{dayBlackouts.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="card p-4 sm:p-6">
        {/* Header row */}
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
            className="btn-secondary text-xs"
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
          <button
            className="btn-primary ml-auto text-xs flex items-center gap-1.5"
            onClick={handleDownloadPDF}
            disabled={downloading}
            title={`Download PDF for ${MONTH_LABEL(cursor)} & ${MONTH_LABEL(addMonths(cursor, 1))}`}
          >
            ⬇ Download Roster PDF
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[160px_1fr_1fr] gap-3 mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-ink-500">
          <div>Weekend</div>
          <div className="text-brand-700">Saturday</div>
          <div className="text-brand-700">Sunday</div>
        </div>

        {/* Weekend rows */}
        <div className="flex flex-col gap-2">
          {weekends.length === 0 && (
            <div className="text-sm text-ink-400 italic py-8 text-center">No weekends found in this month.</div>
          )}
          {weekends.map(saturday => {
            const sunday = addDays(saturday, 1)
            const satKey = format(saturday, 'yyyy-MM-dd')
            const sunKey = format(sunday, 'yyyy-MM-dd')
            const isSelectedSat = selectedDate === satKey
            const isSelectedSun = selectedDate === sunKey
            const isSelected = isSelectedSat || isSelectedSun
            const isTodaySat = isSameDay(saturday, new Date())
            const isTodaySun = isSameDay(sunday, new Date())

            return (
              <div
                key={satKey}
                className={`grid grid-cols-[160px_1fr_1fr] gap-3 rounded-xl border transition ${
                  isSelected
                    ? 'border-brand-400 ring-2 ring-brand-300 bg-brand-50/40'
                    : 'border-brand-100 bg-brand-50/20 hover:border-brand-300'
                }`}
              >
                {/* Date label */}
                <div className="flex flex-col justify-center px-3 py-3 border-r border-brand-100">
                  <span className="text-sm font-bold text-ink-800">
                    {format(saturday, 'd')} – {format(sunday, 'd')} {format(saturday, 'MMM')}
                  </span>
                  <span className="text-xs text-ink-500 mt-0.5">{format(saturday, 'yyyy')}</span>
                  {(isTodaySat || isTodaySun) && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                      This weekend
                    </span>
                  )}
                </div>

                {/* Saturday cell */}
                <button
                  onClick={() => setSelectedDate(satKey)}
                  className={`text-left px-3 py-3 rounded-l-none transition ${
                    isSelectedSat ? 'bg-brand-100/60' : 'hover:bg-brand-50'
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-500 mb-1.5">
                    Sat {format(saturday, 'd MMM')}
                    {isTodaySat && <span className="ml-1 text-brand-600">· Today</span>}
                  </div>
                  <BrokerPills dateStr={satKey} dayType="SATURDAY" />
                </button>

                {/* Sunday cell */}
                <button
                  onClick={() => setSelectedDate(sunKey)}
                  className={`text-left px-3 py-3 border-l border-brand-100 rounded-r-xl transition ${
                    isSelectedSun ? 'bg-brand-100/60' : 'hover:bg-brand-50'
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-500 mb-1.5">
                    Sun {format(sunday, 'd MMM')}
                    {isTodaySun && <span className="ml-1 text-brand-600">· Today</span>}
                  </div>
                  <BrokerPills dateStr={sunKey} dayType="SUNDAY" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Legend */}
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
