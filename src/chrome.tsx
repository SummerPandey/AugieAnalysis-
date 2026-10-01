/**
 * Institutional page chrome shared by every "real page" — Options, Profile
 * and the MMM workflow — so the app reads as one Augustana product rather
 * than a site with a separate tool bolted on. The full-bleed Landing/Loading
 * moments intentionally skip this chrome.
 *
 * Lives in its own module so both App.tsx and mmm.tsx can import it without
 * an App ↔ mmm import cycle.
 */
import { T } from "./theme"
import { IconArrowLeft, IconFlask } from "./icons"
import { DATA_SOURCES, MODEL_WINDOW, STATUS_AS_OF, STATUS_LABEL, formatStatusDate } from "./projectStatus"

export function AugieMark({ size = 28, boxed = true }: { size?: number; boxed?: boolean }) {
  const shield = (
    <svg width={size * 0.5} height={size * 0.56} viewBox="0 0 24 27" fill="none" aria-hidden>
      <path d="M12 1L2.5 4.6v6.6c0 6.4 4 11.3 9.5 14 5.5-2.7 9.5-7.6 9.5-14V4.6L12 1z" fill={T.gold} />
      <path d="M12 6.5l3.4 3.4-3.4 3.4-3.4-3.4L12 6.5z" fill={T.navy} />
      <rect x="7.8" y="15.8" width="8.4" height="2" rx="1" fill={T.navy} />
    </svg>
  )
  if (!boxed) return shield
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size / 7)),
        background: T.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {shield}
    </div>
  )
}

export function SiteHeader({
  variant,
  name,
  onSignOut,
  onSignIn,
  crumb,
  onBack,
  backLabel = "Back",
  backAriaLabel,
}: {
  variant: "demo" | "signedIn"
  name?: string | null
  onSignOut?: () => void
  /** Demo pages: offer the way into the live tool. */
  onSignIn?: () => void
  /** Current section, shown as a breadcrumb after the brand (e.g. "MMM analysis"). */
  crumb?: string
  onBack?: () => void
  backLabel?: string
  backAriaLabel?: string
}) {
  return (
    <>
      {/* the utility bar scrolls away; only the brand bar stays pinned */}
      <div className="utility-bar">
        <div
          className="container-x"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 32, gap: 16 }}
        >
          <span>Augustana College</span>
          <span className="u-secondary">Marketing &amp; Communications</span>
        </div>
      </div>
      <header className="site-header">
        <div
          className="container-x"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <AugieMark size={32} />
            <div style={{ minWidth: 0 }}>
              <p className="brand-title">
                Augie <em>Analysis</em>
              </p>
              <p className="brand-sub">Marketing Mix Model</p>
            </div>
            {crumb && (
              <span className="brand-crumb" aria-current="page">
                {crumb}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {variant === "demo" && (
              <span className="badge badge-demo hide-md">
                <IconFlask size={12} />
                Demo · sample data
              </span>
            )}
            {variant === "signedIn" && name && (
              <span className="hide-md" style={{ fontSize: 13, color: T.ts, whiteSpace: "nowrap" }}>
                Signed in as <strong style={{ color: T.tp }}>{name}</strong>
              </span>
            )}
            {variant === "signedIn" && onSignOut && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}>
                Sign out
              </button>
            )}
            {onBack && (
              <button type="button" className="btn btn-outline btn-sm" onClick={onBack} aria-label={backAriaLabel ?? backLabel}>
                <IconArrowLeft size={14} />
                <span className="hide-sm">{backLabel}</span>
              </button>
            )}
            {variant === "demo" && onSignIn && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onSignIn}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

/* ── footer helpers ─────────────────────────────────────────── */
/** "2023-01" → "Jan 2023"; falls back to the raw string. */
function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const date = new Date(y, (m || 1) - 1, 1)
  if (!y || Number.isNaN(date.getTime())) return ym
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function SiteFooter() {
  const listItem: React.CSSProperties = { color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }
  const dim: React.CSSProperties = { color: "rgba(255,255,255,0.6)" }
  return (
    <footer className="site-footer">
      <div className="container-x footer-grid">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <AugieMark size={28} />
            <span className="footer-wordmark">
              Augie <em>Analysis</em>
            </span>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 320, color: "rgba(255,255,255,0.7)" }}>
            An internal Marketing Mix Model for Augustana College admissions marketing, built to
            show which channels move weekly applications using Augustana's own Slate, Carnegie
            and billboard data.
          </p>
        </div>
        <div>
          <h2>Project</h2>
          <ul>
            <li style={listItem}>Sponsor: Irene, Marketing &amp; Communications</li>
            <li style={listItem}>Analyst: Summer Pandey, CS &amp; Data Science</li>
            <li style={listItem}>Ridge regression · walk-forward cross-validation</li>
            <li style={listItem}>
              Model window: {formatMonth(MODEL_WINDOW.start)} – {formatMonth(MODEL_WINDOW.end)}
            </li>
          </ul>
        </div>
        <div>
          <h2>Data sources</h2>
          <ul>
            {DATA_SOURCES.map((s) => (
              <li
                key={s.id}
                style={{
                  ...listItem,
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "0 12px",
                }}
              >
                <span>{s.label}</span>
                <span style={{ ...dim, fontSize: 12 }}>
                  <span className="sr-only">Status: </span>
                  {STATUS_LABEL[s.status]}
                  {s.status === "pending" && ` · ${s.owner}`}
                </span>
              </li>
            ))}
          </ul>
          <p style={{ ...dim, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>
            Source status as of {formatStatusDate(STATUS_AS_OF)}.
          </p>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div className="container-x footer-base">
          <span>© {new Date().getFullYear()} Augustana College · Rock Island, Illinois</span>
          <span>Internal tool · not for public distribution</span>
        </div>
      </div>
    </footer>
  )
}
