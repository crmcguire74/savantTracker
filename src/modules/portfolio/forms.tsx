// 📝 Create and edit forms for the three structural levels.
//
// Every form waits for its save. While monday is live a save goes to monday first, which takes a
// moment and can be refused, so the form stays open with "Saving…" and closes only when the save
// worked. A refused save leaves the form as it was, and the toast says why.

import { useState, type ReactNode } from 'react'
import { GhostButton, PrimaryButton, pillarTitle, type Initiative, type Pillar, type NewInitiativeInput, type NewProjectInput } from '@sdk'

type Save<T> = (value: T) => Promise<unknown>

/** Runs a save, holds the busy state, and calls `done` only when the save reported success. */
function useSaving() {
  const [busy, setBusy] = useState(false)
  const run = async (work: () => Promise<unknown>, done: () => void) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await work()
      if (result !== undefined && result !== false) done()
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function Field(props: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <span className="muted small">{props.hint}</span>}
    </label>
  )
}

function Actions(props: { busy: boolean; label: string; onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <PrimaryButton onClick={props.onSave} disabled={props.busy || props.disabled}>
        {props.busy ? 'Saving…' : props.label}
      </PrimaryButton>
      <GhostButton onClick={props.onCancel} disabled={props.busy}>
        Cancel
      </GhostButton>
    </div>
  )
}

/** One line under a form that says where the save goes. */
function SyncNote(props: { children: ReactNode }) {
  return (
    <p className="muted small" role="note" style={{ margin: 0 }}>
      {props.children}
    </p>
  )
}

export function NewPillarForm(props: { live: boolean; onSave: (title: string, owner: string) => Promise<unknown>; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const { busy, run } = useSaving()
  const save = () => void run(() => props.onSave(title, owner), props.onCancel)

  return (
    <form className="form-card" onSubmit={(event) => (event.preventDefault(), save())}>
      <Field label="Pillar">
        <input className="input" value={title} placeholder="Pillar name" autoFocus onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Owner">
        <input className="input" value={owner} placeholder="Optional" onChange={(event) => setOwner(event.target.value)} />
      </Field>
      {props.live && <SyncNote>Creates the pillar folder in monday.com too. The owner is kept in WiseTrack.</SyncNote>}
      <Actions busy={busy} label="Add pillar" onSave={save} onCancel={props.onCancel} disabled={!title.trim()} />
    </form>
  )
}

export function EditPillarForm(props: {
  pillar: Pillar
  linked: boolean
  onSave: Save<Partial<Pillar>>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(props.pillar.title)
  const [owner, setOwner] = useState(props.pillar.owner)
  const { busy, run } = useSaving()
  const save = () => void run(() => props.onSave({ title: title.trim(), owner: owner.trim() }), props.onCancel)

  return (
    <form className="form-card" onClick={(event) => event.stopPropagation()} onSubmit={(event) => (event.preventDefault(), save())}>
      <Field label="Pillar">
        <input className="input" value={title} autoFocus onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Owner">
        <input className="input" value={owner} placeholder="Owner" onChange={(event) => setOwner(event.target.value)} />
      </Field>
      {props.linked && <SyncNote>A new name also renames the pillar folder in monday.com. The owner is kept in WiseTrack.</SyncNote>}
      <Actions busy={busy} label="Save" onSave={save} onCancel={props.onCancel} disabled={!title.trim()} />
    </form>
  )
}

const emptyInitiative: NewInitiativeInput = {
  title: '',
  scope: '',
  businessOwner: '',
  executionOwner: '',
  startQuarter: '',
  endQuarter: '',
}

export interface InitiativeFormValue extends NewInitiativeInput {
  pillarId: string
}

export function InitiativeForm(props: {
  initial?: Initiative
  /** Pillars an initiative may sit in. Shown as a picker when editing. */
  pillars?: Pillar[]
  pillarId: string
  submitLabel: string
  /** monday is live and (when editing) this initiative is linked to it. */
  linked: boolean
  onSave: Save<InitiativeFormValue>
  onCancel: () => void
}) {
  const [form, setForm] = useState<InitiativeFormValue>(() =>
    props.initial
      ? {
          pillarId: props.initial.pillarId,
          title: props.initial.title,
          scope: props.initial.scope ?? '',
          businessOwner: props.initial.businessOwner,
          executionOwner: props.initial.executionOwner,
          startQuarter: props.initial.startQuarter,
          endQuarter: props.initial.endQuarter,
        }
      : { ...emptyInitiative, pillarId: props.pillarId },
  )
  const { busy, run } = useSaving()
  const set = (patch: Partial<InitiativeFormValue>) => setForm((current) => ({ ...current, ...patch }))
  const save = () => void run(() => props.onSave(form), props.onCancel)
  // A linked initiative can only move to a pillar monday also has.
  const choices = (props.pillars ?? []).filter((pillar) => !props.linked || !props.initial || Boolean(pillar.mondayId) || pillar.id === props.initial.pillarId)

  return (
    <form className="form-card" onSubmit={(event) => (event.preventDefault(), save())}>
      <Field label="Initiative">
        <input className="input" value={form.title} placeholder="Initiative name" autoFocus onChange={(event) => set({ title: event.target.value })} />
      </Field>
      {props.initial && choices.length > 1 && (
        <Field label="Pillar">
          <select className="select" value={form.pillarId} onChange={(event) => set({ pillarId: event.target.value })} style={{ width: '100%' }}>
            {choices.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillarTitle(pillar.title)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Scope statement">
        <textarea
          className="input"
          rows={3}
          maxLength={500}
          value={form.scope ?? ''}
          placeholder="What this initiative sets out to deliver"
          onChange={(event) => set({ scope: event.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field label="Business owner">
          <input className="input" value={form.businessOwner} onChange={(event) => set({ businessOwner: event.target.value })} />
        </Field>
        <Field label="Delivery owner">
          <input className="input" value={form.executionOwner} onChange={(event) => set({ executionOwner: event.target.value })} />
        </Field>
        <Field label="Start quarter">
          <input className="input" value={form.startQuarter} placeholder="e.g. Q1 2026" onChange={(event) => set({ startQuarter: event.target.value })} />
        </Field>
        <Field label="End quarter">
          <input className="input" value={form.endQuarter} placeholder="e.g. Q4 2026" onChange={(event) => set({ endQuarter: event.target.value })} />
        </Field>
      </div>
      {props.linked && (
        <SyncNote>
          {props.initial
            ? 'A new name or pillar also changes the initiative folder in monday.com. The scope statement, owners and quarters are kept in WiseTrack.'
            : 'Creates the initiative folder and its project register board in monday.com. The scope statement, owners and quarters are kept in WiseTrack.'}
        </SyncNote>
      )}
      <Actions busy={busy} label={props.submitLabel} onSave={save} onCancel={props.onCancel} disabled={!form.title.trim()} />
    </form>
  )
}

export function NewProjectForm(props: { live: boolean; onSave: Save<NewProjectInput>; onCancel: () => void }) {
  const [form, setForm] = useState<NewProjectInput>({ title: '', businessOwner: '', executionOwner: '' })
  const { busy, run } = useSaving()
  const set = (patch: Partial<NewProjectInput>) => setForm((current) => ({ ...current, ...patch }))
  const save = () => void run(() => props.onSave(form), props.onCancel)

  return (
    <form className="form-card" onSubmit={(event) => (event.preventDefault(), save())}>
      <Field label="Project">
        <input className="input" value={form.title} placeholder="Project name" autoFocus onChange={(event) => set({ title: event.target.value })} />
      </Field>
      <div className="form-grid">
        <Field label="Business owner">
          <input className="input" value={form.businessOwner} onChange={(event) => set({ businessOwner: event.target.value })} />
        </Field>
        <Field label="Delivery owner">
          <input className="input" value={form.executionOwner} onChange={(event) => set({ executionOwner: event.target.value })} />
        </Field>
      </div>
      {props.live && (
        <SyncNote>Creates the project as an item in this initiative’s monday.com board (Projects group). Fill in status, dates and the rest in monday.com.</SyncNote>
      )}
      <Actions busy={busy} label="Add project" onSave={save} onCancel={props.onCancel} disabled={!form.title.trim()} />
    </form>
  )
}
