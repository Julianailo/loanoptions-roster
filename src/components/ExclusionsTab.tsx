import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { ExcludedDate, RosterConfig } from '../types'
import type { RosterActions } from '../state/useRoster'

interface Props {
  config: RosterConfig
  exclusionsFor: (start: string, end: string) => Map<string, ExcludedDate>
  actions: RosterActions
}

const SOURCE_LABEL: Record<ExcludedDate['source'], string> = {
  PUBLIC_HOLIDAY: 'NSW public holiday',
  CULTURAL: 'Cultural',
  MANUAL: 'Custom',
}

export default function ExclusionsTab({ config, exclusionsFor, actions }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  const exclusions = useMemo(() => {
    const all = exclusionsFor(`${year}-01-01`, `${year}-12-31`)
    return [...all.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [exclusionsFor, year])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Exclusions</h2>
        <p className="text-sm text-ink-500 mt-1">
          NSW public holidays are auto-detected. Mother's Day and Father's Day are excluded by default.
          Add custom exclusions for offsites, closures, etc.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3 text-sm">Settings</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.settings.excludeMothersDay}
              onChange={e => actions.updateSettings({ excludeMothersDay: e.target.checked })}
            />
            Exclude Mother's Day (2nd Sunday of May)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.settings.excludeFathersDay}
              onChange={e => actions.updateSettings({ excludeFathersDay: e.target.checked })}
            />
            Exclude Father's Day (1st Sunday of September)
          </label>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3 text-sm">Add custom exclusion</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          <input
            className="input sm:col-span-2"
            placeholder="Reason (e.g. company offsite)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!date || !reason.trim()}
            onClick={() => {
              actions.addCustomExclusion({ date, reason: reason.trim(), source: 'MANUAL' })
              setDate('')
              setReason('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">All exclusions</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-500">Year</label>
            <select
              className="input w-24 text-xs"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {[year - 1, year, year + 1, year + 2].map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-700 text-left">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Source</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map(e => (
                <tr key={e.date} className="border-t border-ink-100">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {format(parseISO(e.date), 'EEE d MMM yyyy')}
                  </td>
                  <td className="py-2 pr-3">{e.reason}</td>
                  <td className="py-2 pr-3">
                    <span className="chip-excluded">{SOURCE_LABEL[e.source]}</span>
                  </td>
                  <td className="py-2 text-right">
                    {e.source === 'MANUAL' && (
                      <button onClick={() => actions.removeCustomExclusion(e.date)} className="btn-ghost text-xs">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
