/**
 * Single source of truth for "where does the project's data stand" — read by
 * the data-coverage panel (coverage.tsx) and the project checklist
 * (checklist.tsx). Facts here come from the files in the MMM repo's data/
 * folder as of the 2026-10-20 re-check; update this file, not the components,
 * when a new export arrives.
 *
 * Months are "YYYY-MM" strings. Segments are inclusive on both ends.
 */

/** The window the model is fit on: Slate applications 2023-W01 → 2026-W22. */
export const MODEL_WINDOW = { start: "2023-01", end: "2026-05" } as const

/** Date the facts in this file were last checked against the data folder. */
export const STATUS_AS_OF = "2026-10-20"

export type SourceStatus = "live" | "partial" | "reference" | "pending"

/** One word per status, shared by every badge and list so they never drift. */
export const STATUS_LABEL: Record<SourceStatus, string> = {
  live: "Live",
  partial: "Partial",
  reference: "Reference only",
  pending: "Pending",
}

/** Plain-language meaning of each status word, for tooltips and legends. */
export const STATUS_GLOSS: Record<SourceStatus, string> = {
  live: "Loaded and used by the model.",
  partial: "Loaded and used, but with gaps in the dates.",
  reference: "Shown for background. Not used by the model.",
  pending: "Waiting for someone to send it.",
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
    coverageLabel: "100% · 178 weeks",
    segments: [{ start: "2023-01", end: "2026-05" }],
    note: "The outcome the model explains. Ends the week of late May 2026 (2026-W22), so it doesn't yet include the fall 2026 application season.",
  },
  {
    id: "impressions",
    label: "Carnegie impressions",
    owner: "Irene / Carnegie",
    status: "partial",
    coverageLabel: "83% of weeks on file",
    segments: [
      { start: "2023-01", end: "2024-07" },
      { start: "2024-10", end: "2025-06" },
      { start: "2025-09", end: "2025-12" },
    ],
    note: "No ad data for Aug–Sep 2024, most of Jul–Aug 2025, or after Jan 1, 2026. Ads were switched off in Jul–Aug 2023, May–Jul 2024 and Jul–Aug 2025 (zero impressions), so ads ran in only 122 of 178 weeks (69%).",
  },
  {
    id: "spend",
    label: "Carnegie channel spend",
    owner: "Irene / Carnegie",
    status: "partial",
    coverageLabel: "38% of weeks",
    segments: [
      { start: "2024-10", end: "2025-06" },
      { start: "2025-08", end: "2026-01" },
    ],
    note: "Starts Oct 2024. No spend at all in Jul 2025. YouTube only from Sep 2025. Google IP Targeting (ads aimed at chosen locations) is missing Jan–Sep 2025 and Jan 2026.",
  },
  {
    id: "billboards",
    label: "Billboards",
    owner: "Lucas",
    status: "reference",
    coverageLabel: "100% · 4 budget periods",
    segments: [{ start: "2023-01", end: "2026-05" }],
    note: "We only have four budget totals, with no dates for when boards were actually up (flight dates). So billboards are shown for background and are not used in the model.",
  },
  {
    id: "conversions",
    label: "Tracked conversions",
    owner: "Irene / Carnegie",
    status: "reference",
    coverageLabel: "1 month",
    segments: [{ start: "2026-05", end: "2026-05" }],
    note: "May 2026 only. That's too short for the model to use.",
  },
  {
    id: "email",
    label: "Email sends",
    owner: "Anthony",
    status: "pending",
    coverageLabel: "No data yet",
    segments: [],
    note: "The system is ready to receive it. Waiting for Anthony to send the history of emails sent.",
  },
  {
    id: "direct_mail",
    label: "Direct mail",
    owner: "Lucas",
    status: "pending",
    coverageLabel: "No data yet",
    segments: [],
    note: "The system is ready to receive it. We need the dates each mailing went out, not just yearly totals.",
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
    detail: "178 weeks of submitted applications, Jan 2023 to May 2026.",
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
    title: "Build and test the model",
    detail: "Built the model, tested it on weeks it had not seen, and checked whether channels moved together too closely to tell apart.",
    owner: "Summer",
    phase: "done",
    defaultDone: true,
  },

  // Phase 1 — immediate
  {
    id: "carnegie-media-plan",
    title: "Export the full 24-month Carnegie Media Plan",
    detail:
      "In Carnegie, open Media Plan, choose Pivot Table, set dates back to Jun 2023 and export. This is the biggest improvement available: today we have ad spend for only 38% of weeks.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "carnegie-impressions",
    title: "Export the full Carnegie impressions time series",
    detail: "In Carnegie: Overview, then Time Series. Fills the Aug–Sep 2024 gap.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "carnegie-conversions",
    title: "Export the full YoY conversions history",
    detail: "In Carnegie: YoY, then Time Series. Only May 2026 is on file today.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "mobile-footprinting",
    title: "Confirm Carnegie's name for Mobile Footprinting",
    detail: "Tell us the exact name Carnegie uses for this channel. Until then the tool finds no rows for it.",
    owner: "Irene",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "email-history",
    title: "Send the email campaign history",
    detail: "For each campaign: send date, emails sent, opens and clicks.",
    owner: "Anthony",
    phase: "now",
    defaultDone: false,
  },
  {
    id: "slate-refresh",
    title: "Refresh Slate applications through Fall 2026",
    detail: "The data stops in May 2026. The November deadline weeks (weeks 44–46) are the most informative part of the year.",
    owner: "Summer",
    phase: "now",
    defaultDone: false,
  },

  // Phase 2 — later
  {
    id: "direct-mail",
    title: "Add direct mail flight dates",
    detail: "Start and end dates plus spend for each mailing, not just yearly totals.",
    owner: "Lucas",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "billboard-flights",
    title: "Replace billboard annual totals with flight dates",
    detail: "Lets the model see when billboards were actually up.",
    owner: "Lucas",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "adstock-tuning",
    title: "Test how long each channel's effect lingers",
    detail: "Today every channel is assumed to fade at the same rate (adstock decay 0.5). Needs the full spend history first.",
    owner: "Summer",
    phase: "later",
    defaultDone: false,
  },
  {
    id: "funnel",
    title: "Look beyond applications",
    detail: "Look at admits, deposits and enrollment, which the college cares about most, once that data is available.",
    owner: "Summer",
    phase: "later",
    defaultDone: false,
  },
]
