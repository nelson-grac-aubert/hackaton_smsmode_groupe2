import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CheckoutHeader from '../components/CheckoutHeader';

const OTP_LENGTH = 6;
const TIMER_SECONDS = 59;
const MASKED_PHONE = '06 •• •• •• 81';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type Step = 'payment' | 'verification' | 'confirmation';
type ErrorSeverity = 'warning' | 'error' | 'fatal';

interface VerifyError {
  message: string;
  severity: ErrorSeverity;
}

const steps: Step[] = ['payment', 'verification', 'confirmation'];
const stepLabels: Record<Step, string> = {
  payment: 'Paiement',
  verification: 'Vérification',
  confirmation: 'Confirmation',
};

// Maps API error reasons to user-friendly French messages
function parseVerifyError(reason: string, remainingAttempts?: number): VerifyError {
  switch (reason) {
    case 'INVALID_CODE':
      return {
        message: remainingAttempts !== undefined
          ? `Code incorrect — il vous reste ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''}.`
          : 'Code incorrect, veuillez réessayer.',
        severity: 'warning',
      };
    case 'BLOCKED':
      return {
        message: 'Trop de tentatives incorrectes. Veuillez recommencer depuis le début.',
        severity: 'fatal',
      };
    case 'EXPIRED':
      return {
        message: 'Ce code a expiré. Veuillez en demander un nouveau.',
        severity: 'fatal',
      };
    case 'NOT_FOUND':
      return {
        message: 'Session introuvable. Veuillez recommencer depuis le début.',
        severity: 'fatal',
      };
    default:
      return {
        message: 'Une erreur est survenue, veuillez réessayer.',
        severity: 'error',
      };
  }
}

function ProgressStepper({ current }: { current: Step }) {
  return (
    <nav className="stepper" aria-label="Étapes du paiement">
      {steps.map((step) => {
        const idx = steps.indexOf(step);
        const currentIdx = steps.indexOf(current);
        const isDone = idx < currentIdx;
        const isActive = step === current;
        return (
          <div key={step} className={`stepper__item ${isActive ? 'stepper__item--active' : ''} ${isDone ? 'stepper__item--done' : ''}`}>
            <span className="stepper__label">{stepLabels[step]}</span>
            <div className="stepper__line" />
          </div>
        );
      })}
    </nav>
  );
}

function OtpInput({ onChange }: { onChange: (code: string) => void }) {
  const [values, setValues] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusNext = (idx: number) => refs.current[idx + 1]?.focus();
  const focusPrev = (idx: number) => refs.current[idx - 1]?.focus();

  const handleChange = useCallback((idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...values];
    next[idx] = val;
    setValues(next);
    onChange(next.join(''));
    if (val) focusNext(idx);
  }, [values, onChange]);

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !values[idx]) focusPrev(idx);
  }, [values]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((c, i) => (next[i] = c));
    setValues(next);
    onChange(next.join(''));
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }, [onChange]);

  return (
    <div className="otp-grid" onPaste={handlePaste} role="group" aria-label="Code OTP">
      {values.map((val, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          className={`otp-cell ${val ? 'otp-cell--filled' : ''}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          autoFocus={idx === 0}
          aria-label={`Chiffre ${idx + 1}`}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
        />
      ))}
    </div>
  );
}

function CountdownTimer({ onExpire }: { onExpire: () => void }) {
  const [seconds, setSeconds] = useState(TIMER_SECONDS);

  useEffect(() => {
    if (seconds <= 0) { onExpire(); return; }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, onExpire]);

  if (seconds <= 0) return null;
  return (
    <span className="timer">({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')})</span>
  );
}

// Inline error banner with icon and severity-based styling
function ErrorBanner({ verifyError }: { verifyError: VerifyError }) {
  const icons: Record<ErrorSeverity, string> = {
    warning: 'WARNING',
    error: 'ERROR',
    fatal: 'FATAL',
  };
  return (
    <div className={`error-banner error-banner--${verifyError.severity}`} role="alert">
      <span className="error-banner__icon">{icons[verifyError.severity]}</span>
      <span>{verifyError.message}</span>
    </div>
  );
}

function SecurityBadge() {
  return (
    <div className="security">
      <div className="security__row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="security__icon" aria-hidden="true">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        </svg>
        <span className="security__label">Transaction chiffrée<br />de bout en bout</span>
      </div>
    </div>
  );
}

function ConfirmationScreen() {
  return (
    <div className="confirm">
      <div className="confirm__icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1"/>
          <path d="M14 24l7 7 13-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="confirm__title">Commande validée</h2>
      <p className="confirm__body">
        Merci pour votre achat. Votre paiement a bien été accepté et votre commande est en cours de préparation.
      </p>
      <p className="confirm__email">
        Un e-mail de confirmation vous sera envoyé dans quelques instants.
      </p>
    </div>
  );
}

export default function OtpVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // challengeId is passed by SendCodePage after a successful generate
  const state = location.state as { phoneNumber?: string; challengeId?: string } | null;
  const phoneNumber = state?.phoneNumber;
  const challengeId = state?.challengeId;

  const [code, setCode] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [verifyError, setVerifyError] = useState<VerifyError | null>(null);

  // Fatal errors (blocked, expired) disable the submit button
  const isFatal = verifyError?.severity === 'fatal';

  const handleExpire = useCallback(() => setCanResend(true), []);

  const handleResend = () => {
    setCanResend(false);
    setCode('');
    setVerifyError(null);
    navigate('/send-code', { state: { phoneNumber } });
  };

  const handleSubmit = async () => {
    if (code.length < OTP_LENGTH) {
      setVerifyError({ message: 'Veuillez saisir les 6 chiffres.', severity: 'warning' });
      return;
    }
    setVerifyError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/otp-sms-mode/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
        setVerifyError(parseVerifyError(data.reason, data.remainingAttempts));
        return;
      }
      setConfirmed(true);
    } catch {
      setVerifyError({ message: 'Erreur réseau, veuillez réessayer.', severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="page">
        <CheckoutHeader />

        <main className="main">
          <ProgressStepper current={confirmed ? 'confirmation' : 'verification'} />
          {confirmed ? (
            <ConfirmationScreen />
          ) : (
            <>
              <section className="hero">
                <h1 className="hero__title">Vérification de sécurité</h1>
                <p className="hero__body">
                  Un code de confirmation a été envoyé à votre numéro se terminant par{' '}
                  <strong className="hero__phone">{phoneNumber ?? MASKED_PHONE}</strong>.{' '}
                  Veuillez le saisir ci-dessous pour valider votre achat.
                </p>
              </section>

              <div className="card">
                <OtpInput onChange={setCode} />

                {verifyError && <ErrorBanner verifyError={verifyError} />}

                <p className="resend-row">
                  Vous n'avez pas reçu le code ?{' '}
                  <button
                    className={`resend-btn ${canResend ? '' : 'resend-btn--disabled'}`}
                    onClick={canResend ? handleResend : undefined}
                    aria-disabled={!canResend}
                  >
                    Renvoyer
                  </button>{' '}
                  {!canResend && <CountdownTimer onExpire={handleExpire} />}
                </p>

                <button
                  className={`cta ${isSubmitting ? 'cta--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || isFatal}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="cta__spinner-row">
                      <span className="spinner" aria-hidden="true" />
                      Vérification…
                    </span>
                  ) : 'Confirmer le paiement'}
                </button>

                <SecurityBadge />
              </div>
            </>
          )}
        </main>

        <footer className="footer">
          <span className="footer__copy">© 2024 Digital Atelier. All Rights Reserved.</span>
          <nav className="footer__nav" aria-label="Liens légaux">
            <a href="#" className="footer__link">Secure Encryption</a>
            <a href="#" className="footer__link">Privacy Policy</a>
            <a href="#" className="footer__link">Terms of Service</a>
          </nav>
        </footer>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap');

  :root {
    --surface: #fbf9f9;
    --surface-low: #f5f3f3;
    --surface-container: #efeded;
    --surface-high: #e9e8e7;
    --surface-highest: #e3e2e2;
    --surface-white: #ffffff;
    --on-surface: #1b1c1c;
    --on-surface-variant: #444748;
    --outline: #747878;
    --outline-variant: #c4c7c7;
    --primary: #000000;
    --on-primary: #ffffff;
    --secondary: #735c00;
    --error: #ba1a1a;
    --error-bg: #fff1f1;
    --warning: #a05c00;
    --warning-bg: #fff8ee;
    --fatal: #6b0000;
    --fatal-bg: #fff0f0;

    --font-display: 'Playfair Display', Georgia, serif;
    --font-body: 'Inter', system-ui, sans-serif;

    --radius-sm: 0.125rem;
    --radius: 0.25rem;
    --radius-lg: 0.5rem;

    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 32px;
    --space-xl: 64px;
    --margin-mobile: 20px;
    --margin-desktop: 64px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .page {
    min-height: 100dvh;
    background: var(--surface);
    color: var(--on-surface);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--margin-mobile);
    background: var(--surface);
    border-bottom: 1px solid var(--outline-variant);
  }
  .topbar__left { display: flex; align-items: center; gap: 12px; }
  .topbar__back {
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: var(--primary); padding: 4px;
    transition: opacity 0.15s;
  }
  .topbar__back:hover { opacity: 0.6; }
  .topbar__brand {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--primary);
    letter-spacing: -0.01em;
  }

  .main {
    flex: 1;
    padding: var(--space-lg) var(--margin-mobile) var(--space-xl);
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
  }

  .stepper {
    display: flex;
    align-items: flex-end;
    gap: 0;
    margin-bottom: var(--space-lg);
  }
  .stepper__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    opacity: 0.35;
  }
  .stepper__item--done,
  .stepper__item--active { opacity: 1; }
  .stepper__label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
    white-space: nowrap;
  }
  .stepper__item--active .stepper__label { color: var(--primary); }
  .stepper__line { height: 1px; width: 100%; background: var(--outline-variant); }
  .stepper__item--done .stepper__line,
  .stepper__item--active .stepper__line { background: var(--primary); height: 2px; }

  .hero { text-align: center; margin-bottom: var(--space-lg); }
  .hero__title {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 500;
    line-height: 1.25;
    color: var(--primary);
    margin-bottom: var(--space-md);
  }
  .hero__body {
    font-size: 16px;
    color: var(--on-surface-variant);
    line-height: 1.6;
    max-width: 420px;
    margin: 0 auto;
  }
  .hero__phone { color: var(--primary); font-weight: 600; }

  .card {
    background: var(--surface-white);
    border: 1px solid var(--outline-variant);
    border-radius: var(--radius-lg);
    padding: var(--space-lg) var(--space-md);
    box-shadow: 0 10px 30px rgba(26,26,26,0.05);
  }

  .otp-grid {
    display: flex;
    justify-content: center;
    gap: clamp(4px, 2vw, 8px);
    margin-bottom: var(--space-lg);
    padding: 0 4px;
  }
  .otp-cell {
    width: clamp(36px, 12vw, 48px);
    height: clamp(48px, 16vw, 64px);
    text-align: center;
    font-family: var(--font-display);
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 500;
    border: 1px solid var(--outline-variant);
    border-radius: var(--radius);
    background: var(--surface-low);
    color: var(--primary);
    transition: border-color 0.15s, background 0.15s;
    outline: none;
    min-width: 0;
  }
  .otp-cell:focus {
    border-color: var(--primary);
    border-width: 2px;
    background: var(--surface-white);
  }
  .otp-cell--filled { background: var(--surface-white); border-color: var(--primary); }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    margin-bottom: var(--space-md);
    animation: slideDown 0.2s ease both;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .error-banner--warning {
    background: var(--warning-bg);
    color: var(--warning);
    border: 1px solid #f5c97a;
  }
  .error-banner--error {
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid #f5a0a0;
  }
  .error-banner--fatal {
    background: var(--fatal-bg);
    color: var(--fatal);
    border: 1px solid #e08080;
  }
  .error-banner__icon { flex-shrink: 0; font-size: 15px; }

  .resend-row {
    text-align: center;
    font-size: 14px;
    color: var(--on-surface-variant);
    margin-bottom: var(--space-lg);
    line-height: 1.6;
  }
  .resend-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: opacity 0.15s;
  }
  .resend-btn--disabled { opacity: 0.4; cursor: default; text-decoration: none; }
  .timer { color: var(--on-surface-variant); opacity: 0.7; font-size: 13px; }

  .cta {
    width: 100%;
    background: var(--primary);
    color: var(--on-primary);
    border: none;
    border-radius: var(--radius);
    padding: 18px 24px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .cta:hover { opacity: 0.85; }
  .cta:active { transform: scale(0.98); }
  .cta:disabled { opacity: 0.4; cursor: not-allowed; }
  .cta--loading { opacity: 0.7; }

  .security {
    margin-top: var(--space-lg);
    padding-top: var(--space-md);
    border-top: 1px solid var(--outline-variant);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .security__row { display: flex; align-items: center; gap: 6px; }
  .security__icon { color: var(--secondary); flex-shrink: 0; }
  .security__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
  }

  .cta__spinner-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: var(--space-lg);
    animation: fadeUp 0.5s ease both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .confirm__icon { color: var(--primary); margin-bottom: var(--space-lg); }
  .confirm__title {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 500;
    color: var(--primary);
    margin-bottom: var(--space-md);
  }
  .confirm__body {
    font-size: 16px;
    color: var(--on-surface-variant);
    line-height: 1.6;
    max-width: 380px;
    margin-bottom: var(--space-sm);
  }
  .confirm__email {
    font-size: 14px;
    color: var(--on-surface-variant);
    opacity: 0.7;
    margin-bottom: var(--space-xl);
  }

  .footer {
    background: var(--surface-low);
    border-top: 1px solid var(--outline-variant);
    padding: var(--space-lg) var(--margin-mobile);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    text-align: center;
  }
  .footer__copy {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--primary);
  }
  .footer__nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
  .footer__link {
    font-size: 14px;
    color: var(--on-surface-variant);
    text-decoration: none;
    transition: color 0.15s;
  }
  .footer__link:hover { color: var(--primary); }

  @media (min-width: 768px) {
    .topbar { padding: 0 var(--margin-desktop); }
    .topbar__brand { font-size: 28px; }
    .main { padding: var(--space-xl) var(--margin-desktop); }
    .hero__title { font-size: 42px; }
    .otp-cell { width: 64px; height: 80px; font-size: 28px; }
    .otp-grid { gap: 12px; }
    .card { padding: var(--space-xl); }
    .footer {
      flex-direction: row;
      justify-content: space-between;
      padding: var(--space-lg) var(--margin-desktop);
    }
  }
`;