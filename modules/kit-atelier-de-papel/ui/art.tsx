/** Láminas geométricas hechas con SVG y tokens del tema: sin fotos ni archivos externos. */
export function Plate({
  variant = 0,
  className = "",
}: {
  variant?: number
  className?: string
}) {
  const v = variant % 6
  return (
    <svg
      viewBox="0 0 120 150"
      className={`w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="120" height="150" className="fill-muted" />
      {v % 3 === 0 ? (
        <>
          <path
            d="M20 150V70a40 40 0 0 1 80 0v80z"
            className="fill-primary/25"
          />
          <circle cx="60" cy="52" r="14" className="fill-primary" />
        </>
      ) : v % 3 === 1 ? (
        <>
          <rect
            x="22"
            y="30"
            width="76"
            height="96"
            rx="2"
            className="fill-primary/20"
          />
          <path
            d="M22 126 98 30"
            className="stroke-primary"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="86" cy="42" r="8" className="fill-primary/60" />
        </>
      ) : (
        <>
          <circle cx="60" cy="75" r="42" className="fill-primary/20" />
          <path
            d="M18 75h84"
            className="stroke-primary"
            strokeWidth="2"
            fill="none"
          />
          <rect
            x="50"
            y="40"
            width="20"
            height="70"
            className="fill-primary/50"
          />
        </>
      )}
      {v >= 3 ? (
        <path
          d="M0 140h120"
          className="stroke-foreground/30"
          strokeWidth="1"
          fill="none"
        />
      ) : null}
    </svg>
  )
}
