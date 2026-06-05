import type { OtpMode } from '../lib/api'

interface RcsPreviewProps {
  mode: OtpMode
  logoUrl?: string
  cardTitle?: string
  messageTemplate?: string
  senderLabel?: string
  ttlSeconds?: number
  codeLength?: number
  logoError: boolean
  onLogoError: () => void
}

function resolveTemplate(template: string, brand: string, ttlSeconds: number): string {
  const ttlMin = Math.max(1, Math.round(ttlSeconds / 60))
  return template
    .replace(/{{brand}}/g, brand || 'Votre marque')
    .replace(/{{ttl}}/g, String(ttlMin))
}

export function RcsPreview({
  mode,
  logoUrl,
  cardTitle,
  messageTemplate,
  senderLabel,
  ttlSeconds = 300,
  codeLength = 6,
  logoError,
  onLogoError,
}: RcsPreviewProps) {
  const title = cardTitle || 'Code de vérification'
  const brand = senderLabel || 'Verification'
  const template = messageTemplate || 'Votre code {{brand}} est valable {{ttl}} min.'
  const message = resolveTemplate(template, brand, ttlSeconds)
  const ttlMin = Math.max(1, Math.round(ttlSeconds / 60))

  // Fake digits for CLASSIC mode
  const fakeCode = Array.from({ length: codeLength }, (_, i) =>
    ['4', '8', '3', '9', '2', '1', '7', '5', '0', '6'][i % 10],
  ).join('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>
        APERÇU RCS
      </span>

      {/* Phone frame */}
      <div
        style={{
          width: 280,
          background: '#1a1a2e',
          borderRadius: 32,
          padding: '12px 8px',
          border: '2px solid #333',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Phone notch */}
        <div
          style={{
            width: 80,
            height: 6,
            background: '#333',
            borderRadius: 3,
            margin: '0 auto 12px',
          }}
        />

        {/* Message bubble area */}
        <div
          style={{
            background: '#f0f0f0',
            borderRadius: 16,
            margin: '0 4px',
            overflow: 'hidden',
          }}
        >
          {/* Sender label */}
          <div
            style={{
              padding: '8px 12px 4px',
              fontSize: 11,
              fontWeight: 700,
              color: '#666',
              letterSpacing: 0.3,
            }}
          >
            {brand.toUpperCase()}
          </div>

          {/* RCS Card */}
          <div
            style={{
              background: '#fff',
              margin: '0 8px 8px',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            {/* Logo area */}
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt="logo"
                onError={onLogoError}
                style={{ width: '100%', height: 80, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 80,
                  background: logoError
                    ? 'linear-gradient(135deg, #fee2e2, #fecaca)'
                    : 'linear-gradient(135deg, #e8e8f0, #d0d0e8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: logoError ? '#ef4444' : '#999',
                  fontWeight: 500,
                }}
              >
                {logoError ? '⚠ URL invalide' : '[ Logo ]'}
              </div>
            )}

            {/* Card content */}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 6 }}>
                {title}
              </div>

              {mode === 'CLASSIC' ? (
                <>
                  <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, marginBottom: 10 }}>
                    {message}
                  </div>

                  {/* Code display */}
                  <div
                    style={{
                      borderTop: '1px dashed #ddd',
                      borderBottom: '1px dashed #ddd',
                      padding: '8px 4px',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    {fakeCode.split('').map((digit, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: '#111',
                          fontFamily: 'var(--font-mono)',
                          width: 22,
                          textAlign: 'center',
                        }}
                      >
                        {digit}
                      </span>
                    ))}
                  </div>

                  {/* Validate button */}
                  <button
                    style={{
                      width: '100%',
                      background: '#6366f1',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 0',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'default',
                      marginBottom: 4,
                    }}
                  >
                    ✓ Valider la connexion
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>
                    Est-ce vous qui essayez de vous connecter ?
                    <br />
                    Valable {ttlMin} min.
                  </div>

                  {/* 3 digit buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    {['3', '7', '5'].map((d) => (
                      <button
                        key={d}
                        style={{
                          flex: 1,
                          background: '#f0f0f0',
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          padding: '8px 0',
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#333',
                          cursor: 'default',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Report button */}
          <div
            style={{
              padding: '6px 8px 10px',
            }}
          >
            <button
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: '6px 0',
                fontSize: 11,
                color: '#888',
                cursor: 'default',
              }}
            >
              Ce n&apos;est pas moi
            </button>
          </div>
        </div>

        {/* Phone home bar */}
        <div
          style={{
            width: 100,
            height: 4,
            background: '#333',
            borderRadius: 2,
            margin: '10px auto 0',
          }}
        />
      </div>
    </div>
  )
}
