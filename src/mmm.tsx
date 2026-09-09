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

function ImportStep({
  file,
  onFileChange,
  onNext,
}: {
  file: ImportedFile | null
  onFileChange: (f: ImportedFile | null) => void
  onNext: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(list: FileList | null) {
    if (!list?.length) return
    const f = list[0]
    const ok =
      f.name.endsWith(".csv") ||
      f.name.endsWith(".xls") ||
      f.name.endsWith(".xlsx")
    if (!ok) {
      onFileChange({
        name: f.name,
        size: f.size,
        rows: 0,
        cols: [],
        status: "error",
        warnings: [
          "Unsupported format. Please upload a .csv, .xls, or .xlsx file.",
        ],
      })
      return
    }
    const simRows = Math.floor(f.size / 130)
    const warnings: string[] = []
    if (simRows < 52)
      warnings.push(
        "Fewer than 52 weeks of data detected — model accuracy may be reduced.",
      )
    onFileChange({
      name: f.name,
      size: f.size,
      rows: simRows,
      cols: DEMO_CSV_COLS,
      status: simRows < 20 ? "warning" : "valid",
      warnings,
    })
  }

  const fmtSize = (b: number) =>
    b >= 1_048_576
      ? `${(b / 1_048_576).toFixed(1)} MB`
      : `${Math.round(b / 1024)} KB`

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
        <p style={{ fontSize: 13, color: T.ts, lineHeight: 1.5 }}>
          Upload a CSV or Excel file containing daily or weekly media spend and
          revenue data. Minimum 52 rows recommended for accurate modeling.
        </p>
      </div>

      {/* drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV or XLS file"
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
          border: `2px dashed ${dragOver ? T.navy : T.border}`,
          borderRadius: 10,
          padding: "36px 24px",
          textAlign: "center",
          background: dragOver ? "#EEF2F8" : T.bg,
          cursor: "pointer",
          transition: "all 0.15s",
          outline: "none",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          style={{ margin: "0 auto 12px" }}
        >
          <path
            d="M16 4v16M10 9l6-5 6 5"
            stroke={T.navy}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 22v3a3 3 0 003 3h14a3 3 0 003-3v-3"
            stroke={T.navy}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: T.tp,
            marginBottom: 4,
          }}
        >
          Drag &amp; drop your file here
        </p>
        <p style={{ fontSize: 12, color: T.ts }}>
          CSV, XLS, XLSX — or{" "}
          <span
            style={{
              color: T.navy,
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            browse
          </span>
        </p>
        <p style={{ fontSize: 11, color: T.ts, marginTop: 8 }}>
          Supported: up to 50 MB · .csv, .xls, .xlsx
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          aria-label="Choose file"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* or load demo */}
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, color: T.ts }}>or </span>
        <button
          onClick={() => onFileChange(DEMO_FILE)}
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
          load demo dataset
        </button>
        <span style={{ fontSize: 12, color: T.ts }}>
          {" "}
          to explore the workflow
        </span>
      </div>

      {/* file status */}
      {file && (
        <div style={{ ...card, padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderBottom: file.warnings.length
                ? `1px solid ${T.border}`
                : "none",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <rect
                x="2"
                y="1"
                width="11"
                height="16"
                rx="2"
                stroke={T.navy}
                strokeWidth="1.4"
                fill="none"
              />
              <path
                d="M13 1v5h4"
                stroke={T.navy}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M5 8h8M5 11h6"
                stroke={T.navy}
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: T.tp,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={file.name}
              >
                {file.name}
              </p>
              <p style={{ fontSize: 11, color: T.ts }}>
                {fmtSize(file.size)}
                {file.rows > 0 ? ` · ${fmt(file.rows)} rows` : ""}
                {file.cols.length > 0 ? ` · ${file.cols.length} columns` : ""}
              </p>
            </div>
            <Badge
              variant={
                file.status === "valid"
                  ? "success"
                  : file.status === "warning"
                    ? "warning"
                    : "error"
              }
            >
              {file.status === "valid"
                ? "✓ Valid"
                : file.status === "warning"
                  ? "⚠ Warning"
                  : "✕ Error"}
            </Badge>
            <button
              aria-label="Remove file"
              onClick={() => onFileChange(null)}
              style={{
                background: "none",
                border: "none",
                color: T.ts,
                cursor: "pointer",
                fontSize: 16,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
          {file.warnings.map((w, i) => (
            <div key={i} style={{ padding: "8px 16px" }}>
              <Alert variant="warning">{w}</Alert>
            </div>
          ))}
          {file.status === "error" &&
            file.warnings.map((w, i) => (
              <div key={i} style={{ padding: "8px 16px" }}>
                <Alert variant="error">{w}</Alert>
              </div>
            ))}
          {file.cols.length > 0 && (
            <div style={{ padding: "10px 16px" }}>
              <p style={{ ...lbl, marginBottom: 6 }}>Detected columns</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {file.cols.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: T.bg,
                      border: `1px solid ${T.border}`,
                      color: T.tp,
                      fontFamily: "monospace",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {file?.name === DEMO_FILE.name && (
        <Alert variant="demo">
          <strong>Demo dataset loaded.</strong> Results will use simulated data
          to illustrate the workflow. Connect a real data source for production
          use.
        </Alert>
      )}

      <StepFooter
        onNext={onNext}
        nextDisabled={!file || file.status === "error"}
        nextDisabledReason="Please upload a valid file first"
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
  description: string
  requires?: string
}[] = [
  {
    id: "attribution",
    label: "Attribution",
    description:
      "Decompose revenue across channels using Shapley or Bayesian attribution, with adstock decay and saturation adjustments.",
  },
  {
    id: "roi",
    label: "ROI Curves",
    description:
      "Compute marginal and average return on investment per channel at current and alternative spend levels.",
  },
  {
    id: "saturation",
    label: "Saturation",
    description:
      "Fit Hill functions to identify diminishing-returns thresholds and optimal spend ranges per channel.",
  },
  {
    id: "budget",
    label: "Budget Optimizer",
    description:
      "Redistribute a fixed total budget across channels to maximise projected revenue, subject to optional channel constraints.",
  },
  {
    id: "incrementality",
    label: "Incrementality",
    description:
      "Estimate the true causal lift of media spend using holdout test design or synthetic control.",
  },
]

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
        <p style={{ fontSize: 13, color: T.ts }}>
          Choose the type of MMM analysis to run.
        </p>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
        role="radiogroup"
        aria-label="Analysis type"
      >
        {ANALYSIS_OPTIONS.map((opt) => {
          const sel = analysisType === opt.id
          return (
            <label
              key={opt.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 10,
                border: `1.5px solid ${sel ? T.navy : T.border}`,
                background: sel ? "#EEF2F8" : T.surface,
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              <input
                type="radio"
                name="analysis"
                value={opt.id}
                checked={sel}
                onChange={() => onSelect(opt.id)}
                style={{
                  accentColor: T.navy,
                  marginTop: 2,
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                }}
                aria-describedby={`desc-${opt.id}`}
              />
              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: sel ? 600 : 500,
                    color: sel ? T.navy : T.tp,
                    marginBottom: 3,
                  }}
                >
                  {opt.label}
                </p>
                <p
                  id={`desc-${opt.id}`}
                  style={{ fontSize: 12, color: T.ts, lineHeight: 1.5 }}
                >
                  {opt.description}
                </p>
              </div>
              {sel && (
                <span
                  style={{
                    marginLeft: "auto",
                    color: T.navy,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
              )}
            </label>
          )
        })}
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
  isReal,
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
  isReal: boolean
  onBack: () => void
  onRun: () => void
}) {
  const label =
    ANALYSIS_OPTIONS.find((a) => a.id === analysisType)?.label ?? "Analysis"
  const stepsToShow = isReal ? REAL_RUN_STEPS : RUN_STEPS
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

      {isReal ? (
        <Alert variant="info">
          <strong>Signed in.</strong> This will run the real Augustana MMM
          pipeline (Ridge regression) against your live Supabase data — not
          the demo dataset. The configuration below is illustrative; the
          real pipeline always uses its own validated feature set.
        </Alert>
      ) : (
        <Alert variant="demo">
          Not signed in — this will run on the simulated demo dataset. Sign
          in from the landing page to run the real pipeline instead.
        </Alert>
      )}

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

/* ── STEP 6 – Results ───────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      style={{
        ...card,
        padding: "16px",
        borderLeft: highlight ? `3px solid ${T.navy}` : undefined,
      }}
    >
      <p style={{ ...lbl, marginBottom: 8 }}>{label}</p>
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
        />
        <KpiCard
          label="Modeled Revenue"
          value={fmtUSD(result.kpi.modeledRevenue)}
          sub={`${(result.kpi.modeledRevenue / result.kpi.totalSpend).toFixed(1)}× revenue/spend`}
        />
        <KpiCard
          label="Incremental Revenue"
          value={fmtUSD(result.kpi.incrementalRevenue)}
          sub="Above organic baseline"
        />
        <KpiCard
          label="Blended ROI"
          value={`${result.kpi.roi}×`}
          sub="Incremental / total spend"
        />
        <KpiCard
          label="Model R²"
          value={result.kpi.rSquared.toFixed(3)}
          sub={result.kpi.rSquared >= 0.85 ? "Good fit" : "Below target"}
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
          <p style={{ fontSize: 13, color: T.tp, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {commentary}
          </p>
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        <KpiCard label="In-sample R²" value={inSample["R²"]?.toFixed(3) ?? "—"} sub="Full fit" highlight />
        <KpiCard label="Cross-val R²" value={cv.mean_r2.toFixed(3)} sub={`±${cv.std_r2.toFixed(2)} across folds`} />
        <KpiCard label="MAE" value={`${inSample["MAE"]?.toFixed(0) ?? "—"} apps/wk`} sub="Avg prediction error" />
        <KpiCard label="Ridge alpha" value={result.selected_ridge_alpha.toFixed(2)} sub="Auto-tuned" />
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
      style={{
        minHeight: "100%",
        background: T.bg,
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="7" width="2" height="4" rx="0.5" fill={T.gold} />
              <rect
                x="4.5"
                y="4.5"
                width="2"
                height="6.5"
                rx="0.5"
                fill={T.gold}
              />
              <rect
                x="8"
                y="1.5"
                width="2"
                height="9.5"
                rx="0.5"
                fill={T.gold}
              />
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

      {/* stepper bar */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: "10px 24px",
        }}
      >
        <Stepper current={step} />
      </div>

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
            file={file}
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
        {step === 5 && (
          <RunStep
            analysisType={analysisType}
            config={config}
            isRunning={isRunning}
            progress={runProgress}
            currentRunStep={runStep}
            runError={runError}
            lastResult={lastResult}
            isReal={!!authToken}
            onBack={() => goTo(4)}
            onRun={runAnalysis}
          />
        )}
        {step === 6 && realResult && (
          <RealResultsStep
            result={realResult}
            commentary={realCommentary}
            commentaryError={realCommentaryError}
            onBack={() => goTo(4)}
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
