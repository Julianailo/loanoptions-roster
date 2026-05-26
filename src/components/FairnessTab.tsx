import { useMemo } from 'react'
import type { Broker, Shift } from '../types'
import { fullName, initials } from '../data/brokers'

interface Props {
  brokers: Broker[]
  shifts: Shift[]
}

export default function FairnessTab({ brokers, shifts }: Props) {
  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of brokers) counts.set(b.id, 0)
    for (const s of shifts) {
      if (s.brokerId) counts.set(s.brokerId, (counts.get(s.brokerId) ?? 0) + 1)
    }
    const active = brokers.filter(b => b.active)
    const values = active.map(b => counts.get(b.id) ?? 0)
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    const max = Math.max(1, ...values)
    return {
      avg: Math.round(avg * 10) / 10,
      max,
      rows: active
        .map(b => {
          const n = counts.get(b.id) ?? 0
          const dev = Math.round((n - avg) * 10) / 10
          return { broker: b, count: n, dev }
        })
        .sort((a, b) => b.count - a.count),
    }
  }, [brokers, shifts])

  const totalShifts = stats.rows.reduce((acc, r) => acc + r.count, 0)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Fairness</h2>
        <p className="text-sm text-ink-500 mt-1">
          Per-broker shift totals for everything currently in the roster. Target is everyone within ±2 of the
          average.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Total shifts assigned" value={totalShifts} />
        <Stat label="Average per active broker" value={stats.avg} />
        <Stat label="Active brokers" value={stats.rows.length} />
      </div>

      <div className="card p-4">
        <ul className="space-y-2.5">
          {stats.rows.map(({ broker, count, dev }) => {
            const tone =
              Math.abs(dev) <= 1
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : Math.abs(dev) <= 2
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-red-50 text-red-800 border-red-200'
            const pct = Math.max(2, Math.round((count / stats.max) * 100))
            return (
              <li key={broker.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm">
                  {initials(broker)}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1 gap-2">
                    <div className="font-semibold text-sm truncate">{fullName(broker)}</div>
                    <div className="text-xs text-ink-500 whitespace-nowrap">
                      {count} shift{count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className={`chip border ${tone} font-mono`}>
                  {dev > 0 ? '+' : ''}
                  {dev}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-widest font-semibold text-ink-500">{label}</div>
      <div className="text-2xl font-bold tracking-tight mt-1">{value}</div>
    </div>
  )
}
