/**
 * Shared page primitives for the MMM workflow and the results view: badges,
 * alerts, section/step headers, disclosures, step navigation, KPI figures and
 * the chart chrome every Recharts block uses. Split out of mmm.tsx so the
 * workflow shell and results.tsx draw from one set.
 */
import { useState, type CSSProperties, type ReactNode } from "react"
import { T } from "./theme"
import { IconArrowLeft, IconArrowRight, IconChevron, IconError, IconFlask, IconInfo, IconWarning } from "./icons"

/* ── surfaces ──────────────────────────────────────────────── */
export const card: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  overflow: "hidden",
  boxShadow: "0 1px 2px rgba(0,15,55,0.05)",
}

/* ── number + date formatting ──────────────────────────────── */
export function fmt(n: number, dec = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: dec })
}
export const fmtApps = (v: number) => Math.round(v).toLocaleString("en-US")

/** "Jan ’23": month + apostrophe year, so it can't be misread as a day.
 *  Parsed as UTC so a week starting on the 1st doesn't slip a month. */
export function fmtChartDate(d: string) {
  const dt = new Date(d)
  const m = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  const y = dt.toLocaleDateString("en-US", { year: "2-digit", timeZone: "UTC" })
  return `${m} ’${y}`
}
export function fmtWeekOf(d: string) {
  const dt = new Date(d)
  return `Week of ${dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
}
/** "May 25, 2026" for an ISO date. */
export function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}
/** "Sep 30, 2026, 8:04 AM" for a timestamp. */
export function fmtStamp(ms: number) {
  return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

/* ── badges + alerts ───────────────────────────────────────── */
export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode
  variant?: "default" | "success" | "error" | "warning" | "info" | "demo"
}) {
  const cls: Record<string, string> = {
    default: "badge",
    success: "badge badge-success",
    error: "badge badge-error",
    warning: "badge badge-warning",
    info: "badge badge-info",
    demo: "badge badge-demo",
  }
  return <span className={cls[variant]}>{children}</span>
}

export function Alert({
  variant,
  title,
  children,
}: {
  variant: "warning" | "error" | "info" | "demo"
  /** Optional bold lead line: the "what", with children as the "why". */
  title?: string
  children: ReactNode
}) {
  const Icon = { warning: IconWarning, error: IconError, info: IconInfo, demo: IconFlask }[variant]
  return (
    <div role={variant === "error" || variant === "warning" ? "alert" : "status"} className={`alert alert-${variant}`}>
      <Icon size={18} />
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        {children}
      </div>
    </div>
  )
}

/* ── inline help ───────────────────────────────────────────── */
/** Small "?" with a tip. Opens on hover, focus AND tap, so it works on touch. */
export function InfoTooltip({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="hit-44"
        aria-label={`Info: ${tip}`}
        aria-expanded={show}
        onMouseEnter={() => setShow(true)}
        onFocus={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onBlur={() => setShow(false)}
        onClick={() => setShow((s) => !s)}
        onKeyDown={(e) => e.key === "Escape" && setShow(false)}
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: T.blueTint,
          color: T.navy,
          fontSize: 10.5,
          fontWeight: 700,
          border: `1px solid ${T.blueTint2}`,
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: T.tp,
            color: "#fff",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: "normal",
            textTransform: "none",
            padding: "8px 11px",
            borderRadius: 4,
            width: 240,
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

/** Click-to-open "why this step" popover, placed next to a step's heading. */
export function PageInfoButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 8 }}>
      <button
        type="button"
        className="hit-44"
        aria-label={`Why this step: ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: open ? T.navy : T.blueTint,
          color: open ? "#fff" : T.navy,
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          border: `1px solid ${open ? T.navy : T.blueTint2}`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {open && (
        <>
          <div aria-hidden onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
          <div
            role="dialog"
            aria-label={title}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              width: 320,
              maxWidth: "80vw",
              zIndex: 200,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              borderTop: `3px solid ${T.gold}`,
              boxShadow: "var(--shadow-lg)",
              padding: "14px 16px",
              textAlign: "left",
              letterSpacing: "normal",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: T.tp }}>{title}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: T.ts, fontSize: 16, lineHeight: 1, cursor: "pointer", padding: 2 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 400, color: T.ts, lineHeight: 1.65 }}>
              {children}
            </div>
          </div>
        </>
      )}
    </span>
  )
}

/* ── headers ───────────────────────────────────────────────── */
export function SectionHeader({ title, caption, action }: { title: ReactNode; caption?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div style={{ minWidth: 0 }}>
        <h3 className="section-title">{title}</h3>
        {caption && <p className="section-caption">{caption}</p>}
      </div>
      {action}
    </div>
  )
}

/** Page-level header shared by every workflow step: eyebrow, serif title,
 *  plain-language lead, optional actions on the right. */
export function StepHeader({
  eyebrow,
  title,
  lead,
  info,
  actions,
}: {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  info?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="step-head">
      <div className="step-head-main">
        <p className="eyebrow eyebrow-rule">{eyebrow}</p>
        <h2 className="step-title" tabIndex={-1} data-step-title>
          <span>{title}</span>
          {info}
        </h2>
        {lead && <p className="step-lead">{lead}</p>}
      </div>
      {actions && <div className="step-actions no-print">{actions}</div>}
    </div>
  )
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="card disclosure"
      style={{ overflow: "hidden" }}
    >
      <summary className="disclosure-summary">
        <IconChevron open={open} size={14} />
        {summary}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  )
}

/* ── step navigation ───────────────────────────────────────── */
export function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  nextDisabledReason,
  backLabel = "Back",
  children,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextDisabledReason?: string
  backLabel?: string
  children?: ReactNode
}) {
  return (
    <div className="step-footer no-print">
      <div className="step-footer-note">
        {nextDisabled && nextDisabledReason ? (
          <span style={{ color: T.ts }}>{nextDisabledReason}</span>
        ) : (
          children
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <IconArrowLeft size={14} /> {backLabel}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => !nextDisabled && onNext()}
            aria-disabled={nextDisabled || undefined}
          >
            {nextLabel} <span className="arrow"><IconArrowRight size={14} /></span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── KPI figure ────────────────────────────────────────────── */
/** One figure in a KPI strip (`.card.kpi-strip`): equal weight, hairline
 *  dividers, no hover motion. These are figures, not controls. */
export function KpiCard({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  /** "caution" adds a small warning mark beside the label. */
  tone?: "caution"
}) {
  return (
    <div className="kpi">
      <p className="kpi-label">
        {label}
        {tone === "caution" && (
          <span className="kpi-caution" title="Read with care">
            <IconWarning size={12} />
            <span className="sr-only"> (read with care)</span>
          </span>
        )}
      </p>
      <p className="kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  )
}

/* ── chart chrome ──────────────────────────────────────────── */
export function ChartTip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string; stroke?: string; fill?: string }[]
  label?: string | number
  formatter?: (v: number) => string
  labelFormatter?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="viz-tip">
      <p className="viz-tip-title">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      {payload.map((p) => (
        <div key={p.name} className="viz-tip-row">
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: p.stroke || p.color || p.fill, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span className="viz-tip-val">{formatter ? formatter(p.value) : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Axis ticks: 12px secondary ink, readable and ≥4.5:1 on white. */
export const AXIS_TICK = { fontSize: T.axisText, fill: T.ts }
/** Legend: always below, neutral ink text (series colour lives in the key,
 *  not the label, so gold/sky series names stay legible). */
export const LEGEND_PROPS = {
  iconSize: 10,
  wrapperStyle: { fontSize: T.axisText, paddingTop: 14, lineHeight: "20px" },
  formatter: (v: string) => <span style={{ color: T.ts, marginRight: 6 }}>{v}</span>,
} as const
