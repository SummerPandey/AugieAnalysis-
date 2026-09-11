/**
 * MMM Workflow – full 6-step Marketing Mix Modeling analysis flow.
 * When `authToken` is supplied (the user is signed in), Run Analysis calls
 * the real Augustana MMM backend instead of the simulated generator, and
 * Results renders RealResultsStep with the actual Ridge regression output.
 * Signed-out sessions keep the original simulated demo flow unchanged.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useId,
  memo,
  type ReactNode,
  type CSSProperties,
} from "react"
import { runPipeline, getInsights, type PipelineResult } from "./api"
import {
  ComposedChart,
  BarChart,
  LineChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

/* ── design tokens ─────────────────────────────────────────── */
export const T = {
  navy: "#002F6C",
  navyHover: "#013a87",
  gold: "#FFDD00",
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  tp: "#102A43", // text primary
  ts: "#62748A", // text secondary
  border: "#D9E1EA",
  success: "#276749",
  successBg: "#F0FFF4",
  error: "#9B2C2C",
  errorBg: "#FFF5F5",
  warning: "#7B5E00",
  warningBg: "#FFFBEB",
  infoBg: "#EBF8FF",
  infoBorder: "#BEE3F8",
  ch: ["#002F6C", "#0E7490", "#6B21A8", "#B45309", "#065F46"], // chart channels
} as const

/* ── shared style helpers ───────────────────────────────────── */
const card: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  overflow: "hidden",
}
const lbl: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: T.ts,
}
const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: T.tp,
  marginBottom: 4,
  display: "block",
}
const inputBase: CSSProperties = {
  fontSize: 13,
  padding: "7px 10px",
  borderRadius: 7,
  border: `1px solid ${T.border}`,
  background: T.bg,
  color: T.tp,
  width: "100%",
  outline: "none",
}

/* ── types ──────────────────────────────────────────────────── */
type AnalysisType = "attribution" | "roi" | "saturation" | "budget" | "incrementality"

interface ImportedFile {
  name: string
  size: number
  rows: number
  cols: string[]
  status: "valid" | "warning" | "error"
  warnings: string[]
}

type ColMap = Record<string, string> // requiredField → csvColumn

interface AnalysisConfig {
  lookback?: number
  modelType?: string
  granularity?: string
  baselineMethod?: string
  hillFunction?: string
  totalBudget?: number
  constraintType?: string
  testPeriod?: number
  holdoutPct?: number
  confidenceLevel?: number
  adstock?: string
  priorScale?: number
}

interface ChannelResult {
  channel: string
  spend: number
  contribution: number
  roi: number
  marginalRoi: number
  recSpend: number
  confidence: [number, number]
}

interface WeeklyPoint {
  week: string
  actual: number
  predicted: number
  lower: number
  upper: number
  [ch: string]: number | string
}

interface CurvePoint {
  spendPct: number
  [ch: string]: number
}

interface RunResult {
  analysisType: AnalysisType
  timestamp: number
  isDemo: true
  execSummary: string
  warnings: string[]
  kpi: {
    totalSpend: number
    modeledRevenue: number
    incrementalRevenue: number
    roi: number
    rSquared: number
  }
  channels: ChannelResult[]
  weekly: WeeklyPoint[]
  roiCurves: CurvePoint[]
  satCurves: CurvePoint[]
  modelQuality: {
    rSquared: number
    mape: number
    rmse: number
    trainingPeriod: string
    residualSkew: number
  }
}

interface WorkflowState {
  step: 1 | 2 | 3 | 4 | 5 | 6
  file: ImportedFile | null
  importedSources: Record<string, ImportedFile | null>
  colMap: ColMap
  analysisType: AnalysisType
  config: AnalysisConfig
  defaultConfig: AnalysisConfig
  result: RunResult | null
  lastResult: RunResult | null
  runError: string | null
  isRunning: boolean
  runProgress: number
  runStep: string
  realResult: PipelineResult | null
  realCommentary: string | null
  realCommentaryError: string | null
}

/* ── demo data helpers ──────────────────────────────────────── */
const CHANNEL_NAMES = [
  "Paid Search",
  "Social Media",
  "Display",
  "Email",
  "TV / Video",
]

function fmt(n: number, dec = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: dec })
}
function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function generateResult(
  analysisType: AnalysisType,
  cfg: AnalysisConfig,
): RunResult {
  const lb = cfg.lookback ?? 90
  const seed = lb * 7 + analysisType.charCodeAt(0)
  const rng = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280

  const channels: ChannelResult[] = CHANNEL_NAMES.map((ch, i) => {
    const baseSpend = [812000, 634000, 521000, 198000, 682000][i]
    const baseRoi = [2.1, 1.8, 0.9, 4.2, 0.8][i]
    const jitter = 0.9 + rng(i * 17) * 0.2
    const spend = Math.round(baseSpend * jitter)
    const roi = +(baseRoi * (0.9 + rng(i * 31) * 0.2)).toFixed(2)
    const contribution = [0.31, 0.24, 0.14, 0.18, 0.13][i]
    const mRoi = +(roi * (0.55 + rng(i * 13) * 0.25)).toFixed(2)
    const recSpend = Math.round(
      spend * (roi > 1.5 ? 1.18 : roi > 1 ? 0.97 : 0.78),
    )
    return {
      channel: ch,
      spend,
      contribution,
      roi,
      marginalRoi: mRoi,
      recSpend,
      confidence: [
        +(roi * 0.82).toFixed(2),
        +(roi * 1.18).toFixed(2),
      ] as [number, number],
    }
  })

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0)
  const modeledRevenue = Math.round(
    channels.reduce((s, c) => s + c.spend * c.roi, 0),
  )
  const incrementalRevenue = Math.round(modeledRevenue * 0.47)
  const roi = +(incrementalRevenue / totalSpend).toFixed(2)
  const rSquared = +(0.81 + rng(99) * 0.08).toFixed(3)

  // weekly series – 12 weeks
  const weekly: WeeklyPoint[] = Array.from({ length: 12 }, (_, w) => {
    const base = 680000 + rng(w * 3) * 120000
    const predicted = Math.round(base * (0.97 + rng(w * 7) * 0.06))
    const actual = Math.round(base * (0.94 + rng(w * 11) * 0.12))
    const err = Math.round(predicted * 0.05)
    const pt: WeeklyPoint = {
      week: `W${w + 1}`,
      actual,
      predicted,
      lower: predicted - err,
      upper: predicted + err,
    }
    channels.forEach((ch, i) => {
      pt[ch.channel] = Math.round(
        ch.contribution * predicted * (0.92 + rng(w * i + 5) * 0.16),
      )
    })
    return pt
  })

  // ROI curves – spend index 0→200%
  const roiCurves: CurvePoint[] = Array.from({ length: 21 }, (_, k) => {
    const x = k * 10
    const pt: CurvePoint = { spendPct: x }
    channels.forEach((ch, i) => {
      const decay = 1 - Math.pow(x / 200, 1.5 + rng(i * 7) * 0.5)
      pt[ch.channel] = +Math.max(0, ch.roi * (0.4 + decay * 0.7)).toFixed(2)
    })
    return pt
  })

  // saturation curves
  const satCurves: CurvePoint[] = Array.from({ length: 20 }, (_, k) => {
    const x = (k + 1) * 5
    const pt: CurvePoint = { spendPct: x }
    channels.forEach((ch, i) => {
      const sat = x / 100 / (x / 100 + (0.2 + rng(i * 11) * 0.3))
      pt[ch.channel] = +(sat * 100).toFixed(1)
    })
    return pt
  })

  const analysisLabels: Record<AnalysisType, string> = {
    attribution: "Attribution",
    roi: "ROI Curves",
    saturation: "Saturation",
    budget: "Budget Optimizer",
    incrementality: "Incrementality",
  }
  const topCh = [...channels].sort((a, b) => b.roi - a.roi)[0]
  const underCh = [...channels].sort((a, b) => a.roi - b.roi)[0]

  const warnings: string[] = []
  if (rSquared < 0.85)
    warnings.push(
      "Model R² is below 0.85 — interpret channel-level splits with caution.",
    )
  if (underCh.roi < 1)
    warnings.push(
      `${underCh.channel} shows ROI < 1 (${underCh.roi}×). Consider pausing or reallocating spend.`,
    )

  return {
    analysisType,
    timestamp: Date.now(),
    isDemo: true,
    execSummary: `Your ${analysisLabels[analysisType]} analysis covers ${fmt(totalSpend)} in media spend across ${channels.length} channels and ${lb} days. ${topCh.channel} delivers the highest ROI at ${topCh.roi}× return, while ${underCh.channel} is the least efficient at ${underCh.roi}×. Shifting ~15% of ${underCh.channel} budget toward ${topCh.channel} is projected to improve blended ROI from ${roi}× to approximately ${+(roi * 1.12).toFixed(2)}×.`,
    warnings,
    kpi: { totalSpend, modeledRevenue, incrementalRevenue, roi, rSquared },
    channels,
    weekly,
    roiCurves,
    satCurves,
    modelQuality: {
      rSquared,
      mape: +(6.5 + rng(55) * 4).toFixed(1),
      rmse: Math.round(12000 + rng(77) * 8000),
      trainingPeriod: `${lb}-day window`,
      residualSkew: +(-0.12 + rng(33) * 0.28).toFixed(2),
    },
  }
}

/* ── demo CSV columns ───────────────────────────────────────── */
const DEMO_CSV_COLS = [
  "date",
  "paid_search_spend",
  "social_spend",
  "display_spend",
  "email_spend",
  "tv_spend",
  "revenue",
  "conversions",
  "impressions_total",
]

const REQUIRED_FIELDS = [
  { key: "date", label: "Date", required: true },
  { key: "revenue", label: "Revenue / KPI", required: true },
  { key: "ch_1", label: "Channel 1 Spend", required: true },
  { key: "ch_2", label: "Channel 2 Spend", required: true },
  { key: "ch_3", label: "Channel 3 Spend", required: false },
  { key: "ch_4", label: "Channel 4 Spend", required: false },
  { key: "ch_5", label: "Channel 5 Spend", required: false },
  { key: "conversions", label: "Conversions", required: false },
]

const DEFAULT_COL_MAP: ColMap = {
  date: "date",
  revenue: "revenue",
  ch_1: "paid_search_spend",
  ch_2: "social_spend",
  ch_3: "display_spend",
  ch_4: "email_spend",
  ch_5: "tv_spend",
  conversions: "conversions",
}

/* ── analysis config defaults ───────────────────────────────── */
const DEFAULTS: Record<AnalysisType, AnalysisConfig> = {
  attribution: {
    lookback: 90,
    modelType: "shapley",
    adstock: "geometric",
    priorScale: 0.5,
    confidenceLevel: 90,
  },
  roi: {
    lookback: 90,
    granularity: "weekly",
    baselineMethod: "decomposition",
    adstock: "geometric",
    confidenceLevel: 90,
  },
  saturation: {
    lookback: 180,
    hillFunction: "auto",
    adstock: "geometric",
    confidenceLevel: 90,
  },
  budget: {
    lookback: 90,
    totalBudget: 2850000,
    constraintType: "proportional",
    confidenceLevel: 90,
  },
  incrementality: {
    lookback: 90,
    testPeriod: 14,
    holdoutPct: 10,
    confidenceLevel: 95,
  },
}

/* ── small primitives ───────────────────────────────────────── */
function Divider() {
  return (
    <div
      role="separator"
      style={{ height: 1, background: T.border, margin: "4px 0" }}
    />
  )
}

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode
  variant?: "default" | "success" | "error" | "warning" | "demo"
}) {
  const styles: Record<string, CSSProperties> = {
    default: { background: "#EEF2F8", color: T.tp },
    success: { background: T.successBg, color: T.success },
    error: { background: T.errorBg, color: T.error },
    warning: { background: T.warningBg, color: T.warning },
    demo: {
      background: "#FEF9C3",
      color: "#713F12",
      border: "1px solid #FDE047",
    },
  }
  return (
    <span
      style={{
        ...styles[variant],
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {children}
    </span>
  )
}

function InfoTooltip({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`Info: ${tip}`}
        onMouseEnter={() => setShow(true)}
        onFocus={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onBlur={() => setShow(false)}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#E2E8F0",
          color: T.ts,
          fontSize: 10,
          fontWeight: 700,
          border: "none",
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          outline: "none",
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
            lineHeight: 1.4,
            padding: "7px 10px",
            borderRadius: 7,
            width: 220,
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

/** Click-to-open "why this step" popover, placed next to a step's H2. */
function PageInfoButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 8 }}>
      <button
        type="button"
        aria-label={`Why this step: ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: open ? T.navy : "#EEF2F8",
          color: open ? "#fff" : T.navy,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${open ? T.navy : T.border}`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          outline: "none",
        }}
      >
        ?
      </button>
      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 199 }}
          />
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
              borderRadius: 10,
              boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: T.tp }}>{title}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: T.ts,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, color: T.ts, lineHeight: 1.65 }}>{children}</div>
          </div>
        </>
      )}
    </span>
  )
}

function Alert({
  variant,
  children,
}: {
  variant: "warning" | "error" | "info" | "demo"
  children: ReactNode
}) {
  const styles: Record<string, CSSProperties> = {
    warning: {
      background: T.warningBg,
      borderColor: "#F6E05E",
      color: T.warning,
    },
    error: { background: T.errorBg, borderColor: "#FEB2B2", color: T.error },
    info: { background: T.infoBg, borderColor: T.infoBorder, color: "#2C5282" },
    demo: { background: "#FEF9C3", borderColor: "#FDE047", color: "#713F12" },
  }
  const icons: Record<string, string> = {
    warning: "⚠",
    error: "✕",
    info: "ℹ",
    demo: "★",
  }
  return (
    <div
      role="alert"
      style={{
        ...styles[variant],
        border: `1px solid ${styles[variant].borderColor}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ flexShrink: 0, fontWeight: 700, marginTop: 1 }}>
        {icons[variant]}
      </span>
      <span style={{ lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <p style={lbl}>{title}</p>
      {action}
    </div>
  )
}

function Disclosure({
  summary,
  children,
}: {
  summary: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "10px 14px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          color: T.tp,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          gap: 8,
          listStyle: "none",
          outline: "none",
        }}
      >
        <span style={{ color: T.ts, fontSize: 12 }}>{open ? "▾" : "▸"}</span>
        {summary}
      </summary>
      <div
        style={{
          padding: "12px 14px",
          fontSize: 13,
          color: T.tp,
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </details>
  )
}

function NavBtn({
  children,
  onClick,
  disabled,
  variant = "secondary",
  disabledReason,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "ghost"
  disabledReason?: string
}) {
  const styles: Record<string, CSSProperties> = {
    primary: {
      background: T.navy,
      color: T.gold,
      border: "none",
      fontWeight: 600,
    },
    secondary: {
      background: T.surface,
      color: T.tp,
      border: `1px solid ${T.border}`,
      fontWeight: 500,
    },
    ghost: {
      background: "transparent",
      color: T.ts,
      border: "none",
      fontWeight: 500,
    },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      aria-disabled={disabled}
      style={{
        ...styles[variant],
        fontSize: 13,
        padding: "8px 18px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.1s",
        outline: "none",
      }}
    >
      {children}
    </button>
  )
}

function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  nextDisabledReason,
  children,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextDisabledReason?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 20,
        borderTop: `1px solid ${T.border}`,
        marginTop: 24,
        gap: 12,
      }}
    >
      <div>{children}</div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        {onBack && (
          <NavBtn variant="ghost" onClick={onBack}>
            ← Back
          </NavBtn>
        )}
        {onNext && (
          <NavBtn
            variant="primary"
            onClick={onNext}
            disabled={nextDisabled}
            disabledReason={nextDisabledReason}
          >
            {nextLabel} →
          </NavBtn>
        )}
      </div>
    </div>
  )
}

/* ── chart tooltip ──────────────────────────────────────────── */
function ChartTip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...card,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontSize: 12,
        maxWidth: 220,
      }}
    >
      <p style={{ fontWeight: 600, color: T.tp, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: T.ts, marginBottom: 2 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color,
              marginRight: 6,
            }}
          />
          {p.name}:{" "}
          <span style={{ color: T.tp, fontWeight: 600 }}>
            {formatter ? formatter(p.value) : fmt(p.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

/* ── STEP 1 – Import ────────────────────────────────────────── */
const DEMO_FILE: ImportedFile = {
  name: "augie_analysis_media_data.csv",
  size: 48320,
  rows: 365,
  cols: DEMO_CSV_COLS,
  status: "valid",
  warnings: [],
}

interface ImportCategory {
  id: string
  label: string
  description: string
  columns: string[]
  rows: number
  dateRange: string
  coverage: string
  status: "available" | "pending"
  pendingNote?: string
  color: string
  icon: (color: string) => ReactNode
}

const IMPORT_CATEGORIES: ImportCategory[] = [
  {
    id: "applications",
    label: "Applications",
    description: "Weekly submitted applications from Slate CRM — the outcome the model explains.",
    columns: ["week", "applications"],
    rows: 181,
    dateRange: "Jan 2023 – May 2026",
    coverage: "100% — full history",
    status: "available",
    color: T.navy,
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 13.5V9M6 13.5V5.5M10 13.5V7M14 13.5V2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "spend",
    label: "Channel Spend",
    description: "Monthly media plan by channel from Carnegie (Meta, Snapchat, YouTube, Google PPC/IP, Display).",
    columns: ["Group", "Subgroup", "Strategy", "Campaign", "Status", "Month", "Budget"],
    rows: 61,
    dateRange: "Oct 2024 – Jan 2026",
    coverage: "37% of full range",
    status: "available",
    color: "#B45309",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.2" stroke={c} strokeWidth="1.4" />
        <path d="M8 4.5v7M10 6.3c0-.9-.9-1.6-2-1.6-1.1 0-2 .7-2 1.6s.9 1.4 2 1.6c1.1.2 2 .7 2 1.6s-.9 1.6-2 1.6c-1.1 0-2-.7-2-1.6" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "impressions",
    label: "Impressions",
    description: "Daily ad impressions from Carnegie — used as a spend proxy where channel history is missing.",
    columns: ["day", "Impressions"],
    rows: 951,
    dateRange: "Jan 2023 – Jan 2026",
    coverage: "67% of full range",
    status: "available",
    color: "#0E7490",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="2" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    id: "conversions",
    label: "Tracked Conversions",
    description: "Ad-platform-tracked conversions from Carnegie — reference only, not yet used as a model feature.",
    columns: ["day", "Total Conversions"],
    rows: 31,
    dateRange: "May 2026 only",
    coverage: "Too short to use yet",
    status: "available",
    color: "#065F46",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke={c} strokeWidth="1.3" />
        <circle cx="8" cy="8" r="3" stroke={c} strokeWidth="1.3" />
        <circle cx="8" cy="8" r="0.9" fill={c} />
      </svg>
    ),
  },
  {
    id: "adgroup",
    label: "Ad Group Snapshot",
    description: "Point-in-time performance by strategy/campaign/ad group — supplementary, not a time series.",
    columns: ["Strategy", "Campaign Name", "Ad Group", "Imp.", "Clicks", "CTR"],
    rows: 5,
    dateRange: "Snapshot",
    coverage: "Reference only",
    status: "available",
    color: "#6B21A8",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2l6.5 3.2L8 8.4 1.5 5.2 8 2z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M1.5 8.4L8 11.6l6.5-3.2M1.5 11.6L8 14.8l6.5-3.2" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "billboard",
    label: "Billboards",
    description: "QC Airport + Admissions Surge billboard spend by fiscal period, provided by Lucas.",
    columns: ["start_date", "end_date", "total_spend", "label"],
    rows: 4,
    dateRange: "Jan 2023 – Jun 2026",
    coverage: "100% — full history",
    status: "available",
    color: "#9B2C2C",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="6.5" rx="1" stroke={c} strokeWidth="1.3" />
        <path d="M8 9.5v4.5M5.5 14h5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "email",
    label: "Email Sends",
    description: "Send volume and engagement by campaign — schema ready, waiting on an export from Anthony.",
    columns: ["send_date", "campaign_name", "sends", "opens", "clicks"],
    rows: 0,
    dateRange: "—",
    coverage: "Pending",
    status: "pending",
    pendingNote: "Waiting on Anthony to export send history.",
    color: T.ts,
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.2" stroke={c} strokeWidth="1.3" />
        <path d="M2 4.5l6 5 6-5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "direct_mail",
    label: "Direct Mail",
    description: "Flight dates and spend per mail campaign — schema ready, waiting on Lucas.",
    columns: ["flight_start", "flight_end", "spend", "description"],
    rows: 0,
    dateRange: "—",
    coverage: "Pending",
    status: "pending",
    pendingNote: "Waiting on Lucas for flight dates, not just annual totals.",
    color: T.ts,
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.2" stroke={c} strokeWidth="1.3" />
        <path d="M4 6h5M4 8.5h3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M10 10.5l2 2 2-2" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function ImportCategoryCard({
  category,
  file,
  onChange,
}: {
  category: ImportCategory
  file: ImportedFile | null
  onChange: (f: ImportedFile | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function loadReal() {
    onChange({
      name: `${category.id}.csv`,
      size: Math.max(category.rows, 1) * 64,
      rows: category.rows,
      cols: category.columns,
      status: "valid",
      warnings: [],
    })
  }

  function handleFiles(list: FileList | null) {
    if (!list?.length) return
    const f = list[0]
    onChange({
      name: f.name,
      size: f.size,
      rows: category.rows || Math.floor(f.size / 130),
      cols: category.columns,
      status: "valid",
      warnings: [],
    })
  }

  const iconBadge = (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${category.color}18`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {category.icon(category.color)}
    </div>
  )

  if (category.status === "pending") {
    return (
      <div style={{ ...card, padding: "14px 16px", opacity: 0.55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {iconBadge}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.tp }}>{category.label}</p>
              <p style={{ fontSize: 11, color: T.ts, marginTop: 2, lineHeight: 1.4 }}>
                {category.description}
              </p>
            </div>
          </div>
          <Badge variant="warning">Pending</Badge>
        </div>
        {category.pendingNote && (
          <p style={{ fontSize: 11, color: T.ts, marginTop: 8, fontStyle: "italic" }}>
            {category.pendingNote}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className="hover-lift"
      style={{
        ...card,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderLeft: `3px solid ${category.color}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {iconBadge}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.tp }}>{category.label}</p>
            <p style={{ fontSize: 11, color: T.ts, marginTop: 2, lineHeight: 1.4 }}>
              {category.description}
            </p>
          </div>
        </div>
        {file && (
          <button
            aria-label={`Remove ${category.label}`}
            onClick={() => onChange(null)}
            style={{ background: "none", border: "none", color: T.ts, cursor: "pointer", fontSize: 15, flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>

      {file ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            background: T.bg,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 11, color: T.tp, fontWeight: 500 }}>
            {fmt(file.rows)} rows loaded
          </span>
          <Badge variant="success">✓ Ready</Badge>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload ${category.label} file`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          style={{
            border: `1.5px dashed ${dragOver ? T.navy : T.border}`,
            borderRadius: 8,
            padding: "10px",
            textAlign: "center",
            background: dragOver ? "#EEF2F8" : T.bg,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <p style={{ fontSize: 11, color: T.ts }}>
            Drop CSV or{" "}
            <span style={{ color: T.navy, fontWeight: 600, textDecoration: "underline" }}>
              browse
            </span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            aria-label={`Choose ${category.label} file`}
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={loadReal}
        style={{
          fontSize: 11,
          color: T.navy,
          fontWeight: 600,
          textDecoration: "underline",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {file ? "Reload" : "Use"} Augustana's real data ({fmt(category.rows)} rows, {category.dateRange})
      </button>
    </div>
  )
}

function ImportStep({
  sources,
  onSourcesChange,
  onFileChange,
  onNext,
}: {
  sources: Record<string, ImportedFile | null>
  onSourcesChange: (s: Record<string, ImportedFile | null>) => void
  onFileChange: (f: ImportedFile | null) => void
  onNext: () => void
}) {
  const providedCount = Object.values(sources).filter(Boolean).length
  const canProceed = providedCount > 0

  function setCategory(id: string, f: ImportedFile | null) {
    onSourcesChange({ ...sources, [id]: f })
  }

  function loadAllReal() {
    const next: Record<string, ImportedFile | null> = { ...sources }
    IMPORT_CATEGORIES.filter((c) => c.status === "available").forEach((c) => {
      next[c.id] = {
        name: `${c.id}.csv`,
        size: Math.max(c.rows, 1) * 64,
        rows: c.rows,
        cols: c.columns,
        status: "valid",
        warnings: [],
      }
    })
    onSourcesChange(next)
  }

  function handleContinue() {
    const provided = Object.values(sources).filter(Boolean) as ImportedFile[]
    const totalRows = provided.reduce((s, f) => s + f.rows, 0)
    onFileChange({
      name: `Augustana MMM dataset (${provided.length} source${provided.length === 1 ? "" : "s"})`,
      size: provided.reduce((s, f) => s + f.size, 0),
      rows: totalRows || DEMO_FILE.rows,
      cols: DEMO_CSV_COLS,
      status: "valid",
      warnings: [],
    })
    onNext()
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.tp,
              marginBottom: 4,
            }}
          >
            Import Data
          </h2>
          <PageInfoButton title="Why we import data this way">
            An MMM needs two kinds of history lined up week by week: the
            outcome you're explaining (applications) and the marketing
            activity that might explain it (spend and impressions per
            channel, plus offline efforts like billboards). Augustana's real
            data lives in several separate systems — Slate tracks
            applications, Carnegie tracks digital spend/impressions, Lucas
            tracks billboards, Anthony will track email — so each source is
            imported on its own below instead of forcing everything into one
            spreadsheet. The model only uses weeks where the sources you
            provide actually overlap.
          </PageInfoButton>
        </div>
        <p style={{ fontSize: 13, color: T.ts, lineHeight: 1.5 }}>
          Import each data source separately, matching how Augustana's data
          actually lives across systems. At least one source is required to
          continue.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={loadAllReal}
          style={{
            fontSize: 12,
            color: T.navy,
            fontWeight: 600,
            textDecoration: "underline",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Load all available Augustana data
        </button>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
      >
        {IMPORT_CATEGORIES.map((cat) => (
          <ImportCategoryCard
            key={cat.id}
            category={cat}
            file={sources[cat.id] ?? null}
            onChange={(f) => setCategory(cat.id, f)}
          />
        ))}
      </div>

      {canProceed && (
        <Alert variant="demo">
          <strong>
            {providedCount} source{providedCount === 1 ? "" : "s"} imported.
          </strong>{" "}
          Map Columns through Results below use a simulated demo pipeline to
          illustrate the workflow — sign in to run the real model on
          Augustana's live data instead.
        </Alert>
      )}

      <StepFooter
        onNext={handleContinue}
        nextDisabled={!canProceed}
        nextDisabledReason="Import at least one data source first"
        nextLabel="Map Columns"
      />
    </div>
  )
}

/* ── STEP 2 – Map Columns ───────────────────────────────────── */
function MapStep({
  file,
  colMap,
  onColMapChange,
  onBack,
  onNext,
}: {
  file: ImportedFile
  colMap: ColMap
  onColMapChange: (m: ColMap) => void
  onBack: () => void
  onNext: () => void
}) {
  const requiredMapped = REQUIRED_FIELDS.filter((f) => f.required).every(
    (f) => colMap[f.key] && colMap[f.key] !== "",
  )
  const channelsMapped =
    Object.entries(colMap).filter(([k, v]) => k.startsWith("ch_") && v)
      .length >= 2
  const canProceed = requiredMapped && channelsMapped

  function setField(key: string, val: string) {
    onColMapChange({ ...colMap, [key]: val })
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.tp,
              marginBottom: 4,
            }}
          >
            Map Columns
          </h2>
          <PageInfoButton title="Why column mapping matters">
            Every MMM needs the same skeleton no matter what your source
            file looks like: one date column to build a weekly timeline, one
            outcome/KPI column to explain, and at least two spend columns so
            the regression has something to compare channels against.
            Mapping tells the model which of your file's actual columns play
            each of those roles — get this wrong and the model either can't
            run or attributes results to the wrong channel.
          </PageInfoButton>
        </div>
        <p style={{ fontSize: 13, color: T.ts, lineHeight: 1.5 }}>
          Match your file's columns to the MMM required fields. At least 2 spend
          channels and a revenue column are required.
        </p>
      </div>

      <div style={{ ...card, padding: 0 }}>
        <SectionHeader title="Column mapping" />
        <div style={{ padding: "16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 16px",
            }}
          >
            {REQUIRED_FIELDS.map((f) => {
              const id = `map-${f.key}`
              return (
                <div key={f.key}>
                  <label htmlFor={id} style={fieldLabel}>
                    {f.label}
                    {f.required && (
                      <span
                        style={{ color: T.error, marginLeft: 3 }}
                        aria-label="required"
                      >
                        *
                      </span>
                    )}
                  </label>
                  <select
                    id={id}
                    value={colMap[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    style={{
                      ...inputBase,
                      appearance: "none",
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2362748A' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 10px center",
                      paddingRight: 28,
                    }}
                    aria-required={f.required}
                  >
                    <option value="">— select column —</option>
                    {file.cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!canProceed && (
        <Alert variant="warning">
          Map at least <strong>Date</strong>, <strong>Revenue / KPI</strong>,
          and <strong>2 channel spend columns</strong> to continue.
        </Alert>
      )}

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canProceed}
        nextLabel="Select Analysis"
        nextDisabledReason="Complete required mappings first"
      />
    </div>
  )
}

/* ── STEP 3 – Select Analysis ───────────────────────────────── */
const ANALYSIS_OPTIONS: {
  id: AnalysisType
  label: string
  question: string
  description: string
  requires?: string
  icon: (c: string) => ReactNode
}[] = [
  {
    id: "attribution",
    label: "Attribution",
    question: "Who gets credit?",
    description:
      "Decompose revenue across channels using Shapley or Bayesian attribution, with adstock decay and saturation adjustments.",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="5" r="2.2" stroke={c} strokeWidth="1.4" />
        <path d="M10 7.2V11M10 11L5 15M10 11l5 4" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="5" cy="15.5" r="1.6" stroke={c} strokeWidth="1.4" />
        <circle cx="15" cy="15.5" r="1.6" stroke={c} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    id: "roi",
    label: "ROI Curves",
    question: "What's the return right now?",
    description:
      "Compute marginal and average return on investment per channel at current and alternative spend levels.",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 16.5h15" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M3.5 13l3.5-4.5L10 11l6-8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 3h3v3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "saturation",
    label: "Saturation",
    question: "When does more spend stop helping?",
    description:
      "Fit Hill functions to identify diminishing-returns thresholds and optimal spend ranges per channel.",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 16.5h15M2.5 16.5V2.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M3 15c2-.5 4-2 5.5-4.5S11 5.5 13 4.5s3-1 3.5-1" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "budget",
    label: "Budget Optimizer",
    question: "How should I reallocate?",
    description:
      "Redistribute a fixed total budget across channels to maximise projected revenue, subject to optional channel constraints.",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3v14M4 6h12M4 6l-2 4.5h4L4 6zm12 0l-2 4.5h4L16 6z" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M6 17h8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "incrementality",
    label: "Incrementality",
    question: "Did the spend actually cause it?",
    description:
      "Estimate the true causal lift of media spend using holdout test design or synthetic control.",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="8" r="5.5" stroke={c} strokeWidth="1.4" />
        <path d="M10 5v3.3l2.3 1.3" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 16.5h5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

function AnalysisTile({
  option,
  selected,
  onSelect,
}: {
  option: (typeof ANALYSIS_OPTIONS)[number]
  selected: boolean
  onSelect: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startFlipTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlipped(true), 450)
  }
  function cancelFlip() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setFlipped(false)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const faceBase: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: 12,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden" as const,
  }

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={`${option.label}: ${option.question}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={startFlipTimer}
      onMouseLeave={cancelFlip}
      onFocus={startFlipTimer}
      onBlur={cancelFlip}
      style={{
        position: "relative",
        height: 172,
        perspective: "1200px",
        cursor: "pointer",
        outline: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s cubic-bezier(0.4, 0.15, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* front */}
        <div
          style={{
            ...faceBase,
            background: selected ? "#EEF2F8" : T.surface,
            border: `1.5px solid ${selected ? T.navy : T.border}`,
            boxShadow: selected
              ? "0 4px 14px rgba(0,47,108,0.12)"
              : "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: selected ? T.navy : "#EEF2F8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s ease",
              }}
            >
              {option.icon(selected ? T.gold : T.navy)}
            </div>
            {selected && (
              <span style={{ color: T.navy, fontWeight: 700, fontSize: 15 }}>✓</span>
            )}
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: selected ? T.navy : T.tp, marginTop: 12 }}>
            {option.label}
          </p>
          <p style={{ fontSize: 12, color: T.ts, marginTop: 3, lineHeight: 1.4 }}>
            {option.question}
          </p>
          <p style={{ marginTop: "auto", fontSize: 10, color: T.ts, fontStyle: "italic" }}>
            Hover to learn more →
          </p>
        </div>

        {/* back */}
        <div
          style={{
            ...faceBase,
            background: `linear-gradient(135deg, ${T.navy}, #001e48)`,
            transform: "rotateY(180deg)",
            justifyContent: "center",
            border: selected ? `1.5px solid ${T.gold}` : `1.5px solid ${T.navy}`,
            boxShadow: selected ? "0 0 0 3px rgba(255,221,0,0.2)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{option.label}</p>
            {selected && <span style={{ color: T.gold, fontWeight: 700, fontSize: 15 }}>✓</span>}
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.55 }}>
            {option.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function SelectStep({
  analysisType,
  onSelect,
  onBack,
  onNext,
}: {
  analysisType: AnalysisType
  onSelect: (t: AnalysisType) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.tp,
              marginBottom: 4,
            }}
          >
            Select Analysis
          </h2>
          <PageInfoButton title="Why there are multiple analysis types">
            The same underlying regression can be read in different ways
            depending on the question you're asking. Attribution asks which
            channel gets credit for past results. ROI Curves asks what the
            marginal return looks like right now. Saturation asks when more
            spend on a channel stops helping. Budget Optimizer asks how to
            reallocate a fixed budget across channels. Incrementality asks
            whether spend actually caused a lift, or would it have happened
            anyway. Each option summarizes the same fitted model differently
            — it doesn't re-collect data.
          </PageInfoButton>
        </div>
        <p style={{ fontSize: 13, color: T.ts }}>
          Choose the type of MMM analysis to run — hover a card for a moment
          to see what it does.
        </p>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}
        role="radiogroup"
        aria-label="Analysis type"
      >
        {ANALYSIS_OPTIONS.map((opt) => (
          <AnalysisTile
            key={opt.id}
            option={opt}
            selected={analysisType === opt.id}
            onSelect={() => onSelect(opt.id)}
          />
        ))}
      </div>

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Configure Model" />
    </div>
  )
}

/* ── STEP 4 – Configure ─────────────────────────────────────── */
function FieldRow({
  label,
  tip,
  children,
  id,
}: {
  label: string
  tip: string
  children: ReactNode
  id?: string
}) {
  const gId = useId()
  const fieldId = id ?? gId
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label htmlFor={fieldId} style={fieldLabel}>
          {label}
        </label>
        <InfoTooltip tip={tip} />
      </div>
      {/* Pass the id to the child — works when child is a direct input/select */}
      {children}
    </div>
  )
}

function ConfigureStep({
  analysisType,
  config,
  defaultConfig,
  onConfigChange,
  onReset,
  onBack,
  onNext,
}: {
  analysisType: AnalysisType
  config: AnalysisConfig
  defaultConfig: AnalysisConfig
  onConfigChange: (c: AnalysisConfig) => void
  onReset: () => void
  onBack: () => void
  onNext: () => void
}) {
  function set(key: keyof AnalysisConfig, val: number | string) {
    onConfigChange({ ...config, [key]: val })
  }

  const label =
    ANALYSIS_OPTIONS.find((a) => a.id === analysisType)?.label ?? "Analysis"

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.tp,
              marginBottom: 4,
            }}
          >
            Configure: {label}
          </h2>
          <PageInfoButton title="Why these settings exist">
            These control how the regression is built, not what data goes
            in. Lookback window sets how much history the fit uses. Adstock
            decay models the idea that an ad's effect doesn't vanish the
            moment spend stops — it carries over and fades. Confidence level
            sets how wide the uncertainty bands are around each estimate.
            Attribution method picks the algorithm used to split credit
            across channels. Baseline decomposition separates organic and
            seasonal demand from marketing-driven demand before attributing
            anything to spend — real Augustana data uses trend
            decomposition since seasonality (deadline spikes, summer lulls)
            explains most of the variance.
          </PageInfoButton>
        </div>
        <p style={{ fontSize: 13, color: T.ts }}>
          Adjust model settings below. Hover any{" "}
          <span
            style={{
              fontFamily: "inherit",
              background: "#E2E8F0",
              padding: "0 4px",
              borderRadius: 4,
            }}
          >
            ?
          </span>{" "}
          for a description.
        </p>
      </div>

      <div style={{ ...card, padding: 0 }}>
        <SectionHeader
          title="General settings"
          action={
            <button
              onClick={onReset}
              style={{
                fontSize: 12,
                color: T.navy,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Reset to defaults
            </button>
          }
        />
        <div
          style={{
            padding: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px 20px",
          }}
        >
          <FieldRow
            label="Lookback window (days)"
            tip="Number of days of historical data used to fit the model. Longer windows capture seasonality but may include structural breaks."
          >
            <input
              type="number"
              min={28}
              max={730}
              value={config.lookback ?? defaultConfig.lookback}
              onChange={(e) => set("lookback", parseInt(e.target.value))}
              style={inputBase}
              aria-describedby="lookback-desc"
            />
          </FieldRow>

          <FieldRow
            label="Confidence level (%)"
            tip="Credible interval width for uncertainty estimates. 90% is standard for media planning; 95% is more conservative."
          >
            <select
              value={config.confidenceLevel ?? defaultConfig.confidenceLevel}
              onChange={(e) => set("confidenceLevel", parseInt(e.target.value))}
              style={inputBase}
            >
              <option value={80}>80%</option>
              <option value={90}>90%</option>
              <option value={95}>95%</option>
            </select>
          </FieldRow>

          <FieldRow
            label="Adstock transformation"
            tip="Models how ad exposure decays and carries over time. Geometric decay is standard; Weibull allows flexible peak timing."
          >
            <select
              value={config.adstock ?? defaultConfig.adstock}
              onChange={(e) => set("adstock", e.target.value)}
              style={inputBase}
            >
              <option value="geometric">Geometric decay</option>
              <option value="weibull">Weibull (flexible)</option>
              <option value="none">None</option>
            </select>
          </FieldRow>

          {analysisType === "attribution" && (
            <FieldRow
              label="Attribution method"
              tip="Shapley distributes credit fairly across channels. Last-touch gives full credit to the final touchpoint."
            >
              <select
                value={config.modelType ?? defaultConfig.modelType}
                onChange={(e) => set("modelType", e.target.value)}
                style={inputBase}
              >
                <option value="shapley">Shapley (recommended)</option>
                <option value="linear">Linear</option>
                <option value="last_touch">Last-touch</option>
              </select>
            </FieldRow>
          )}

          {(analysisType === "roi" || analysisType === "attribution") && (
            <FieldRow
              label="Baseline decomposition"
              tip="Method to separate organic baseline revenue from paid media lift. Decomposition uses trend + seasonality; holdout uses a clean test period."
            >
              <select
                value={config.baselineMethod ?? defaultConfig.baselineMethod}
                onChange={(e) => set("baselineMethod", e.target.value)}
                style={inputBase}
              >
                <option value="decomposition">Trend decomposition</option>
                <option value="holdout">Holdout period</option>
              </select>
            </FieldRow>
          )}

          {analysisType === "saturation" && (
            <FieldRow
              label="Hill function parameters"
              tip="Auto estimates the Hill function slope (k) and half-saturation point (EC50) from data. Custom lets you set priors."
            >
              <select
                value={config.hillFunction ?? defaultConfig.hillFunction}
                onChange={(e) => set("hillFunction", e.target.value)}
                style={inputBase}
              >
                <option value="auto">Auto (estimated from data)</option>
                <option value="custom">Custom priors</option>
              </select>
            </FieldRow>
          )}

          {analysisType === "budget" && (
            <>
              <FieldRow
                label="Total budget ($)"
                tip="Total media budget to allocate across channels. The optimizer will find the revenue-maximising split."
              >
                <input
                  type="number"
                  min={10000}
                  step={50000}
                  value={config.totalBudget ?? defaultConfig.totalBudget}
                  onChange={(e) => set("totalBudget", parseInt(e.target.value))}
                  style={inputBase}
                />
              </FieldRow>
              <FieldRow
                label="Budget constraint"
                tip="Unconstrained: optimizer has full freedom. Proportional: channels can shift ±50% of current. Channel min/max: set per-channel floors and ceilings."
              >
                <select
                  value={config.constraintType ?? defaultConfig.constraintType}
                  onChange={(e) => set("constraintType", e.target.value)}
                  style={inputBase}
                >
                  <option value="proportional">Proportional (±50%)</option>
                  <option value="unconstrained">Unconstrained</option>
                </select>
              </FieldRow>
            </>
          )}

          {analysisType === "incrementality" && (
            <>
              <FieldRow
                label="Holdout % of audience"
                tip="Percentage of the target audience withheld from media exposure to form the control group."
              >
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={config.holdoutPct ?? defaultConfig.holdoutPct}
                  onChange={(e) => set("holdoutPct", parseInt(e.target.value))}
                  style={inputBase}
                />
              </FieldRow>
              <FieldRow
                label="Test period (days)"
                tip="Duration of the incrementality test window. Longer periods reduce variance but delay results."
              >
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={config.testPeriod ?? defaultConfig.testPeriod}
                  onChange={(e) => set("testPeriod", parseInt(e.target.value))}
                  style={inputBase}
                />
              </FieldRow>
            </>
          )}
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Run Analysis" />
    </div>
  )
}

/* ── STEP 5 – Run ───────────────────────────────────────────── */
const RUN_STEPS = [
  "Validating data schema",
  "Preprocessing & transforming features",
  "Fitting Bayesian model",
  "Computing channel attribution",
  "Generating insights & recommendations",
]

const REAL_RUN_STEPS = [
  "Fetching live Supabase data",
  "Fitting Ridge regression (auto-tuned)",
  "Running multicollinearity diagnostics",
  "Generating AI commentary",
]

function RunStep({
  analysisType,
  config,
  isRunning,
  progress,
  currentRunStep,
  runError,
  lastResult,
  onBack,
  onRun,
}: {
  analysisType: AnalysisType
  config: AnalysisConfig
  isRunning: boolean
  progress: number
  currentRunStep: string
  runError: string | null
  lastResult: RunResult | null
  onBack: () => void
  onRun: () => void
}) {
  const label =
    ANALYSIS_OPTIONS.find((a) => a.id === analysisType)?.label ?? "Analysis"
  const stepsToShow = RUN_STEPS
  const doneCount = Math.round((progress / 100) * stepsToShow.length)

  return (
    <div
      style={{
        maxWidth: 540,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: T.tp,
            marginBottom: 4,
          }}
        >
          Run Analysis
        </h2>
        <p style={{ fontSize: 13, color: T.ts }}>
          Review the configuration summary below, then run the analysis.
        </p>
      </div>

      <Alert variant="demo">
        Not signed in — this will run on the simulated demo dataset. Sign
        in from the landing page to run the real pipeline instead.
      </Alert>

      {/* config summary */}
      <div style={{ ...card, padding: "14px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 24px",
          }}
        >
          {[
            ["Analysis", label],
            ["Lookback", `${config.lookback ?? 90} days`],
            ["Adstock", config.adstock ?? "geometric"],
            ["Confidence", `${config.confidenceLevel ?? 90}%`],
            ...(config.modelType ? [["Method", config.modelType]] : []),
            ...(config.totalBudget
              ? [["Budget", fmtUSD(config.totalBudget)]]
              : []),
          ].map(([k, v]) => (
            <div key={k}>
              <span style={{ ...lbl, display: "block", marginBottom: 2 }}>
                {k}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.tp }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* progress */}
      {isRunning && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Running: ${currentRunStep}`}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 13, color: T.tp, fontWeight: 500 }}>
                {currentRunStep}
              </span>
              <span style={{ fontSize: 13, color: T.ts }}>{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                height: 6,
                borderRadius: 3,
                background: T.border,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: T.navy,
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stepsToShow.map((step, i) => {
              const done = i < doneCount
              const active = i === doneCount && isRunning
              return (
                <div
                  key={step}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: done ? T.success : active ? T.navy : T.bg,
                      border: `1.5px solid ${
                        done ? T.success : active ? T.navy : T.border
                      }`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 10,
                      color: done || active ? "#fff" : T.ts,
                      transition: "all 0.2s",
                    }}
                  >
                    {done ? "✓" : active ? "…" : ""}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: done ? T.success : active ? T.tp : T.ts,
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* error */}
      {runError && (
        <Alert variant="error">
          <strong>Run failed:</strong> {runError}
          {lastResult && (
            <span style={{ display: "block", marginTop: 4, color: T.ts }}>
              The previous result from{" "}
              {new Date(lastResult.timestamp).toLocaleTimeString()} is still
              available below.
            </span>
          )}
        </Alert>
      )}

      <StepFooter
        onBack={isRunning ? undefined : onBack}
        onNext={isRunning ? undefined : onRun}
        nextLabel="Run Analysis"
        nextDisabled={isRunning}
        nextDisabledReason="Analysis is already running"
      />
    </div>
  )
}

/* ── Signed-in run screen — no wizard, one button ─────────────── */
function RealRunStep({
  isRunning,
  progress,
  currentRunStep,
  runError,
  onRun,
  onBack,
}: {
  isRunning: boolean
  progress: number
  currentRunStep: string
  runError: string | null
  onRun: () => void
  onBack: () => void
}) {
  const doneCount = Math.round((progress / 100) * REAL_RUN_STEPS.length)

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "60px auto 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: T.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,47,108,0.25)",
        }}
      >
        <svg width="26" height="29" viewBox="0 0 24 27" fill="none">
          <path
            d="M12 1L2.5 4.6v6.6c0 6.4 4 11.3 9.5 14 5.5-2.7 9.5-7.6 9.5-14V4.6L12 1z"
            fill={T.gold}
          />
          <path d="M12 6.5l3.4 3.4-3.4 3.4-3.4-3.4L12 6.5z" fill={T.navy} />
          <rect x="7.8" y="15.8" width="8.4" height="2" rx="1" fill={T.navy} />
        </svg>
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.tp, marginBottom: 6 }}>
          Run Your Marketing Analysis
        </h2>
        <p style={{ fontSize: 13, color: T.ts, lineHeight: 1.6 }}>
          This runs the real model against Augustana's current application and
          spend data. It takes about ten seconds — no setup needed.
        </p>
      </div>

      {isRunning && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Running: ${currentRunStep}`}
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ height: 6, borderRadius: 3, background: T.border, overflow: "hidden" }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: T.navy,
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
            {REAL_RUN_STEPS.map((s, i) => {
              const done = i < doneCount
              const active = i === doneCount
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: done ? T.success : active ? T.navy : T.bg,
                      border: `1.5px solid ${done ? T.success : active ? T.navy : T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 9,
                      color: done || active ? "#fff" : T.ts,
                    }}
                  >
                    {done ? "✓" : active ? "…" : ""}
                  </div>
                  <span style={{ fontSize: 12, color: done ? T.success : active ? T.tp : T.ts }}>
                    {s}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {runError && (
        <Alert variant="error">
          <strong>Something went wrong:</strong> {runError}
        </Alert>
      )}

      {!isRunning && (
        <button
          onClick={onRun}
          className="hover-lift"
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 10,
            background: T.navy,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,47,108,0.25)",
          }}
        >
          Run Analysis
        </button>
      )}

      <button
        onClick={onBack}
        style={{
          fontSize: 13,
          color: T.ts,
          background: "none",
          border: "none",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        ← Back to analysis selection
      </button>
    </div>
  )
}

/* ── STEP 6 – Results ───────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  highlight,
  icon,
  delay = 0,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  icon?: ReactNode
  delay?: number
}) {
  return (
    <div
      className="hover-lift animate-pop-in"
      style={{
        ...card,
        padding: "16px",
        position: "relative",
        overflow: "hidden",
        animationDelay: `${delay}ms`,
      }}
    >
      {highlight && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${T.navy}, ${T.gold})`,
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <p style={{ ...lbl, marginBottom: 8 }}>{label}</p>
        {icon && (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "#EEF2F8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: T.tp, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: T.ts, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

const CHART_COLORS = T.ch

function ChannelContributionChart({ result }: { result: RunResult }) {
  const data = result.weekly.map((w) => {
    const pt: Record<string, string | number> = { week: w.week }
    result.channels.forEach((ch) => {
      pt[ch.channel] = (w[ch.channel] as number)
    })
    return pt
  })

  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Channel contribution (weekly)" />
      <div style={{ padding: "16px" }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v) => fmtUSD(v)}
            />
            <RTooltip
              content={<ChartTip formatter={fmtUSD} />}
              cursor={{ fill: "rgba(0,47,108,0.04)" }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: T.ts, paddingTop: 8 }}
            />
            {result.channels.map((ch, i) => (
              <Bar
                key={ch.channel}
                dataKey={ch.channel}
                stackId="a"
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={
                  i === result.channels.length - 1 ? [3, 3, 0, 0] : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ActualVsPredictedChart({ result }: { result: RunResult }) {
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Actual vs. predicted revenue" />
      <div style={{ padding: "16px" }}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={result.weekly}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v) => fmtUSD(v)}
            />
            <RTooltip content={<ChartTip formatter={fmtUSD} />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: T.ts, paddingTop: 8 }}
            />
            <Area
              dataKey="upper"
              stroke="none"
              fill={T.navy}
              fillOpacity={0.07}
              name="Confidence band"
              legendType="none"
            />
            <Area
              dataKey="lower"
              stroke="none"
              fill={T.surface}
              fillOpacity={1}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke={T.navy}
              strokeWidth={2}
              dot={false}
              name="Predicted"
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#9B2C2C"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              name="Actual"
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ROICurvesChart({ result }: { result: RunResult }) {
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="ROI curves by channel" />
      <div style={{ padding: "16px" }}>
        <p style={{ fontSize: 12, color: T.ts, marginBottom: 12 }}>
          X-axis: spend index (100 = current). Y-axis: marginal ROI at that
          spend level.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={result.roiCurves}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              vertical={false}
            />
            <XAxis
              dataKey="spendPct"
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => `${v}×`}
            />
            <ReferenceLine
              y={1}
              stroke={T.warning}
              strokeDasharray="4 3"
              label={{
                value: "Breakeven",
                position: "right",
                fontSize: 10,
                fill: T.warning,
              }}
            />
            <RTooltip
              content={<ChartTip formatter={(v) => `${v.toFixed(2)}×`} />}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: T.ts, paddingTop: 8 }}
            />
            {result.channels.map((ch, i) => (
              <Line
                key={ch.channel}
                type="monotone"
                dataKey={ch.channel}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={1.8}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SaturationChart({ result }: { result: RunResult }) {
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Saturation curves" />
      <div style={{ padding: "16px" }}>
        <p style={{ fontSize: 12, color: T.ts, marginBottom: 12 }}>
          Response (% of ceiling) vs. impression index. Flattening curves
          indicate diminishing returns.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={result.satCurves}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              vertical={false}
            />
            <XAxis
              dataKey="spendPct"
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => `${v}%`}
            />
            <RTooltip
              content={<ChartTip formatter={(v) => `${v.toFixed(1)}%`} />}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: T.ts, paddingTop: 8 }}
            />
            {result.channels.map((ch, i) => (
              <Line
                key={ch.channel}
                type="monotone"
                dataKey={ch.channel}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={1.8}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BudgetTable({ channels }: { channels: ChannelResult[] }) {
  const totalCurrent = channels.reduce((s, c) => s + c.spend, 0)
  const totalRec = channels.reduce((s, c) => s + c.recSpend, 0)

  function exportCSV() {
    const rows = [
      [
        "Channel",
        "Current Spend",
        "Recommended Spend",
        "Difference",
        "ROI",
        "Marginal ROI",
        "95% CI Low",
        "95% CI High",
      ],
      ...channels.map((c) => [
        c.channel,
        c.spend,
        c.recSpend,
        c.recSpend - c.spend,
        c.roi,
        c.marginalRoi,
        c.confidence[0],
        c.confidence[1],
      ]),
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "mmm_budget_recommendations.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader
        title="Budget recommendations"
        action={
          <button
            onClick={exportCSV}
            style={{
              fontSize: 12,
              color: T.navy,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            ↓ Export CSV
          </button>
        }
      />
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          aria-label="Budget recommendations"
        >
          <thead>
            <tr style={{ background: T.bg }}>
              {[
                "Channel",
                "Current Spend",
                "Rec. Spend",
                "Difference",
                "ROI",
                "Marginal ROI",
                "Confidence",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    padding: "9px 14px",
                    textAlign: h === "Channel" ? "left" : "right",
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.ts,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${T.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((ch, i) => {
              const diff = ch.recSpend - ch.spend
              return (
                <tr
                  key={ch.channel}
                  style={{
                    borderBottom: `1px solid ${T.border}`,
                    background: i % 2 === 0 ? T.surface : T.bg,
                  }}
                >
                  <td
                    style={{
                      padding: "10px 14px",
                      fontWeight: 500,
                      color: T.tp,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        marginRight: 8,
                      }}
                    />
                    {ch.channel}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      color: T.tp,
                    }}
                  >
                    {fmtUSD(ch.spend)}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: T.tp,
                    }}
                  >
                    {fmtUSD(ch.recSpend)}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: diff >= 0 ? T.success : T.error,
                    }}
                  >
                    {diff >= 0 ? "+" : ""}
                    {fmtUSD(diff)}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      color:
                        ch.roi >= 1.5 ? T.success : ch.roi < 1 ? T.error : T.tp,
                    }}
                  >
                    {ch.roi}×
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      color: T.ts,
                    }}
                  >
                    {ch.marginalRoi}×
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      color: T.ts,
                      fontSize: 12,
                    }}
                  >
                    [{ch.confidence[0]}×, {ch.confidence[1]}×]
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#EEF2F8", fontWeight: 600 }}>
              <td style={{ padding: "10px 14px", color: T.tp }}>Total</td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "right",
                  color: T.tp,
                }}
              >
                {fmtUSD(totalCurrent)}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "right",
                  color: T.tp,
                }}
              >
                {fmtUSD(totalRec)}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "right",
                  color: totalRec - totalCurrent >= 0 ? T.success : T.error,
                }}
              >
                {totalRec - totalCurrent >= 0 ? "+" : ""}
                {fmtUSD(totalRec - totalCurrent)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function ModelQuality({ q }: { q: RunResult["modelQuality"] }) {
  const metrics = [
    {
      label: "R² (fit quality)",
      value: q.rSquared.toFixed(3),
      good: q.rSquared >= 0.85,
      note: q.rSquared < 0.85 ? "Below 0.85 — use with caution" : "Good fit",
    },
    {
      label: "MAPE",
      value: `${q.mape}%`,
      good: q.mape <= 10,
      note: q.mape > 10 ? "Above 10% — moderate error" : "Acceptable",
    },
    {
      label: "RMSE",
      value: fmtUSD(q.rmse),
      good: true,
      note: "Root mean squared error",
    },
    {
      label: "Residual skew",
      value: q.residualSkew.toFixed(2),
      good: Math.abs(q.residualSkew) < 0.2,
      note: "Should be near 0",
    },
    { label: "Training period", value: q.trainingPeriod, good: true, note: "" },
  ]

  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Model quality" />
      <div
        style={{
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {metrics.map((m) => (
          <div key={m.label}>
            <p style={lbl}>{m.label}</p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: m.good ? T.tp : T.warning,
                marginTop: 4,
              }}
            >
              {m.value}
            </p>
            {m.note && (
              <p
                style={{
                  fontSize: 11,
                  color: m.good ? T.ts : T.warning,
                  marginTop: 2,
                }}
              >
                {m.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsStep({
  result,
  onBack,
  onNewRun,
}: {
  result: RunResult
  onBack: () => void
  onNewRun: () => void
}) {
  const analysisLabel =
    ANALYSIS_OPTIONS.find((a) => a.id === result.analysisType)?.label ?? ""

  function exportFullCSV() {
    const rows = [
      [
        "Week",
        "Actual Revenue",
        "Predicted Revenue",
        ...result.channels.map((c) => `${c.channel} Contribution`),
      ],
      ...result.weekly.map((w) => [
        w.week,
        w.actual,
        w.predicted,
        ...result.channels.map((c) => w[c.channel] as number),
      ]),
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mmm_results_${result.analysisType}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.tp }}>
              Results: {analysisLabel}
            </h2>
            <Badge variant="demo">★ Demo data</Badge>
          </div>
          <p style={{ fontSize: 12, color: T.ts }}>
            {new Date(result.timestamp).toLocaleString()} · Simulated results —
            connect a real backend for production use.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <NavBtn variant="secondary" onClick={exportFullCSV}>
            ↓ CSV
          </NavBtn>
          <NavBtn variant="secondary" onClick={() => window.print()}>
            ↓ Print / PDF
          </NavBtn>
          <NavBtn variant="primary" onClick={onNewRun}>
            New Run
          </NavBtn>
        </div>
      </div>

      {/* warnings */}
      {result.warnings.map((w, i) => (
        <Alert key={i} variant="warning">
          {w}
        </Alert>
      ))}

      {/* executive summary */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <p style={{ ...lbl, marginBottom: 8 }}>Executive summary</p>
        <p style={{ fontSize: 14, color: T.tp, lineHeight: 1.7 }}>
          {result.execSummary}
        </p>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="Total Spend"
          value={fmtUSD(result.kpi.totalSpend)}
          highlight
          delay={0}
        />
        <KpiCard
          label="Modeled Revenue"
          value={fmtUSD(result.kpi.modeledRevenue)}
          sub={`${(result.kpi.modeledRevenue / result.kpi.totalSpend).toFixed(1)}× revenue/spend`}
          delay={50}
        />
        <KpiCard
          label="Incremental Revenue"
          value={fmtUSD(result.kpi.incrementalRevenue)}
          sub="Above organic baseline"
          delay={100}
        />
        <KpiCard
          label="Blended ROI"
          value={`${result.kpi.roi}×`}
          sub="Incremental / total spend"
          delay={150}
        />
        <KpiCard
          label="Model R²"
          value={result.kpi.rSquared.toFixed(3)}
          sub={result.kpi.rSquared >= 0.85 ? "Good fit" : "Below target"}
          delay={200}
        />
      </div>

      {/* charts */}
      <ChannelContributionChart result={result} />
      <ActualVsPredictedChart result={result} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <ROICurvesChart result={result} />
        <SaturationChart result={result} />
      </div>

      {/* budget table */}
      <BudgetTable channels={result.channels} />

      {/* model quality */}
      <ModelQuality q={result.modelQuality} />

      {/* how calculated */}
      <Disclosure summary="How this was calculated">
        <p>
          <strong>Attribution</strong> is computed using a Bayesian time-series
          decomposition that separates baseline (organic + seasonality) revenue
          from media-driven incremental revenue. Adstock transformations model
          carry-over effects; Hill functions model diminishing returns.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>ROI</strong> = incremental revenue attributed to each channel
          ÷ channel spend. Marginal ROI represents the return on the{" "}
          <em>last dollar</em> spent in that channel.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Budget optimisation</strong> maximises total projected revenue
          subject to the selected constraints by gradient descent on the fitted
          response functions.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Confidence intervals</strong> are posterior credible intervals
          from the Bayesian model at the selected confidence level.
        </p>
        <p
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: T.warningBg,
            borderRadius: 6,
            color: T.warning,
          }}
        >
          ⚠ These results are <strong>simulated demo data</strong>. They are
          intended to illustrate the workflow and output format. Real results
          require connecting actual media spend and revenue data and running the
          backend model.
        </p>
      </Disclosure>

      {/* footer nav */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-start",
          paddingTop: 8,
        }}
      >
        <NavBtn variant="ghost" onClick={onBack}>
          ← Configure
        </NavBtn>
      </div>
    </div>
  )
}

/* ── STEP 6 (real) – Results from the actual backend ──────────── */
function CoefficientBar({ name, value, max }: { name: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0
  const positive = value >= 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
      <span style={{ width: 190, flexShrink: 0, color: T.tp, fontFamily: "monospace" }}>
        {name}
      </span>
      <div style={{ flex: 1, height: 14, background: T.bg, borderRadius: 3, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: positive ? "50%" : undefined,
            right: positive ? undefined : "50%",
            width: `${pct / 2}%`,
            background: positive ? T.success : T.error,
            borderRadius: 3,
          }}
        />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: T.border }} />
      </div>
      <span style={{ width: 64, flexShrink: 0, textAlign: "right", color: T.ts, fontFamily: "monospace" }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}

const REAL_CHART_PALETTE = [
  T.navy, "#0E7490", "#6B21A8", "#B45309", "#065F46", "#9B2C2C", T.gold, "#4C51BF",
]

function fmtChartDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

const CHANNEL_LABELS: Record<string, string> = {
  google_ppc_spend: "Google PPC",
  google_ip_spend: "Google IP Targeting",
}

function humanizeChannel(key: string) {
  if (key === "baseline") return "Baseline/Seasonality"
  if (key === "impressions") return "Impressions"
  if (CHANNEL_LABELS[key]) return CHANNEL_LABELS[key]
  return key.replace("_spend", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function RealActualVsPredictedChart({ weekly }: { weekly: PipelineResult["weekly"] }) {
  const tickInterval = Math.max(0, Math.floor(weekly.length / 8))
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Actual vs. modeled applications (weekly)" />
      <div style={{ padding: "16px" }}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weekly} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtChartDate}
              interval={tickInterval}
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: T.ts }} axisLine={false} tickLine={false} width={40} />
            <RTooltip
              labelFormatter={(v) => fmtChartDate(String(v))}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${T.border}` }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke={T.navy} strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Model fit"
              stroke={T.gold}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RealChannelContributionChart({
  data,
  seriesKeys,
}: {
  data: PipelineResult["channel_contribution_weekly"]
  seriesKeys: string[]
}) {
  const tickInterval = Math.max(0, Math.floor(data.length / 8))
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader title="Channel contribution over time" />
      <div style={{ padding: "16px" }}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtChartDate}
              interval={tickInterval}
              tick={{ fontSize: 11, fill: T.ts }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: T.ts }} axisLine={false} tickLine={false} width={40} />
            <RTooltip
              labelFormatter={(v) => fmtChartDate(String(v))}
              formatter={(v, name) => [Math.round(Number(v)), String(name)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${T.border}` }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={humanizeChannel} />
            <ReferenceLine y={0} stroke={T.ts} strokeWidth={1} />
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={humanizeChannel(key)}
                stackId="contrib"
                stroke={REAL_CHART_PALETTE[i % REAL_CHART_PALETTE.length]}
                fill={REAL_CHART_PALETTE[i % REAL_CHART_PALETTE.length]}
                fillOpacity={0.75}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Inline **bold** support — the one inline construct the AI prompt uses. */
function renderInline(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  )
}

/**
 * Minimal Markdown → JSX renderer scoped to exactly what the AI insights
 * system prompt asks the model to produce: #/##/### headers, **bold**, ---
 * rules, | table | rows |, numbered/bulleted lists, and paragraphs. This is
 * deliberately not a general Markdown renderer — the input is one
 * controlled AI output format, not arbitrary user content, so a small
 * hand-written parser beats pulling in a full remark/unified dependency
 * chain for it.
 */
function renderMarkdown(text: string): ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  const isHeader = (l: string) => /^#{1,4}\s+/.test(l)
  const isRule = (l: string) => /^-{3,}$/.test(l.trim())
  const isTableRow = (l: string) => l.trim().startsWith("|")
  const isListItem = (l: string) => /^\s*([-*]|\d+\.)\s+/.test(l)

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    if (isRule(line)) {
      blocks.push(
        <hr key={key++} style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />,
      )
      i++
      continue
    }

    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes: Record<number, number> = { 1: 17, 2: 15, 3: 14, 4: 13 }
      blocks.push(
        <p
          key={key++}
          style={{ fontSize: sizes[level] ?? 13, fontWeight: 700, color: T.tp, marginTop: 14, marginBottom: 6 }}
        >
          {renderInline(headerMatch[2], `h${key}`)}
        </p>,
      )
      i++
      continue
    }

    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const rows = tableLines
        .filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l.trim()))
        .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
      if (rows.length > 0) {
        const [header, ...body] = rows
        blocks.push(
          <div key={key++} style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  {header.map((h, ci) => (
                    <th
                      key={ci}
                      style={{
                        textAlign: "left",
                        padding: "6px 10px",
                        borderBottom: `2px solid ${T.border}`,
                        color: T.ts,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {renderInline(h, `th${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c, ci) => (
                      <td key={ci} style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, color: T.tp }}>
                        {renderInline(c, `td${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        )
      }
      continue
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && isListItem(lines[i])) {
        const m = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)
        if (m) items.push(m[1])
        i++
      }
      const ListTag: "ol" | "ul" = ordered ? "ol" : "ul"
      blocks.push(
        <ListTag key={key++} style={{ paddingLeft: 20, margin: "6px 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ fontSize: 13, color: T.tp, lineHeight: 1.6 }}>
              {renderInline(item, `li${ii}`)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== "" && !isHeader(lines[i]) && !isTableRow(lines[i]) && !isListItem(lines[i]) && !isRule(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} style={{ fontSize: 13, color: T.tp, lineHeight: 1.7, margin: "6px 0" }}>
        {renderInline(paraLines.join(" "), `p${key}`)}
      </p>,
    )
  }

  return <>{blocks}</>
}

function RealResultsStep({
  result,
  commentary,
  commentaryError,
  onBack,
  onNewRun,
}: {
  result: PipelineResult
  commentary: string | null
  commentaryError: string | null
  onBack: () => void
  onNewRun: () => void
}) {
  const coefEntries = Object.entries(result.coefficients).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  )
  const maxAbsCoef = Math.max(...coefEntries.map(([, v]) => Math.abs(v)), 1)
  const diag = result.multicollinearity
  const inSample = result.in_sample_metrics
  const cv = result.cross_validation
  const contributionKeys = Object.keys(result.channel_contribution_weekly[0] ?? {}).filter(
    (k) => k !== "date",
  )

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 16,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.tp, marginBottom: 4 }}>
            Results: Live Augustana Data
          </h2>
          <p style={{ fontSize: 13, color: T.ts }}>
            {result.rows} weeks · {result.date_range[0]} → {result.date_range[1]}
          </p>
        </div>
        <Badge variant="success">● Real data</Badge>
      </div>

      {diag.warning && <Alert variant="warning">{diag.warning}</Alert>}

      {commentaryError && (
        <Alert variant="warning">
          AI commentary unavailable: {commentaryError}
        </Alert>
      )}

      {commentary && (
        <div style={{ ...card, padding: "16px" }}>
          <p style={{ ...lbl, marginBottom: 8 }}>AI Analysis</p>
          {renderMarkdown(commentary)}
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        <KpiCard
          label="In-sample R²"
          value={inSample["R²"]?.toFixed(3) ?? "—"}
          sub="Full fit"
          highlight
          delay={0}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke={T.navy} strokeWidth="1.3" />
              <circle cx="7" cy="7" r="2.8" stroke={T.navy} strokeWidth="1.3" />
              <circle cx="7" cy="7" r="0.9" fill={T.navy} />
            </svg>
          }
        />
        <KpiCard
          label="Cross-val R²"
          value={cv.mean_r2.toFixed(3)}
          sub={`±${cv.std_r2.toFixed(2)} across folds`}
          delay={60}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l4.5 1.6v3.4c0 3-1.9 5-4.5 6-2.6-1-4.5-3-4.5-6V3.1L7 1.5z" stroke={T.navy} strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M5 7l1.4 1.4L9.2 5.6" stroke={T.navy} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <KpiCard
          label="MAE"
          value={`${inSample["MAE"]?.toFixed(0) ?? "—"} apps/wk`}
          sub="Avg prediction error"
          delay={120}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10.5L5 5l2 3 2-4.5 3 7" stroke={T.navy} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          }
        />
        <KpiCard
          label="Ridge alpha"
          value={result.selected_ridge_alpha.toFixed(2)}
          sub="Auto-tuned"
          delay={180}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke={T.navy} strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="5" cy="3.5" r="1.3" fill={T.gold} stroke={T.navy} strokeWidth="0.8" />
              <circle cx="9" cy="7" r="1.3" fill={T.gold} stroke={T.navy} strokeWidth="0.8" />
              <circle cx="4" cy="10.5" r="1.3" fill={T.gold} stroke={T.navy} strokeWidth="0.8" />
            </svg>
          }
        />
      </div>

      {result.spend_coverage && (
        <Alert variant="info">
          Spend data covers {result.spend_coverage.weeks_covered} of{" "}
          {result.spend_coverage.total_weeks} weeks (
          {Math.round((result.spend_coverage.weeks_covered / result.spend_coverage.total_weeks) * 100)}
          %). Channel coefficients below are less reliable outside that window.
        </Alert>
      )}

      {result.weekly.length > 0 && <RealActualVsPredictedChart weekly={result.weekly} />}

      {result.channel_contribution_weekly.length > 0 && contributionKeys.length > 0 && (
        <RealChannelContributionChart
          data={result.channel_contribution_weekly}
          seriesKeys={contributionKeys}
        />
      )}

      <div style={{ ...card, padding: 0 }}>
        <SectionHeader title="Model coefficients (standardized units)" />
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {coefEntries.map(([name, value]) => (
            <CoefficientBar key={name} name={name} value={value} max={maxAbsCoef} />
          ))}
        </div>
      </div>

      <Disclosure summary="Cross-validation & diagnostics detail">
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: T.ts }}>
            Per-fold R²: {cv.per_fold_r2.map((s) => s.toFixed(2)).join(", ")}
          </p>
          <p style={{ fontSize: 12, color: T.ts }}>
            Durbin-Watson: {inSample["Durbin-Watson"]?.toFixed(2) ?? "—"} (≈2 = no
            significant autocorrelation)
          </p>
          {diag.condition_number !== undefined && (
            <p style={{ fontSize: 12, color: T.ts }}>
              Design matrix condition number: {diag.condition_number.toLocaleString()}
              {diag.high_condition_number ? " (high)" : ""}
            </p>
          )}
          {diag.high_vif_features && Object.keys(diag.high_vif_features).length > 0 && (
            <p style={{ fontSize: 12, color: T.ts }}>
              High-VIF features:{" "}
              {Object.entries(diag.high_vif_features)
                .map(([k, v]) => `${k} (${v})`)
                .join(", ")}
            </p>
          )}
        </div>
      </Disclosure>

      <StepFooter onBack={onBack} onNext={onNewRun} nextLabel="New Run" />
    </div>
  )
}

/* ── Stepper ────────────────────────────────────────────────── */
const STEPS = ["Import", "Map Columns", "Select", "Configure", "Run", "Results"]

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Workflow steps">
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          listStyle: "none",
          padding: 0,
          margin: 0,
          overflowX: "auto",
        }}
      >
        {STEPS.map((s, i) => {
          const done = i + 1 < current
          const active = i + 1 === current
          return (
            <li
              key={s}
              style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              aria-current={active ? "step" : undefined}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 4px",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: done ? T.success : active ? T.navy : T.bg,
                    border: `2px solid ${
                      done ? T.success : active ? T.navy : T.border
                    }`,
                    color: done || active ? "#fff" : T.ts,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    color: active ? T.navy : done ? T.success : T.ts,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 1,
                    background: done ? T.success : T.border,
                    flexShrink: 0,
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ── MMMWorkflow root ───────────────────────────────────────── */
export function MMMWorkflow({
  onBack,
  authToken,
}: {
  onBack: () => void
  authToken?: string | null
}) {
  const [state, setState] = useState<WorkflowState>({
    step: 5,
    file: DEMO_FILE,
    importedSources: {},
    colMap: DEFAULT_COL_MAP,
    analysisType: "attribution",
    config: DEFAULTS.attribution,
    defaultConfig: DEFAULTS.attribution,
    result: null,
    lastResult: null,
    runError: null,
    isRunning: false,
    runProgress: 0,
    runStep: "",
    realResult: null,
    realCommentary: null,
    realCommentaryError: null,
  })

  const mainRef = useRef<HTMLDivElement>(null)

  function focusMain() {
    setTimeout(() => mainRef.current?.focus(), 50)
  }

  function goTo(step: WorkflowState["step"]) {
    setState((s) => ({ ...s, step }))
    focusMain()
  }

  function setAnalysisType(t: AnalysisType) {
    setState((s) => ({
      ...s,
      analysisType: t,
      config: DEFAULTS[t],
      defaultConfig: DEFAULTS[t],
    }))
  }

  function resetConfig() {
    setState((s) => ({ ...s, config: s.defaultConfig }))
  }

  function runAnalysis() {
    if (state.isRunning) return
    if (authToken) {
      runRealAnalysis(authToken)
    } else {
      runDemoAnalysis()
    }
  }

  function runDemoAnalysis() {
    setState((s) => ({
      ...s,
      isRunning: true,
      runProgress: 0,
      runError: null,
      runStep: RUN_STEPS[0],
    }))

    const totalMs = 4200
    const stepMs = totalMs / RUN_STEPS.length

    RUN_STEPS.forEach((label, i) => {
      setTimeout(
        () => {
          setState((s) => ({
            ...s,
            runProgress: Math.round(((i + 1) / RUN_STEPS.length) * 100),
            runStep: RUN_STEPS[Math.min(i + 1, RUN_STEPS.length - 1)],
          }))
        },
        stepMs * (i + 1),
      )
    })

    setTimeout(() => {
      const result = generateResult(state.analysisType, state.config)
      setState((s) => ({
        ...s,
        isRunning: false,
        runProgress: 100,
        result,
        lastResult: result,
        step: 6,
      }))
      focusMain()
    }, totalMs + 300)
  }

  async function runRealAnalysis(token: string) {
    setState((s) => ({
      ...s,
      isRunning: true,
      runProgress: 10,
      runError: null,
      runStep: "Running the real Augustana MMM pipeline…",
      realResult: null,
      realCommentary: null,
      realCommentaryError: null,
    }))

    let result: PipelineResult
    try {
      result = await runPipeline(token)
    } catch (err) {
      setState((s) => ({
        ...s,
        isRunning: false,
        runProgress: 0,
        runError: err instanceof Error ? err.message : String(err),
      }))
      return
    }

    setState((s) => ({
      ...s,
      runProgress: 70,
      runStep: "Generating AI commentary…",
      realResult: result,
    }))

    let commentary: string | null = null
    let commentaryError: string | null = null
    try {
      const insights = await getInsights(token)
      commentary = insights.commentary
    } catch (err) {
      commentaryError = err instanceof Error ? err.message : String(err)
    }

    setState((s) => ({
      ...s,
      isRunning: false,
      runProgress: 100,
      realCommentary: commentary,
      realCommentaryError: commentaryError,
      step: 6,
    }))
    focusMain()
  }

  const {
    step,
    file,
    importedSources,
    colMap,
    analysisType,
    config,
    defaultConfig,
    result,
    lastResult,
    runError,
    isRunning,
    runProgress,
    runStep,
    realResult,
    realCommentary,
    realCommentaryError,
  } = state

  return (
    <div
      className="bg-mesh"
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* top bar */}
      <header
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to analysis selection"
          style={{
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 6,
            background: T.bg,
            color: T.ts,
            border: `1px solid ${T.border}`,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <span aria-hidden style={{ color: T.border, fontSize: 16 }}>
          /
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: T.navy,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="13.3" viewBox="0 0 24 27" fill="none">
              <path
                d="M12 1L2.5 4.6v6.6c0 6.4 4 11.3 9.5 14 5.5-2.7 9.5-7.6 9.5-14V4.6L12 1z"
                fill={T.gold}
              />
              <path d="M12 6.5l3.4 3.4-3.4 3.4-3.4-3.4L12 6.5z" fill={T.navy} />
              <rect x="7.8" y="15.8" width="8.4" height="2" rx="1" fill={T.navy} />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.tp }}>
            MMM Analysis
          </span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.ts }}>
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </header>

      {/* stepper bar — only meaningful for the demo wizard; signed-in users get
          a single-screen flow with no steps to track */}
      {!authToken && (
        <div
          style={{
            background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            padding: "10px 24px",
          }}
        >
          <Stepper current={step} />
        </div>
      )}

      {/* main content */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        style={{
          flex: 1,
          padding: "28px 24px",
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          outline: "none",
          boxSizing: "border-box",
        }}
        aria-label={`Step ${step}: ${STEPS[step - 1]}`}
      >
        {step === 1 && (
          <ImportStep
            sources={importedSources}
            onSourcesChange={(src) => setState((s) => ({ ...s, importedSources: src }))}
            onFileChange={(f) => setState((s) => ({ ...s, file: f }))}
            onNext={() => goTo(2)}
          />
        )}
        {step === 2 && file && (
          <MapStep
            file={file}
            colMap={colMap}
            onColMapChange={(m) => setState((s) => ({ ...s, colMap: m }))}
            onBack={() => goTo(1)}
            onNext={() => goTo(3)}
          />
        )}
        {step === 3 && (
          <SelectStep
            analysisType={analysisType}
            onSelect={setAnalysisType}
            onBack={() => goTo(2)}
            onNext={() => goTo(4)}
          />
        )}
        {step === 4 && (
          <ConfigureStep
            analysisType={analysisType}
            config={config}
            defaultConfig={defaultConfig}
            onConfigChange={(c) => setState((s) => ({ ...s, config: c }))}
            onReset={resetConfig}
            onBack={() => goTo(3)}
            onNext={() => goTo(5)}
          />
        )}
        {step === 5 && authToken && (
          <RealRunStep
            isRunning={isRunning}
            progress={runProgress}
            currentRunStep={runStep}
            runError={runError}
            onRun={runAnalysis}
            onBack={onBack}
          />
        )}
        {step === 5 && !authToken && (
          <RunStep
            analysisType={analysisType}
            config={config}
            isRunning={isRunning}
            progress={runProgress}
            currentRunStep={runStep}
            runError={runError}
            lastResult={lastResult}
            onBack={() => goTo(4)}
            onRun={runAnalysis}
          />
        )}
        {step === 6 && realResult && (
          <RealResultsStep
            result={realResult}
            commentary={realCommentary}
            commentaryError={realCommentaryError}
            onBack={onBack}
            onNewRun={() => {
              setState((s) => ({ ...s, step: 5, runProgress: 0, runStep: "" }))
              focusMain()
            }}
          />
        )}
        {step === 6 && !realResult && result && (
          <ResultsStep
            result={result}
            onBack={() => goTo(4)}
            onNewRun={() => {
              setState((s) => ({ ...s, step: 5, runProgress: 0, runStep: "" }))
              focusMain()
            }}
          />
        )}
      </main>
    </div>
  )
}
