/** Láminas planas hechas con SVG y tokens del tema. */
export function Piece({
  variant = 0,
  className = "",
}: {
  variant?: number
  className?: string
}) {
  const v = variant % 4
  return (
    <svg
      viewBox="0 0 160 120"
      className={`w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="160" height="120" className="fill-(--kit-tint-strong)" />
      {v === 0 ? (
        <>
          <path d="M0 120 50 40l40 50 30-30 40 60z" className="fill-primary" />
          <circle cx="120" cy="28" r="14" className="fill-foreground" />
        </>
      ) : v === 1 ? (
        <>
          <rect
            x="20"
            y="20"
            width="50"
            height="80"
            rx="25"
            className="fill-primary"
          />
          <rect
            x="85"
            y="40"
            width="55"
            height="60"
            className="fill-foreground"
          />
          <circle cx="112" cy="26" r="9" className="fill-primary" />
        </>
      ) : v === 2 ? (
        <>
          <path d="M45 35h70l-8 70H53z" className="fill-primary" />
          <path
            d="M115 50c20 0 20 30 0 30"
            strokeWidth="8"
            fill="none"
            className="stroke-foreground"
          />
          <ellipse cx="80" cy="35" rx="35" ry="7" className="fill-foreground" />
        </>
      ) : (
        <>
          <circle cx="55" cy="60" r="34" className="fill-foreground" />
          <circle cx="105" cy="60" r="34" className="fill-primary" />
          <path
            d="M80 30a34 34 0 0 1 0 60 34 34 0 0 1 0-60z"
            className="fill-(--kit-tint-strong)"
          />
        </>
      )}
    </svg>
  )
}
