import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { GenerateOtpResponse, OtpStatus } from '../lib/api'
import { getApps } from '../lib/storage'
import { Card, Field, Input, Select, Btn, Badge, Alert, Spinner, CopyRow } from '../components/ui'

interface SendOtpProps {
  initialAppId?: string
}

type BadgeColor = 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'default'

function statusBadgeColor(status: OtpStatus): BadgeColor {
  switch (status) {
    case 'PENDING': return 'info'
    case 'VERIFIED': return 'success'
    case 'EXPIRED': return 'default'
    case 'BLOCKED': return 'danger'
    case 'REPORTED': return 'warning'
  }
}

function statusLabel(status: OtpStatus): string {
  switch (status) {
    case 'PENDING': return 'En attente'
    case 'VERIFIED': return 'Vérifié ✓'
    case 'EXPIRED': return 'Expiré'
    case 'BLOCKED': return 'Bloqué'
    case 'REPORTED': return 'Signalé'
  }
}

function statusMessage(status: OtpStatus): string | null {
  switch (status) {
    case 'EXPIRED': return "Le code a expiré. Envoyez un nouvel OTP."
    case 'BLOCKED': return "Trop de tentatives échouées. Ce challenge est bloqué."
    case 'REPORTED': return "L'utilisateur a signalé ne pas être à l'origine de cette tentative."
    default: return null
  }
}

const TERMINAL_STATUSES: OtpStatus[] = ['VERIFIED', 'EXPIRED', 'BLOCKED', 'REPORTED']

export function SendOtp({ initialAppId }: SendOtpProps) {
  const apps = getApps()

  const initialApp = initialAppId ? apps.find((a) => a.id === initialAppId) : apps[0]
  const [selectedAppId, setSelectedAppId] = useState(initialApp?.id ?? '')
  const [manualApiKey, setManualApiKey] = useState('')
  const [useManual, setUseManual] = useState(apps.length === 0)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [sessionId, setSessionId] = useState('sess_dashboard_001')

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateOtpResponse | null>(null)
  const [currentStatus, setCurrentStatus] = useState<OtpStatus | null>(null)

  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean
    reason?: string
    remainingAttempts?: number
  } | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedApp = apps.find((a) => a.id === selectedAppId)
  const activeApiKey = useManual ? manualApiKey : (selectedApp?.apiKey ?? '')
  const isGooglePrompt = selectedApp?.otpMode === 'GOOGLE_PROMPT'

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const startPolling = (challengeId: string) => {
    stopPolling()
    pollingRef.current = setInterval(() => {
      void api.getStatus(challengeId, activeApiKey).then((res) => {
        setCurrentStatus(res.status)
        if (TERMINAL_STATUSES.includes(res.status)) {
          stopPolling()
        }
      })
    }, 2000)
  }

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      setSendError('Le numéro de téléphone est requis')
      return
    }
    if (!activeApiKey) {
      setSendError("Clé API manquante — sélectionnez une application ou saisissez une clé")
      return
    }
    setSending(true)
    setSendError(null)
    setResult(null)
    setCurrentStatus(null)
    setVerifyResult(null)
    stopPolling()

    try {
      const res = await api.generateOtp({ phoneNumber, sessionId }, activeApiKey)
      setResult(res)
      setCurrentStatus(res.status)
      if (!TERMINAL_STATUSES.includes(res.status)) {
        startPolling(res.challengeId)
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    if (!result) return
    setVerifying(true)
    try {
      const res = await api.verifyOtp({ challengeId: result.challengeId, code: verifyCode }, activeApiKey)
      setVerifyResult(res)
      if (res.valid) {
        setCurrentStatus('VERIFIED')
        stopPolling()
      }
    } catch (err) {
      setVerifyResult({ valid: false, reason: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    stopPolling()
    setResult(null)
    setCurrentStatus(null)
    setVerifyResult(null)
    setVerifyCode('')
    setSendError(null)
    setPhoneNumber('')
  }

  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tester l&apos;envoi OTP</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
          Envoyez un OTP de test et suivez son statut en temps réel
        </p>
      </div>

      {/* App selection */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Application">
            {apps.length > 0 ? (
              <Select
                value={useManual ? '__manual__' : selectedAppId}
                onChange={(e) => {
                  if (e.target.value === '__manual__') {
                    setUseManual(true)
                  } else {
                    setUseManual(false)
                    setSelectedAppId(e.target.value)
                  }
                }}
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} ({app.otpMode})
                  </option>
                ))}
                <option value="__manual__">— Saisir manuellement —</option>
              </Select>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Aucune application — saisissez une clé API manuellement
              </div>
            )}
          </Field>

          {(useManual || apps.length === 0) && (
            <Field label="Clé API manuelle">
              <Input
                value={manualApiKey}
                onChange={(e) => setManualApiKey(e.target.value)}
                placeholder="sk_..."
                type="password"
              />
            </Field>
          )}
        </div>
      </Card>

      {/* Send form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Numéro de téléphone" hint="Format E.164 — ex : +33600000001">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+33600000001"
              disabled={!!result}
            />
          </Field>
          <Field label="Session ID">
            <Input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={!!result}
            />
          </Field>

          {sendError && <Alert variant="danger">{sendError}</Alert>}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              variant="primary"
              loading={sending}
              disabled={!!result}
              onClick={() => void handleSend()}
            >
              Envoyer l&apos;OTP
            </Btn>
            {result && (
              <Btn variant="secondary" onClick={handleReset}>
                Nouvel envoi
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Result */}
      {result && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>Challenge créé</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentStatus && !TERMINAL_STATUSES.includes(currentStatus) && (
                  <Spinner size={16} />
                )}
                {currentStatus && (
                  <Badge color={statusBadgeColor(currentStatus)}>
                    {statusLabel(currentStatus)}
                  </Badge>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CopyRow label="Challenge ID" value={result.challengeId} mono />
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '8px 12px',
                  background: '#141414',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Canal</span>
                <Badge color={result.channel === 'RCS' ? 'accent' : 'info'}>{result.channel}</Badge>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: 12 }}>
                  Expire le {new Date(result.expiresAt).toLocaleString('fr-FR')}
                </span>
              </div>
            </div>

            {/* Google Prompt digit */}
            {result.promptDigit !== undefined && (
              <div
                style={{
                  marginTop: 16,
                  textAlign: 'center',
                  padding: '20px',
                  background: 'var(--accent-dim)',
                  borderRadius: 10,
                  border: '1px solid var(--accent)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>
                  MONTREZ CE CHIFFRE À L&apos;UTILISATEUR
                </div>
                <div
                  style={{
                    fontSize: 96,
                    fontWeight: 900,
                    color: 'var(--accent)',
                    lineHeight: 1,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {result.promptDigit}
                </div>
              </div>
            )}
          </Card>

          {/* Status messages */}
          {currentStatus && statusMessage(currentStatus) && (
            <Alert
              variant={currentStatus === 'EXPIRED' ? 'warning' : currentStatus === 'BLOCKED' ? 'danger' : 'warning'}
            >
              {statusMessage(currentStatus)}
            </Alert>
          )}

          {/* VERIFIED success */}
          {currentStatus === 'VERIFIED' && (
            <div
              style={{
                marginTop: 12,
                padding: 20,
                background: 'var(--success-dim)',
                border: '1px solid var(--success)',
                borderRadius: 10,
                textAlign: 'center',
                animation: 'successPop 0.4s ease-out',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 6 }}>✓</div>
              <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15 }}>
                OTP vérifié avec succès
              </div>
            </div>
          )}

          {/* Manual verify (CLASSIC only) */}
          {!isGooglePrompt && currentStatus === 'PENDING' && (
            <Card style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                Vérification manuelle
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="Code reçu..."
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: 2 }}
                />
                <Btn
                  variant="primary"
                  loading={verifying}
                  onClick={() => void handleVerify()}
                  style={{ flexShrink: 0 }}
                >
                  Vérifier
                </Btn>
              </div>

              {verifyResult && (
                <div style={{ marginTop: 10 }}>
                  <Alert variant={verifyResult.valid ? 'success' : 'danger'}>
                    {verifyResult.valid ? (
                      '✓ Code valide — OTP vérifié'
                    ) : (
                      <>
                        ✗ Code invalide
                        {verifyResult.reason && ` — ${verifyResult.reason}`}
                        {verifyResult.remainingAttempts !== undefined && (
                          <> · {verifyResult.remainingAttempts} tentative{verifyResult.remainingAttempts > 1 ? 's' : ''} restante{verifyResult.remainingAttempts > 1 ? 's' : ''}</>
                        )}
                      </>
                    )}
                  </Alert>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
