import { addDays, format, getDay, parseISO } from 'date-fns'
import { useMemo } from 'react'
import type { Broker, ExcludedDate, Shift } from '../types'
import { fullName } from '../data/brokers'
import { downloadWeekendPDF } from '../lib/pdf'

interface Props {
  dateStr: string | null
  brokers: Broker[]
  shifts: Shift[]
  exclusionsFor: (start: string, end: string) => Map<string, ExcludedDate>
  blackouts: { brokerId: string; date: string; reason?: string }[]
  onClose: () => void
  onUpdateShift: (date: string, slotIndex: number, brokerId: string | null) => void
  onToggleLock: (date: string, slotIndex: number) => void
}

export default function WeekendDetail({
  dateStr,
  brokers,
  shifts,
  exclusionsFor,
  blackouts,
  onClose,
  onUpdateShift,
  onToggleLock,
}: Props) {
  const { saturday, sunday } = useMemo(() => {
    if (!dateStr) return { saturday: null, sunday: null }
    const d = parseISO(dateStr)
    const dow = getDay(d)
    const sat = dow === 6 ? d : addDays(d, -1)
    return { saturday: sat, sunday: addDays(sat, 1) }
  }, [dateStr])

  if (!dateStr || !saturday || !sunday) {
    return (
      <div className="card p-6 text-sm text-ink-500">
        <div className="font-semibold text-ink-900 mb-1">Weekend details</div>
        Click a Saturday or Sunday in the calendar to view assignments and export a PDF.
      </div>
    )
  }

  const satKey = format(saturday, 'yyyy-MM-dd')
  const sunKey = format(sunday, 'yyyy-MM-dd')

  const exclusions = exclusionsFor(satKey, sunKey)
  const satShifts = shifts.filter(s => s.date === satKey).sort((a, b) => a.slotIndex - b.slotIndex)
  const sunShifts = shifts.filter(s => s.date === sunKey).sort((a, b) => a.slotIndex - b.slotIndex)
  const dayBlackouts = blackouts.filter(b => b.date === satKey || b.date === sunKey)

  const handlePDF = () => {
    downloadWeekendPDF({
      saturday,
      shifts: [...satShifts, ...sunShifts],
      brokers,
      exclusions,
      blackouts: dayBlackouts,
    })
  }

  return (
    <div className="card p-5 sticky top-20">
      <div className="flex items-start gap-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-ink-500">Weekend</div>
          <div className="text-lg font-bold tracking-tight">
            {format(saturday, 'd MMM')} – {format(sunday, 'd MMM yyyy')}
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost ml-auto p-1.5 -mr-1.5" aria-label="Close">
          ✕
        </button>
      </div>

      <DaySection
        label="Saturday"
        date={saturday}
        shifts={satShifts}
        brokers={brokers}
        exclusion={exclusions.get(satKey)}
        onUpdateShift={onUpdateShift}
        onToggleLock={onToggleLock}
        blackouts={blackouts.filter(b => b.date === satKey)}
      />
      <div className="my-4 border-t border-ink-100" />
      <DaySection
        label="Sunday"
        date={sunday}
        shifts={sunShifts}
        brokers={brokers}
        exclusion={exclusions.get(sunKey)}
        onUpdateShift={onUpdateShift}
        onToggleLock={onToggleLock}
        blackouts={blackouts.filter(b => b.date === sunKey)}
      />

      <button onClick={handlePDF} className="btn-primary w-full mt-5">
        ⬇ Download weekend PDF
      </button>
    </div>
  )
}

function DaySection({
  label,
  date,
  shifts,
  brokers,
  exclusion,
  onUpdateShift,
  onToggleLock,
  blackouts,
}: {
  label: string
  date: Date
  shifts: Shift[]
  brokers: Broker[]
  exclusion?: ExcludedDate
  blackouts: { brokerId: string; reason?: string }[]
  onUpdateShift: (date: string, slotIndex: number, brokerId: string | null) => void
  onToggleLock: (date: string, slotIndex: number) => void
}) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const blackedOutIds = new Set(blackouts.map(b => b.brokerId))

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-sm font-bold text-brand-700">{label}</h3>
        <span className="text-xs text-ink-500">{format(date, 'd MMM yyyy')}</span>
      </div>

      {exclusion ? (
        <div className="rounded-xl bg-ink-50 border border-ink-200 p-3 text-sm text-ink-700">
          <div className="font-semibold text-ink-900 mb-0.5">No shift today</div>
          <div className="text-xs">{exclusion.reason}</div>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-xs text-ink-500 italic">No slots generated yet. Use the Generate tab.</div>
      ) : (
        <ul className="space-y-2">
          {shifts.map(s => (
            <li key={s.slotIndex} className="flex items-center gap-2">
              <span className="w-5 text-xs font-semibold text-ink-500 text-center">{s.slotIndex + 1}</span>
              <select
                className="input flex-1 text-sm"
                value={s.brokerId ?? ''}
                onChange={e => onUpdateShift(dateStr, s.slotIndex, e.target.value || null)}
              >
                <option value="">— Unassigned —</option>
                {brokers
                  .filter(b => b.active || b.id === s.brokerId)
                  .map(b => (
                    <option key={b.id} value={b.id} disabled={blackedOutIds.has(b.id) && b.id !== s.brokerId}>
                      {fullName(b)}
                      {blackedOutIds.has(b.id) ? ' · blacked out' : ''}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => onToggleLock(dateStr, s.slotIndex)}
                className={`btn-ghost p-2 ${s.locked ? 'text-brand-600' : ''}`}
                aria-label={s.locked ? 'Unlock slot' : 'Lock slot'}
                title={s.locked ? 'Locked — preserved on regenerate' : 'Lock slot'}
              >
                {s.locked ? '🔒' : '🔓'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {blackouts.length > 0 && !exclusion && (
        <div className="mt-3 text-xs text-ink-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-semibold text-red-800">Blackouts: </span>
          {blackouts
            .map(b => {
              const broker = brokers.find(x => x.id === b.brokerId)
              return broker ? fullName(broker) : b.brokerId
            })
            .join(', ')}
        </div>
      )}
    </div>
  )
}
