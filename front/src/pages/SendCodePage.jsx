import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CheckoutHeader from '../components/CheckoutHeader'
import './SendCodePage.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

const APP_ID = 'cmq0r7wj100004nqbl2oedsc2'

const order = {
  item: 'Midnight Silk Dress',
  variant: 'Taille: FR 38 | Noir Profond',
  amount: '249,00€',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB-O-0xU14n8rcD_uCyQhzk63Sdj_ab_dzbKyjIWz6R24feDSURtLT-SJyboHPEdmjxVHO3P-VBHqM8XNtCK4uJrecJ7D-Q_UI1FWPAxWB3kY-65uyzLRWrC2cbXw2iO1vEUjFHjb71oHohAma5ypcXupRyvmWfXohS-bY638qoK8i8uSVAT8QkydINcQjRiUqxMtmD6iuwNnV-iyLKAWjUH98FEf0B7JjTdahOJl6XU1prX6QOBKd09FYjof_cSz9Ro390df4DUrZM',
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data.message ??
      data.error ??
      `Erreur API ${response.status} sur ${path}`
    throw new Error(Array.isArray(message) ? message.join(', ') : message)
  }

  return data
}

function SendCodePage() {
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('+33647700234')
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
      const data = await postJson('/otp-sms-mode/generate', {
        phoneNumber: trimmedPhoneNumber,
        appId: APP_ID,
        sessionId: crypto.randomUUID(),
      })

      setRequestState({
        loading: false,
        status: 'success',
        message: `Code envoyé. Statut fournisseur : ${data.status ?? 'accepté'}.`,
      })
      navigate('/verification', {
        state: { phoneNumber: trimmedPhoneNumber, challengeId: data.challengeId },
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
              Pour confirmer cette transaction, envoyez un code de validation
              sur le téléphone du client.
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

          <div className="security-context">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <p>
              Un code RCS/SMS sera envoyé via l'API de démonstration. Les
              informations de carte et de commande affichées ici sont factices.
            </p>
          </div>

          {requestState.message ? (
            <p className={`feedback ${requestState.status}`}>
              {requestState.message}
            </p>
          ) : null}

          <button className="primary-action" type="submit" disabled={!canSend}>
            {requestState.loading ? 'Envoi en cours' : 'Envoyer le code'}
          </button>

          <div className="api-footnote">
            <span>POST</span>
            <code>{API_BASE_URL}/otp-sms-mode/generate</code>
          </div>
        </form>
      </main>
    </div>
  )
}

export default SendCodePage