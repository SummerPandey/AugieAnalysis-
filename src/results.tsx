/**
 * One results view for every model run: the live Augustana pipeline and the
 * signed-out demo sample are read by the same components, so the demo
 * can never tell a different story than the real tool. Order follows what a
 * marketer asks: what's the answer → how far can I trust it → what did each
 * channel do → what does the AI make of it → the charts → the technical detail.
 */
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { PipelineResult } from "./api"
import { T } from "./theme"
import { channelColor, channelLabel, featureGroup, featureLabel, orderSeries } from "./channels"
import {
  deadlineSeasons,
  downloadText,
  driverLedger,
  FIT_WORDS,
  headline,
  ledgerOverlap,
  resultToCSV,
  shareSummary,
  trust,
  VERDICT_LABEL,
  type LedgerRow,
  type Verdict,
} from "./insights"
import {
  Alert,
  AXIS_TICK,
  Badge,
  card,
  ChartTip,
  Disclosure,
  fmtApps,
  fmtDay,
  fmtStamp,
  fmtWeekOf,
  KpiCard,
  LEGEND_PROPS,
  SectionHeader,
  StepFooter,
  StepHeader,
} from "./ui"
import { Dot, IconArrowRight, IconCheck, IconDownload, IconFlask, IconInfo, IconPrint, IconRefresh, IconWarning } from "./icons"
import { Term } from "./glossary"
import EasyView from "./easyView"
import "./results.css"
import "./easyView.css"

export type CommentaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; error: string }

/* ── verdict chip ──────────────────────────────────────────── */
function IconQuestion({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden className="icon">
      <path d="M7.4 7.3a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.6" />
      <circle cx="10" cy="15" r="0.6" fill="currentColor" />
    </svg>
  )
}
function IconCalendar({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="icon">
      <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
    </svg>
  )
}
/** A card whose children (header, body) carry their own padding. */
const flushCard = { ...card, padding: 0 }

/** Signed number with a real minus sign. */
// null/NaN can come back from the backend for degenerate fits; show a dash instead of crashing
const signed = (v: number | null | undefined, d = 2) =>
  typeof v !== "number" || !Number.isFinite(v) ? "—" : v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d)

const VERDICT_UI: Record<Verdict, { cls: string; Icon: (p: { size?: number }) => ReactNode }> = {
  calendar: { cls: "badge verdict-calendar", Icon: IconCalendar },
  helping: { cls: "badge badge-info", Icon: IconCheck },
  directional: { cls: "badge badge-info", Icon: IconArrowRight },
  thin: { cls: "badge", Icon: IconInfo },
  "cant-tell": { cls: "badge badge-warning", Icon: IconQuestion },
}
export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { cls, Icon } = VERDICT_UI[verdict]
  return (
    <span className={cls}>
      <Icon size={12} />
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

/* ── the finding ───────────────────────────────────────────── */
function Finding({ ledger, stale, dataEnd, unidentified }: { ledger: LedgerRow[]; stale: number; dataEnd: string; unidentified: boolean }) {
  const h = headline(ledger)
  return (
    <section className="finding" aria-label="Headline finding" data-guide="results-finding">
      <p className="finding-lead">
        {h.lead} the model puts about <mark className="finding-mark">{h.figure}</mark> of its predicted applications down to
        the time of year and the long-term trend. That is a <Term id="decomposition">model-based allocation</Term>, not a
        causal measurement: a way of dividing up the forecast, not a count of where applicants came from.
      </p>
      <p className="finding-paid">
        {unidentified ? (
          <>
            No individual channel has an estimate we can support yet. Adding ad data did not beat the{" "}
            <Term id="calendar-only">calendar-only</Term> forecast, so don't raise or cut any channel's budget because of
            this page.
          </>
        ) : (
          <>{h.paid} This is a pattern in past data, not proof.</>
        )}
      </p>
      {stale >= 8 && (
        <p className="finding-stale">
          <IconWarning size={14} /> Data ends {fmtDay(dataEnd)}, {stale} weeks ago, so this run can't see the current
          admissions cycle yet. Ask the analyst for a fresh Slate export before using it for fall planning.
        </p>
      )}
    </section>
  )
}

/* ── driver ledger ─────────────────────────────────────────── */
function Ledger({ rows, modeled }: { rows: LedgerRow[]; modeled: number }) {
  const overlap = ledgerOverlap(rows)
  // scale bars to the channels; the baseline would flatten every one of them
  const max = Math.max(...rows.filter((r) => r.key !== "baseline").map((r) => Math.abs(r.share)), 0.0001)
  return (
    <div style={flushCard}>
      <SectionHeader
        title="How the model divides up the forecast"
        caption="The model splits its predicted applications among the calendar, impressions and each ad channel. This is a model-based allocation, not a causal measurement. The last column says how much to trust each line. It looks at whether marketing beat the calendar-only model, whether the estimate is positive, whether channels ran at the same time, and how many weeks had activity."
      />
      <div className="tbl-wrap">
        <table className="tbl ledger">
          <caption className="sr-only">Predicted applications by source, with how much to trust each</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Applications assigned</th>
              <th scope="col" className="ledger-share-h">
                Share of total
              </th>
              <th scope="col">Weeks active</th>
              <th scope="col">How much to trust this</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const muted = r.verdict === "cant-tell" || r.verdict === "thin"
              return (
                <tr key={r.key} className={muted ? "is-muted" : undefined}>
                  <th scope="row">
                    <span className="ledger-name">
                      <span className="swatch" style={{ background: channelColor(r.key) }} aria-hidden />
                      {r.label}
                    </span>
                    <span className="ledger-mobile num" aria-hidden>
                      {r.verdict === "cant-tell" ? "No number (Can't tell yet)" : `${fmtApps(r.total)} apps · ${(r.share * 100).toFixed(r.share < 0.1 ? 1 : 0)}%`} ·{" "}
                      {r.weeksActive} wks
                    </span>
                    <span className="ledger-reason">{r.reason}</span>
                  </th>
                  <td className="num">{r.verdict === "cant-tell" ? "—" : fmtApps(r.total)}</td>
                  <td className="ledger-share">
                    {r.verdict === "cant-tell" ? (
                      <span className="ledger-na">No number (Can't tell yet)</span>
                    ) : (
                      <span className="ledger-bar-wrap">
                        {r.key !== "baseline" && (
                          <span
                            className="ledger-bar"
                            style={{ width: `${(Math.max(0, r.share) / max) * 100}%`, background: channelColor(r.key) }}
                            aria-hidden
                          />
                        )}
                        <span className="num">{(r.share * 100).toFixed(r.share < 0.1 ? 1 : 0)}%</span>
                      </span>
                    )}
                  </td>
                  <td className="num">{r.weeksActive}</td>
                  <td>
                    <VerdictChip verdict={r.verdict} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {overlap.labels.length > 0 && (
            <tfoot>
              <tr className="ledger-overlap">
                <th scope="row">
                  {overlap.kind === "unidentified" ? (
                    <>
                      <span className="ledger-name">All advertising combined (not split by channel)</span>
                      <span className="ledger-reason">
                        The model allocates this many applications to ads overall (a model-based allocation, not causal). It didn't beat the calendar-only model
                        on weeks it hadn't seen, so treat the total as unproven.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="ledger-name">Share the model couldn't split by channel</span>
                      <span className="ledger-reason">
                        {overlap.labels.join(" and ")} got below-zero estimates because they ran alongside other channels.
                        They are shown as one line so the table adds up to 100%. This is not evidence for or against them.
                      </span>
                    </>
                  )}
                </th>
                <td className="num">{overlap.total < 0 ? "−" : ""}{fmtApps(Math.abs(overlap.total))}</td>
                <td className="num ledger-share">
                  {overlap.share < 0 ? "−" : ""}
                  {(Math.abs(overlap.share) * 100).toFixed(1)}%
                </td>
                <td />
                <td />
              </tr>
              <tr className="ledger-total">
                <th scope="row">
                  <span className="ledger-name">All predicted applications</span>
                </th>
                <td className="num">{fmtApps(modeled)}</td>
                <td className="num ledger-share">100%</td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/* ── AI readout (live only) ────────────────────────────────── */
let turnSeq = 0

function AiCard({
  commentary,
  onAsk,
  onReadout,
}: {
  commentary: CommentaryState
  onAsk?: (q: string) => Promise<string>
  onReadout?: () => void
}) {
  const [q, setQ] = useState("")
  const [thread, setThread] = useState<{ id: number; q: string; a?: string; error?: string }[]>([])
  const busy = thread.some((t) => t.a === undefined && t.error === undefined)
  const inputId = useId()

  async function ask(e: FormEvent) {
    e.preventDefault()
    const question = q.trim()
    if (!question || !onAsk || busy) return
    setQ("")
    const id = ++turnSeq
    setThread((t) => [...t, { id, q: question }])
    try {
      const a = await onAsk(question)
      setThread((t) => t.map((x) => (x.id === id ? { ...x, a } : x)))
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setThread((t) => t.map((x) => (x.id === id ? { ...x, error } : x)))
    }
  }

  return (
    <div className="card ai-card">
      <SectionHeader
        title={
          <>
            AI summary in plain words <span className="ai-tag">Generated</span>
          </>
        }
        caption="Written by an AI model from this run's numbers. It can make mistakes. If it sounds more sure than this page does, trust the page."
      />
      <div className="section-body">
        {commentary.status === "loading" && (
          <div role="status" aria-label="Writing the AI summary" className="ai-loading">
            <div className="skeleton" style={{ height: 13, width: "92%" }} />
            <div className="skeleton" style={{ height: 13, width: "84%" }} />
            <div className="skeleton" style={{ height: 13, width: "88%" }} />
            <p>Writing a plain-words summary. This usually takes 15–30 seconds; the numbers above are already final.</p>
          </div>
        )}
        {commentary.status === "error" && (
          <Alert variant="warning" title="The AI summary isn't available right now">
            {commentary.error} Everything else on this page comes straight from the model and is unaffected.
            {onReadout && (
              <span className="alert-extra">
                <button type="button" className="btn btn-outline btn-sm" onClick={onReadout}>
                  Try the summary again
                </button>
              </span>
            )}
          </Alert>
        )}
        {commentary.status === "idle" && onReadout && (
          <div className="ai-idle">
            <p>No summary for this run yet.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={onReadout}>
              Write the summary
            </button>
          </div>
        )}
        {commentary.status === "ready" && <div className="md">{renderMarkdown(commentary.text)}</div>}

        {onAsk && commentary.status !== "loading" && (
          <div className="ai-followup">
            {thread.map((t) => (
              <div key={t.id} className="ai-turn">
                <p className="ai-q">{t.q}</p>
                {t.a !== undefined && <div className="md">{renderMarkdown(t.a)}</div>}
                {t.error && <p className="ai-err">{t.error}</p>}
                {t.a === undefined && !t.error && (
                  <p role="status" className="ai-wait">
                    Thinking about this run…
                  </p>
                )}
              </div>
            ))}
            <form onSubmit={ask} className="ai-ask no-print">
              <label htmlFor={inputId} className="field-label">
                Ask a follow-up about this run
              </label>
              <div className="ai-ask-row">
                <input
                  id={inputId}
                  className="field"
                  placeholder="e.g. Why is Snapchat marked “Can't tell yet”?"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={busy}
                  maxLength={400}
                />
                <button type="submit" className="btn btn-primary" aria-disabled={busy || !q.trim() || undefined}>
                  Ask
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── charts ────────────────────────────────────────────────── */
/** First week of each Jan/Apr/Jul/Oct, so ticks fall on real quarters. */
function quarterTicks(dates: string[]): string[] {
  const seen = new Set<string>()
  return dates.filter((d) => {
    const m = Number(d.slice(5, 7))
    const key = d.slice(0, 7)
    if (![1, 4, 7, 10].includes(m) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
/** "2024" at January, "Apr" / "Jul" / "Oct" otherwise. */
function fmtQuarter(d: string) {
  const dt = new Date(d)
  return dt.getUTCMonth() === 0
    ? String(dt.getUTCFullYear())
    : dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
}
/** The highest actual week of each calendar year, for peak labels. */
function yearlyPeaks(weekly: PipelineResult["weekly"]) {
  const best = new Map<string, PipelineResult["weekly"][number]>()
  for (const w of weekly) {
    const y = w.date.slice(0, 4)
    const cur = best.get(y)
    if (!cur || w.actual > cur.actual) best.set(y, w)
  }
  // only label a genuine peak, not the last week of a partial year
  return [...best.values()].filter((w) => w.actual > 400)
}
/** First week with any paid-channel activity: everything before it has no spend on file. */
function firstSpendDate(r: PipelineResult): string | undefined {
  const paid = r.spend_channels.filter((k) => k !== "billboard_spend")
  return r.channel_contribution_weekly.find((w) => paid.some((k) => Math.abs(Number(w[k] ?? 0)) > 0))?.date
}

function ActualVsModeled({ r, hatchId, live }: { r: PipelineResult; hatchId: string; live: boolean }) {
  const spendFrom = firstSpendDate(r)
  const first = r.weekly[0]?.date
  const ticks = useMemo(() => quarterTicks(r.weekly.map((w) => w.date)), [r])
  const peaks = useMemo(() => yearlyPeaks(r.weekly), [r])
  return (
    <div style={flushCard}>
      <SectionHeader
        title="Real applications vs. the model's forecast"
        caption={
          <>
            {live ? "Navy line: applications that Slate, our admissions system, recorded each week" : "Navy line: the sample's weekly applications"}.
            Dashed gold line: the model's forecast for the same weeks. Where they are close, the model follows that stretch.
            It tends to run below the biggest fall peaks.
            {spendFrom && spendFrom !== first && <> Hatched weeks have no ad spend records, so ads are not accounted for there.</>}
          </>
        }
      />
      <div className="section-body chart-box">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={r.weekly} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={T.bg} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={T.borderStrong} strokeWidth="1.5" />
              </pattern>
            </defs>
            {spendFrom && first && spendFrom !== first && (
              <ReferenceArea
                x1={first}
                x2={spendFrom}
                fill={`url(#${hatchId})`}
                fillOpacity={1}
                ifOverflow="visible"
                label={{ value: "No spend on file", position: "insideTopLeft", fontSize: 11, fill: T.ts, offset: 8 }}
              />
            )}
            <CartesianGrid stroke={T.grid} vertical={false} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={fmtQuarter}
              interval={0}
              tick={AXIS_TICK}
              axisLine={{ stroke: T.axis }}
              tickLine={false}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={fmtApps} />
            <RTooltip content={<ChartTip formatter={fmtApps} labelFormatter={fmtWeekOf} />} />
            <Legend iconType="plainline" {...LEGEND_PROPS} />
            {peaks.map((w) => (
              <ReferenceDot
                key={w.date}
                x={w.date}
                y={w.actual}
                r={3.5}
                fill={T.actual}
                stroke="#fff"
                strokeWidth={1.5}
                label={{ value: fmtApps(w.actual), position: "top", fontSize: 11, fontWeight: 700, fill: T.tp, offset: 8 }}
              />
            ))}
            <Line type="monotone" dataKey="actual" name={live ? "Actual (Slate)" : "Actual (sample)"} stroke={T.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Model forecast"
              stroke={T.modeled}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DeadlineReplay({ r, live }: { r: PipelineResult; live: boolean }) {
  const seasons = deadlineSeasons(r)
  if (!seasons.length) return null
  const yMax = Math.max(...seasons.flatMap((s) => s.points.map((p) => Math.max(p.actual, p.predicted))))
  const step = yMax > 1200 ? 500 : yMax > 500 ? 250 : 100
  const top = Math.ceil(yMax / step) * step
  const yTicks = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  const lastYear = seasons[seasons.length - 1].year
  return (
    <div style={flushCard}>
      <SectionHeader
        title="The deadline season, year by year"
        caption="Each box covers early September to late December of one year. The gold band is the application deadline period (late Oct to mid Nov). At the peak, the real number is usually higher than the forecast. That gap could come from many things (events, school visits, deadlines, marketing), so it is not evidence that ads worked."
      />
      <div className="section-body">
        <div className="season-grid">
          {seasons.map((s) => {
            const miss = s.peak ? s.peak.actual - s.peak.predicted : 0
            return (
              <figure key={s.year} className="season">
                <figcaption>
                  <span className="season-year">{s.year}</span>
                  {s.peak && (
                    <span className="season-lines">
                      <span>Peak · week {s.peak.week}{s.peak.week === 44 ? " (about Nov 1)" : ""}</span>
                      <span className="num">
                        <strong>{fmtApps(s.peak.actual)}</strong> actual · {fmtApps(s.peak.predicted)} forecast
                      </span>
                      <span className="season-miss num">
                        {miss >= 0 ? "+" : "−"}
                        {fmtApps(Math.abs(miss))} {miss >= 0 ? "above" : "below"} the forecast
                      </span>
                    </span>
                  )}
                </figcaption>
                <div className="chart-box-sm">
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={s.points} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={T.grid} vertical={false} />
                    <XAxis dataKey="week" tick={AXIS_TICK} axisLine={{ stroke: T.axis }} tickLine={false} ticks={[36, 40, 44, 48, 52]} />
                    <YAxis domain={[0, top]} ticks={yTicks} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={fmtApps} />
                    <ReferenceArea x1={44} x2={46} fill={T.goldTint} fillOpacity={0.9} ifOverflow="visible" />
                    <RTooltip content={<ChartTip formatter={fmtApps} labelFormatter={(l) => `Week ${l}, ${s.year}`} />} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke={T.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="predicted" name="Model forecast" stroke={T.modeled} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    {s.peak && <ReferenceDot x={s.peak.week} y={s.peak.actual} r={4} fill={T.actual} stroke="#fff" strokeWidth={2} />}
                  </LineChart>
                </ResponsiveContainer>
                </div>
              </figure>
            )
          })}
          <figure className="season season-empty" aria-label={`${lastYear + 1} season not on file yet`}>
            <figcaption>
              <span className="season-year">{lastYear + 1}</span>
              <span className="season-lines">
                <span>Not on file yet</span>
                <span>&nbsp;</span>
                <span>&nbsp;</span>
              </span>
            </figcaption>
            <div className="season-empty-body">
              <p>
                The data ends before this year's deadline season. It fills in when the Slate export is refreshed through
                the fall.
              </p>
            </div>
          </figure>
        </div>
        <div className="legend" style={{ marginTop: 14 }}>
          <span className="legend-item">
            <span className="legend-key" style={{ background: T.actual }} /> {live ? "Actual (Slate)" : "Actual (sample)"}
          </span>
          <span className="legend-item">
            <span className="legend-key" style={{ background: `repeating-linear-gradient(90deg, ${T.modeled} 0 5px, transparent 5px 8px)` }} /> Model forecast
          </span>
          <span className="legend-item">
            <span className="legend-key swatch" style={{ background: T.goldTint, boxShadow: `inset 0 0 0 1px ${T.borderStrong}` }} /> Deadline weeks (44–46)
          </span>
        </div>
      </div>
    </div>
  )
}

function Contributions({ r, ledger }: { r: PipelineResult; ledger: LedgerRow[] }) {
  const [view, setView] = useState<"all" | "ads">("all")
  const shown = ledger.filter((row) => row.verdict !== "cant-tell" && row.total > 0).map((row) => row.key)
  const hidden = ledger.filter((row) => row.verdict === "cant-tell")
  // nothing to show on its own when every channel is unsupported
  const hasAds = shown.some((k) => k !== "baseline")
  const unidentified = !!r.marketing_lift && !r.marketing_lift.identified
  const keys = orderSeries(view === "ads" && hasAds ? shown.filter((k) => k !== "baseline") : shown)
  const ticks = useMemo(() => quarterTicks(r.channel_contribution_weekly.map((w) => w.date)), [r])
  return (
    <div style={flushCard}>
      <SectionHeader
        title="The model's weekly split of applications"
        caption={
          view === "all" || !hasAds
            ? "Each week's forecast, split into slices. Gray: the normal level for that time of year (the baseline). Colors: the part the model assigned to advertising. This is a model-based allocation, not a causal measurement, so treat the colors as unproven."
            : "Advertising slices only, on their own scale so they are readable. The calendar is left out. Still a model-based allocation, not causal."
        }
        action={
          hasAds && (
          <div className="seg no-print" role="group" aria-label="Slices shown">
            <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
              Everything
            </button>
            <button type="button" aria-pressed={view === "ads"} onClick={() => setView("ads")}>
              Advertising only
            </button>
          </div>
          )
        }
      />
      <div className="section-body">
        <div className="chart-box">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={r.channel_contribution_weekly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.grid} vertical={false} />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={fmtQuarter} interval={0} tick={AXIS_TICK} axisLine={{ stroke: T.axis }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={fmtApps} />
            <RTooltip content={<ChartTip formatter={fmtApps} labelFormatter={fmtWeekOf} />} />
            <ReferenceLine y={0} stroke={T.axis} />
            {keys.map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key === "baseline" ? "Baseline (normal for the time of year)" : channelLabel(key)}
                stackId="contrib"
                stroke="#fff"
                strokeWidth={1}
                fill={channelColor(key)}
                fillOpacity={key === "baseline" ? 1 : 0.92}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        <div className="series-legend" aria-label="Legend">
          {keys.map((k) => (
            <span key={k}>
              <i style={{ background: channelColor(k) }} aria-hidden />
              {k === "baseline" ? "Baseline (normal for the time of year)" : channelLabel(k)}
            </span>
          ))}
        </div>
        {hidden.length > 0 && (
          <p className="chart-note">
            <IconInfo size={14} /> Not drawn: {hidden.map((h) => h.label).join(", ")}.{" "}
            {unidentified
              ? "Marketing didn't beat the calendar-only model on weeks it hadn't seen, so this is Can't tell yet, not evidence they did nothing."
              : "The model gave them below-zero estimates, usually because they ran at the same time as other channels. That is Can't tell yet, not evidence they caused harm."}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── technical detail ──────────────────────────────────────── */
/** One-line plain-language hint under a coefficient's name, for rows that don't explain themselves. */
const COEF_HINTS: Record<string, string> = {
  peak_deadline: "Late Oct to mid Nov, the application deadline",
  winter_surge: "Jan and Feb, the second application rush",
  yield_period: "Mar and Apr, when admitted students decide",
  summer_ramp: "Aug to early Oct; corrects the waves below in those weeks",
  week_num: "Slow drift up or down across the years",
  spend_observed: "Data switch, not marketing: on for weeks with spend on file",
  impressions_observed: "Data switch, not marketing: on for weeks with impressions on file",
  sin_1: "Repeats once a year: the main busy and quiet seasons",
  cos_1: "Repeats once a year: the main busy and quiet seasons",
  sin_2: "Repeats twice a year: adds a second bump",
  cos_2: "Repeats twice a year: adds a second bump",
  sin_3: "Repeats three times a year: fine detail",
  cos_3: "Repeats three times a year: fine detail",
}

function CoefficientBar({
  name,
  value,
  max,
  flag,
  neutral,
}: {
  name: string
  value: number
  max: number
  flag?: string
  /** Sign carries no meaning (yearly waves), so draw it gray and don't call it more/fewer applications. */
  neutral?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0
  const positive = value >= 0
  const label = name.endsWith("_spend_adstock") ? `${channelLabel(name.replace(/_adstock$/, ""))} spend` : featureLabel(name)
  const shown = `${positive ? "+" : "−"}${Math.abs(value).toFixed(2)}`
  const hint = COEF_HINTS[name]
  const reading = neutral ? "sets the timing of the yearly curve" : `moved with ${positive ? "more" : "fewer"} applications`
  return (
    <div className="coef-row">
      <div className="coef-name">
        {label}
        {flag && <span className="coef-flag">{flag}</span>}
        {hint && <span className="coef-hint">{hint}</span>}
        {label !== name && <span className="coef-key">{name}</span>}
      </div>
      <div className="coef-track" role="img" aria-label={`${label}: ${shown} (${reading})${flag ? `, ${flag}` : ""}`}>
        <div
          className="coef-bar"
          style={{
            left: positive ? "50%" : undefined,
            right: positive ? undefined : "50%",
            width: `${pct / 2}%`,
            background: neutral ? "var(--color-ink-3)" : positive ? T.pos : T.neg,
            borderRadius: positive ? "0 2px 2px 0" : "2px 0 0 2px",
            opacity: flag ? 0.55 : 1,
          }}
        />
      </div>
      <span className="coef-val" aria-hidden>
        {shown}
      </span>
    </div>
  )
}

function Coefficients({ r }: { r: PipelineResult }) {
  const entries = Object.entries(r.coefficients).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1)
  const high = r.multicollinearity?.high_vif_features ?? {}
  const isHarmonic = (k: string) => /^(sin|cos)_\d$/.test(k)
  const ads = entries.filter(([k]) => featureGroup(k) === "Advertising signals")
  const calendar = entries.filter(([k]) => featureGroup(k) === "Seasonality & trend" && !isHarmonic(k))
  // waves read as one curve, so keep them in wave order (1 sine, 1 cosine, 2 …) rather than by size
  const harmonics = entries
    .filter(([k]) => isHarmonic(k))
    .sort(([a], [b]) => a.slice(4).localeCompare(b.slice(4)) || b.localeCompare(a))
  const flagFor = (k: string, v: number) =>
    k in high ? `overlaps with others (VIF ${high[k].toFixed(0)}; above 10 is high)` : k.endsWith("_adstock") && v < 0 ? "can't tell yet" : undefined
  return (
    <Disclosure summary="For analysts: how the model weighs each factor">
      <p className="disclosure-lead">
        You can skip this; the conclusions are above. Each bar shows how closely a factor moved with weekly applications
        in past data, after accounting for the others. Longer bar means a stronger link. These are associations, not proof
        of cause. Faded bars overlap with other channels, so they are <Term id="directional">Directional</Term> at best.
      </p>
      <div className="coef-legend" style={{ margin: "14px 0 18px" }}>
        <span>
          <span aria-hidden style={{ width: 14, height: 10, borderRadius: 2, background: T.pos }} />
          Moved up with applications
        </span>
        <span>
          <span aria-hidden style={{ width: 14, height: 10, borderRadius: 2, background: T.neg }} />
          Moved down with applications (does not mean it hurts)
        </span>
      </div>
      {[
        {
          title: "Advertising signals",
          rows: ads,
          note: "Marketing inputs. Faded bars overlap heavily with other channels, so their size, and even their direction, can flip as more data comes in.",
        },
        {
          title: "The admissions calendar & trend",
          rows: calendar,
          note: "Periods the college already knows are busy, plus a slow drift over the years. The two \"data on file\" rows are switches for weeks with Carnegie data, not marketing effects.",
        },
        {
          title: `Annual cycle terms · ${harmonics.length}`,
          rows: harmonics,
          neutral: true,
          note: "Smooth curves the model uses to draw the normal shape of the admissions year: quiet summer, fall ramp, deadline spike. They are calendar machinery, not marketing, and are drawn in gray. Nothing to act on here.",
        },
      ]
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.title} className="coef-group" role="group" aria-label={g.title}>
            <p className="coef-group-title">
              <span>{g.title}</span>
            </p>
            <p className="coef-group-note">{g.note}</p>
            {g.rows.map(([name, value]) => (
              <CoefficientBar
                key={name}
                name={name}
                value={value}
                max={max}
                flag={flagFor(name, value)}
                neutral={g.neutral}
              />
            ))}
          </div>
        ))}
    </Disclosure>
  )
}

function Diagnostics({ r }: { r: PipelineResult }) {
  const t = trust(r)
  const d = r.multicollinearity
  const m = r.in_sample_metrics
  const rows: [string, ReactNode][] = [
    ["Score on weeks it already saw (in-sample R²)", <>{m["R²"]?.toFixed(3) ?? "—"}. Always flatters; read the unseen-weeks score instead.</>],
    ["Adjusted R² (the score, corrected for how many factors were used)", m["Adj R²"]?.toFixed(3) ?? "—"],
    [
      `Five test stretches, each predicting later weeks than it learned from (${t.folds})`,
      <span className="fold-list">
        {r.cross_validation.per_fold_r2.map((v, i) => (
          <span key={i} className={v < 0 ? "fold fold-neg" : "fold"}>
            {signed(v)}
          </span>
        ))}
      </span>,
    ],
    ["Durbin-Watson (leftover week-to-week pattern)", <>{m["Durbin-Watson"]?.toFixed(2) ?? "—"} (about 2 means none)</>],
    ["Regularization (ridge α): keeps the model from over-reacting to noise", r.selected_ridge_alpha.toFixed(2)],
  ]
  if (d?.condition_number !== undefined)
    rows.push(["Condition number (high means channels moved together too much to separate)", <>{Math.round(d.condition_number).toLocaleString("en-US")}{d.high_condition_number ? " (high: inputs overlap heavily)" : ""}</>])
  if (d?.high_vif_features && Object.keys(d.high_vif_features).length)
    rows.push([
      "Channels that overlap heavily (VIF), so Directional at best",
      Object.entries(d.high_vif_features)
        .map(([k, v]) => `${featureLabel(k)} (${v.toFixed(1)})`)
        .join(", "),
    ])
  return (
    <Disclosure summary="Technical checks (for analysts)">
      <p className="disclosure-lead">
        Plain-English takeaway: the model follows the busy and quiet seasons fairly well, but it is not reliable for
        splitting applications among ad channels.
      </p>
      {d?.warning && <p className="disclosure-lead">Model note: {d.warning}</p>}
      <dl className="diag">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  )
}

/* ── reading level ─────────────────────────────────────────── */
type ResultsLevel = "regular" | "easy" | "technical"
const LEVEL_KEY = "augie.resultsLevel"
function readLevel(): ResultsLevel {
  try {
    const v = localStorage.getItem(LEVEL_KEY)
    return v === "easy" ? "easy" : "regular"
  } catch {
    return "regular"
  }
}

function ViewSwitch({ view, onPick }: { view: ResultsLevel; onPick: (v: ResultsLevel) => void }) {
  return (
    <div className="view-switch no-print" data-guide="results-view-switch">
      <span className="view-switch-label">Reading level</span>
      <div className="seg" role="group" aria-label="Reading level">
        <button type="button" aria-pressed={view === "easy"} onClick={() => onPick("easy")} data-guide="view-easy">
          Plain English
        </button>
        <button type="button" aria-pressed={view === "regular"} onClick={() => onPick("regular")}>
          Full detail
        </button>
      </div>
      <span className="view-switch-hint">
        {view === "easy" ? "Short answers, no statistics. Same results either way." : "Charts, numbers and every caveat."}
      </span>
    </div>
  )
}

/* ── the view ──────────────────────────────────────────────── */
export function ResultsView({
  result,
  mode,
  ranAt,
  commentary = { status: "idle" },
  onAsk,
  onRerun,
  rerunLabel = "Refresh results",
  onBack,
  backLabel,
  notice,
  status,
  onReadout,
}: {
  result: PipelineResult
  mode: "live" | "sample"
  ranAt: number
  commentary?: CommentaryState
  onAsk?: (q: string) => Promise<string>
  onRerun: () => void
  rerunLabel?: string
  onBack?: () => void
  backLabel?: string
  /** Extra line under the header, e.g. the settings used for a sample run. */
  notice?: ReactNode
  /** Run-level status shown above the finding, e.g. "re-running" or a failed re-run. */
  status?: ReactNode
  /** (Re)generate the AI readout for this run. */
  onReadout?: () => void
}) {
  const ledger = useMemo(() => driverLedger(result), [result])
  const t = useMemo(() => trust(result), [result])
  const hatchId = `hatch-${useId().replace(/:/g, "")}`
  const live = mode === "live"
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const [view, setView] = useState<ResultsLevel>(readLevel)
  function pickView(v: ResultsLevel) {
    setView(v)
    try {
      localStorage.setItem(LEVEL_KEY, v)
    } catch {
      /* private window: the choice just isn't remembered */
    }
  }

  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle")
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(shareSummary(result, live))
      setCopied("done")
    } catch {
      setCopied("failed")
    }
    window.setTimeout(() => setCopied("idle"), 2500)
  }

  function exportCSV() {
    const stamp = new Date(ranAt).toISOString().slice(0, 10)
    downloadText(`${live ? "augie-analysis-live" : "DEMO-augie-analysis-rescaled"}-${stamp}.csv`, resultToCSV(result, live ? "live" : "demo"))
  }

  return (
    <div className="wf-stack wf-stack-results results">
      <div className="print-only print-head">
        <strong>Augie Analysis · Marketing mix model results</strong>
        <span>
          {live ? "Live Augustana data" : "Demo: real results, counts rescaled (average week = 100)"} · generated {fmtStamp(ranAt)} · data{" "}
          {fmtDay(t.dataStart)} to {fmtDay(t.dataEnd)}
          {t.spendShare !== undefined && ` · spend on file for ${pct(t.spendShare)} of weeks`}
        </span>
      </div>

      <StepHeader
        eyebrow={live ? "Results · Live Augustana data" : "Results · Demo sample"}
        title={
          <>
            What this run <em>found</em>
          </>
        }
        info={
          live ? (
            <Badge variant="success">
              <Dot /> Live data
            </Badge>
          ) : (
            <Badge variant="demo">
              <IconFlask size={12} /> Sample data
            </Badge>
          )
        }
        lead={
          <>
            <span className="num">{result.rows}</span> weeks,{" "}
            <span className="num" style={{ whiteSpace: "nowrap" }}>
              {fmtDay(t.dataStart)} – {fmtDay(t.dataEnd)}
            </span>{" "}
            · last updated {fmtStamp(ranAt)}
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={copySummary} aria-live="polite">
              <IconCheck size={14} />{" "}
              {copied === "done" ? "Copied" : copied === "failed" ? "Couldn't copy" : "Copy summary"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportCSV}>
              <IconDownload size={14} /> Spreadsheet (CSV)
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <IconPrint size={14} /> Print
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onRerun}>
              <IconRefresh size={14} /> {rerunLabel}
            </button>
          </>
        }
      />

      {!live && (
        <Alert variant="demo" title="Demo sample">
          These are the real model's results on Augustana's data, with application counts rescaled so an average week
          reads 100, and no dollar amounts. The patterns and fit scores are real; the counts are not. Sign in to see the
          live model.
          {notice && <span className="alert-extra">{notice}</span>}
        </Alert>
      )}

      <ViewSwitch view={view} onPick={pickView} />

      {status}

      <div key={view} className="results-pane">
      {view === "easy" ? (
        <EasyView result={result} live={live} />
      ) : (
      <>
      <Finding ledger={ledger} stale={t.weeksStale} dataEnd={t.dataEnd} unidentified={!!result.marketing_lift && !result.marketing_lift.identified} />

      <section className="next-steps" aria-label="What to do next">
        <p className="next-steps-title">What to do next</p>
        <ol>
          <li>Use the calendar to plan: it is the part of the forecast we can lean on.</li>
          <li>Don't change channel budgets based on this run.</li>
          <li>Plan a short, time-boxed spend test in one channel.</li>
          <li>Send the analyst the full Carnegie history and event data.</li>
        </ol>
        <p className="next-steps-term">
          The <Term id="mmm">marketing mix model</Term> compares weekly applications with weekly ad activity.
        </p>
      </section>

      <div className="card kpi-strip" role="group" aria-label="How far to trust this run">
        <KpiCard
          label="How well it predicts weeks it hasn't seen"
          value={signed(t.cvMean)}
          tone={t.unstable ? "caution" : undefined}
          sub={
            result.marketing_lift && !result.marketing_lift.identified ? (
              <>
                Score from 0 to 1; higher is better, below 0 is worse than guessing the average. <Term id="calendar-only">Calendar-only</Term>{" "}
                benchmark: <span className="num">{signed(result.marketing_lift.baseline_mean_r2)}</span> (a forecast using only the time of year).
                Across five test stretches, scores ranged from <span className="num">{signed(t.foldMin)}</span> to{" "}
                <span className="num">{signed(t.foldMax)}</span>.
              </>
            ) : (
              <>
                {FIT_WORDS[t.rating]}. Score from 0 to 1; higher is better, below 0 is worse than guessing the average. Across five test
                stretches, scores ranged from <span className="num">{signed(t.foldMin)}</span> to <span className="num">{signed(t.foldMax)}</span>.
              </>
            )
          }
        />
        <KpiCard
          label="Typical weekly error"
          value={t.mae !== undefined ? fmtApps(t.mae) : "—"}
          unit="apps"
          sub={
            t.maeShare !== undefined ? (
              <>
                {pct(t.maeShare)} of an average week ({fmtApps(t.meanActual)}), measured on weeks the model already saw, so on new weeks it will usually miss by more
              </>
            ) : undefined
          }
        />
        <KpiCard
          label="Ad spending records on file"
          value={t.spendShare !== undefined ? pct(t.spendShare) : "—"}
          tone={t.spendShare !== undefined && t.spendShare < 0.5 ? "caution" : undefined}
          sub={t.spendWeeks !== undefined ? <>{t.spendWeeks} of {t.totalWeeks} weeks{t.spendShare !== undefined && t.spendShare < 0.5 ? ". With under half the weeks recorded, the model can say little about ads" : ""}</> : "No channel spend in this run"}
        />
        <KpiCard
          label="Data through"
          value={new Date(t.dataEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          tone={t.weeksStale >= 8 ? "caution" : undefined}
          sub={
            <>
              {new Date(t.dataEnd).getUTCFullYear()} · {t.weeksStale} week{t.weeksStale === 1 ? "" : "s"} ago
            </>
          }
        />
      </div>

      {result.marketing_lift && !result.marketing_lift.identified && (
        <Alert variant="warning" title="Adding marketing data didn't make the forecast better">
          Adding marketing data did not make the forecast more accurate than using the calendar alone, so it is{" "}
          Can't tell yet what each channel did. On weeks the model had not seen, the version
          with marketing scored {result.marketing_lift.full_mean_r2.toFixed(2)} and the{" "}
          <Term id="calendar-only">calendar-only</Term> version scored {result.marketing_lift.baseline_mean_r2.toFixed(2)}{" "}
          (higher is better). Marketing did better in {result.marketing_lift.folds_won} of {result.marketing_lift.folds}{" "}
          test stretches. What would change that: fuller Carnegie spend history, real dates for when ads and billboards
          ran (flight dates), or a short planned spend test. Until then, don't cut or increase any channel based on this
          page.
        </Alert>
      )}
      {result.marketing_lift?.identified !== false && result.multicollinearity?.warning && (
        <Alert variant="warning" title="Some channels moved together, so their estimates are Directional">
          These channels were often switched on at the same time:{" "}
          {Object.keys(result.multicollinearity.high_vif_features ?? {}).map(featureLabel).join(", ") || "several of them"}. When
          that happens the model can't tell which one to give the allocation to, so treat their numbers as Directional: a rough
          direction, not a size.
        </Alert>
      )}

      <Ledger rows={ledger} modeled={result.weekly.reduce((acc, w) => acc + w.predicted, 0)} />

      {live ? (
        <AiCard key={ranAt /* a re-run starts a fresh follow-up thread */} commentary={commentary} onAsk={onAsk} onReadout={onReadout} />
      ) : (
        <div className="card ai-card ai-card-off">
          <SectionHeader
            title={
              <>
                AI summary in plain words <span className="ai-tag">Signed-in only</span>
              </>
            }
            caption="When you're signed in, an AI model writes a short plain-words summary of the live run here, and you can ask it follow-up questions. It isn't generated for the demo sample."
          />
        </div>
      )}

      <ActualVsModeled r={result} hatchId={hatchId} live={live} />
      <DeadlineReplay r={result} live={live} />
      <Contributions r={result} ledger={ledger} />
      <Coefficients r={result} />
      <Diagnostics r={result} />
      </>
      )}
      </div>

      <StepFooter onBack={onBack} backLabel={backLabel} onNext={onRerun} nextLabel={rerunLabel} />
    </div>
  )
}

/* ── minimal Markdown for the AI readout ───────────────────── */
/** Inline **bold** and *italic*, the only inline constructs the AI prompt uses. */
function renderInline(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
  return parts.map((part, i) => {
    const k = `${keyPrefix}-${i}`
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>
    return <span key={k}>{part}</span>
  })
}

/**
 * Minimal Markdown → JSX scoped to exactly what the AI insights system prompt
 * produces: #/##/### headers, **bold**, --- rules, | tables |, lists and
 * paragraphs. The input is one controlled AI format, not arbitrary content, so
 * a small parser beats a full remark/unified dependency chain.
 */
export function renderMarkdown(text: string): ReactNode {
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
      blocks.push(<hr key={key++} className="md-rule" />)
      i++
      continue
    }
    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const Tag: "h4" | "h5" = level <= 2 ? "h4" : "h5"
      blocks.push(
        <Tag key={key++} className={level <= 2 ? "md-h" : "md-h md-h-sm"}>
          {renderInline(headerMatch[2], `h${key}`)}
        </Tag>,
      )
      i++
      continue
    }
    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) tableLines.push(lines[i++])
      const rows = tableLines
        .filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l.trim()))
        .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
      if (rows.length > 0) {
        const [header, ...body] = rows
        blocks.push(
          <div key={key++} className="md-table">
            <table>
              <thead>
                <tr>
                  {header.map((h, ci) => (
                    <th key={ci}>{renderInline(h, `th${ci}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c, ci) => (
                      <td key={ci}>{renderInline(c, `td${ri}-${ci}`)}</td>
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
        <ListTag key={key++}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `li${ii}`)}</li>
          ))}
        </ListTag>,
      )
      continue
    }
    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== "" && !isHeader(lines[i]) && !isTableRow(lines[i]) && !isListItem(lines[i]) && !isRule(lines[i])) {
      paraLines.push(lines[i++])
    }
    blocks.push(<p key={key++}>{renderInline(paraLines.join(" "), `p${key}`)}</p>)
  }
  return <>{blocks}</>
}
