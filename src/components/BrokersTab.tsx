import { useState } from 'react'
import type { Broker, Preference } from '../types'
import type { RosterActions } from '../state/useRoster'
import { fullName, initials } from '../data/brokers'

interface Props {
  brokers: Broker[]
  actions: RosterActions
}

const PREF_LABEL: Record<Preference, string> = {
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
  NO_PREFERENCE: 'Either',
}

export default function BrokersTab({ brokers, actions }: Props) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Brokers</h2>
          <p className="text-sm text-ink-500 mt-1">
            {brokers.filter(b => b.active).length} active · {brokers.length} total
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary">
          + Add broker
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {brokers.map(b => (
          <BrokerCard key={b.id} broker={b} actions={actions} />
        ))}
      </div>

      {adding && (
        <AddBrokerModal
          onClose={() => setAdding(false)}
          onSubmit={data => {
            actions.addBroker({
              ...data,
              joinedAt: new Date().toISOString().slice(0, 10),
              active: true,
            })
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function BrokerCard({ broker, actions }: { broker: Broker; actions: RosterActions }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <EditBrokerForm
        broker={broker}
        onCancel={() => setEditing(false)}
        onSave={patch => {
          actions.updateBroker(broker.id, patch)
          setEditing(false)
        }}
        onRemove={() => {
          if (confirm(`Remove ${fullName(broker)} permanently? Their past shifts will be unassigned.`)) {
            actions.removeBroker(broker.id)
          }
        }}
      />
    )
  }
  return (
    <div className={`card p-4 ${!broker.active ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 grid place-items-center font-bold">
          {initials(broker)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{fullName(broker)}</div>
          <div className="text-xs text-ink-500">Prefers {PREF_LABEL[broker.preference]}</div>
        </div>
        {!broker.active && <span className="chip-excluded">Inactive</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {broker.optInSaturdays && <span className="chip-optin">★ Every Sat</span>}
        {broker.optInSundays && <span className="chip-optin">★ Every Sun</span>}
        {broker.availableExtra && <span className="chip-broker">Extras OK</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex-1">
          Edit
        </button>
        <button
          onClick={() => actions.updateBroker(broker.id, { active: !broker.active })}
          className="btn-ghost text-xs"
        >
          {broker.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  )
}

function EditBrokerForm({
  broker,
  onSave,
  onCancel,
  onRemove,
}: {
  broker: Broker
  onSave: (patch: Partial<Broker>) => void
  onCancel: () => void
  onRemove: () => void
}) {
  const [firstName, setFirstName] = useState(broker.firstName)
  const [lastName, setLastName] = useState(broker.lastName ?? '')
  const [preference, setPreference] = useState<Preference>(broker.preference)
  const [optInSaturdays, setOptInSat] = useState(broker.optInSaturdays)
  const [optInSundays, setOptInSun] = useState(broker.optInSundays)
  const [availableExtra, setExtras] = useState(broker.availableExtra)

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="label">First name</label>
          <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>
        <div>
          <label className="label">Last</label>
          <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
      </div>
      <label className="label">Preference</label>
      <select
        className="input mb-3"
        value={preference}
        onChange={e => setPreference(e.target.value as Preference)}
      >
        <option value="NO_PREFERENCE">Either</option>
        <option value="SATURDAY">Saturday</option>
        <option value="SUNDAY">Sunday</option>
      </select>

      <div className="space-y-2 mb-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={optInSaturdays} onChange={e => setOptInSat(e.target.checked)} />
          Work every Saturday
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={optInSundays} onChange={e => setOptInSun(e.target.checked)} />
          Work every Sunday
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={availableExtra} onChange={e => setExtras(e.target.checked)} />
          Available for extras
        </label>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          onClick={() => onSave({ firstName, lastName: lastName || undefined, preference, optInSaturdays, optInSundays, availableExtra })}
        >
          Save
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}

function AddBrokerModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (b: Omit<Broker, 'id' | 'joinedAt' | 'active'>) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [preference, setPreference] = useState<Preference>('NO_PREFERENCE')
  const [optInSaturdays, setOptInSat] = useState(false)
  const [optInSundays, setOptInSun] = useState(false)
  const [availableExtra, setExtras] = useState(false)

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Add broker</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Last</label>
            <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <label className="label">Preference</label>
        <select className="input mb-3" value={preference} onChange={e => setPreference(e.target.value as Preference)}>
          <option value="NO_PREFERENCE">Either</option>
          <option value="SATURDAY">Saturday</option>
          <option value="SUNDAY">Sunday</option>
        </select>
        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={optInSaturdays} onChange={e => setOptInSat(e.target.checked)} />
            Work every Saturday
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={optInSundays} onChange={e => setOptInSun(e.target.checked)} />
            Work every Sunday
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={availableExtra} onChange={e => setExtras(e.target.checked)} />
            Available for extras
          </label>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={!firstName.trim()}
            onClick={() =>
              onSubmit({
                firstName: firstName.trim(),
                lastName: lastName.trim() || undefined,
                preference,
                optInSaturdays,
                optInSundays,
                availableExtra,
              })
            }
          >
            Add
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
