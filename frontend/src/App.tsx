import { useState } from 'react'
import { AppList } from './pages/AppList'
import { CreateApp } from './pages/CreateApp'
import { SendOtp } from './pages/SendOtp'
import { Stats } from './pages/Stats'

type Page = 'apps' | 'create' | 'test' | 'stats'

interface NavItem {
  id: Page
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { id: 'apps', label: 'Mes applications', icon: '📦' },
  { id: 'create', label: 'Créer une application', icon: '＋' },
  { id: 'test', label: "Tester l'envoi", icon: '🧪' },
  { id: 'stats', label: 'Statistiques', icon: '📊' },
]

export default function App() {
  const [page, setPage] = useState<Page>('apps')
  const [testAppId, setTestAppId] = useState<string | undefined>()

  const navigateToTest = (appId?: string) => {
    setTestAppId(appId)
    setPage('test')
  }

  const navigateToCreate = () => {
    setPage('create')
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              🔐
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>OTP</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>
                RCS Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id !== 'test') setTestAppId(undefined)
                setPage(item.id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: page === item.id ? 'var(--accent-dim)' : 'transparent',
                color: page === item.id ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: page === item.id ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.15s',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (page !== item.id) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={(e) => {
                if (page !== item.id) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer link */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <a
            href="/api/doc"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 13,
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📖</span>
            API Swagger
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
        }}
      >
        {page === 'apps' && (
          <AppList onTest={navigateToTest} onCreate={navigateToCreate} />
        )}
        {page === 'create' && <CreateApp onTest={navigateToTest} />}
        {page === 'test' && <SendOtp initialAppId={testAppId} />}
        {page === 'stats' && <Stats />}
      </main>
    </div>
  )
}
