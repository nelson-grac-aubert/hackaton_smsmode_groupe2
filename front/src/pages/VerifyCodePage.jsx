function VerifyCodePage({ phoneNumber, onBack }) {
  return (
    <main className="page-placeholder">
      <section>
        <p className="page-placeholder__eyebrow">Etape 2 sur 2</p>
        <h1>Vérification du code</h1>
        <p>
          Le code a été demandé pour <strong>{phoneNumber}</strong>. Cette page
          est prête à recevoir l'écran de vérification de l'équipe.
        </p>
        <button type="button" onClick={onBack}>
          Retour à l'envoi du code
        </button>
      </section>
    </main>
  )
}

export default VerifyCodePage
