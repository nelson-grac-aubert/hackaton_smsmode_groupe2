import { useState, useRef, useEffect } from 'react'

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MC', name: 'Monaco' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'ES', name: 'Espagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'IE', name: 'Irlande' },
  { code: 'SE', name: 'Suède' },
  { code: 'NO', name: 'Norvège' },
  { code: 'DK', name: 'Danemark' },
  { code: 'FI', name: 'Finlande' },
  { code: 'PL', name: 'Pologne' },
  { code: 'CZ', name: 'Tchéquie' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'AT', name: 'Autriche' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'HR', name: 'Croatie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'GR', name: 'Grèce' },
  { code: 'CY', name: 'Chypre' },
  { code: 'MT', name: 'Malte' },
  { code: 'US', name: 'États-Unis' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexique' },
  { code: 'BR', name: 'Brésil' },
  { code: 'AR', name: 'Argentine' },
  { code: 'AU', name: 'Australie' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'JP', name: 'Japon' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'CN', name: 'Chine' },
  { code: 'IN', name: 'Inde' },
  { code: 'SG', name: 'Singapour' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taïwan' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'SA', name: 'Arabie Saoudite' },
  { code: 'TR', name: 'Turquie' },
  { code: 'IL', name: 'Israël' },
  { code: 'EG', name: 'Égypte' },
  { code: 'MA', name: 'Maroc' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'NG', name: 'Nigéria' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'RU', name: 'Russie' },
  { code: 'UA', name: 'Ukraine' },
]

const flag = (code: string) =>
  [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')

interface CountryPickerProps {
  value: string[]
  onChange: (codes: string[]) => void
}

export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = COUNTRIES.filter(c => {
    if (query.length === 0) return true
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  })

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code])
  }

  const remove = (code: string) => onChange(value.filter(c => c !== code))

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Tous les pays autorisés (aucune restriction)
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map(code => {
            const country = COUNTRIES.find(c => c.code === code)
            return (
              <span
                key={code}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                  borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--text)',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{flag(code)}</span>
                <span style={{ fontWeight: 500 }}>{code}</span>
                {country && <span style={{ color: 'var(--text-secondary)' }}>{country.name}</span>}
                <button
                  onClick={() => remove(code)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1,
                    padding: '0 0 0 2px', display: 'flex', alignItems: 'center',
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un pays…"
          style={{
            width: '100%', background: 'var(--input-bg, #1a1a1a)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '7px 10px 7px 32px', fontSize: 13, color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', color: 'var(--text-secondary)' }}>
          🔍
        </span>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, zIndex: 100, maxHeight: 240, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                Aucun résultat
              </div>
            ) : filtered.map(c => {
              const selected = value.includes(c.code)
              return (
                <button
                  key={c.code}
                  onClick={() => { toggle(c.code); setQuery('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 12px', background: selected ? 'var(--accent-dim)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{flag(c.code)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{c.code}</span>
                  {selected && <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
