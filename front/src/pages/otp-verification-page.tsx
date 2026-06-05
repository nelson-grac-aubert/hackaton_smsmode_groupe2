import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CheckoutHeader from '../components/CheckoutHeader';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const OTP_LENGTH = 6;
const TIMER_SECONDS = 59;

type OtpMode = 'CLASSIC' | 'GOOGLE_PROMPT';
type Step = 'payment' | 'verification' | 'confirmation';
type ErrorSeverity = 'warning' | 'error' | 'fatal';

type VerifyError = {
  message: string;
  severity: ErrorSeverity;
};

type VerificationState = {
  apiKey?: string;
  challengeId?: string;
  debugCode?: string;
  mode?: OtpMode;
  phoneNumber?: string;
  promptDigit?: number;
};

const steps: Step[] = ['payment', 'verification', 'confirmation'];
const stepLabels: Record<Step, string> = {
  payment: 'Paiement',
  verification: 'Verification',
  confirmation: 'Confirmation',
};

function parseVerifyError(reason: string, remainingAttempts?: number): VerifyError {
  switch (reason) {
    case 'INVALID_CODE':
      return {
        message:
          remainingAttempts !== undefined
            ? `Code incorrect. Il reste ${remainingAttempts} tentative(s).`
            : 'Code incorrect, veuillez reessayer.',
        severity: 'warning',
      };
    case 'BLOCKED':
      return {
        message: 'Trop de tentatives incorrectes. Recommencez depuis le debut.',
        severity: 'fatal',
      };
    case 'EXPIRED':
      return {
        message: 'Ce challenge a expire. Demandez un nouveau code.',
        severity: 'fatal',
      };
    case 'NOT_FOUND':
      return {
        message: 'Challenge introuvable. Recommencez depuis le debut.',
        severity: 'fatal',
      };
    case 'REPORTED':
      return {
        message: "La transaction a ete signalee comme suspecte.",
        severity: 'fatal',
      };
    default:
      return {
        message: 'Une erreur est survenue, veuillez reessayer.',
        severity: 'error',
      };
  }
}

function ProgressStepper({ current }: { current: Step }) {
  return (
    <nav className="stepper" aria-label="Etapes du paiement">
      {steps.map((step) => {
        const idx = steps.indexOf(step);
        const currentIdx = steps.indexOf(current);
        const isDone = idx < currentIdx;
        const isActive = step === current;

        return (
          <div
            key={step}
            className={`stepper__item ${isActive ? 'stepper__item--active' : ''} ${
              isDone ? 'stepper__item--done' : ''
            }`}
          >
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

  const handleChange = useCallback(
    (idx: number, val: string) => {
      if (!/^\d?$/.test(val)) return;
      const next = [...values];
      next[idx] = val;
      setValues(next);
      onChange(next.join(''));
      if (val) refs.current[idx + 1]?.focus();
    },
    [values, onChange],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      const pasted = event.clipboardData
        .getData('text')
        .replace(/\D/g, '')
        .slice(0, OTP_LENGTH);
      const next = Array(OTP_LENGTH).fill('');
      pasted.split('').forEach((char, idx) => {
        next[idx] = char;
      });
      setValues(next);
      onChange(next.join(''));
      refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    },
    [onChange],
  );

  return (
    <div className="otp-grid" onPaste={handlePaste} role="group" aria-label="Code OTP">
      {values.map((val, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          className={`otp-cell ${val ? 'otp-cell--filled' : ''}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          autoFocus={idx === 0}
          aria-label={`Chiffre ${idx + 1}`}
          onChange={(event) => handleChange(idx, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !values[idx]) refs.current[idx - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

function CountdownTimer({ onExpire }: { onExpire: () => void }) {
  const [seconds, setSeconds] = useState(TIMER_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire();
      return;
    }
    const id = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds, onExpire]);

  if (seconds <= 0) return null;
  return (
    <span className="timer">
      ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')})
    </span>
  );
}

function ErrorBanner({ verifyError }: { verifyError: VerifyError }) {
  return (
    <div className={`error-banner error-banner--${verifyError.severity}`} role="alert">
      <span className="error-banner__icon">{verifyError.severity.toUpperCase()}</span>
      <span>{verifyError.message}</span>
    </div>
  );
}

function SecurityBadge() {
  return (
    <div className="security">
      <div className="security__row">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="security__icon"
          aria-hidden="true"
        >
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        <span className="security__label">Transaction chiffree de bout en bout</span>
      </div>
    </div>
  );
}

function ConfirmationScreen() {
  return (
    <div className="confirm">
      <div className="confirm__icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1" />
          <path
            d="M14 24l7 7 13-13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="confirm__title">Commande validee</h2>
      <p className="confirm__body">
        Merci pour votre achat. Le paiement est confirme et la commande est en
        cours de preparation.
      </p>
    </div>
  );
}

export default function OtpVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as VerificationState | null;
  const apiKey = state?.apiKey;
  const challengeId = state?.challengeId;
  const debugCode = state?.debugCode;
  const mode = state?.mode ?? 'CLASSIC';
  const phoneNumber = state?.phoneNumber;
  const promptDigit = state?.promptDigit;

  const [code, setCode] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [verifyError, setVerifyError] = useState<VerifyError | null>(null);

  const isPromptMode = mode === 'GOOGLE_PROMPT';
  const isFatal = verifyError?.severity === 'fatal';
  const handleExpire = useCallback(() => setCanResend(true), []);

  useEffect(() => {
    if (!isPromptMode || !challengeId || !apiKey || confirmed) return;

    const id = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/otp/status/${challengeId}`, {
          headers: { 'x-api-key': apiKey },
        });
        const data = await response.json().catch(() => ({}));
        if (data.status === 'VERIFIED') setConfirmed(true);
        if (['EXPIRED', 'BLOCKED', 'REPORTED'].includes(data.status)) {
          setVerifyError(parseVerifyError(data.status));
        }
      } catch {
        // Best-effort polling only; the demo button still works.
      }
    }, 2000);

    return () => window.clearInterval(id);
  }, [apiKey, challengeId, confirmed, isPromptMode]);

  const handleResend = () => {
    setCanResend(false);
    setCode('');
    setVerifyError(null);
    navigate('/send-code', { state: { phoneNumber } });
  };

  const verifyCode = async (submittedCode: string) => {
    if (!challengeId || !apiKey) {
      setVerifyError({
        message: 'Challenge OTP incomplet. Veuillez recommencer.',
        severity: 'fatal',
      });
      return;
    }

    setVerifyError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ challengeId, code: submittedCode }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.valid) {
        setVerifyError(parseVerifyError(data.reason, data.remainingAttempts));
        return;
      }

      setConfirmed(true);
    } catch {
      setVerifyError({ message: 'Erreur reseau, veuillez reessayer.', severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (code.length < OTP_LENGTH) {
      setVerifyError({ message: 'Veuillez saisir les 6 chiffres.', severity: 'warning' });
      return;
    }
    await verifyCode(code);
  };

  const handlePromptPress = async () => {
    if (promptDigit === undefined) {
      setVerifyError({ message: 'Chiffre de validation introuvable.', severity: 'fatal' });
      return;
    }
    await verifyCode(String(promptDigit));
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
                <h1 className="hero__title">Verification de securite</h1>
                {isPromptMode ? (
                  <p className="hero__body">
                    Un message avec 3 boutons a ete envoye au{' '}
                    <strong className="hero__phone">{phoneNumber ?? 'telephone client'}</strong>.
                    Appuyez sur le chiffre affiche ci-dessous pour valider.
                  </p>
                ) : (
                  <p className="hero__body">
                    Un code de confirmation a ete envoye au{' '}
                    <strong className="hero__phone">{phoneNumber ?? 'telephone client'}</strong>.
                    Veuillez le saisir ci-dessous pour valider votre achat.
                  </p>
                )}
              </section>

              <div className="card">
                {isPromptMode ? (
                  <div className="prompt-card">
                    <span className="prompt-card__label">Chiffre a selectionner</span>
                    <strong className="prompt-card__digit">{promptDigit ?? '-'}</strong>
                    <p>
                      Sur le message RCS recu, choisissez le bouton portant ce
                      chiffre. Le bouton ci-dessous simule cet appui pour la demo.
                    </p>
                  </div>
                ) : (
                  <>
                    <OtpInput onChange={setCode} />
                    {debugCode ? (
                      <div className="demo-code">
                        <span>Mode demo sans provider SMSMode</span>
                        <strong>Code recu : {debugCode}</strong>
                        <button type="button" onClick={() => verifyCode(debugCode)}>
                          Utiliser ce code
                        </button>
                      </div>
                    ) : null}
                  </>
                )}

                {verifyError && <ErrorBanner verifyError={verifyError} />}

                <p className="resend-row">
                  Vous n'avez pas recu le code ?{' '}
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
                  onClick={isPromptMode ? handlePromptPress : handleSubmit}
                  disabled={isSubmitting || isFatal}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="cta__spinner-row">
                      <span className="spinner" aria-hidden="true" />
                      Verification...
                    </span>
                  ) : isPromptMode ? (
                    `J'ai appuye sur ${promptDigit ?? '-'}`
                  ) : (
                    'Confirmer le paiement'
                  )}
                </button>

                <SecurityBadge />
              </div>
            </>
          )}
        </main>

        <footer className="footer">
          <span className="footer__copy">© 2024 Digital Atelier. All Rights Reserved.</span>
          <nav className="footer__nav" aria-label="Liens legaux">
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
    --surface-white: #ffffff;
    --on-surface: #1b1c1c;
    --on-surface-variant: #444748;
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
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 32px;
    --space-xl: 64px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .page {
    min-height: 100dvh;
    background: var(--surface);
    color: var(--on-surface);
    font-family: var(--font-body);
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
    padding: 0 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--outline-variant);
  }
  .topbar__brand-group { display: flex; align-items: center; gap: 8px; }
  .topbar__brand {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--primary);
  }
  .brand-logo { color: var(--primary); flex-shrink: 0; }

  .main {
    flex: 1;
    padding: var(--space-lg) 20px var(--space-xl);
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
  }

  .stepper { display: flex; align-items: flex-end; margin-bottom: var(--space-lg); }
  .stepper__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    opacity: 0.35;
  }
  .stepper__item--done, .stepper__item--active { opacity: 1; }
  .stepper__label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
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
    letter-spacing: 0;
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
    border-radius: 8px;
    padding: var(--space-lg) var(--space-md);
    box-shadow: 0 10px 30px rgba(26, 26, 26, 0.05);
  }

  .otp-grid {
    display: flex;
    justify-content: center;
    gap: clamp(4px, 2vw, 8px);
    margin-bottom: var(--space-lg);
  }
  .otp-cell {
    width: clamp(36px, 12vw, 48px);
    height: clamp(48px, 16vw, 64px);
    text-align: center;
    font-family: var(--font-display);
    font-size: clamp(18px, 5vw, 24px);
    border: 1px solid var(--outline-variant);
    border-radius: 4px;
    background: var(--surface-low);
    color: var(--primary);
    outline: none;
  }
  .otp-cell:focus,
  .otp-cell--filled {
    border-color: var(--primary);
    background: var(--surface-white);
  }

  .prompt-card {
    margin-bottom: var(--space-lg);
    padding: 20px;
    border: 1px solid var(--outline-variant);
    border-radius: 8px;
    display: grid;
    gap: 10px;
    text-align: center;
    background: var(--surface-low);
  }
  .prompt-card__label {
    color: var(--on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .prompt-card__digit {
    font-family: var(--font-display);
    font-size: 84px;
    line-height: 1;
    color: var(--primary);
  }
  .prompt-card p {
    color: var(--on-surface-variant);
    font-size: 14px;
    line-height: 20px;
  }

  .demo-code {
    margin: 0 auto var(--space-lg);
    padding: 14px;
    border: 1px solid var(--outline-variant);
    border-radius: 8px;
    display: grid;
    gap: 8px;
    text-align: center;
    background: var(--surface-low);
  }
  .demo-code span {
    color: var(--on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .demo-code strong {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--primary);
  }
  .demo-code button {
    justify-self: center;
    background: transparent;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .error-banner {
    margin-bottom: var(--space-md);
    border-radius: 4px;
    padding: 12px 14px;
    display: flex;
    gap: 10px;
    font-size: 13px;
    line-height: 20px;
  }
  .error-banner__icon { font-weight: 700; }
  .error-banner--warning { color: var(--warning); background: var(--warning-bg); }
  .error-banner--error { color: var(--error); background: var(--error-bg); }
  .error-banner--fatal { color: var(--fatal); background: var(--fatal-bg); }

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
    font-size: 14px;
    font-weight: 600;
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .resend-btn--disabled { opacity: 0.4; cursor: default; text-decoration: none; }
  .timer { color: var(--on-surface-variant); opacity: 0.7; font-size: 13px; }

  .cta {
    width: 100%;
    background: var(--primary);
    color: var(--on-primary);
    border: none;
    border-radius: 4px;
    padding: 18px 24px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .cta:hover { opacity: 0.85; }
  .cta:disabled { opacity: 0.6; cursor: not-allowed; }
  .cta__spinner-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .security {
    margin-top: var(--space-lg);
    padding-top: var(--space-md);
    border-top: 1px solid var(--outline-variant);
    display: flex;
    justify-content: center;
  }
  .security__row { display: flex; align-items: center; gap: 6px; }
  .security__icon { color: var(--secondary); }
  .security__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
  }

  .confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: var(--space-lg);
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
  }

  .footer {
    background: var(--surface-low);
    border-top: 1px solid var(--outline-variant);
    padding: var(--space-lg) 20px;
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
  .footer__link { font-size: 14px; color: var(--on-surface-variant); text-decoration: none; }

  @media (min-width: 768px) {
    .topbar { padding: 0 64px; }
    .topbar__brand { font-size: 28px; }
    .main { padding: var(--space-xl) 64px; }
    .hero__title { font-size: 42px; }
    .otp-cell { width: 64px; height: 80px; font-size: 28px; }
    .otp-grid { gap: 12px; }
    .card { padding: var(--space-xl); }
    .footer { flex-direction: row; justify-content: space-between; padding: var(--space-lg) 64px; }
  }
`;
