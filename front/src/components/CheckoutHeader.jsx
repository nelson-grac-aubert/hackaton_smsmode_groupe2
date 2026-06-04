function BrandLogo() {
  return (
    <svg
      className="brand-logo"
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-label="L'Élégance monogramme"
    >
      <circle cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="0.75" />
      <text
        x="18"
        y="23"
        textAnchor="middle"
        fontFamily="Playfair Display, Georgia, serif"
        fontSize="13"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="1"
      >
        LE
      </text>
    </svg>
  )
}

function CheckoutHeader() {
  return (
    <header className="topbar">
      <div className="topbar__brand-group">
        <BrandLogo />
        <span className="topbar__brand">L'Élégance</span>
      </div>
    </header>
  )
}

export default CheckoutHeader
