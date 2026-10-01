/**
 * Channel + feature vocabulary shared by every chart, table and legend, so a
 * channel wears the same colour and the same name everywhere — demo or real,
 * bar, line or table. Colour follows the entity, never its position in a
 * filtered list.
 */
import { T } from "./theme"

/** Canonical stacking / legend order. Palette slot i belongs to entry i+1. */
export const CHANNEL_ORDER = [
  "baseline",
  "meta_spend",
  "google_ppc_spend",
  "snapchat_spend",
  "youtube_spend",
  "display_spend",
  "google_ip_spend",
  "billboard_spend",
  "impressions",
] as const

const LABELS: Record<string, string> = {
  baseline: "Baseline & seasonality",
  meta_spend: "Meta (IG/FB)",
  google_ppc_spend: "Google PPC",
  snapchat_spend: "Snapchat",
  youtube_spend: "YouTube",
  display_spend: "Display Retargeting",
  google_ip_spend: "Google IP Targeting",
  billboard_spend: "Billboards",
  impressions: "Ad impressions",
  mobile_footprinting_spend: "Mobile Footprinting",
  email_sends: "Email sends",
  direct_mail_spend: "Direct Mail",
}

/** Display names (as used by the demo generator) → canonical keys. */
const ALIASES: Record<string, string> = {
  "meta (ig/fb)": "meta_spend",
  meta: "meta_spend",
  "google ppc": "google_ppc_spend",
  snapchat: "snapchat_spend",
  youtube: "youtube_spend",
  "display retargeting": "display_spend",
  display: "display_spend",
  "google ip targeting": "google_ip_spend",
  billboards: "billboard_spend",
  billboard: "billboard_spend",
  "baseline/seasonality": "baseline",
  "baseline & seasonality": "baseline",
}

export function canonicalKey(nameOrKey: string): string {
  return ALIASES[nameOrKey.trim().toLowerCase()] ?? nameOrKey
}

/** Human label for a raw pipeline key (`google_ppc_spend`) or a display name. */
export function channelLabel(nameOrKey: string): string {
  const key = canonicalKey(nameOrKey)
  if (LABELS[key]) return LABELS[key]
  return key
    .replace(/_spend$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Stable colour for an entity. Baseline is neutral context; unknown keys fold to "other" gray. */
export function channelColor(nameOrKey: string): string {
  const key = canonicalKey(nameOrKey)
  if (key === "baseline") return T.neutralSeries
  const slot = CHANNEL_ORDER.indexOf(key as (typeof CHANNEL_ORDER)[number])
  if (slot < 1) return "#9C978E"
  return T.ch[slot - 1]
}

/** Sort series into canonical order; anything unknown goes last. */
export function orderSeries(keys: string[]): string[] {
  const rank = (k: string) => {
    const i = CHANNEL_ORDER.indexOf(canonicalKey(k) as (typeof CHANNEL_ORDER)[number])
    return i === -1 ? CHANNEL_ORDER.length : i
  }
  return [...keys].sort((a, b) => rank(a) - rank(b))
}

/* ── model features ─────────────────────────────────────────── */

export type FeatureGroup = "Seasonality & trend" | "Advertising signals"

const FEATURE_LABELS: Record<string, string> = {
  week_num: "Long-term trend",
  peak_deadline: "Peak deadline (weeks 44–46)",
  winter_surge: "Winter surge (weeks 1–8)",
  yield_period: "Yield period (weeks 9–18)",
  summer_ramp: "Summer ramp (weeks 32–40)",
  impressions: "Ad impressions",
  campaign_active: "Campaign running",
  impressions_lag1: "Ad impressions, prior week",
}

export function featureLabel(key: string): string {
  if (FEATURE_LABELS[key]) return FEATURE_LABELS[key]
  const harmonic = key.match(/^(sin|cos)_(\d)$/)
  if (harmonic) return `Annual cycle · ${harmonic[1]} harmonic ${harmonic[2]}`
  if (key.endsWith("_adstock")) return `${channelLabel(key.replace(/_adstock$/, ""))} · adstocked spend`
  return channelLabel(key)
}

export function featureGroup(key: string): FeatureGroup {
  if (key.endsWith("_adstock")) return "Advertising signals"
  if (["impressions", "campaign_active", "impressions_lag1"].includes(key)) return "Advertising signals"
  return "Seasonality & trend"
}

/**
 * Display-only: swap raw model feature keys that appear inside backend
 * prose (e.g. the multicollinearity warning's "meta_spend_adstock") for the
 * names a marketer knows ("Meta (IG/FB)"). Only recognised feature keys are
 * touched; everything else in the sentence is left exactly as sent.
 */
export function humanizeFeatureNames(text: string): string {
  return text.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (m) => {
    if (m.endsWith("_adstock")) return channelLabel(m.replace(/_adstock$/, ""))
    if (m.endsWith("_spend") || /^(sin|cos)_\d$/.test(m) || m in FEATURE_LABELS) return featureLabel(m)
    return m
  })
}

/** Kept for App.tsx / callers that predate this module. */
export const humanizeChannel = channelLabel
