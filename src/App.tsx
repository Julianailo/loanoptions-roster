import { useState } from 'react'
import { useRoster } from './state/useRoster'
import Calendar from './components/Calendar'
import BrokersTab from './components/BrokersTab'
import BlackoutsTab from './components/BlackoutsTab'
import ExclusionsTab from './components/ExclusionsTab'
import GenerateTab from './components/GenerateTab'
import FairnessTab from './components/FairnessTab'

type Tab = 'calendar' | 'generate' | 'brokers' | 'blackouts' | 'exclusions' | 'fairness'

const TABS: { key: Tab; label: string }[] = [
  { key: 'calendar',   label: 'Calendar' },
  { key: 'generate',   label: 'Generate' },
  { key: 'brokers',    label: 'Brokers' },
  { key: 'blackouts',  label: 'Blackouts' },
  { key: 'exclusions', label: 'Exclusions' },
  { key: 'fairness',   label: 'Fairness' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-brand-600 grid place-items-center text-white font-extrabold text-lg shadow-soft">
        L
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">LoanOptions.ai</div>
        <div className="text-[11px] uppercase tracking-widest text-ink-500 font-semibold">
          Weekend Roster
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { config, exclusionsFor, actions } = useRosterFacade()
  const [tab, setTab] = useState<Tab>('calendar')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-ink-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Logo />
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`tab ${tab === t.key ? 'tab-active' : 'tab-idle'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'calendar' && (
          <Calendar
            brokers={config.brokers}
            shifts={config.shifts}
            exclusionsFor={exclusionsFor}
            onUpdateShift={actions.updateShift}
            onToggleLock={actions.toggleLock}
            blackouts={config.blackouts}
          />
        )}
        {tab === 'generate' && <GenerateTab config={config} actions={actions} />}
        {tab === 'brokers' && <BrokersTab brokers={config.brokers} actions={actions} />}
        {tab === 'blackouts' && (
          <BlackoutsTab brokers={config.brokers} blackouts={config.blackouts} actions={actions} />
        )}
        {tab === 'exclusions' && (
          <ExclusionsTab config={config} exclusionsFor={exclusionsFor} actions={actions} />
        )}
        {tab === 'fairness' && <FairnessTab brokers={config.brokers} shifts={config.shifts} />}
      </main>

      <footer className="border-t border-ink-200 bg-white no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 text-xs text-ink-500 flex items-center gap-2">
          <span>LoanOptions.ai Weekend Roster</span>
          <span className="text-ink-300">·</span>
          <span>Fair Sat/Sun scheduling · NSW holidays excluded</span>
          <span className="text-ink-300">·</span>
          <span className="font-mono">{config.brokers.filter(b => b.active).length} active brokers</span>
        </div>
      </footer>
    </div>
  )
}

// Adapter so the prop name from useRoster matches what the components expect.
function useRosterFacade() {
  const r = useRoster()
  return {
    config: r.config,
    actions: r.actions,
    exclusionsFor: r.exclusionsForRange,
  }
}
