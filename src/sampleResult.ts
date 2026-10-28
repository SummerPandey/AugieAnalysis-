/**
 * The signed-out demo's run. At the default settings it is Augustana's real
 * model run, exported by scripts/export_demo_snapshot.py, with every
 * application count rescaled so the average week reads 100 and no dollar
 * figures. Fit statistics (R², folds, the marketing test, VIF) are the real
 * ones; only the units are hidden, because signed-out pages are public.
 *
 * Changed settings aren't re-fit. A small generator (generate(), shaped like
 * the same data) estimates how far each setting moves the result, and that
 * movement is applied on top of the real run. The weekly actuals never move:
 * settings change the model, not the data.
 *
 * It returns a PipelineResult, so the demo is read by exactly the same
 * results view, ledger and caveats as a live run. Billboards are described,
 * not fit as a driver, matching the live model.
 */
import type { PipelineResult } from "./api"
import { isoWeek } from "./insights"
import snapshotJson from "./demoSnapshot.json"

const SNAPSHOT = snapshotJson as unknown as PipelineResult

export interface SampleSettings {
  /** Share of a week's advertising effect carried into the next week (0.1–0.9). */
  adstockDecay: number
  /** Number of annual sine/cosine pairs (1–5). */
  harmonics: number
  /** Walk-forward validation folds (3–8). */
  folds: number
  /** Admissions-calendar flags the model is allowed to use. */
  seasonFlags: { winter_surge: boolean; yield_period: boolean; summer_ramp: boolean; peak_deadline: boolean }
  /** Data sources included in the run. */
  sources: { spend: boolean; impressions: boolean; billboards: boolean }
}

export const DEFAULT_SETTINGS: SampleSettings = {
  adstockDecay: 0.5,
  harmonics: 3,
  folds: 5,
  seasonFlags: { winter_surge: true, yield_period: true, summer_ramp: true, peak_deadline: true },
  sources: { spend: true, impressions: true, billboards: true },
}

export const LIMITS = {
  adstockDecay: { min: 0.1, max: 0.9, step: 0.1 },
  harmonics: { min: 1, max: 5, step: 1 },
  folds: { min: 3, max: 8, step: 1 },
} as const

/* ── deterministic noise ───────────────────────────────────── */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── the admissions calendar (documented in CLAUDE.md) ─────── */
function calendarLevel(w: number): number {
  if (w <= 1) return 70
  if (w <= 8) return 230 - (w - 2) * 16 // winter surge, easing
  if (w <= 18) return 115 - (w - 9) * 5.5 // yield period
  if (w <= 31) return 36 // summer lull
  if (w <= 40) return 44 * Math.pow(1.24, w - 31) // summer ramp
  if (w <= 43) return [0, 330, 420, 540][w - 40]
  if (w <= 46) return [0, 980, 860, 360][w - 43] // peak deadline
  return Math.max(60, 300 - (w - 47) * 42) // after the deadline
}
const inWindow = (w: number, a: number, b: number) => w >= a && w <= b

/* ── spend windows mirror the real coverage gaps ───────────── */
type Window = [string, string]
const CHANNELS: { key: string; weekly: number; windows: Window[] }[] = [
  { key: "meta_spend", weekly: 20, windows: [["2024-10", "2025-04"], ["2025-09", "2026-01"]] },
  { key: "google_ppc_spend", weekly: 15, windows: [["2024-10", "2025-04"], ["2025-08", "2026-01"]] },
  // ran alongside Meta and PPC, so the sample's model can't separate it: its
  // estimate comes out negative, the same artifact the live data shows
  { key: "snapchat_spend", weekly: -5, windows: [["2024-10", "2025-04"], ["2025-09", "2026-01"]] },
  { key: "youtube_spend", weekly: 6, windows: [["2025-09", "2025-12"]] },
  { key: "display_spend", weekly: 7, windows: [["2024-10", "2025-06"], ["2025-09", "2026-01"]] },
  { key: "google_ip_spend", weekly: 4, windows: [["2024-10", "2024-12"], ["2025-10", "2025-12"]] },
]
const IMPRESSION_WINDOWS: Window[] = [["2023-01", "2024-07"], ["2024-10", "2025-06"], ["2025-09", "2025-12"]]
const active = (ym: string, windows: Window[]) => windows.some(([a, b]) => ym >= a && ym <= b)

const r2 = (a: number[], p: number[]) => {
  const mean = a.reduce((s, v) => s + v, 0) / a.length
  const sst = a.reduce((s, v) => s + (v - mean) ** 2, 0) || 1
  const sse = a.reduce((s, v, i) => s + (v - p[i]) ** 2, 0)
  return 1 - sse / sst
}
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

/** Shaped like the real data, every number generated; used only to size how settings move the real run. */
function generate(s: SampleSettings): PipelineResult {
  const seed = Math.round(s.adstockDecay * 10) * 1000 + s.harmonics * 100 + s.folds
  const rand = mulberry32(20260930 + seed)
  const noise = () => (rand() + rand() + rand() - 1.5) / 1.5 // ~N(0, 0.33)

  // Mondays from 2023-01-02 to 2026-05-25, the same span as the live data
  const n = 178
  const start = Date.UTC(2023, 0, 2)
  const yearLift: Record<number, number> = { 2023: 1, 2024: 1.1, 2025: 0.94, 2026: 0.97 }

  // Harmonics: 3 is the sweet spot. Fewer under-fits the calendar's shape,
  // more starts chasing noise (better in-sample, worse out-of-sample).
  const shapeFit = [0, 0.55, 0.8, 0.9, 0.93, 0.95][s.harmonics]
  const overfit = Math.max(0, s.harmonics - 3) * 0.06

  const f = s.seasonFlags
  const channels = s.sources.spend ? CHANNELS : []
  const carry: Record<string, number> = {}
  let spendWeeks = 0
  const weekly: PipelineResult["weekly"] = []
  const contrib: PipelineResult["channel_contribution_weekly"] = []

  for (let i = 0; i < n; i++) {
    const t = start + i * 7 * 86_400_000
    const d = new Date(t)
    const date = d.toISOString().slice(0, 10)
    const ym = date.slice(0, 7)
    const w = isoWeek(d)
    const lift = yearLift[d.getUTCFullYear()] ?? 1
    const level = calendarLevel(w) * lift
    const intensity = Math.min(1.6, 0.35 + level / 400) // campaigns lean into busy weeks

    // what the model can represent of the calendar, given its settings
    let modeledLevel = 40 + (level - 40) * shapeFit
    if (!f.peak_deadline && inWindow(w, 44, 46)) modeledLevel *= 0.52
    if (!f.winter_surge && inWindow(w, 2, 8)) modeledLevel *= 0.78
    if (!f.summer_ramp && inWindow(w, 32, 40)) modeledLevel *= 0.85
    if (!f.yield_period && inWindow(w, 9, 18)) modeledLevel *= 0.93

    const point: PipelineResult["channel_contribution_weekly"][number] = { date, baseline: 0 }
    let paid = 0
    if (channels.some((ch) => active(ym, ch.windows)) && ym !== "2025-07") spendWeeks++
    for (const ch of channels) {
      const on = active(ym, ch.windows) && ym !== "2025-07"
      const impulse = on ? ch.weekly * intensity * (0.85 + rand() * 0.3) : 0
      carry[ch.key] = impulse + (carry[ch.key] ?? 0) * s.adstockDecay
      // heavier decay spreads the same effect over more weeks
      const v = carry[ch.key] * (1 - s.adstockDecay) * 1.9
      point[ch.key] = round(v)
      paid += v
    }
    if (s.sources.impressions) {
      const on = active(ym, IMPRESSION_WINDOWS)
      point.impressions = on ? round(6 + level * 0.02) : 0
      paid += point.impressions as number
    }
    const baseline = Math.max(10, modeledLevel - paid * 0.35)
    point.baseline = round(baseline)
    contrib.push(point)

    const predicted = baseline + paid
    // real weeks spike past the model at the deadline and wobble elsewhere
    const deadlineSurprise = inWindow(w, 44, 45) ? 1.3 + 0.35 * rand() : 1
    const wobble = 1 + noise() * (0.3 + overfit * 0.3)
    // plus week-level noise in absolute applications (events, weather, a Slate batch landing late)
    const jolt = (rand() - 0.5) * 110
    const actual = Math.max(4, Math.round(level * deadlineSurprise * wobble + (predicted - modeledLevel) * 0.25 + jolt))
    weekly.push({ date, actual, predicted: round(predicted) })
  }

  /* ── metrics, computed from the series above ──────────────── */
  const a = weekly.map((x) => x.actual)
  const p = weekly.map((x) => x.predicted)
  const inR2 = r2(a, p)
  const resid = a.map((v, i) => v - p[i])
  const mae = resid.reduce((acc, v) => acc + Math.abs(v), 0) / n
  const dw = resid.slice(1).reduce((acc, v, i) => acc + (v - resid[i]) ** 2, 0) / resid.reduce((acc, v) => acc + v * v, 0)

  // walk-forward folds: the earliest fold trains on the least history, so it
  // scores worst; extra harmonics cost out-of-sample fit
  const chunk = Math.floor(n / (s.folds + 1))
  const folds: number[] = []
  for (let k = 0; k < s.folds; k++) {
    const lo = (k + 1) * chunk
    const hi = k === s.folds - 1 ? n : lo + chunk
    const scarce = (s.folds - k) / s.folds
    const fit = r2(a.slice(lo, hi), p.slice(lo, hi))
    folds.push(round(fit - 1.15 * scarce * scarce - overfit * 2 + (rand() - 0.5) * 0.12, 4))
  }
  const mean = (xs: number[]) => xs.reduce((acc, v) => acc + v, 0) / xs.length
  const cvMean = mean(folds)
  const cvStd = Math.sqrt(folds.reduce((acc, v) => acc + (v - cvMean) ** 2, 0) / folds.length)
  const sorted = [...folds].sort((x, y) => x - y)
  const cvMedian = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  // Calendar-only benchmark on the same folds. With any marketing source in,
  // the calendar alone scores higher on all but one fold, as on the live
  // data; with none, the two models are the same and there's nothing to test.
  const hasMarketing = channels.length > 0 || s.sources.impressions
  const baselineFolds = folds.map((v, k) =>
    round(hasMarketing ? v + (k === 1 ? -0.03 : 0.14 + rand() * 0.08) : v, 4),
  )
  const diffs = folds.map((v, k) => v - baselineFolds[k])
  const lift = mean(diffs)
  const won = diffs.filter((d) => d > 0).length

  /* ── coefficients (standardized, illustrative) ────────────── */
  const coefficients: Record<string, number> = { week_num: -1.4 }
  if (f.peak_deadline) coefficients.peak_deadline = 96.4
  if (f.winter_surge) coefficients.winter_surge = 21.8
  if (f.yield_period) coefficients.yield_period = 2.6
  if (f.summer_ramp) coefficients.summer_ramp = -7.9
  const harmonicSize = [0, 52, 17, 6, 2.4, 1.1]
  for (let h = 1; h <= s.harmonics; h++) {
    coefficients[`sin_${h}`] = round(-harmonicSize[h] * (h % 2 ? 1 : -0.6), 2)
    coefficients[`cos_${h}`] = round(harmonicSize[h] * (h % 2 ? 0.9 : -0.8), 2)
  }
  if (s.sources.impressions) {
    coefficients.impressions_observed = -4.1
    coefficients.impressions = 14.2
  }
  if (channels.length) coefficients.spend_observed = 2.3
  const chanCoef: Record<string, number> = {
    meta_spend: 9.1,
    google_ppc_spend: 6.3,
    snapchat_spend: -11.8,
    youtube_spend: 1.2,
    display_spend: 2.7,
    google_ip_spend: 0.8,
  }
  for (const ch of channels) coefficients[`${ch.key}_adstock`] = round(chanCoef[ch.key] * (0.8 + s.adstockDecay * 0.4), 2)

  const vif: Record<string, number> = {}
  for (const k of Object.keys(coefficients)) vif[k] = round(1.4 + rand() * 5, 2)
  const high: Record<string, number> = {}
  if (s.sources.spend) {
    vif.meta_spend_adstock = high.meta_spend_adstock = 14.2
    vif.google_ppc_spend_adstock = high.google_ppc_spend_adstock = 18.9
    vif.snapchat_spend_adstock = high.snapchat_spend_adstock = 12.1
  }
  const highKeys = Object.keys(high)

  return {
    rows: n,
    date_range: [weekly[0].date, weekly[n - 1].date],
    spend_channels: channels.map((c) => c.key),
    spend_coverage: s.sources.spend ? { weeks_covered: spendWeeks, total_weeks: n } : null,
    features_used: Object.keys(coefficients),
    selected_ridge_alpha: round(4 + s.harmonics * 1.3, 3),
    in_sample_metrics: { "R²": round(inR2, 4), "Adj R²": round(inR2 - 0.03, 4), MAE: round(mae, 3), "Durbin-Watson": round(dw, 4) },
    cross_validation: {
      per_fold_r2: folds,
      mean_r2: round(cvMean, 4),
      median_r2: round(cvMedian, 4),
      std_r2: round(cvStd, 4),
      min_train_weeks: 52,
    },
    // no marketing inputs → no marketing test to report
    marketing_lift: hasMarketing
      ? {
          full_mean_r2: round(cvMean, 4),
          baseline_mean_r2: round(mean(baselineFolds), 4),
          lift: round(lift, 4),
          folds_won: won,
          folds: folds.length,
          identified: lift >= 0.02 && won > folds.length / 2,
        }
      : undefined,
    coefficients,
    multicollinearity: {
      condition_number: 21.7,
      high_condition_number: false,
      vif,
      high_vif_features: high,
      warning: highKeys.length
        ? `High multicollinearity detected: coefficients for ${highKeys.join(", ")} may be unstable; treat individual channel attribution as directional, not precise.`
        : null,
    },
    weekly,
    channel_contribution_weekly: contrib,
  }
}

/* ── the real run, moved by changed settings ───────────────── */
const mean = (xs: number[]) => xs.reduce((acc, v) => acc + v, 0) / xs.length
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
let generatedDefault: PipelineResult | null = null

export function sampleResult(s: SampleSettings = DEFAULT_SETTINGS): PipelineResult {
  if (JSON.stringify(s) === JSON.stringify(DEFAULT_SETTINGS)) return clone(SNAPSHOT)

  const snap = SNAPSHOT
  const g = generate(s)
  const g0 = (generatedDefault ??= generate(DEFAULT_SETTINGS))
  // generator units → the snapshot's index (average week = 100)
  const m = 100 / mean(g0.weekly.map((w) => w.actual))

  const weekly = snap.weekly.map((w, i) => ({
    date: w.date,
    actual: w.actual,
    predicted: round(w.predicted + m * (g.weekly[i].predicted - g0.weekly[i].predicted)),
  }))
  const contrib = snap.channel_contribution_weekly.map((p, i) => {
    const point: PipelineResult["channel_contribution_weekly"][number] = { date: p.date, baseline: 0 }
    let others = 0
    for (const key of Object.keys(g.channel_contribution_weekly[i])) {
      if (key === "date" || key === "baseline") continue
      const v = round(Number(p[key] ?? 0) + m * (Number(g.channel_contribution_weekly[i][key]) - Number(g0.channel_contribution_weekly[i][key] ?? 0)))
      point[key] = v
      others += v
    }
    point.baseline = round(weekly[i].predicted - others) // keeps the split adding up to the forecast
    return point
  })

  /* in-sample fit, recomputed on the real actuals */
  const a = weekly.map((x) => x.actual)
  const p = weekly.map((x) => x.predicted)
  const n = a.length
  const inR2 = r2(a, p)
  const resid = a.map((v, i) => v - p[i])
  const mae = mean(resid.map(Math.abs))
  const dw = resid.slice(1).reduce((acc, v, i) => acc + (v - resid[i]) ** 2, 0) / resid.reduce((acc, v) => acc + v * v, 0)
  const nFeat = Object.keys(g.coefficients).length
  const adj = 1 - ((1 - inR2) * (n - 1)) / Math.max(1, n - nFeat - 1)

  /* walk-forward folds: the real ones, shifted by how the setting moves them */
  const snapFolds = snap.cross_validation.per_fold_r2
  const gFolds = g.cross_validation.per_fold_r2
  const g0Folds = g0.cross_validation.per_fold_r2
  const sameCount = gFolds.length === snapFolds.length
  const folds = sameCount
    ? snapFolds.map((v, i) => round(v + (gFolds[i] - g0Folds[i]), 4))
    : gFolds.map((v) => round(v + (mean(snapFolds) - mean(g0Folds)), 4))
  const snapLift = snap.marketing_lift as (PipelineResult["marketing_lift"] & { baseline_per_fold_r2?: number[] }) | undefined
  const snapBase = snapLift?.baseline_per_fold_r2 ?? snapFolds
  const gap = snapBase.map((v, i) => v - snapFolds[i])
  const hasMarketing = !!g.marketing_lift
  const baseFolds = folds.map((v, i) => round(hasMarketing ? v + (sameCount ? gap[i] : mean(gap)) : v, 4))
  const diffs = folds.map((v, i) => v - baseFolds[i])
  const lift = mean(diffs)
  const won = diffs.filter((d) => d > 0).length
  const cvMean = mean(folds)
  const sorted = [...folds].sort((x, y) => x - y)
  const cvMedian = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  /* coefficients and VIF: real where the feature exists in the real run */
  const coefficients: Record<string, number> = {}
  for (const [key, v] of Object.entries(g.coefficients)) {
    const real = snap.coefficients[key]
    const base = g0.coefficients[key]
    coefficients[key] = real !== undefined ? round(real * (base ? v / base : 1), 4) : round(v * m, 4)
  }
  const vif: Record<string, number> = {}
  for (const key of Object.keys(coefficients)) vif[key] = snap.multicollinearity.vif?.[key] ?? g.multicollinearity.vif?.[key] ?? 1
  const high: Record<string, number> = {}
  for (const key of Object.keys(snap.multicollinearity.high_vif_features ?? {})) if (key in coefficients) high[key] = vif[key]
  const highKeys = Object.keys(high)

  return {
    ...clone(snap),
    spend_channels: g.spend_channels,
    spend_coverage: g.spend_coverage ? snap.spend_coverage : null,
    features_used: Object.keys(coefficients),
    selected_ridge_alpha: round(snap.selected_ridge_alpha + (g.selected_ridge_alpha - g0.selected_ridge_alpha), 3),
    in_sample_metrics: { "R²": round(inR2, 4), "Adj R²": round(adj, 4), MAE: round(mae, 3), "Durbin-Watson": round(dw, 4) },
    cross_validation: {
      per_fold_r2: folds,
      mean_r2: round(cvMean, 4),
      median_r2: round(cvMedian, 4),
      std_r2: round(Math.sqrt(mean(folds.map((v) => (v - cvMean) ** 2))), 4),
      min_train_weeks: snap.cross_validation.min_train_weeks,
    },
    marketing_lift: hasMarketing
      ? {
          full_mean_r2: round(cvMean, 4),
          baseline_mean_r2: round(mean(baseFolds), 4),
          lift: round(lift, 4),
          folds_won: won,
          folds: folds.length,
          identified: lift >= 0.02 && won > folds.length / 2,
        }
      : undefined,
    coefficients,
    multicollinearity: {
      ...snap.multicollinearity,
      vif,
      high_vif_features: high,
      warning: highKeys.length
        ? `High multicollinearity detected: coefficients for ${highKeys.join(", ")} may be unstable; treat individual channel attribution as directional, not precise.`
        : null,
    },
    weekly,
    channel_contribution_weekly: contrib,
  }
}
