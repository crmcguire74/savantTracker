// 🧩 Small, dumb building blocks. Each one commits on blur rather than on
// every keystroke, which is what keeps the change log to one entry per edit
// instead of one per character.

import { useEffect, useState, type ReactNode } from 'react'
import { PHASE, RAG, SEVERITY, TREND } from '../constants'
import type { Phase, RagStatus, Severity, Trend } from '../types'

export function RagDot({ status }: { status: RagStatus }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: RAG[status].color,
        flexShrink: 0,
      }}
    />
  )
}

export function IconButton(props: {
  onClick: (event: React.MouseEvent) => void
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`btn-icon${props.danger ? ' danger' : ''}`}
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function PrimaryButton(props: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" className={`btn ${props.danger ? 'btn-danger' : 'btn-primary'}`} onClick={props.onClick}>
      {props.children}
    </button>
  )
}

export function GhostButton(props: {
  onClick?: () => void
  children: ReactNode
  title?: string
  style?: React.CSSProperties
}) {
  return (
    <button type="button" className="btn btn-ghost" onClick={props.onClick} title={props.title} style={props.style}>
      {props.children}
    </button>
  )
}

export function Field(props: { label: string; width?: number | string; children: ReactNode }) {
  return (
    <label className="field" style={{ width: props.width }}>
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

export function EditableText(props: {
  value: string
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(props.value)
  useEffect(() => setDraft(props.value), [props.value])

  return (
    <input
      className="input"
      value={draft}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      disabled={props.disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== props.value) props.onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(props.value)
      }}
    />
  )
}

export function EditableTextArea(props: {
  value: string
  placeholder?: string
  maxLength?: number
  rows?: number
  disabled?: boolean
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(props.value)
  useEffect(() => setDraft(props.value), [props.value])

  return (
    <textarea
      className="input"
      rows={props.rows ?? 2}
      value={draft}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      disabled={props.disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== props.value) props.onCommit(draft)
      }}
    />
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function EditableDate(props: { value: string; disabled?: boolean; onCommit: (value: string) => void }) {
  return (
    <input
      type="date"
      className="input"
      value={ISO_DATE.test(props.value) ? props.value : ''}
      disabled={props.disabled}
      onChange={(event) => props.onCommit(event.target.value)}
    />
  )
}

export function RagSelect(props: { value: RagStatus; disabled?: boolean; onChange: (value: RagStatus) => void }) {
  return (
    <select
      className="select"
      style={{ color: RAG[props.value].color }}
      value={props.value}
      disabled={props.disabled}
      aria-label="RAG status"
      onChange={(event) => props.onChange(event.target.value as RagStatus)}
    >
      {(Object.keys(RAG) as RagStatus[]).map((key) => (
        <option key={key} value={key}>
          {RAG[key].label}
        </option>
      ))}
    </select>
  )
}

export function TrendSelect(props: { value: Trend; disabled?: boolean; onChange: (value: Trend) => void }) {
  return (
    <select
      className="select"
      value={props.value}
      disabled={props.disabled}
      aria-label="Trend"
      onChange={(event) => props.onChange(event.target.value as Trend)}
    >
      {(Object.keys(TREND) as Trend[]).map((key) => (
        <option key={key} value={key}>
          {TREND[key].symbol} {TREND[key].label}
        </option>
      ))}
    </select>
  )
}

export function PhaseSelect(props: { value: Phase; disabled?: boolean; onChange: (value: Phase) => void }) {
  return (
    <select
      className="select"
      value={props.value}
      disabled={props.disabled}
      aria-label="Phase"
      onChange={(event) => props.onChange(event.target.value as Phase)}
    >
      <option value="">(not set)</option>
      {(Object.keys(PHASE) as Exclude<Phase, ''>[]).map((key) => (
        <option key={key} value={key}>
          {PHASE[key].label}
        </option>
      ))}
    </select>
  )
}

export function SeveritySelect(props: {
  value: Severity
  disabled?: boolean
  onChange: (value: Severity) => void
}) {
  return (
    <select
      className="select"
      style={{ color: SEVERITY[props.value].color }}
      value={props.value}
      disabled={props.disabled}
      aria-label="Severity"
      onChange={(event) => props.onChange(event.target.value as Severity)}
    >
      {(Object.keys(SEVERITY) as Severity[]).map((key) => (
        <option key={key} value={key}>
          {SEVERITY[key].label}
        </option>
      ))}
    </select>
  )
}

export function ProgressControl(props: { value: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(props.value)
  useEffect(() => setDraft(props.value), [props.value])

  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

  return (
    <div className="field">
      <span>Progress</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={draft}
          disabled={props.disabled}
          aria-label="Progress percent"
          style={{ width: 140 }}
          onChange={(event) => setDraft(Number(event.target.value))}
          onMouseUp={(event) => props.onCommit(clamp(Number(event.currentTarget.value)))}
          onTouchEnd={(event) => props.onCommit(clamp(Number(event.currentTarget.value)))}
          onKeyUp={(event) => props.onCommit(clamp(Number(event.currentTarget.value)))}
        />
        <input
          type="number"
          className="input"
          min={0}
          max={100}
          value={draft}
          disabled={props.disabled}
          aria-label="Progress value"
          style={{ width: 62, textAlign: 'right' }}
          onChange={(event) => setDraft(event.target.value === '' ? 0 : clamp(Number(event.target.value)))}
          onBlur={() => {
            if (draft !== props.value) props.onCommit(draft)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
      </div>
    </div>
  )
}
