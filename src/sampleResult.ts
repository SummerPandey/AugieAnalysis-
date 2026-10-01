/**
 * Synthetic sample run for signed-out visitors. It is shaped like
 * Augustana's data (181 weeks, the admissions calendar, the same channels and
 * the same spend-history gaps as projectStatus.ts) but every number is
 * generated. Nothing here comes from real Slate or Carnegie figures.
 *
 * It returns a PipelineResult, so the demo is read by exactly the same
 * results view, ledger and caveats as a live run. The model settings chosen
 * in the demo change the output in the direction the real model would move,
 * which is what makes the settings worth touching.
 */
import type { PipelineResult } from "./api"
import { isoWeek } from "./insights"

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

export function sampleResult(s: SampleSettings = DEFAULT_SETTINGS): PipelineResult {
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
    if (s.sources.billboards) {
      point.billboard_spend = round(2.2 + level * 0.004)
      paid += point.billboard_spend as number
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
  const cvMean = folds.reduce((acc, v) => acc + v, 0) / folds.length
  const cvStd = Math.sqrt(folds.reduce((acc, v) => acc + (v - cvMean) ** 2, 0) / folds.length)

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
    coefficients.impressions = 5.8
    coefficients.campaign_active = 2.9
    coefficients.impressions_lag1 = 11.6
  }
  const chanCoef: Record<string, number> = {
    meta_spend: 9.1,
    google_ppc_spend: 6.3,
    snapchat_spend: -11.8,
    youtube_spend: 1.2,
    display_spend: 2.7,
    google_ip_spend: 0.8,
  }
  for (const ch of channels) coefficients[`${ch.key}_adstock`] = round(chanCoef[ch.key] * (0.8 + s.adstockDecay * 0.4), 2)
  if (s.sources.billboards) coefficients.billboard_spend_adstock = 1.5

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
    spend_channels: [...channels.map((c) => c.key), ...(s.sources.billboards ? ["billboard_spend"] : [])],
    spend_coverage: s.sources.spend ? { weeks_covered: spendWeeks, total_weeks: n } : null,
    features_used: Object.keys(coefficients),
    selected_ridge_alpha: round(4 + s.harmonics * 1.3, 3),
    in_sample_metrics: { "R²": round(inR2, 4), "Adj R²": round(inR2 - 0.03, 4), MAE: round(mae, 3), "Durbin-Watson": round(dw, 4) },
    cross_validation: { per_fold_r2: folds, mean_r2: round(cvMean, 4), std_r2: round(cvStd, 4) },
    coefficients,
    multicollinearity: {
      condition_number: 48210.5,
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
