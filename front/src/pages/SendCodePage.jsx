import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CheckoutHeader from '../components/CheckoutHeader'
import './SendCodePage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

const OTP_APPS = {
  CLASSIC: {
    apiKey: 'sk_OHpif5gj-rz22n5NxjBBf1EiB4bOlmLZ',
  },
  GOOGLE_PROMPT: {
    apiKey: 'sk_7c5iTu-wVY55eOtnayv-8Fyf-hT2Kdj_',
  },
}

const OTP_MODES = {
  CLASSIC: {
    label: 'Code à saisir',
    description: 'Le client reçoit un code à 6 chiffres et le saisit sur la page suivante.',
  },
  GOOGLE_PROMPT: {
    label: 'Prompt à boutons',
    description: 'Le client reçoit 3 boutons et appuie sur le chiffre affiché à l’écran.',
  },
}

const order = {
  item: 'Midnight Silk Dress',
  variant: 'Taille: FR 38 | Noir Profond',
  amount: '249,00€',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB-O-0xU14n8rcD_uCyQhzk63Sdj_ab_dzbKyjIWz6R24feDSURtLT-SJyboHPEdmjxVHO3P-VBHqM8XNtCK4uJrecJ7D-Q_UI1FWPAxWB3kY-65uyzLRWrC2cbXw2iO1vEUjFHjb71oHohAma5ypcXupRyvmWfXohS-bY638qoK8i8uSVAT8QkydINcQjRiUqxMtmD6iuwNnV-iyLKAWjUH98FEf0B7JjTdahOJl6XU1prX6QOBKd09FYjof_cSz9Ro390df4DUrZM',
}

function buildOtpHeaders(app) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': app.apiKey,
  }
}

async function postJson(path, payload, app) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: buildOtpHeaders(app),
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data.message ??
      data.error ??
      `Erreur API ${response.status} sur ${path}`
    const error = new Error(Array.isArray(message) ? message.join(', ') : message)
    error.status = response.status
    throw error
  }

  return data
}

function createSessionId() {
  if (crypto.randomUUID) return `sess_${crypto.randomUUID()}`
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function generateOtp({ mode, phoneNumber }) {
  const sessionId = createSessionId()
  const app = OTP_APPS[mode]
  const challenge = await postJson(
    '/otp/generate',
    { phoneNumber, sessionId },
    app,
  )
  return { ...challenge, ...app, sessionId }
}

function SendCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [phoneNumber, setPhoneNumber] = useState(
    location.state?.phoneNumber ?? '+33647700234',
  )
  const [mode, setMode] = useState('CLASSIC')
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [requestState, setRequestState] = useState({
    loading: false,
    status: 'idle',
    message: '',
  })

  const trimmedPhoneNumber = phoneNumber.trim()
  const canSend = trimmedPhoneNumber.length >= 8 && !requestState.loading

  async function handleSendCode(event) {
    event.preventDefault()
    setRequestState({ loading: true, status: 'idle', message: '' })

    try {
      const challenge = await generateOtp({ mode, phoneNumber: trimmedPhoneNumber })

      setRequestState({
        loading: false,
        status: 'success',
        message: `Challenge créé. Statut : ${challenge.status ?? 'PENDING'}.`,
      })
      navigate('/verification', {
        state: {
          apiKey: challenge.apiKey,
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt,
          mode,
          phoneNumber: trimmedPhoneNumber,
          promptDigit: challenge.promptDigit,
          sessionId: challenge.sessionId,
        },
      })
    } catch (error) {
      setRequestState({
        loading: false,
        status: 'error',
        message: error.message,
      })
    }
  }

  return (
    <div className="send-code-page">
      <CheckoutHeader />

      <main className="send-code-main">
        <nav className="send-stepper" aria-label="Étapes du paiement">
          <div className="send-stepper__item send-stepper__item--done">
            <span className="send-stepper__label">Paiement</span>
            <div className="send-stepper__line" />
          </div>
          <div className="send-stepper__item send-stepper__item--active">
            <span className="send-stepper__label">Vérification</span>
            <div className="send-stepper__line" />
          </div>
          <div className="send-stepper__item">
            <span className="send-stepper__label">Confirmation</span>
            <div className="send-stepper__line" />
          </div>
        </nav>

        <section
          className={`order-summary ${isSummaryOpen ? 'order-summary--open' : ''}`}
        >
          <button
            className="order-summary__trigger"
            type="button"
            onClick={() => setIsSummaryOpen((current) => !current)}
            aria-expanded={isSummaryOpen}
          >
            <span>Résumé de la commande</span>
            <strong>
              {order.amount}
              <span className="material-symbols-outlined expand-icon">
                expand_more
              </span>
            </strong>
          </button>

          <div className="order-summary__content">
            <div className="product-line">
              <img src={order.image} alt={order.item} />
              <div>
                <h2>{order.item}</h2>
                <p>{order.variant}</p>
              </div>
              <strong>{order.amount}</strong>
            </div>
            <div className="summary-row">
              <span>Livraison</span>
              <strong>Offerte</strong>
            </div>
          </div>
        </section>

        <form className="payment-form" onSubmit={handleSendCode}>
          <div>
            <h1>Vérification du paiement</h1>
            <p className="intro-copy">
              Choisissez le type de vérification à déclencher pour la démo, puis
              envoyez le challenge au téléphone du client.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="phoneNumber">Numéro de téléphone</label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+33647700234"
              autoComplete="tel"
            />
          </div>

          <div className="field-group">
            <label>Type d'envoi</label>
            <div className="mode-selector" role="radiogroup">
              {Object.entries(OTP_MODES).map(([value, option]) => (
                <button
                  key={value}
                  type="button"
                  className={`mode-option ${mode === value ? 'mode-option--active' : ''}`}
                  onClick={() => setMode(value)}
                  role="radio"
                  aria-checked={mode === value}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="security-context">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <p>
              Le front utilise la clé API configurée en dur pour le mode
              sélectionné, puis génère le challenge OTP.
            </p>
          </div>

          {requestState.message ? (
            <p className={`feedback ${requestState.status}`}>
              {requestState.message}
            </p>
          ) : null}

          <button className="primary-action" type="submit" disabled={!canSend}>
            {requestState.loading ? 'Envoi en cours' : 'Envoyer le challenge'}
          </button>

          <div className="api-footnote">
            <span>POST</span>
            <code>{API_BASE_URL}/otp/generate</code>
          </div>
        </form>
      </main>
    </div>
  )
}

export default SendCodePage

