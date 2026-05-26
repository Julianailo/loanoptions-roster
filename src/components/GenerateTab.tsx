import { useState } from 'react'
import { addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns'
import type { RosterActions } from '../state/useRoster'
import type { RosterConfig } from '../types'
import { downloadJSON, readJSONFile } from '../lib/storage'

interface Props {
  config: RosterConfig
  actions: RosterActions
}

export default function GenerateTab({ config, actions }: Props) {
  const today = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfYear(today), 'yyyy-MM-dd'))
  const [lockBefore, setLockBefore] = useState('')
  const [warnings, setWarnings] = useState<string[] | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleGenerate = () => {
    const { warnings } = actions.regenerate({
      startDate,
      endDate,
      lockBeforeDate: lockBefore || undefined,
    })
    setWarnings(warnings)
    setLastResult(
      `Generated ${format(new Date(startDate), 'd MMM yyyy')} → ${format(new Date(endDate), 'd MMM yyyy')} at ${format(new Date(), 'h:mm a')}`
    )
  }

  const handleImport = async (file: File) => {
    try {
      const next = await readJSONFile(file)
      actions.setConfig(next)
      setLastResult(`Imported config from ${file.name}`)
    } catch (e) {
      alert(`Invalid config file: ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Generate roster</h2>
        <p className="text-sm text-ink-500 mt-1">
          Builds the fair Sat/Sun roster for the chosen range. Locked or manually overridden slots are
          preserved. Excluded dates (holidays, Mother's/Father's Day) stay empty.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Lock everything before (optional)</label>
          <input
            type="date"
            className="input"
            value={lockBefore}
            onChange={e => setLockBefore(e.target.value)}
            placeholder="Leave blank to allow re-generation of the whole range"
          />
          <p className="text-xs text-ink-500 mt-1">
            Anything before this date will be carried forward unchanged — useful after adding a new broker.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-ink-100">
          <div>
            <label className="label">Min brokers per day</label>
            <input
              type="number"
              min={1}
              max={6}
              className="input"
              value={config.settings.minBrokersPerDay}
              onChange={e =>
                actions.updateSettings({ minBrokersPerDay: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
          <div>
            <label className="label">New-broker ramp window (months)</label>
            <input
              type="number"
              min={0}
              max={24}
              className="input"
              value={config.settings.rampWindowMonths}
              onChange={e =>
                actions.updateSettings({ rampWindowMonths: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn-primary" onClick={handleGenerate}>
            ⚡ Generate roster
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              const start = format(startOfYear(today), 'yyyy-MM-dd')
              const end = format(endOfYear(today), 'yyyy-MM-dd')
              setStartDate(start)
              setEndDate(end)
            }}
          >
            This year
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setStartDate(format(addMonths(startOfMonth(today), 1), 'yyyy-MM-dd'))
              setEndDate(format(endOfMonth(addMonths(today, 12)), 'yyyy-MM-dd'))
            }}
          >
            Next 12 months
          </button>
        </div>

        {lastResult && (
          <div className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            ✓ {lastResult}
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="font-semibold mb-1">{warnings.length} warning(s):</div>
            <ul className="list-disc list-inside space-y-0.5">
              {warnings.slice(0, 6).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {warnings.length > 6 && <li>…and {warnings.length - 6} more</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="font-semibold">Config backup</h3>
        <p className="text-sm text-ink-500">
          Export the full state (brokers, blackouts, exclusions, shifts) as JSON to commit to the repo or
          share. Re-import to restore.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => downloadJSON(config)}>
            ⬇ Export config (JSON)
          </button>
          <label className="btn-secondary cursor-pointer">
            ⬆ Import config
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleImport(f)
              }}
            />
          </label>
          <button
            className="btn-danger ml-auto"
            onClick={() => {
              if (confirm('Reset everything to seed brokers and clear all shifts?')) {
                actions.resetToSeed()
                setLastResult('Reset to seed.')
              }
            }}
          >
            Reset to seed
          </button>
        </div>
      </div>
    </div>
  )
}
