/**
 * The "Easy" reading of one model run: the same result object as the regular
 * view, told in everyday words for someone who has never seen a statistics
 * class. No R², no coefficients, no jargon. Every number is still derived from
 * the result, and the caution rules are the same: if marketing didn't beat the
 * calendar on unseen weeks, nothing here says an ad channel worked.
 *
 * Wording was tested on 20 simulated non-technical readers (counselor,
 * trustee, ESL reader, reader with dyslexia, …). What they asked for: one
 * name for "the forecast", a unit on every number, no grades or idioms,
 * "we don't know yet" instead of anything that reads as "the ads failed",
 * and a plain line on what each ad channel is.
 */
import { useMemo, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts"
import type { PipelineResult } from "./api"
import { T } from "./theme"
import { canonicalKey } from "./channels"
import { driverLedger, isoWeek, trust, type LedgerRow, type Verdict } from "./insights"
import { AXIS_TICK, ChartTip, fmtApps, fmtWeekOf } from "./ui"
import { IconCheck, IconInfo, IconWarning } from "./icons"

type Answer = "yes" | "maybe" | "not-yet" | "untested"

/** Did adding ads help the forecast guess unseen weeks better than the calendar alone? */
function adsAnswer(r: PipelineResult, ledger: LedgerRow[]): Answer {
  const l = r.marketing_lift
  if (!l) return "untested"
  if (!l.identified) return "not-yet"
  return ledger.some((x) => x.verdict === "helping") ? "yes" : "maybe"
}

const CHANNEL_WORDS: Record<Verdict, { text: string; tone: "good" | "unsure" | "none" }> = {
  calendar: { text: "", tone: "none" },
  helping: { text: "Rises with applications", tone: "good" },
  directional: { text: "May help, amount unclear", tone: "unsure" },
  thin: { text: "Not enough data yet", tone: "none" },
  "cant-tell": { text: "Not enough data yet", tone: "none" },
}

/** One plain line on what each channel is, for readers who don't buy ads. */
const CHANNEL_WHAT: Record<string, { name: string; what: string }> = {
  meta_spend: { name: "Instagram & Facebook", what: "Ads in Instagram and Facebook feeds" },
  google_ppc_spend: { name: "Google search ads", what: "Ads that show when someone searches on Google" },
  snapchat_spend: { name: "Snapchat", what: "Ads inside the Snapchat app" },
  youtube_spend: { name: "YouTube", what: "Video ads before or during YouTube videos" },
  display_spend: { name: "Follow-up web ads", what: "Ads shown to people who already visited our website" },
  google_ip_spend: { name: "Targeted web ads", what: "Ads shown on devices at chosen places, like high schools" },
  mobile_footprinting_spend: { name: "Location-based phone ads", what: "Ads on phones that visited chosen places" },
  billboard_spend: { name: "Billboards", what: "Roadside and airport signs" },
  email_sends: { name: "Email", what: "Emails sent to prospective students" },
  direct_mail_spend: { name: "Direct mail", what: "Printed mail sent to homes" },
}

const monthDay = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
const monthYear = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

/** Highest week of each year that has a real deadline peak in it. */
function peaksByYear(weekly: PipelineResult["weekly"]) {
  const best = new Map<string, PipelineResult["weekly"][number]>()
  for (const w of weekly) {
    const y = w.date.slice(0, 4)
    const cur = best.get(y)
    if (!cur || w.actual > cur.actual) best.set(y, w)
  }
  return [...best.values()].filter((w) => w.actual > 400)
}

/** Average applications in the deadline weeks (44–46) vs the summer lull (20–30). */
function busyVsQuiet(weekly: PipelineResult["weekly"]) {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const inWeeks = (lo: number, hi: number) =>
    weekly.filter((w) => {
      const k = isoWeek(new Date(w.date))
      return k >= lo && k <= hi
    })
  const busy = avg(inWeeks(44, 46).map((w) => w.actual))
  const quiet = avg(inWeeks(20, 30).map((w) => w.actual))
  return { busy, quiet, ratio: quiet > 0 ? busy / quiet : undefined }
}

function Tile({ kicker, children, tone }: { kicker: string; children: ReactNode; tone?: "good" | "warn" }) {
  return (
    <div className={`card easy-tile${tone ? ` easy-tile-${tone}` : ""}`}>
      <p className="easy-kicker">{kicker}</p>
      {children}
    </div>
  )
}

export default function EasyView({ result, live }: { result: PipelineResult; live: boolean }) {
  const ledger = useMemo(() => driverLedger(result), [result])
  const t = useMemo(() => trust(result), [result])
  const peaks = useMemo(() => peaksByYear(result.weekly), [result])
  const season = useMemo(() => busyVsQuiet(result.weekly), [result])
  const answer = adsAnswer(result, ledger)
  const channels = ledger.filter((x) => x.key !== "baseline" && x.key !== "impressions")
  const calendarShare = Math.round(Math.max(0, Math.min(1, ledger.find((x) => x.key === "baseline")?.share ?? 0)) * 100)
  const yearTicks = useMemo(
    () => result.weekly.filter((w, i, a) => i === 0 || w.date.slice(0, 4) !== a[i - 1].date.slice(0, 4)).map((w) => w.date).slice(1),
    [result],
  )
  const missPct = t.maeShare !== undefined ? Math.round(t.maeShare * 100) : undefined
  const end = monthYear(t.dataEnd)
  // a clear win for time-of-year alone shouldn't be softened to "about equal"
  const lift = result.marketing_lift
  const calendarWon = !!lift && lift.baseline_mean_r2 - lift.full_mean_r2 >= 0.05

  const big: Record<Answer, { title: string; body: string[] }> = {
    "not-yet": {
      title: "Applications rise and fall with the school year. We don't know yet if the ads bring in more.",
      body: [
        "We made two forecasts of past weeks. One used only the time of year. The other also used ad data.",
        calendarWon
          ? "The one that used only the time of year was more accurate. So the ad data did not add anything we could measure."
          : "Both forecasts were about equally good. So the ad data did not add anything we could measure.",
        "This does not mean the ads failed. We need more ad data before we can measure them.",
      ],
    },
    maybe: {
      title: "Applications rise and fall with the school year. Ads may add a few more, but we can't say how many.",
      body: [
        "Adding ad data made the forecast a little better.",
        "But the ad channels ran at the same times, so we can't tell which one did the work.",
      ],
    },
    yes: {
      title: "Applications rise and fall with the school year. Ads seem to add a few more on top.",
      body: [
        "Adding ad data made the forecast better.",
        "This is a pattern in past data, not proof. A planned test would confirm it.",
      ],
    },
    untested: {
      title: "Applications rise and fall with the school year.",
      body: ["This run had no ad data, so it can't tell us anything about ads."],
    },
  }

  return (
    <div className="easy">
      <p className="easy-intro">
        This page answers one question: <strong>do our ads bring in more student applications?</strong> To find out, a
        computer forecast studied every week of applications we have on file.
      </p>

      {/* 1 — the answer */}
      <section className="card easy-answer" aria-label="The short answer">
        <p className="easy-kicker">The short answer</p>
        <h3 className="easy-title">{big[answer].title}</h3>
        <div className="easy-body easy-answer-body">
          {big[answer].body.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
        {t.weeksStale >= 8 && (
          <p className="easy-note">
            <IconWarning size={14} /> The data ends in {end}. Anything after that, including this fall, is not included yet.
          </p>
        )}
      </section>

      {/* 2 — three things to know */}
      <div className="easy-tiles">
        <Tile kicker="When students apply">
          <p className="easy-big">Most apply in late October to mid November</p>
          <p className="easy-body">
            That's the application deadline. It's the busiest time every year.
            {season.ratio !== undefined && season.ratio >= 1.5 && (
              <> On average, a deadline week gets about <strong>{Math.round(season.ratio)} times</strong> as many applications as a summer week.</>
            )}
          </p>
        </Tile>
        <Tile kicker="Do the ads help?" tone={answer === "yes" ? "good" : answer === "not-yet" ? "warn" : undefined}>
          <p className="easy-big">
            {answer === "yes" ? "Probably a little" : answer === "maybe" ? "Maybe a little" : answer === "not-yet" ? "We don't know yet" : "Not tested"}
          </p>
          <p className="easy-body">
            {answer === "not-yet"
              ? "We need more ad data to measure them. For now, the time of year explains the ups and downs."
              : answer === "untested"
                ? "There was no ad data in this run."
                : "Adding ad data made the forecast a little better."}
          </p>
        </Tile>
        <Tile kicker="How close is the forecast?">
          <p className="easy-big">
            Usually off by about {t.mae !== undefined ? fmtApps(t.mae) : "—"} applications a week
          </p>
          <p className="easy-body">
            That's the average miss. A typical week has about {fmtApps(t.meanActual)} applications
            {missPct !== undefined && <>, so the forecast is usually within about {missPct}%</>}. Good for planning. Not
            exact.
          </p>
        </Tile>
      </div>

      {/* 3 — the picture */}
      <section className="card easy-chart" aria-label="Applications each week">
        <p className="easy-kicker">Applications each week</p>
        <div className="easy-key" aria-hidden>
          <span>
            <i style={{ background: T.actual }} /> Real applications
          </span>
          <span>
            <i className="easy-key-dash" style={{ color: T.modeled }} /> The forecast
          </span>
        </div>
        <div className="easy-chart-box">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={result.weekly} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.grid} vertical={false} />
            <XAxis dataKey="date" ticks={yearTicks} tickFormatter={(d: string) => d.slice(0, 4)} interval={0} tick={AXIS_TICK} axisLine={{ stroke: T.axis }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={fmtApps} />
            <RTooltip content={<ChartTip formatter={fmtApps} labelFormatter={fmtWeekOf} />} />
            <Line type="monotone" dataKey="actual" name="Real applications" stroke={T.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="predicted" name="The forecast" stroke={T.modeled} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        </div>
        <p className="easy-body easy-chart-note">Each tall spike is the application deadline in the fall.</p>
        {peaks.length > 0 && (
          <ul className="easy-peaks">
            {peaks.map((p) => (
              <li key={p.date}>
                <span className="easy-peak-year">{p.date.slice(0, 4)}</span> Busiest week: <strong>{fmtApps(p.actual)}</strong>{" "}
                applications (week of {monthDay(p.date)})
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4 — each ad channel */}
      {channels.length > 0 && (
        <section className="card easy-channels" aria-label="Each type of ad">
          <p className="easy-kicker">Each type of ad</p>
          <p className="easy-body">
            {answer === "not-yet"
              ? "No type of ad was tested and failed. We will judge each one once we have more ad data."
              : "What we can say about each one so far."}
          </p>
          <ul className="easy-list">
            {channels.map((c) => {
              const w = CHANNEL_WORDS[c.verdict]
              const info = CHANNEL_WHAT[canonicalKey(c.key)]
              return (
                <li key={c.key}>
                  <span className="easy-ch">
                    <span className="easy-ch-name">{info?.name ?? c.label}</span>
                    {info && <span className="easy-ch-what">{info.what}</span>}
                  </span>
                  <span className={`easy-pill easy-pill-${w.tone}`}>
                    {w.tone === "good" ? <IconCheck size={12} /> : <IconInfo size={12} />} {w.text}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 5 — what to do */}
      <div className="easy-tiles easy-tiles-2">
        <Tile kicker="What to do now">
          <ul className="easy-steps">
            {answer === "not-yet" || answer === "untested" ? (
              <>
                <li>Don't raise or cut ad spending because of this page. It can't tell us yet whether the ads pay off.</li>
                <li>Use the school year to plan. It's the best guide to when students apply.</li>
                <li>
                  A good next step: work with the marketing team on a short test. Pause one type of ad for a few weeks,
                  then compare.
                </li>
              </>
            ) : (
              <>
                <li>Treat this as a hint, not proof. Don't move large amounts of money because of it.</li>
                <li>Use the school year to plan. It's still the biggest factor.</li>
                <li>Confirm it with a short test: pause one type of ad for a few weeks, then compare.</li>
              </>
            )}
          </ul>
        </Tile>
        <Tile kicker="What would help us know more">
          <ul className="easy-steps">
            {t.spendWeeks !== undefined && t.totalWeeks !== undefined && (
              <li>
                More records of ad spending. We have them for {t.spendWeeks} of the {t.totalWeeks} weeks so far.
              </li>
            )}
            <li>The dates emails and printed mail were sent.</li>
            <li>The dates billboards were up.</li>
          </ul>
        </Tile>
      </div>

      <div className="easy-foot">
        <IconInfo size={14} />
        <div>
          <p>
            {live ? (
              <>Based on Augustana's weekly applications from {monthYear(t.dataStart)} to {end}.</>
            ) : (
              <>
                <strong>These are made-up sample numbers.</strong> They look like Augustana's weekly applications from{" "}
                {monthYear(t.dataStart)} to {end}, but they are not real counts.
              </>
            )}
          </p>
          <p>
            The forecast credits about {calendarShare}% of applications to the normal yearly rhythm. This is an estimate,
            not proof.
          </p>
          <p>For charts and exact numbers, choose Regular at the top of this page.</p>
        </div>
      </div>
    </div>
  )
}
