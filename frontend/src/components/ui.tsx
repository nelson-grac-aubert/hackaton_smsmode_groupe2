import { useState, useRef, type CSSProperties, type ReactNode, type KeyboardEvent } from 'react'

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '20px 24px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hint}</span>
      )}
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        background: '#141414',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text)',
        outline: 'none',
        width: '100%',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'
        props.onBlur?.(e)
      }}
    />
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, style, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      style={{
        background: '#141414',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text)',
        outline: 'none',
        width: '100%',
        resize: 'vertical',
        minHeight: 80,
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'
        props.onBlur?.(e)
      }}
    />
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ style, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      style={{
        background: '#141414',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text)',
        outline: 'none',
        width: '100%',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// ── Btn ───────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  loading?: boolean
}

const btnStyles: Record<BtnVariant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid var(--accent)',
  },
  secondary: {
    background: 'var(--card)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
  },
}

export function Btn({ variant = 'secondary', size = 'md', loading, children, disabled, style, ...props }: BtnProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '5px 12px' : '8px 16px',
        borderRadius: 6,
        fontWeight: 500,
        fontSize: size === 'sm' ? 12 : 13,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        whiteSpace: 'nowrap',
        ...btnStyles[variant],
        ...style,
      }}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeColor = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
}

const badgeColors: Record<BadgeColor, CSSProperties> = {
  default: { background: 'var(--border)', color: 'var(--text-secondary)' },
  success: { background: 'var(--success-dim)', color: 'var(--success)' },
  warning: { background: 'var(--warning-dim)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-dim)', color: 'var(--danger)' },
  info: { background: 'var(--info-dim)', color: 'var(--info)' },
  accent: { background: 'var(--accent-dim)', color: 'var(--accent)' },
}

export function Badge({ children, color = 'default' }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        ...badgeColors[color],
      }}
    >
      {children}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid var(--border)`,
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <span
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 38,
          height: 22,
          background: checked ? 'var(--accent)' : 'var(--border)',
          borderRadius: 99,
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 19 : 3,
            width: 16,
            height: 16,
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
          }}
        />
      </span>
      {label && <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>}
    </label>
  )
}

// ── TagInput ──────────────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  validate?: (tag: string) => boolean
}

export function TagInput({ tags, onChange, placeholder = 'Ajouter...', validate }: TagInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (value: string) => {
    const tag = value.trim().toUpperCase()
    if (!tag) return
    if (tags.includes(tag)) { setInput(''); return }
    if (validate && !validate(tag)) return
    onChange([...tags, tag])
    setInput('')
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        cursor: 'text',
        minHeight: 40,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {tag}
          <span
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)) }}
            style={{ cursor: 'pointer', opacity: 0.7, fontSize: 14, lineHeight: 1 }}
          >
            ×
          </span>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: 13,
          minWidth: 80,
          flex: 1,
        }}
      />
    </div>
  )
}

// ── CopyRow ───────────────────────────────────────────────────────────────────

interface CopyRowProps {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}

export function CopyRow({ label, value, mono, truncate }: CopyRowProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#141414',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          flex: 1,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: truncate ? 'ellipsis' : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <button
        onClick={copy}
        style={{
          background: copied ? 'var(--success-dim)' : 'var(--border)',
          color: copied ? 'var(--success)' : 'var(--text-secondary)',
          border: 'none',
          borderRadius: 4,
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        {copied ? '✓ Copié' : 'Copier'}
      </button>
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────

type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
}

const alertStyles: Record<AlertVariant, CSSProperties> = {
  info: { background: 'var(--info-dim)', borderColor: 'var(--info)', color: 'var(--info)' },
  success: { background: 'var(--success-dim)', borderColor: 'var(--success)', color: 'var(--success)' },
  warning: { background: 'var(--warning-dim)', borderColor: 'var(--warning)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-dim)', borderColor: 'var(--danger)', color: 'var(--danger)' },
}

export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 6,
        border: '1px solid',
        fontSize: 13,
        lineHeight: 1.6,
        ...alertStyles[variant],
      }}
    >
      {children}
    </div>
  )
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </h3>
  )
}

// ── NumberInput ───────────────────────────────────────────────────────────────

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

export function NumberInput({ value, onChange, min, max, disabled }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10)
        if (!isNaN(v)) onChange(v)
      }}
      style={{
        background: '#141414',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
        color: disabled ? 'var(--text-secondary)' : 'var(--text)',
        outline: 'none',
        width: '100%',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  )
}
