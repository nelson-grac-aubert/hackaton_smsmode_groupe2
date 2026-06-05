import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type {
  Period,
  OverviewResponse,
  StatusBreakdownResponse,
  TimeseriesResponse,
  FraudAlertsResponse,
  OtpStatus,
  AppConfig,
  UpdateAppConfigPayload,
  AppConfigResponse,
} from '../lib/api'
import { getApps } from '../lib/storage'
import { Card, Select, Spinner, Alert, Badge, SectionTitle, Field, Toggle, NumberInput, Btn } from '../components/ui'
import { CountryPicker } from '../components/CountryPicker'

function statusHex(s: OtpStatus) {
  const m: Record<OtpStatus, string> = {
    VERIFIED: '#22c55e', PENDING: '#3b82f6',
    EXPIRED: '#6b7280', BLOCKED: '#ef4444', REPORTED: '#f59e0b',
  }
  return m[s]
}

function formatTs(ts: string, g: 'hour' | 'day') {
  const d = new Date(ts)
  return g === 'hour'
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function periodDays(p: Period) { return p === '24h' ? 1 : p === '7d' ? 7 : 30 }

// ── Donut ──────────────────────────────────────────────────────────────────────
function Donut({ segments, total, size = 120, thickness = 16 }: {
  segments: { color: string; value: number; label: string }[]
  total: number; size?: number; thickness?: number
}) {
  const [hov, setHov] = useState<string | null>(null)
  const cx = size / 2, cy = size / 2
  const r = (size - thickness) / 2 - 2
  const circ = 2 * Math.PI * r
  let cum = 0
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {total === 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
      )}
      {segments.map((s) => {
        if (!s.value) return null
        const dash = (s.value / total) * circ
        const offset = -(cum * circ)
        cum += s.value / total
        return (
          <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={hov === s.label ? thickness + 3 : thickness}
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-width 0.15s', cursor: 'default' }}
            onMouseEnter={() => setHov(s.label)} onMouseLeave={() => setHov(null)} />
        )
      })}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text)">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">total</text>
    </svg>
  )
}

// ── Stacked bar chart ──────────────────────────────────────────────────────────
function StackedTimeseries({ points, granularity }: {
  points: { timestamp: string; total: number; verified: number; fraud: number }[]
  granularity: 'hour' | 'day'
}) {
  const [hov, setHov] = useState<number | null>(null)
  if (!points.length) return null

  const VW = 900, VH = 240
  const pad = { top: 24, right: 16, bottom: 40, left: 40 }
  const iW = VW - pad.left - pad.right
  const iH = VH - pad.top - pad.bottom
  const maxVal = Math.max(...points.map(p => p.total), 1)
  const slot = iW / points.length
  const bw = Math.max(4, slot * 0.65)
  const bx = (i: number) => pad.left + i * slot + (slot - bw) / 2
  const bh = (v: number) => (v / maxVal) * iH
  const baseY = pad.top + iH
  const labelStep = Math.max(1, Math.ceil(points.length / 9))
  const labelIdx = points.reduce<number[]>((a, _, i) => {
    if (i % labelStep === 0 || i === points.length - 1) a.push(i)
    return a
  }, [])
  const hp = hov !== null ? points[hov] : null

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        {[['#22c55e', 'Vérifiés'], ['#6b7280', 'Autres'], ['#ef4444', 'Fraude']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>

      {hp !== null && hov !== null && (
        <div style={{
          position: 'absolute', top: 30,
          ...(hov > points.length * 0.6 ? { left: 44 } : { right: 0 }),
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12,
          pointerEvents: 'none', zIndex: 10, minWidth: 160,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>{formatTs(hp.timestamp, granularity)}</div>
          {([
            ['Total', hp.total, 'var(--text)', undefined],
            ['Vérifiés', hp.verified, '#22c55e', hp.total > 0 ? Math.round(hp.verified / hp.total * 100) : 0],
            ['Fraude', hp.fraud, '#ef4444', undefined],
            ['Autres', hp.total - hp.verified - hp.fraud, '#6b7280', undefined],
          ] as [string, number, string, number | undefined][]).map(([l, v, c, pct]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
              <strong style={{ color: c }}>{v}{pct !== undefined && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> ({pct}%)</span>}</strong>
            </div>
          ))}
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ overflow: 'visible', display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const yp = pad.top + iH * (1 - f)
          return (
            <g key={f}>
              <line x1={pad.left} x2={VW - pad.right} y1={yp} y2={yp}
                stroke="var(--border)" strokeDasharray={f === 0 ? undefined : '3,4'} strokeWidth={f === 0 ? 1 : 0.7} />
              <text x={pad.left - 8} y={yp + 4} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
                {Math.round(f * maxVal)}
              </text>
            </g>
          )
        })}
        {points.map((p, i) => {
          const x = bx(i)
          const other = Math.max(0, p.total - p.verified - p.fraud)
          const isH = hov === i
          const hV = bh(p.verified), hO = bh(other), hF = bh(p.fraud), hT = bh(p.total)
          const rr = Math.min(3, bw / 4)
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <rect x={x - slot * 0.18} y={pad.top} width={slot} height={iH} fill="transparent" />
              {p.verified > 0 && <rect x={x} y={baseY - hV} width={bw} height={hV} fill="#22c55e" opacity={isH ? 1 : 0.82} rx={hO === 0 && hF === 0 ? rr : 0} />}
              {other > 0 && <rect x={x} y={baseY - hV - hO} width={bw} height={hO} fill="#4b5563" opacity={isH ? 1 : 0.72} rx={hF === 0 ? rr : 0} />}
              {p.fraud > 0 && <rect x={x} y={baseY - hT} width={bw} height={hF} fill="#ef4444" opacity={isH ? 1 : 0.88} rx={rr} />}
              {isH && p.total > 0 && <rect x={x - 1} y={baseY - hT - 1} width={bw + 2} height={hT + 2} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} rx={rr} />}
            </g>
          )
        })}
        {labelIdx.map(i => (
          <text key={i} x={bx(i) + bw / 2} y={VH - 6} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
            {formatTs(points[i].timestamp, granularity)}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── KPI ────────────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color, progress, highlight }: {
  label: string; value: string | number; sub?: string
  color?: string; progress?: number; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? 'var(--accent-dim)' : 'var(--card)',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop: 8, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color ?? 'var(--accent)', borderRadius: 2, transition: 'width 0.6s ease-out' }} />
        </div>
      )}
    </div>
  )
}

// ── Security config panel ──────────────────────────────────────────────────────
function SecurityPanel({ app, onClose, onSaved }: {
  app: { id: string; apiKey: string }
  onClose: () => void
  onSaved: (cfg: AppConfig) => void
}) {
  const [form, setForm] = useState<AppConfig>({
    ttlSeconds: 300, codeLength: 6, maxAttempts: 3, resendCooldown: 30,
    oneTapEnabled: true, allowedCountries: [], rateLimitPhone: 5, rateLimitIp: 20, reportEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    api.getConfig(app.apiKey)
      .then((res: AppConfigResponse) => {
        const { id: _id, ...cfg } = res
        setForm(cfg)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [app.apiKey])

  const set = <K extends keyof AppConfig>(k: K, v: AppConfig[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res: AppConfigResponse = await api.updateConfig(app.apiKey, form as UpdateAppConfigPayload)
      const { id: _id, ...cfg } = res
      setForm(cfg)
      onSaved(cfg)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Paramètres de sécurité</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            Modification appliquée immédiatement sur toutes les nouvelles requêtes
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={24} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <SectionTitle>OTP</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Durée de validité (secondes)" hint="30 – 900 s">
                <NumberInput value={form.ttlSeconds} onChange={v => set('ttlSeconds', v)} min={30} max={900} />
              </Field>
              <Field label="Longueur du code" hint="4 – 10 chiffres">
                <NumberInput value={form.codeLength} onChange={v => set('codeLength', v)} min={4} max={10} />
              </Field>
              <Field label="Tentatives max">
                <NumberInput value={form.maxAttempts} onChange={v => set('maxAttempts', v)} min={1} max={10} />
              </Field>
              <Field label="Cooldown renvoi (s)" hint="Exponentiel : 30s → 60s → 120s…">
                <NumberInput value={form.resendCooldown} onChange={v => set('resendCooldown', v)} min={0} />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>Rate limiting</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Limite par téléphone (/ heure)">
                <NumberInput value={form.rateLimitPhone} onChange={v => set('rateLimitPhone', v)} min={1} />
              </Field>
              <Field label="Limite par IP (/ heure)">
                <NumberInput value={form.rateLimitIp} onChange={v => set('rateLimitIp', v)} min={1} />
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Pays autorisés" hint="Vide = tous les pays autorisés">
                <CountryPicker value={form.allowedCountries} onChange={v => set('allowedCountries', v)} />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>Options</SectionTitle>
            <div style={{ display: 'flex', gap: 28 }}>
              <Toggle checked={form.oneTapEnabled} onChange={v => set('oneTapEnabled', v)} label="Bouton 1-tap" />
              <Toggle checked={form.reportEnabled} onChange={v => set('reportEnabled', v)} label="Bouton « Ce n'est pas moi »" />
            </div>
          </Card>

          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="info">Configuration sauvegardée.</Alert>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn variant="primary" loading={saving} onClick={() => void save()}>Sauvegarder</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function Stats() {
  const apps = getApps()
  const [selectedId, setSelectedId] = useState(apps[0]?.id ?? '')
  const [period, setPeriod] = useState<Period>('30d')
  const [showConfig, setShowConfig] = useState(false)

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [breakdown, setBreakdown] = useState<StatusBreakdownResponse | null>(null)
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null)
  const [fraud, setFraud] = useState<FraudAlertsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const app = apps.find(a => a.id === selectedId)

  useEffect(() => {
    if (!app || showConfig) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getOverview(app.apiKey, period),
      api.getStatusBreakdown(app.apiKey, period),
      api.getTimeseries(app.apiKey, period),
      api.getFraudAlerts(app.apiKey),
    ])
      .then(([ov, br, ts, fr]) => { setOverview(ov); setBreakdown(br); setTimeseries(ts); setFraud(fr) })
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [app?.id, period, showConfig])

  if (!apps.length) return (
    <div style={{ padding: 32 }}>
      <Alert variant="info">Créez une application pour accéder aux statistiques.</Alert>
    </div>
  )

  const days = periodDays(period)
  const avgPerDay = overview ? Math.round(overview.total / days) : 0

  return (
    <div style={{ padding: 32, maxWidth: 980 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Statistiques</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>Supervision et analyse des OTPs envoyés</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width: 200 }}>
            {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {!showConfig && (
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['24h', '7d', '30d'] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '6px 14px',
                  background: period === p ? 'var(--accent)' : 'transparent',
                  color: period === p ? '#fff' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <Btn
            variant={showConfig ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowConfig(v => !v)}
          >
            {showConfig ? '← Stats' : '⚙ Sécurité'}
          </Btn>
          {loading && !showConfig && <Spinner size={16} />}
        </div>
      </div>

      {/* Security config panel */}
      {showConfig && app && (
        <SecurityPanel
          app={app}
          onClose={() => setShowConfig(false)}
          onSaved={() => setShowConfig(false)}
        />
      )}

      {/* Stats content */}
      {!showConfig && (
        <>
          {error && <Alert variant="danger">{error}</Alert>}

          {overview?.total === 0 && !loading && (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div>Aucune donnée sur cette période.</div>
              </div>
            </Card>
          )}

          {overview && overview.total > 0 && (
            <>
              {/* Synthèse */}
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 18px', marginBottom: 20,
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {days === 1 ? 'Dernières 24h' : `${days} derniers jours`} —
                </span>
                <strong>{overview.total} OTPs</strong>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{overview.conversionRate}% vérifiés</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: overview.fraudRate > 5 ? '#ef4444' : 'var(--text-secondary)' }}>
                  {overview.fraudRate}% fraude
                </span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(overview.channels.rcs / Math.max(overview.total, 1) * 100)}% RCS
                  {days > 1 && ` · ~${avgPerDay}/j`}
                </span>
              </div>

              {/* KPIs — 4 cartes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <Kpi label="OTP envoyés" value={overview.total} sub={days > 1 ? `~${avgPerDay} / jour` : undefined} highlight />
                <Kpi label="Conversion" value={`${overview.conversionRate}%`} sub={`${overview.verified} vérifiés`} color="#22c55e" progress={overview.conversionRate} />
                <Kpi label="Fraude" value={`${overview.fraudRate}%`}
                  sub={`${overview.blocked} bloqués · ${overview.reported} signalés`}
                  color={overview.fraudRate > 5 ? '#ef4444' : '#f59e0b'} progress={overview.fraudRate} />
                <Kpi label="Canal dominant"
                  value={overview.channels.rcs >= overview.channels.sms ? 'RCS' : 'SMS'}
                  sub={`${overview.channels.rcs} RCS · ${overview.channels.sms} SMS`}
                  color="var(--accent)" />
              </div>

              {/* Graphique pleine largeur */}
              {timeseries && timeseries.points.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Volume d&apos;envoi <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· par {timeseries.granularity === 'hour' ? 'heure' : 'jour'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Survolez pour le détail</span>
                  </div>
                  <StackedTimeseries points={timeseries.points} granularity={timeseries.granularity} />
                </Card>
              )}

              {/* Répartition statuts */}
              {breakdown && breakdown.total > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <SectionTitle>Répartition des statuts</SectionTitle>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <Donut total={breakdown.total} segments={breakdown.breakdown.map(b => ({ color: statusHex(b.status), value: b.count, label: b.status }))} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {breakdown.breakdown.map(b => (
                        <div key={b.status}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusHex(b.status), display: 'inline-block' }} />
                              {b.status}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {b.count} · <strong style={{ color: 'var(--text)' }}>{b.percentage}%</strong>
                            </span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${b.percentage}%`, background: statusHex(b.status), borderRadius: 2, transition: 'width 0.5s ease-out' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Alertes fraude */}
              {fraud && (fraud.reported.count > 0 || fraud.blocked.count > 0 || fraud.suspiciousPhones.length > 0) && (
                <Card>
                  <SectionTitle>Alertes fraude (7 derniers jours)</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>Signalements ({fraud.reported.count})</div>
                      {!fraud.reported.recent.length
                        ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                        : fraud.reported.recent.map(r => (
                          <div key={r.id} style={{ fontSize: 11, padding: '6px 8px', background: '#141414', borderRadius: 4, border: '1px solid var(--border)', marginBottom: 6 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', marginBottom: 2 }}>{r.sessionId.slice(0, 16)}…</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{new Date(r.updatedAt).toLocaleDateString('fr-FR')} · <Badge color="warning">{r.channel}</Badge></div>
                          </div>
                        ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Blocages ({fraud.blocked.count})</div>
                      {!fraud.blocked.recent.length
                        ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                        : fraud.blocked.recent.map(b => (
                          <div key={b.id} style={{ fontSize: 11, padding: '6px 8px', background: '#141414', borderRadius: 4, border: '1px solid var(--border)', marginBottom: 6 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', marginBottom: 2 }}>{b.sessionId.slice(0, 16)}…</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{new Date(b.updatedAt).toLocaleDateString('fr-FR')} · {b.attempts} tentatives</div>
                          </div>
                        ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Numéros suspects</div>
                      {!fraud.suspiciousPhones.length
                        ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                        : fraud.suspiciousPhones.map((p, i) => (
                          <div key={i} style={{ fontSize: 11, padding: '6px 8px', background: '#141414', borderRadius: 4, border: '1px solid var(--border)', marginBottom: 6 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', marginBottom: 2 }}>{p.phoneHashPrefix}</div>
                            <div style={{ color: '#ef4444' }}>{p.failedAttempts} échecs</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
