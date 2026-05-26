import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { Blackout, Broker } from '../types'
import type { RosterActions } from '../state/useRoster'
import { fullName } from '../data/brokers'

interface Props {
  brokers: Broker[]
  blackouts: Blackout[]
  actions: RosterActions
}

export default function BlackoutsTab({ brokers, blackouts, actions }: Props) {
  const [brokerId, setBrokerId] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  const sorted = [...blackouts].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Blackouts</h2>
        <p className="text-sm text-ink-500 mt-1">
          Visible to everyone. The generator will not assign brokers on their blackout dates.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3 text-sm">Add blackout</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          <select className="input" value={brokerId} onChange={e => setBrokerId(e.target.value)}>
            <option value="">Pick broker…</option>
            {brokers
              .filter(b => b.active)
              .map(b => (
                <option key={b.id} value={b.id}>
                  {fullName(b)}
                </option>
              ))}
          </select>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          <input
            className="input sm:col-span-1"
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!brokerId || !date}
            onClick={() => {
              actions.addBlackout({ brokerId, date, reason: reason || undefined })
              setReason('')
              setDate('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">No blackouts logged yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-700 text-left">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Broker</th>
                <th className="px-4 py-2.5">Reason</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(b => {
                const broker = brokers.find(x => x.id === b.brokerId)
                return (
                  <tr key={b.id} className="border-t border-ink-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-900">
                      {format(parseISO(b.date), 'EEE d MMM yyyy')}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{broker ? fullName(broker) : 'Unknown'}</td>
                    <td className="px-4 py-2.5 text-ink-700">{b.reason ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => actions.removeBlackout(b.id)} className="btn-ghost text-xs">
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
