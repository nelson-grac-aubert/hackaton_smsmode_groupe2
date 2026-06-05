import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type {
  Period,
  OverviewResponse,
  StatusBreakdownResponse,
  TimeseriesResponse,
  FraudAlertsResponse,
  OtpStatus,
} from '../lib/api'
import { getApps } from '../lib/storage'
import { Card, Select, Spinner, Alert, Badge, SectionTitle } from '../components/ui'

type BadgeColor = 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'default'

function statusColor(status: OtpStatus): BadgeColor {
  switch (status) {
    case 'VERIFIED': return 'success'
    case 'PENDING': return 'info'
    case 'EXPIRED': return 'default'
    case 'BLOCKED': return 'danger'
    case 'REPORTED': return 'warning'
  }
}

function statusHex(status: OtpStatus): string {
  switch (status) {
    case 'VERIFIED': return '#22c55e'
    case 'PENDING': return '#3b82f6'
    case 'EXPIRED': return '#999'
    case 'BLOCKED': return '#ef4444'
    case 'REPORTED': return '#f59e0b'
  }
}

// Simple SVG bar chart
function BarChart({
  data,
  color = 'var(--accent)',
  height = 100,
}: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value), 1)
  const barWidth = Math.max(8, Math.floor(400 / data.length) - 4)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width={Math.max(400, data.length * (barWidth + 4))}
        height={height + 32}
        style={{ display: 'block' }}
      >
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * height)
          const x = i * (barWidth + 4) + 2
          return (
            <g key={i}>
              <rect
                x={x}
                y={height - h}
                width={barWidth}
                height={h}
                rx={3}
                fill={color}
                opacity={0.85}
              />
              <text
                x={x + barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-secondary)"
              >
                {d.label.length > 5 ? d.label.slice(-5) : d.label}
              </text>
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height - h - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-secondary)"
                >
                  {d.value}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Multi-series SVG line chart
function LineChart({
  points,
  height = 120,
}: {
  points: { timestamp: string; total: number; verified: number; fraud: number }[]
  height?: number
}) {
  if (points.length === 0) return null

  const width = 520
  const padding = { top: 16, right: 16, bottom: 24, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const maxVal = Math.max(...points.flatMap((p) => [p.total, p.verified, p.fraud]), 1)

  const x = (i: number) => padding.left + (i / (points.length - 1 || 1)) * innerW
  const y = (v: number) => padding.top + innerH - (v / maxVal) * innerH

  const line = (key: 'total' | 'verified' | 'fraud') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(' ')

  const series = [
    { key: 'total' as const, color: 'var(--accent)', label: 'Total' },
    { key: 'verified' as const, color: 'var(--success)', label: 'Vérifiés' },
    { key: 'fraud' as const, color: 'var(--danger)', label: 'Fraude' },
  ]

  const labelCount = Math.min(points.length, 6)
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / (labelCount - 1 || 1)) * (points.length - 1)),
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ width: 12, height: 3, background: s.color, display: 'inline-block', borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + innerH * (1 - f)}
              y2={padding.top + innerH * (1 - f)}
              stroke="var(--border)"
              strokeDasharray="3,3"
            />
          ))}

          {/* Lines */}
          {series.map((s) => (
            <path
              key={s.key}
              d={line(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ))}

          {/* X labels */}
          {labelIndices.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 4}
              textAnchor="middle"
              fontSize={8}
              fill="var(--text-secondary)"
            >
              {points[i].timestamp.slice(-5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

// Horizontal bar breakdown
function HorizontalBreakdown({
  items,
}: {
  items: { label: OtpStatus; count: number; percentage: number }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: statusHex(item.label),
                  display: 'inline-block',
                }}
              />
              {item.label}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {item.count} · {item.percentage}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${item.percentage}%`,
                background: statusHex(item.label),
                borderRadius: 3,
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// KPI card
function KpiCard({
  label,
  value,
  sub,
  color,
  progress,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  progress?: number
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>
      )}
      {progress !== undefined && (
        <div
          style={{
            marginTop: 8,
            height: 4,
            background: 'var(--border)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(progress, 100)}%`,
              background: color ?? 'var(--accent)',
              borderRadius: 2,
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>
      )}
    </div>
  )
}

export function Stats() {
  const apps = getApps()
  const [selectedAppId, setSelectedAppId] = useState(apps[0]?.id ?? '')
  const [period, setPeriod] = useState<Period>('24h')

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [breakdown, setBreakdown] = useState<StatusBreakdownResponse | null>(null)
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null)
  const [fraud, setFraud] = useState<FraudAlertsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedApp = apps.find((a) => a.id === selectedAppId)

  useEffect(() => {
    if (!selectedApp) return
    setLoading(true)
    setError(null)
    const key = selectedApp.apiKey

    Promise.all([
      api.getOverview(key, period),
      api.getStatusBreakdown(key, period),
      api.getTimeseries(key, period),
      api.getFraudAlerts(key),
    ])
      .then(([ov, br, ts, fr]) => {
        setOverview(ov)
        setBreakdown(br)
        setTimeseries(ts)
        setFraud(fr)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erreur')
      })
      .finally(() => setLoading(false))
  }, [selectedApp?.id, period])

  if (apps.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <Alert variant="info">
          Créez une application pour accéder aux statistiques.
        </Alert>
      </div>
    )
  }

  const isEmpty = overview?.total === 0

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Statistiques</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
          Supervision et analyse des OTPs envoyés
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <Select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          style={{ width: 220 }}
        >
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </Select>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['24h', '7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px',
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {loading && <Spinner size={18} />}
      </div>

      {error && <Alert variant="danger" >{error}</Alert>}

      {isEmpty && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div>Aucune donnée sur cette période.</div>
          </div>
        </Card>
      )}

      {overview && !isEmpty && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="OTP envoyés" value={overview.total} />
            <KpiCard
              label="Taux de conversion"
              value={`${overview.conversionRate}%`}
              sub={`${overview.verified} vérifiés`}
              color="var(--success)"
              progress={overview.conversionRate}
            />
            <KpiCard
              label="Taux de fraude"
              value={`${overview.fraudRate}%`}
              sub={`${overview.blocked + overview.reported} incidents`}
              color={overview.fraudRate > 5 ? 'var(--danger)' : 'var(--warning)'}
              progress={overview.fraudRate}
            />
            <KpiCard
              label="Canaux"
              value={`${overview.channels.rcs} RCS`}
              sub={`${overview.channels.sms} SMS`}
              color="var(--info)"
            />
          </div>

          {/* Channels bar */}
          {(overview.channels.rcs > 0 || overview.channels.sms > 0) && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Répartition RCS / SMS</SectionTitle>
              <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
                {overview.channels.rcs > 0 && (
                  <div
                    style={{
                      flex: overview.channels.rcs,
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    RCS {Math.round((overview.channels.rcs / overview.total) * 100)}%
                  </div>
                )}
                {overview.channels.sms > 0 && (
                  <div
                    style={{
                      flex: overview.channels.sms,
                      background: 'var(--info)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    SMS {Math.round((overview.channels.sms / overview.total) * 100)}%
                  </div>
                )}
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Status breakdown */}
            {breakdown && breakdown.total > 0 && (
              <Card>
                <SectionTitle>Répartition des statuts</SectionTitle>
                <HorizontalBreakdown
                  items={breakdown.breakdown.map((b) => ({
                    label: b.status,
                    count: b.count,
                    percentage: b.percentage,
                  }))}
                />
              </Card>
            )}

            {/* Timeseries */}
            {timeseries && timeseries.points.length > 0 && (
              <Card>
                <SectionTitle>
                  Évolution temporelle ({timeseries.granularity === 'hour' ? 'par heure' : 'par jour'})
                </SectionTitle>
                <LineChart points={timeseries.points} />
              </Card>
            )}
          </div>

          {/* Timeseries bar chart for total */}
          {timeseries && timeseries.points.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Volume d&apos;envoi</SectionTitle>
              <BarChart
                data={timeseries.points.map((p) => ({
                  label: p.timestamp.slice(-5),
                  value: p.total,
                }))}
                color="var(--accent)"
                height={80}
              />
            </Card>
          )}

          {/* Fraud alerts */}
          {fraud && (fraud.reported.count > 0 || fraud.blocked.count > 0 || fraud.suspiciousPhones.length > 0) && (
            <Card>
              <SectionTitle>Alertes fraude (7 derniers jours)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {/* Reported */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>
                    Signalements ({fraud.reported.count})
                  </div>
                  {fraud.reported.recent.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {fraud.reported.recent.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            fontSize: 11,
                            padding: '6px 8px',
                            background: '#141414',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ color: 'var(--text)', marginBottom: 2 }}>{r.sessionId}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {new Date(r.updatedAt).toLocaleDateString('fr-FR')}
                            {' · '}
                            <Badge color="warning">{r.channel}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blocked */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
                    Blocages ({fraud.blocked.count})
                  </div>
                  {fraud.blocked.recent.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {fraud.blocked.recent.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            fontSize: 11,
                            padding: '6px 8px',
                            background: '#141414',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ color: 'var(--text)', marginBottom: 2 }}>{b.sessionId}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {new Date(b.updatedAt).toLocaleDateString('fr-FR')}
                            {' · '}
                            {b.attempts} tentatives
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suspicious phones */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
                    Numéros suspects
                  </div>
                  {fraud.suspiciousPhones.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aucun</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {fraud.suspiciousPhones.map((p, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11,
                            padding: '6px 8px',
                            background: '#141414',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', marginBottom: 2 }}>
                            {p.phoneHashPrefix}
                          </div>
                          <div style={{ color: 'var(--danger)' }}>{p.failedAttempts} échecs</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
