/**
 * Single source of truth for "where does the project's data stand" — read by
 * the data-coverage panel (coverage.tsx) and the project checklist
 * (checklist.tsx). Facts here come from the files in the MMM repo's data/
 * folder as of the 2026-09-28 audit; update this file, not the components,
 * when a new export arrives.
 *
 * Months are "YYYY-MM" strings. Segments are inclusive on both ends.
 */

/** The window the model is fit on: Slate applications 2023-W01 → 2026-W22. */
export const MODEL_WINDOW = { start: "2023-01", end: "2026-05" } as const

/** Date the facts in this file were last checked against the data folder. */
export const STATUS_AS_OF = "2026-09-28"

export type SourceStatus = "live" | "partial" | "reference" | "pending"

/** One word per status, shared by every badge and list so they never drift. */
export const STATUS_LABEL: Record<SourceStatus, string> = {
  live: "Live",
  partial: "Partial",
  reference: "Reference only",
  pending: "Pending",
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-09-28" → "Sep 28, 2026" — the one date format for "as of" lines. */
export function formatStatusDate(iso: string = STATUS_AS_OF): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d || m > 12) return iso
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`
}

export interface Segment {
  start: string // "YYYY-MM"
  end: string // "YYYY-MM"
}

export interface DataSource {
  id: string
  label: string
  /** Who provides it. */
  owner: string
  status: SourceStatus
  /** Human summary of coverage, e.g. "37% of the model window". */
  coverageLabel: string
  /** Months with data. Empty = nothing on file yet (render an empty row). */
  segments: Segment[]
  /** One-line caveat a marketer should know. */
  note: string
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "applications",
    label: "Slate applications",
    owner: "Admissions (Slate)",
    status: "live",
    coverageLabel: "100% · 181 weeks",
    segments: [{ start: "2023-01", end: "2026-05" }],
    note: "The outcome the model explains. Ends at 2026-W22, so it doesn't cover the Fall 2026 cycle yet.",
  },
  {
    id: "impressions",
    label: "Carnegie impressions",
    owner: "Irene / Carnegie",
    status: "partial",
    coverageLabel: "81% of weeks on file",
    segments: [
      { start: "2023-01", end: "2024-07" },
      { start: "2024-10", end: "2025-06" },
      { start: "2025-09", end: "2025-12" },
    ],
    note: "No rows for Aug–Sep 2024 or most of Jul–Aug 2025, and nothing after Jan 1, 2026. Impressions are zero while campaigns were dark (Jul–Aug 2023, May–Jul 2024, Jul–Aug 2025), so only 122 of 181 weeks (67%) had ads running.",
  },
  {
    id: "spend",
    label: "Carnegie channel spend",
    owner: "Irene / Carnegie",
    status: "partial",
    coverageLabel: "37% of the window",
    segments: [
      { start: "2024-10", end: "2025-06" },
      { start: "2025-08", end: "2026-01" },
    ],
    note: "Starts Oct 2024. No spend at all in Jul 2025; YouTube only from Sep 2025; IP Targeting missing Jan–Sep 2025 and Jan 2026.",
  },
  {
    id: "billboards",
    label: "Billboards",
    owner: "Lucas",
    status: "live",
    coverageLabel: "100% · 4 budget periods",
    segments: [{ start: "2023-01", end: "2026-05" }],
    note: "Four budget-period totals spread evenly across weeks. There are no real flight dates yet.",
  },
  {
    id: "conversions",
    label: "Tracked conversions",
    owner: "Irene / Carnegie",
    status: "reference",
    coverageLabel: "1 month",
    segments: [{ start: "2026-05", end: "2026-05" }],
    note: "May 2026 only. That's too short to use as a model feature.",
  },
  {
    id: "email",
    label: "Email sends",
    owner: "Anthony",
    status: "pending",
    coverageLabel: "No data yet",
    segments: [],
    note: "The table and API are ready; waiting on a send-history export.",
  },
  {
    id: "direct_mail",
    label: "Direct mail",
    owner: "Lucas",
    status: "pending",
    coverageLabel: "No data yet",
    segments: [],
    note: "The table and API are ready; need flight dates, not just annual totals.",
  },
]

/* ── checklist ─────────────────────────────────────────────── */

export type ChecklistPhase = "done" | "now" | "later"

export interface ChecklistItem {
  id: string
  title: string
  /** Why it matters, in one sentence a marketer can act on. */
  detail: string
  owner: string
  phase: ChecklistPhase
  /** Default state before the viewer checks anything off. */
  defaultDone: boolean
}

export const CHECKLIST: ChecklistItem[] = [
  // already in place
  {
    id: "slate-loaded",
    title: "Load Slate application history",
    detail: "181 weeks of submitted applications, Jan 2023 to May 2026.",
    owner: "Summer",
    phase: "done",
    defaultDone: true,
  },
  {
    id: "carnegie-partial",
    title: "Load first Carnegie exports",
    detail: "Impressions from Jan 2023 and channel spend from Oct 2024.",
    owner: "Summer",
    phase: "done",
    defaultDone: true,
  },
  {
    id: "billboards-loaded",
    title: "Add billboard budgets",
    detail: "QC Airport and Admissions Surge totals from Lucas.",
    owner: "Summer",
    phase: "done",
    defaultDone: true,
  },
  {
    id: "model-live",
    title: "Fit and validate the model",
    detail: "Ridge regression with walk-forward cross-validation and collinearity checks.",
    owner: "Summer",
    phase: "done",
    defaultDone: true,
  },

  // Phase 1 — immediate
  {
    id: "carnegie-media-plan",
    title: "Export the full 24-month Carnegie Media Plan",
    detail:
      "Media Plan → Pivot Table, back to Jun 2023. This is the biggest improvement available: spend coverage goes from 37% toward full history.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "carnegie-impressions",
    title: "Export the full Carnegie impressions time series",
    detail: "Overview → Time Series. Fills the Aug–Sep 2024 gap.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "carnegie-conversions",
    title: "Export the full YoY conversions history",
    detail: "YoY → Time Series. Only May 2026 is on file today.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "mobile-footprinting",
    title: "Confirm Carnegie's name for Mobile Footprinting",
    detail: "The channel maps to zero rows until the Strategy name is confirmed.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "email-history",
    title: "Send email send history",
    detail: "Send date, campaign, sends, opens and clicks per campaign.",
    owner: "Anthony",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "slate-refresh",
    title: "Refresh Slate applications through Fall 2026",
    detail: "The file ends in May 2026. The W44–46 deadline spike is the most informative stretch of the year.",
    owner: "Summer",
    phase: "now",
    defaultDone: false,
  },

  // Phase 2 — later
  {
    id: "direct-mail",
    title: "Add direct mail flight dates",
    detail: "Start and end dates plus spend per drop, not just annual totals.",
    owner: "Lucas",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "billboard-flights",
    title: "Replace billboard annual totals with flight dates",
    detail: "Lets the model see when boards were actually up.",
    owner: "Lucas",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "adstock-tuning",
    title: "Tune adstock decay per channel",
    detail: "Needs the full spend history first. Today every channel uses the same 0.5 decay.",
    owner: "Summer",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "funnel",
    title: "Extend to admits and deposits",
    detail: "Measure marketing's effect further down the funnel once that data is available.",
    owner: "Summer",
    phase: "later",
    defaultDone: false,
  },
]
