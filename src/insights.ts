/**
 * Plain-language readings of one model run (a PipelineResult), computed
 * deterministically from the numbers the backend returns. Nothing here
 * invents a figure: every sentence, verdict and total is derived from the
 * result object, so the live run and the synthetic sample are read the same way.
 */
import type { PipelineResult } from "./api"
import { channelLabel } from "./channels"

/* ── dates ─────────────────────────────────────────────────── */
const DAY = 86_400_000

/** ISO-8601 week number (1–53) for a date. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  return Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7)
}
/** ISO week-numbering year (differs from the calendar year around New Year). */
export function isoYear(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return t.getUTCFullYear()
}

/* ── driver ledger ─────────────────────────────────────────── */
export type Verdict = "calendar" | "helping" | "directional" | "thin" | "cant-tell"

export interface LedgerRow {
  key: string
  label: string
  /** Modeled applications attributed to this driver across every week. */
  total: number
  /** total ÷ all modeled applications. */
  share: number
  /** Weeks where this driver contributed at least half an application. */
  weeksActive: number
  verdict: Verdict
  /** One sentence a marketer can repeat. */
  reason: string
  /** Standardized coefficient of the driver's main feature, when there is one. */
  coef?: number
  /** Variance inflation factor, when the diagnostics flagged it as high. */
  vif?: number
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  calendar: "The calendar",
  helping: "Helping",
  directional: "Directional",
  thin: "Too little signal",
  "cant-tell": "Can't tell yet",
}

/** Weeks with spend below which a channel's estimate isn't worth reading. */
const MIN_WEEKS = 20
/** Share of modeled applications below which a channel can't be told from zero. */
const MIN_SHARE = 0.005

export function driverLedger(r: PipelineResult): LedgerRow[] {
  const weeks = r.channel_contribution_weekly
  if (!weeks.length) return []
  const keys = Object.keys(weeks[0]).filter((k) => k !== "date")
  const modeledTotal = r.weekly.reduce((s, w) => s + w.predicted, 0) || 1
  const highVif = r.multicollinearity?.high_vif_features ?? {}
  // A channel can't look more certain than the run it comes from.
  const t = trust(r)
  const runShaky = t.rating === "weak" || t.rating === "modest" || t.unstable || !!r.multicollinearity?.high_condition_number
  const shakyWhy = t.unstable
    ? `the model's accuracy swung between validation periods (${signedFixed(t.foldMin)} to ${signedFixed(t.foldMax)})`
    : `the model's fit on unseen weeks is ${FIT_WORDS[t.rating].toLowerCase()} (${signedFixed(t.cvMean)})`

  const rows: LedgerRow[] = keys.map((key) => {
    let total = 0
    let weeksActive = 0
    for (const w of weeks) {
      const v = Number(w[key] ?? 0)
      total += v
      if (Math.abs(v) >= 0.5) weeksActive++
    }
    const feature = key === "impressions" ? "impressions_lag1" : `${key}_adstock`
    const coef = r.coefficients[feature]
    const vif = highVif[feature]
    const label = key === "baseline" ? "Baseline & seasonality" : channelLabel(key)
    const base = { key, label, total, share: total / modeledTotal, weeksActive, coef, vif }

    if (key === "baseline")
      return {
        ...base,
        verdict: "calendar" as const,
        reason: "Applications Augustana would expect from the admissions calendar and long-term trend alone.",
      }
    if (total <= 0 || (coef !== undefined && coef < 0))
      return {
        ...base,
        verdict: "cant-tell" as const,
        reason:
          key === "billboard_spend"
            ? "The estimate came out negative. Billboards are on file only as four budget totals spread evenly across weeks, so the model can't see when boards were actually up."
            : "The estimate came out negative. That usually means this channel ran at the same time as others and the model can't pull them apart, not that it hurt applications.",
      }
    if (weeksActive < MIN_WEEKS)
      return {
        ...base,
        verdict: "thin" as const,
        reason: `Only ${weeksActive} week${weeksActive === 1 ? "" : "s"} with activity on file, too few to judge.`,
      }
    if (base.share < MIN_SHARE)
      return {
        ...base,
        verdict: "thin" as const,
        reason: "Its estimated contribution is too small to tell apart from zero.",
      }
    if (vif !== undefined)
      return {
        ...base,
        verdict: "directional" as const,
        reason: `Positive, but it moved with other channels (VIF ${vif.toFixed(0)}), so the size is uncertain.`,
      }
    if (runShaky)
      return {
        ...base,
        verdict: "directional" as const,
        reason: `Positive, but ${shakyWhy}, so read it as a direction rather than a size.`,
      }
    return {
      ...base,
      verdict: "helping" as const,
      reason:
        key === "impressions"
          ? "Advertising overall: a consistent positive association between impressions and weekly applications."
          : "A consistent positive association with weekly applications.",
    }
  })

  const rank: Record<Verdict, number> = { calendar: 0, helping: 1, directional: 2, thin: 3, "cant-tell": 4 }
  return rows.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.total - a.total)
}

/** The negative estimates the ledger leaves out, so the visible rows can add up to 100%. */
export function ledgerOverlap(rows: LedgerRow[]): { total: number; share: number; labels: string[] } {
  const out = rows.filter((r) => r.verdict === "cant-tell" && r.total < 0)
  return {
    total: out.reduce((s, r) => s + r.total, 0),
    share: out.reduce((s, r) => s + r.share, 0),
    labels: out.map((r) => r.label),
  }
}

const signedFixed = (v: number) => (v < 0 ? `−${Math.abs(v).toFixed(2)}` : v.toFixed(2))

/* ── how far to trust the run ──────────────────────────────── */
export type FitRating = "weak" | "modest" | "fair" | "strong"

export interface Trust {
  cvMean: number
  foldMin: number
  foldMax: number
  folds: number
  rating: FitRating
  /** At least one validation period scored below zero. */
  unstable: boolean
  inSampleR2?: number
  mae?: number
  meanActual: number
  /** Typical weekly miss as a share of an average week. */
  maeShare?: number
  dataStart: string
  dataEnd: string
  /** Whole weeks between the last week on file and now. */
  weeksStale: number
  spendWeeks?: number
  totalWeeks?: number
  spendShare?: number
}

export function trust(r: PipelineResult, now = Date.now()): Trust {
  const cv = r.cross_validation
  const folds = cv.per_fold_r2.length
  const foldMin = folds ? Math.min(...cv.per_fold_r2) : cv.mean_r2
  const foldMax = folds ? Math.max(...cv.per_fold_r2) : cv.mean_r2
  const meanActual = r.weekly.length ? r.weekly.reduce((s, w) => s + w.actual, 0) / r.weekly.length : 0
  const mae = r.in_sample_metrics["MAE"]
  const rating: FitRating = cv.mean_r2 >= 0.7 ? "strong" : cv.mean_r2 >= 0.5 ? "fair" : cv.mean_r2 >= 0.2 ? "modest" : "weak"
  const cov = r.spend_coverage
  return {
    cvMean: cv.mean_r2,
    foldMin,
    foldMax,
    folds,
    rating,
    unstable: foldMin < 0,
    inSampleR2: r.in_sample_metrics["R²"],
    mae,
    meanActual,
    maeShare: mae !== undefined && meanActual > 0 ? mae / meanActual : undefined,
    dataStart: r.date_range[0],
    dataEnd: r.date_range[1],
    weeksStale: Math.max(0, Math.floor((now - new Date(r.date_range[1]).getTime()) / (7 * DAY))),
    spendWeeks: cov?.weeks_covered,
    totalWeeks: cov?.total_weeks,
    spendShare: cov && cov.total_weeks > 0 ? cov.weeks_covered / cov.total_weeks : undefined,
  }
}

export const FIT_WORDS: Record<FitRating, string> = {
  weak: "Weak",
  modest: "Modest",
  fair: "Fair",
  strong: "Strong",
}

/* ── the one-sentence finding ──────────────────────────────── */
export interface Headline {
  /** Serif lead-in, e.g. "The admissions calendar explains most of it". */
  lead: string
  /** The single highlighted figure, e.g. "91%". */
  figure: string
  /** Text after the figure, completing the sentence. */
  rest: string
  /** Second sentence about paid media. */
  paid: string
}

export function headline(ledger: LedgerRow[]): Headline {
  const base = ledger.find((r) => r.key === "baseline")
  const share = Math.max(0, Math.min(1, base?.share ?? 0))
  const pct = `${Math.round(share * 100)}%`
  const lead =
    share >= 0.6 ? "The admissions calendar explains most of it:" : "Marketing and the calendar share the story:"
  const credible = (r: LedgerRow) => r.verdict === "helping" || r.verdict === "directional"
  // Impressions measure advertising overall; the headline names a channel.
  const top = ledger
    .filter((r) => credible(r) && r.key !== "impressions")
    .sort((x, y) => y.total - x.total)[0]
  const apps = (v: number) => Math.round(v).toLocaleString("en-US")
  const paid = top
    ? `Among individual channels, ${top.label} is the largest signal, about ${apps(top.total)} applications over the window${
        top.verdict === "directional" ? " (directional, since it moved with other channels)" : ""
      }.`
    : "No individual channel shows a signal the model can separate yet."
  return { lead, figure: pct, rest: "of modeled applications come from baseline demand and seasonality.", paid }
}

/* ── deadline season, year by year ─────────────────────────── */
export interface SeasonYear {
  year: number
  points: { week: number; actual: number; predicted: number }[]
  peak?: { week: number; actual: number; predicted: number }
}

/** Weeks 36–52 of each year on file, to compare the model at the busiest time. */
export function deadlineSeasons(r: PipelineResult, from = 36, to = 52): SeasonYear[] {
  const byYear = new Map<number, SeasonYear>()
  for (const w of r.weekly) {
    const d = new Date(w.date)
    const wk = isoWeek(d)
    if (wk < from || wk > to) continue
    const y = isoYear(d)
    if (!byYear.has(y)) byYear.set(y, { year: y, points: [] })
    byYear.get(y)!.points.push({ week: wk, actual: w.actual, predicted: w.predicted })
  }
  return [...byYear.values()]
    .filter((s) => s.points.length >= 6)
    .map((s) => ({ ...s, peak: s.points.reduce((a, b) => (b.actual > a.actual ? b : a), s.points[0]) }))
    .sort((a, b) => a.year - b.year)
}

/* ── export ────────────────────────────────────────────────── */
export function resultToCSV(r: PipelineResult, source: "live" | "synthetic" = "live"): string {
  const contrib = new Map(r.channel_contribution_weekly.map((w) => [w.date, w]))
  const keys = r.channel_contribution_weekly.length
    ? Object.keys(r.channel_contribution_weekly[0]).filter((k) => k !== "date")
    : []
  const header = ["data_source", "week_start", "actual_applications", "modeled_applications", ...keys.map((k) => `contribution_${k}`)]
  const lines = r.weekly.map((w) => {
    const c = contrib.get(w.date)
    return [source, w.date, w.actual, w.predicted.toFixed(1), ...keys.map((k) => Number(c?.[k] ?? 0).toFixed(1))].join(",")
  })
  return [header.join(","), ...lines].join("\n")
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
