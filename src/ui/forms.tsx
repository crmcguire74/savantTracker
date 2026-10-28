// 📝 Create and edit forms for the three structural levels.

import { useState } from 'react'
import { GhostButton, PrimaryButton } from './atoms'
import type { Initiative, Pillar } from '../types'
import type { NewInitiativeInput, NewProjectInput } from '../hooks/useTracker'

export function NewPillarForm(props: { onSave: (title: string, owner: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')

  return (
    <div className="form-card">
      <input
        className="input"
        value={title}
        placeholder="Pillar title"
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        className="input"
        value={owner}
        placeholder="Owner (optional)"
        onChange={(event) => setOwner(event.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton onClick={() => props.onSave(title, owner)}>Add</PrimaryButton>
        <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
      </div>
    </div>
  )
}

export function EditPillarForm(props: {
  pillar: Pillar
  onSave: (patch: Partial<Pillar>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(props.pillar.title)
  const [owner, setOwner] = useState(props.pillar.owner)

  return (
    <div className="form-card" onClick={(event) => event.stopPropagation()}>
      <input className="input" value={title} autoFocus onChange={(event) => setTitle(event.target.value)} />
      <input
        className="input"
        value={owner}
        placeholder="Owner"
        onChange={(event) => setOwner(event.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton onClick={() => props.onSave({ title: title.trim(), owner: owner.trim() })}>
          Save
        </PrimaryButton>
        <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
      </div>
    </div>
  )
}

const emptyInitiative: NewInitiativeInput = {
  title: '',
  businessOwner: '',
  executionOwner: '',
  startQuarter: '',
  endQuarter: '',
}

export function InitiativeForm(props: {
  initial?: Initiative
  submitLabel: string
  onSave: (input: NewInitiativeInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<NewInitiativeInput>(
    props.initial
      ? {
          title: props.initial.title,
          businessOwner: props.initial.businessOwner,
          executionOwner: props.initial.executionOwner,
          startQuarter: props.initial.startQuarter,
          endQuarter: props.initial.endQuarter,
        }
      : emptyInitiative,
  )

  const set = (patch: Partial<NewInitiativeInput>) => setForm((current) => ({ ...current, ...patch }))

  return (
    <div className="form-card">
      <input
        className="input"
        value={form.title}
        placeholder="Initiative title"
        autoFocus
        onChange={(event) => set({ title: event.target.value })}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          value={form.businessOwner}
          placeholder="Business owner"
          onChange={(event) => set({ businessOwner: event.target.value })}
        />
        <input
          className="input"
          value={form.executionOwner}
          placeholder="Delivery owner"
          onChange={(event) => set({ executionOwner: event.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          value={form.startQuarter}
          placeholder="Start quarter (e.g. Q1 2026)"
          onChange={(event) => set({ startQuarter: event.target.value })}
        />
        <input
          className="input"
          value={form.endQuarter}
          placeholder="End quarter (e.g. Q4 2026)"
          onChange={(event) => set({ endQuarter: event.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton onClick={() => props.onSave(form)}>{props.submitLabel}</PrimaryButton>
        <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
      </div>
    </div>
  )
}

export function NewProjectForm(props: { onSave: (input: NewProjectInput) => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewProjectInput>({ title: '', businessOwner: '', executionOwner: '' })
  const set = (patch: Partial<NewProjectInput>) => setForm((current) => ({ ...current, ...patch }))

  return (
    <div className="form-card">
      <input
        className="input"
        value={form.title}
        placeholder="Project title"
        autoFocus
        onChange={(event) => set({ title: event.target.value })}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          value={form.businessOwner}
          placeholder="Business owner"
          onChange={(event) => set({ businessOwner: event.target.value })}
        />
        <input
          className="input"
          value={form.executionOwner}
          placeholder="Delivery owner"
          onChange={(event) => set({ executionOwner: event.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton onClick={() => props.onSave(form)}>Add</PrimaryButton>
        <GhostButton onClick={props.onCancel}>Cancel</GhostButton>
      </div>
    </div>
  )
}
