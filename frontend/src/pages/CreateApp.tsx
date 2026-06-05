import { useState } from 'react'
import { api } from '../lib/api'
import type { OtpMode } from '../lib/api'
import { saveApp } from '../lib/storage'
import {
  Card,
  Field,
  Input,
  Textarea,
  Btn,
  Toggle,
  CopyRow,
  Alert,
  SectionTitle,
  NumberInput,
} from '../components/ui'
import { RcsPreview } from '../components/RcsPreview'
import { CountryPicker } from '../components/CountryPicker'

interface FormState {
  name: string
  mail: string
  verifyRedirectUrl: string
  otpMode: OtpMode
  ttlSeconds: number
  codeLength: number
  maxAttempts: number
  resendCooldown: number
  oneTapEnabled: boolean
  senderLabel: string
  logoUrl: string
  cardTitle: string
  messageTemplate: string
  allowedCountries: string[]
  rateLimitPhone: number
  rateLimitIp: number
  reportEnabled: boolean
}

const DEFAULTS: FormState = {
  name: '',
  mail: '',
  verifyRedirectUrl: '',
  otpMode: 'CLASSIC',
  ttlSeconds: 300,
  codeLength: 6,
  maxAttempts: 3,
  resendCooldown: 30,
  oneTapEnabled: true,
  senderLabel: 'Verification',
  logoUrl: '',
  cardTitle: 'Code de vérification',
  messageTemplate: 'Votre code {{brand}} est valable {{ttl}} min.',
  allowedCountries: [],
  rateLimitPhone: 5,
  rateLimitIp: 20,
  reportEnabled: true,
}

interface CreatedResult {
  id: string
  name: string
  apiKey: string
  otpMode: OtpMode
}

interface CreateAppProps {
  onTest: (appId: string) => void
}

export function CreateApp({ onTest }: CreateAppProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedResult | null>(null)
  const [logoError, setLogoError] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    if (key === 'logoUrl') setLogoError(false)
  }

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = 'Le nom est requis'
    if (!form.mail.trim() || !form.mail.includes('@')) e.mail = 'Email invalide'
    if (!form.verifyRedirectUrl.trim()) e.verifyRedirectUrl = "L'URL de redirection est requise"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        mail: form.mail,
        verifyRedirectUrl: form.verifyRedirectUrl,
        otpMode: form.otpMode,
        ttlSeconds: form.ttlSeconds,
        codeLength: form.otpMode === 'GOOGLE_PROMPT' ? undefined : form.codeLength,
        maxAttempts: form.maxAttempts,
        resendCooldown: form.resendCooldown,
        oneTapEnabled: form.oneTapEnabled,
        senderLabel: form.senderLabel || undefined,
        logoUrl: form.logoUrl || undefined,
        cardTitle: form.cardTitle || undefined,
        messageTemplate: form.messageTemplate || undefined,
        allowedCountries: form.allowedCountries.length > 0 ? form.allowedCountries : undefined,
        rateLimitPhone: form.rateLimitPhone,
        rateLimitIp: form.rateLimitIp,
        reportEnabled: form.reportEnabled,
      }
      const res = await api.createApp(payload)
      saveApp({
        id: res.id,
        name: res.name,
        apiKey: res.apiKey,
        otpMode: form.otpMode,
        createdAt: new Date().toISOString(),
      })
      setCreated({ ...res, otpMode: form.otpMode })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
            animation: 'successPop 0.4s ease-out',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Application créée !</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
            {created.name} — {created.otpMode === 'GOOGLE_PROMPT' ? 'Google Prompt' : 'Classic'}
          </p>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CopyRow label="ID" value={created.id} mono />
            <CopyRow label="API Key" value={created.apiKey} mono truncate />
          </div>
        </Card>

        <Alert variant="warning">
          <strong>⚠ Attention</strong> — Cette clé API ne sera plus affichée. Copiez-la et
          stockez-la dans un endroit sécurisé.
        </Alert>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Btn variant="primary" onClick={() => onTest(created.id)}>
            Tester cette application
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              setCreated(null)
              setForm(DEFAULTS)
            }}
          >
            Créer une autre application
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 32,
        padding: 32,
        alignItems: 'flex-start',
        maxWidth: 1100,
      }}
    >
      {/* Form */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Créer une application</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            Configurez votre service OTP RCS
          </p>
        </div>

        {/* Identification */}
        <Card>
          <SectionTitle>Identification</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nom de l'application" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="ex : MonApp Auth"
                error={!!errors.name}
              />
            </Field>
            <Field label="Email de contact" required error={errors.mail}>
              <Input
                type="email"
                value={form.mail}
                onChange={(e) => set('mail', e.target.value)}
                placeholder="contact@example.com"
                error={!!errors.mail}
              />
            </Field>
            <Field label="URL de redirection après vérification" required error={errors.verifyRedirectUrl}>
              <Input
                value={form.verifyRedirectUrl}
                onChange={(e) => set('verifyRedirectUrl', e.target.value)}
                placeholder="https://app.example.com/auth/callback"
                error={!!errors.verifyRedirectUrl}
              />
            </Field>
          </div>
        </Card>

        {/* OTP Mode */}
        <Card>
          <SectionTitle>Mode OTP</SectionTitle>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['CLASSIC', 'GOOGLE_PROMPT'] as OtpMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => set('otpMode', mode)}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: `2px solid ${form.otpMode === mode ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.otpMode === mode ? 'var(--accent-dim)' : '#141414',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: form.otpMode === mode ? 'var(--accent)' : 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  {mode === 'CLASSIC' ? '🔢 Classic' : '🔵 Google Prompt'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {mode === 'CLASSIC'
                    ? 'Code à N chiffres affiché en grand, bouton 1-tap'
                    : 'Chiffre unique sur le PC, 3 boutons sur le mobile'}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* OTP Behavior */}
        <Card>
          <SectionTitle>Comportement OTP</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Durée de validité (secondes)" hint="Entre 30 et 900 s">
              <NumberInput value={form.ttlSeconds} onChange={(v) => set('ttlSeconds', v)} min={30} max={900} />
            </Field>
            <Field
              label="Longueur du code"
              hint={form.otpMode === 'GOOGLE_PROMPT' ? 'Fixé à 1 chiffre en mode Google Prompt' : 'Entre 4 et 10'}
            >
              <NumberInput
                value={form.otpMode === 'GOOGLE_PROMPT' ? 1 : form.codeLength}
                onChange={(v) => set('codeLength', v)}
                min={4}
                max={10}
                disabled={form.otpMode === 'GOOGLE_PROMPT'}
              />
            </Field>
            <Field label="Tentatives max">
              <NumberInput value={form.maxAttempts} onChange={(v) => set('maxAttempts', v)} min={1} max={10} />
            </Field>
            <Field
              label="Cooldown renvoi (secondes)"
              hint="Le cooldown est exponentiel : 30s → 60s → 120s…"
            >
              <NumberInput value={form.resendCooldown} onChange={(v) => set('resendCooldown', v)} min={0} />
            </Field>
          </div>
        </Card>

        {/* Branding */}
        <Card>
          <SectionTitle>Branding RCS</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nom expéditeur" hint="Affiché comme marque">
                <Input
                  value={form.senderLabel}
                  onChange={(e) => set('senderLabel', e.target.value)}
                  placeholder="ex : Nike ✓"
                />
              </Field>
              <Field label="Titre de la carte">
                <Input
                  value={form.cardTitle}
                  onChange={(e) => set('cardTitle', e.target.value)}
                  placeholder="Code de vérification"
                />
              </Field>
            </div>
            <Field
              label="URL du logo"
              hint={logoError ? undefined : 'URL publique vers votre logo'}
              error={logoError ? "⚠ L'URL du logo ne charge pas" : undefined}
            >
              <Input
                value={form.logoUrl}
                onChange={(e) => set('logoUrl', e.target.value)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </Field>
            <Field
              label="Template du message"
              hint="Variables disponibles : {{brand}}, {{ttl}}"
            >
              <Textarea
                value={form.messageTemplate}
                onChange={(e) => set('messageTemplate', e.target.value)}
                placeholder="Votre code {{brand}} est valable {{ttl}} min."
                style={{ minHeight: 60 }}
              />
            </Field>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <SectionTitle>Sécurité & anti-fraude</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Rate limit par téléphone (par heure)">
                <NumberInput value={form.rateLimitPhone} onChange={(v) => set('rateLimitPhone', v)} min={1} />
              </Field>
              <Field label="Rate limit par IP (par heure)">
                <NumberInput value={form.rateLimitIp} onChange={(v) => set('rateLimitIp', v)} min={1} />
              </Field>
            </div>
            <Field label="Pays autorisés" hint="Vide = tous les pays autorisés">
              <CountryPicker value={form.allowedCountries} onChange={(v) => set('allowedCountries', v)} />
            </Field>
            <div style={{ display: 'flex', gap: 24 }}>
              <Toggle
                checked={form.oneTapEnabled}
                onChange={(v) => set('oneTapEnabled', v)}
                label="Activer le bouton 1-tap"
              />
              <Toggle
                checked={form.reportEnabled}
                onChange={(v) => set('reportEnabled', v)}
                label={`Activer "Ce n'est pas moi"`}
              />
            </div>
          </div>
        </Card>

        {error && <Alert variant="danger">{error}</Alert>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="md" loading={loading} onClick={() => void handleSubmit()}>
            Créer l&apos;application
          </Btn>
        </div>
      </div>

      {/* Preview panel */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
        }}
      >
        <RcsPreview
          mode={form.otpMode}
          logoUrl={form.logoUrl}
          cardTitle={form.cardTitle}
          messageTemplate={form.messageTemplate}
          senderLabel={form.senderLabel}
          ttlSeconds={form.ttlSeconds}
          codeLength={form.codeLength}
          logoError={logoError}
          onLogoError={() => setLogoError(true)}
        />
      </div>
    </div>
  )
}
