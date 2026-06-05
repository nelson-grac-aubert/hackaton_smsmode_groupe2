import { useState } from 'react'
import { getApps, deleteApp } from '../lib/storage'
import { Card, Badge, Btn, Alert } from '../components/ui'

interface AppListProps {
  onTest: (appId: string) => void
  onCreate: () => void
}

export function AppList({ onTest, onCreate }: AppListProps) {
  const [apps, setApps] = useState(getApps)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette application ?')) return
    deleteApp(id)
    setApps(getApps())
  }

  const handleCopy = (id: string, key: string) => {
    void navigator.clipboard.writeText(key).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  if (apps.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 48,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
          }}
        >
          📦
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Aucune application
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Créez votre première application OTP pour commencer.
          </div>
        </div>
        <Btn variant="primary" onClick={onCreate}>
          Créer une application
        </Btn>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Mes applications</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            {apps.length} application{apps.length > 1 ? 's' : ''} configurée{apps.length > 1 ? 's' : ''}
          </p>
        </div>
        <Btn variant="primary" onClick={onCreate}>
          + Nouvelle application
        </Btn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {apps.map((app) => (
          <Card key={app.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* App icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: 'var(--accent-dim)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                🔐
              </div>

              {/* App info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{app.name}</span>
                  <Badge color={app.otpMode === 'GOOGLE_PROMPT' ? 'accent' : 'info'}>
                    {app.otpMode === 'GOOGLE_PROMPT' ? 'Google Prompt' : 'Classic'}
                  </Badge>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  ID : <span style={{ fontFamily: 'var(--font-mono)' }}>{app.id}</span>
                  {' · '}
                  Créée le {new Date(app.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>

                {/* API Key row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#141414',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    API Key
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {app.apiKey.slice(0, 8)}{'•'.repeat(20)}
                  </span>
                  <button
                    onClick={() => handleCopy(app.id, app.apiKey)}
                    style={{
                      background: copiedId === app.id ? 'var(--success-dim)' : 'var(--border)',
                      color: copiedId === app.id ? 'var(--success)' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copiedId === app.id ? '✓ Copié' : 'Copier la clé'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Btn size="sm" variant="primary" onClick={() => onTest(app.id)}>
                  Tester
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => handleDelete(app.id)}>
                  Supprimer
                </Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {apps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Alert variant="info">
            Les clés API sont stockées localement dans votre navigateur. Ne partagez pas vos clés.
          </Alert>
        </div>
      )}
    </div>
  )
}
