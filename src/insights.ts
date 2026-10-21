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
  helping: "Positive association",
  directional: "Directional",
  thin: "Too little signal",
  "cant-tell": "Can't tell yet",
}

/** Weeks with spend below which a channel's estimate isn't worth reading. */
const MIN_WEEKS = 20
/** Share of modeled applications below which a channel can't be told from zero. */
const MIN_SHARE = 0.005

/** One sentence on why channel estimates aren't supported in this run. */
export function notIdentifiedReason(l: NonNullable<PipelineResult["marketing_lift"]>): string {
  return `Adding marketing didn't predict unseen weeks better than the calendar alone (${signedFixed(l.full_mean_r2)} vs ${signedFixed(
    l.baseline_mean_r2,
  )}), so this number isn't supported yet.`
}

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
    const feature = key === "impressions" ? (r.coefficients["impressions"] !== undefined ? "impressions" : "impressions_lag1") : `${key}_adstock`
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
    // Marketing didn't beat the calendar alone on unseen weeks: no channel
    // number is supported, whatever its sign.
    if (r.marketing_lift && !r.marketing_lift.identified)
      return {
        ...base,
        verdict: "cant-tell" as const,
        reason: notIdentifiedReason(r.marketing_lift),
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
        reason: "Positive, but it rose and fell with other channels, so its size is uncertain.",
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
          ? "Advertising overall: impressions moved consistently with weekly applications. That's an association in past data, not proof it caused them."
          : "Moved consistently with weekly applications. That's an association in past data, not proof this channel caused them.",
    }
  })

  const rank: Record<Verdict, number> = { calendar: 0, helping: 1, directional: 2, thin: 3, "cant-tell": 4 }
  return rows.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.total - a.total)
}

/**
 * The estimates the ledger leaves out, so the visible rows can add up to
 * 100%: the negative ones normally, or every channel's when the run couldn't
 * separate marketing from the calendar at all ("unidentified").
 */
export function ledgerOverlap(rows: LedgerRow[]): {
  total: number
  share: number
  labels: string[]
  kind: "negative" | "unidentified"
} {
  const unidentified = rows.some((r) => r.verdict === "cant-tell" && r.total > 0)
  const out = rows.filter((r) => r.verdict === "cant-tell" && (unidentified || r.total < 0))
  return {
    total: out.reduce((s, r) => s + r.total, 0),
    share: out.reduce((s, r) => s + r.share, 0),
    labels: out.map((r) => r.label),
    kind: unidentified ? "unidentified" : "negative",
  }
}

const signedFixed = (v: number | null | undefined) =>
  typeof v !== "number" || !Number.isFinite(v) ? "—" : v < 0 ? `−${Math.abs(v).toFixed(2)}` : v.toFixed(2)

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
  /** Serif lead-in, e.g. "Most of the modeled total is assigned to the admissions baseline:". */
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
  const lead = "In this run,"
  const credible = (r: LedgerRow) => r.verdict === "helping" || r.verdict === "directional"
  // Impressions measure advertising overall; the headline names a channel.
  const top = ledger
    .filter((r) => credible(r) && r.key !== "impressions")
    .sort((x, y) => y.total - x.total)[0]
  const apps = (v: number) => Math.round(v).toLocaleString("en-US")
  const paid = top
    ? `Among individual channels, ${top.label} has the largest positive estimate, with about ${apps(top.total)} modeled applications assigned to it over the window${
        top.verdict === "directional" ? " (directional, since it moved with other channels)" : ""
      }.`
    : "No individual channel has an estimate the model can support yet."
  return {
    lead,
    figure: pct,
    rest: "of modeled applications are assigned to the admissions calendar and long-term trend. That's a model allocation, not a measured cause.",
    paid,
  }
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

/* ── results brief for Augie AI chat ───────────────────────── */
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/**
 * A compact plain-text summary of one run, sent with every chat message so
 * Augie AI can answer questions about these specific results. Built from the
 * same ledger and trust readings the results page shows, so the chat and the
 * page never disagree.
 */
export function chatBrief(r: PipelineResult, ranAt: number, source: "live" | "synthetic" = "live"): string {
  const t = trust(r)
  const ledger = driverLedger(r)
  const overlap = ledgerOverlap(ledger)
  const lines = [
    source === "live"
      ? `Run at ${new Date(ranAt).toISOString()} on real Augustana data.`
      : `Run at ${new Date(ranAt).toISOString()} on the DEMO's synthetic sample (shaped like Augustana's data, not real results).`,
    `Weeks modeled: ${r.rows} (${r.date_range[0]} to ${r.date_range[1]}).`,
    t.spendWeeks !== undefined && t.totalWeeks !== undefined
      ? `Spend history covers ${t.spendWeeks} of ${t.totalWeeks} weeks (${pct(t.spendShare ?? 0)}).`
      : "Spend coverage: unknown.",
    `Fit: in-sample R² ${t.inSampleR2?.toFixed(2) ?? "n/a"}; cross-validated R² ${signedFixed(t.cvMean)} ` +
      `(${FIT_WORDS[t.rating].toLowerCase()}; folds ranged ${signedFixed(t.foldMin)} to ${signedFixed(t.foldMax)}` +
      `${t.unstable ? ", unstable" : ""}).`,
    t.mae !== undefined
      ? `Average error: ${t.mae.toFixed(0)} applications/week against an average of ${t.meanActual.toFixed(0)}/week.`
      : "",
    r.multicollinearity?.high_condition_number ? "Diagnostics: high condition number — channels overlap heavily." : "",
    r.marketing_lift
      ? `Marketing test: calendar-only model scores ${signedFixed(r.marketing_lift.baseline_mean_r2)} on unseen weeks, ` +
        `with marketing ${signedFixed(r.marketing_lift.full_mean_r2)} (better on ${r.marketing_lift.folds_won}/${r.marketing_lift.folds} folds) — ` +
        (r.marketing_lift.identified
          ? "marketing IS identified."
          : "marketing is NOT identified, so no channel number below is supported.")
      : "",
    "\nDrivers (applications attributed across all weeks · share of modeled applications · weeks active · verdict — reason):",
    ...ledger.map(
      (x) =>
        `- ${x.label}: ${Math.round(x.total)} apps · ${pct(x.share)} · ${x.weeksActive} wks · ` +
        `${VERDICT_LABEL[x.verdict]} — ${x.reason}`,
    ),
    overlap.labels.length
      ? `Negative estimates (${overlap.labels.join(", ")}) total ${Math.round(overlap.total)} apps; treat as "can't tell yet", not as harm.`
      : "",
  ]
  return lines.filter(Boolean).join("\n")
}

/* ── plain-language summary to paste into an email ─────────── */
export function shareSummary(r: PipelineResult, live: boolean): string {
  const ledger = driverLedger(r)
  const h = headline(ledger)
  const t = trust(r)
  const l = r.marketing_lift
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
  const lines = [
    `Augie Analysis — ${live ? "Augustana data" : "synthetic demo sample (not real data)"}, ${fmtDate(r.date_range[0])} to ${fmtDate(r.date_range[1])}`,
    "",
    `• ${h.lead} ${h.figure} ${h.rest}`,
    l
      ? `• On weeks the model never saw, it scores ${signedFixed(l.full_mean_r2)} with marketing and ${signedFixed(l.baseline_mean_r2)} with the calendar alone. ${
          l.identified
            ? "Marketing adds measurable signal; read each channel with its verdict."
            : "Marketing isn't separable from the calendar yet, so no channel's estimate is supported."
        }`
      : `• On weeks the model never saw, it scores ${signedFixed(t.cvMean)}.`,
    t.mae !== undefined ? `• Typical weekly miss: about ${Math.round(t.mae)} applications.` : "",
    t.spendShare !== undefined ? `• Channel spend is on file for ${Math.round(t.spendShare * 100)}% of the weeks.` : "",
    "• What would firm it up: the full Carnegie spend history, billboard flight dates, and email send history.",
  ]
  return lines.filter((x, i) => x !== "" || i === 1).join("\n")
}
