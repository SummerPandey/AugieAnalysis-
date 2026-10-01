/**
 * One results view for every model run: the live Augustana pipeline and the
 * signed-out synthetic sample are read by the same components, so the demo
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
import { channelColor, channelLabel, featureGroup, featureLabel, humanizeFeatureNames, orderSeries } from "./channels"
import {
  deadlineSeasons,
  downloadText,
  driverLedger,
  FIT_WORDS,
  headline,
  ledgerOverlap,
  resultToCSV,
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
import "./results.css"

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
/** Signed number with a real minus sign. */
const signed = (v: number, d = 2) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d))

const VERDICT_UI: Record<Verdict, { cls: string; Icon: (p: { size?: number }) => ReactNode }> = {
  calendar: { cls: "badge verdict-calendar", Icon: IconCalendar },
  helping: { cls: "badge badge-success", Icon: IconCheck },
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
function Finding({ ledger, stale, dataEnd }: { ledger: LedgerRow[]; stale: number; dataEnd: string }) {
  const h = headline(ledger)
  return (
    <section className="finding" aria-label="Headline finding">
      <p className="finding-lead">
        {h.lead} <mark className="finding-mark">{h.figure}</mark> {h.rest}
      </p>
      <p className="finding-paid">{h.paid}</p>
      {stale >= 8 && (
        <p className="finding-stale">
          <IconWarning size={14} /> Data ends {fmtDay(dataEnd)}, {stale} weeks ago, so this run can't see the current
          admissions cycle yet.
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
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader
        title="What each driver contributed"
        caption="Modeled applications over the whole window. Each verdict comes from the model's own diagnostics: sign, overlap with other channels, and how many weeks had activity."
      />
      <div className="tbl-wrap">
        <table className="tbl ledger">
          <caption className="sr-only">Modeled applications by driver, with a reliability verdict</caption>
          <thead>
            <tr>
              <th scope="col">Driver</th>
              <th scope="col">Applications</th>
              <th scope="col" className="ledger-share-h">
                Share
              </th>
              <th scope="col">Weeks</th>
              <th scope="col">Verdict</th>
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
                      {r.verdict === "cant-tell" ? "Not estimated" : `${fmtApps(r.total)} apps · ${(r.share * 100).toFixed(r.share < 0.1 ? 1 : 0)}%`} ·{" "}
                      {r.weeksActive} wks
                    </span>
                    <span className="ledger-reason">{r.reason}</span>
                  </th>
                  <td className="num">{r.verdict === "cant-tell" ? "—" : fmtApps(r.total)}</td>
                  <td className="ledger-share">
                    {r.verdict === "cant-tell" ? (
                      <span className="ledger-na">not estimated</span>
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
                  <span className="ledger-name">Overlap the model couldn't assign</span>
                  <span className="ledger-reason">
                    The negative estimates for {overlap.labels.join(" and ")}. They're shown here, not as drivers, so the
                    shares add up.
                  </span>
                </th>
                <td className="num">−{fmtApps(Math.abs(overlap.total))}</td>
                <td className="num ledger-share">−{(Math.abs(overlap.share) * 100).toFixed(1)}%</td>
                <td />
                <td />
              </tr>
              <tr className="ledger-total">
                <th scope="row">
                  <span className="ledger-name">All modeled applications</span>
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
            AI readout <span className="ai-tag">Generated</span>
          </>
        }
        caption="A plain-language reading of this run, written by an AI model from the numbers above. Check it against them before sharing."
      />
      <div className="section-body">
        {commentary.status === "loading" && (
          <div role="status" aria-label="Writing the AI readout" className="ai-loading">
            <div className="skeleton" style={{ height: 13, width: "92%" }} />
            <div className="skeleton" style={{ height: 13, width: "84%" }} />
            <div className="skeleton" style={{ height: 13, width: "88%" }} />
            <p>Writing a plain-language readout. This usually takes 15–30 seconds; the numbers above are already final.</p>
          </div>
        )}
        {commentary.status === "error" && (
          <Alert variant="warning" title="The AI readout isn't available right now">
            {commentary.error} Everything else on this page comes straight from the model and is unaffected.
            {onReadout && (
              <span className="alert-extra">
                <button type="button" className="btn btn-outline btn-sm" onClick={onReadout}>
                  Try the readout again
                </button>
              </span>
            )}
          </Alert>
        )}
        {commentary.status === "idle" && onReadout && (
          <div className="ai-idle">
            <p>No readout for this run yet.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={onReadout}>
              Write the readout
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
                  placeholder="e.g. Why is Snapchat marked “can't tell yet”?"
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
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader
        title="Actual vs. modeled applications"
        caption={
          <>
            {live ? "Navy is what Slate recorded each week" : "Navy is the sample's weekly applications"}; dashed gold is what
            the model expects from the calendar and marketing.
            {spendFrom && spendFrom !== first && <> Hatched weeks have no channel spend on file.</>}
          </>
        }
      />
      <div className="section-body">
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
              name="Modeled"
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
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader
        title="The deadline season, year by year"
        caption="Weeks 36–52 of each year, on one scale. The gap at the peak is what the model can't explain. That's worth knowing, not proof of marketing lift."
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
                      <span>Peak · week {s.peak.week}</span>
                      <span className="num">
                        <strong>{fmtApps(s.peak.actual)}</strong> actual · {fmtApps(s.peak.predicted)} modeled
                      </span>
                      <span className="season-miss num">
                        {miss >= 0 ? "+" : "−"}
                        {fmtApps(Math.abs(miss))} unexplained
                      </span>
                    </span>
                  )}
                </figcaption>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={s.points} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={T.grid} vertical={false} />
                    <XAxis dataKey="week" tick={AXIS_TICK} axisLine={{ stroke: T.axis }} tickLine={false} ticks={[36, 40, 44, 48, 52]} />
                    <YAxis domain={[0, top]} ticks={yTicks} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={fmtApps} />
                    <ReferenceArea x1={44} x2={46} fill={T.goldTint} fillOpacity={0.9} ifOverflow="visible" />
                    <RTooltip content={<ChartTip formatter={fmtApps} labelFormatter={(l) => `Week ${l}, ${s.year}`} />} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke={T.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="predicted" name="Modeled" stroke={T.modeled} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    {s.peak && <ReferenceDot x={s.peak.week} y={s.peak.actual} r={4} fill={T.actual} stroke="#fff" strokeWidth={2} />}
                  </LineChart>
                </ResponsiveContainer>
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
            <span className="legend-key" style={{ background: `repeating-linear-gradient(90deg, ${T.modeled} 0 5px, transparent 5px 8px)` }} /> Modeled
          </span>
          <span className="legend-item">
            <span className="legend-key swatch" style={{ background: T.goldTint, boxShadow: `inset 0 0 0 1px ${T.borderStrong}` }} /> Weeks 44–46
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
  const keys = orderSeries(view === "ads" ? shown.filter((k) => k !== "baseline") : shown)
  const ticks = useMemo(() => quarterTicks(r.channel_contribution_weekly.map((w) => w.date)), [r])
  return (
    <div style={{ ...card, padding: 0 }}>
      <SectionHeader
        title="Where modeled applications came from, week by week"
        caption={
          view === "all"
            ? "Stacked by driver. Gray is baseline demand and the admissions calendar; colors are advertising."
            : "Advertising only, on its own scale, so the channels are readable. The calendar is left out."
        }
        action={
          <div className="seg no-print" role="group" aria-label="Drivers shown">
            <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
              All drivers
            </button>
            <button type="button" aria-pressed={view === "ads"} onClick={() => setView("ads")}>
              Advertising only
            </button>
          </div>
        }
      />
      <div className="section-body">
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
                name={key === "baseline" ? "Baseline & seasonality" : channelLabel(key)}
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
        <div className="series-legend" aria-label="Legend">
          {keys.map((k) => (
            <span key={k}>
              <i style={{ background: channelColor(k) }} aria-hidden />
              {k === "baseline" ? "Baseline & seasonality" : channelLabel(k)}
            </span>
          ))}
        </div>
        {hidden.length > 0 && (
          <p className="chart-note">
            <IconInfo size={14} /> Not drawn: {hidden.map((h) => h.label).join(" and ")}. Their estimates came out
            negative, which reflects overlap rather than a real effect, so the stack runs a little above the modeled total.
          </p>
        )}
      </div>
    </div>
  )
}

/* ── technical detail ──────────────────────────────────────── */
function CoefficientBar({ name, value, max, flag }: { name: string; value: number; max: number; flag?: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0
  const positive = value >= 0
  const label = name.endsWith("_spend_adstock") ? `${channelLabel(name.replace(/_adstock$/, ""))} spend` : featureLabel(name)
  const shown = `${positive ? "+" : "−"}${Math.abs(value).toFixed(2)}`
  return (
    <div className="coef-row">
      <div className="coef-name">
        {label}
        {flag && <span className="coef-flag">{flag}</span>}
        {label !== name && <span className="coef-key">{name}</span>}
      </div>
      <div
        className="coef-track"
        role="img"
        aria-label={`${label}: ${shown} (moved with ${positive ? "more" : "fewer"} applications)${flag ? `, ${flag}` : ""}`}
      >
        <div
          className="coef-bar"
          style={{
            left: positive ? "50%" : undefined,
            right: positive ? undefined : "50%",
            width: `${pct / 2}%`,
            background: positive ? T.pos : T.neg,
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
  const harmonics = entries.filter(([k]) => isHarmonic(k))
  const flagFor = (k: string, v: number) =>
    k in high ? `unstable · VIF ${high[k].toFixed(0)}` : k.endsWith("_adstock") && v < 0 ? "can't tell yet" : undefined
  return (
    <Disclosure summary="Model coefficients (standardized)">
      <p className="disclosure-lead">
        How strongly each factor moved with weekly applications, holding the others constant. These are associations
        from historical data, not proof of cause. Faded bars are unstable estimates.
      </p>
      <div className="coef-legend" style={{ margin: "14px 0 18px" }}>
        <span>
          <span aria-hidden style={{ width: 14, height: 10, borderRadius: 2, background: T.pos }} />
          Moved with more applications
        </span>
        <span>
          <span aria-hidden style={{ width: 14, height: 10, borderRadius: 2, background: T.neg }} />
          Moved with fewer applications
        </span>
      </div>
      {[
        { title: "Advertising signals", rows: ads },
        { title: "The admissions calendar & trend", rows: calendar },
        { title: `Annual cycle terms · ${harmonics.length}`, rows: harmonics },
      ]
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.title} className="coef-group" role="group" aria-label={g.title}>
            <p className="coef-group-title">
              <span>{g.title}</span>
            </p>
            {g.rows.map(([name, value]) => (
              <CoefficientBar key={name} name={name} value={value} max={max} flag={flagFor(name, value)} />
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
    ["Fit on the weeks it learned from (in-sample R²)", <>{m["R²"]?.toFixed(3) ?? "—"}. Always flatters; read the unseen-weeks figure instead.</>],
    ["Adjusted R²", m["Adj R²"]?.toFixed(3) ?? "—"],
    [
      `Walk-forward folds (${t.folds})`,
      <span className="fold-list">
        {r.cross_validation.per_fold_r2.map((v, i) => (
          <span key={i} className={v < 0 ? "fold fold-neg" : "fold"}>
            {signed(v)}
          </span>
        ))}
      </span>,
    ],
    ["Durbin-Watson", <>{m["Durbin-Watson"]?.toFixed(2) ?? "—"} (≈2 means no leftover week-to-week pattern)</>],
    ["Regularization (ridge α, auto-tuned)", r.selected_ridge_alpha.toFixed(2)],
  ]
  if (d?.condition_number !== undefined)
    rows.push(["Condition number", <>{Math.round(d.condition_number).toLocaleString("en-US")}{d.high_condition_number ? " (high: inputs overlap heavily)" : ""}</>])
  if (d?.high_vif_features && Object.keys(d.high_vif_features).length)
    rows.push([
      "High-VIF features",
      Object.entries(d.high_vif_features)
        .map(([k, v]) => `${featureLabel(k)} (${v.toFixed(1)})`)
        .join(", "),
    ])
  return (
    <Disclosure summary="Validation & diagnostics">
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

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ── the view ──────────────────────────────────────────────── */
export function ResultsView({
  result,
  mode,
  ranAt,
  commentary = { status: "idle" },
  onAsk,
  onRerun,
  rerunLabel = "Re-run",
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

  function exportCSV() {
    const stamp = new Date(ranAt).toISOString().slice(0, 10)
    downloadText(`${live ? "augie-analysis-live" : "SYNTHETIC-augie-analysis-sample"}-${stamp}.csv`, resultToCSV(result, live ? "live" : "synthetic"))
  }

  return (
    <div className="wf-stack wf-stack-results results">
      <div className="print-only print-head">
        <strong>Augie Analysis · Marketing Mix Model results</strong>
        <span>
          {live ? "Live Augustana data" : "Synthetic sample, not real data"} · generated {fmtStamp(ranAt)} · data{" "}
          {fmtDay(t.dataStart)} to {fmtDay(t.dataEnd)}
          {t.spendShare !== undefined && ` · spend on file for ${pct(t.spendShare)} of weeks`}
        </span>
      </div>

      <StepHeader
        eyebrow={live ? "Results · Live Augustana data" : "Results · Synthetic sample"}
        title={
          <>
            What's driving <em>applications</em>
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
            · run {fmtStamp(ranAt)}
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportCSV}>
              <IconDownload size={14} /> CSV
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
        <Alert variant="demo" title="Synthetic sample">
          Shaped like Augustana's data (the same date range, channels and spend gaps), but every number here is generated.
          It shows how the tool reads a run; sign in to see the live model.
          {notice && <span className="alert-extra">{notice}</span>}
        </Alert>
      )}

      {status}

      <Finding ledger={ledger} stale={t.weeksStale} dataEnd={t.dataEnd} />

      <div className="card kpi-strip" role="group" aria-label="How far to trust this run">
        <KpiCard
          label="Fit on unseen weeks"
          value={signed(t.cvMean)}
          tone={t.unstable ? "caution" : undefined}
          sub={
            <>
              {FIT_WORDS[t.rating]} · periods ranged <span className="num">{signed(t.foldMin)}</span> to{" "}
              <span className="num">{signed(t.foldMax)}</span>
            </>
          }
        />
        <KpiCard
          label="Typical weekly miss"
          value={t.mae !== undefined ? fmtApps(t.mae) : "—"}
          unit="apps"
          sub={t.maeShare !== undefined ? <>{pct(t.maeShare)} of an average week ({fmtApps(t.meanActual)})</> : undefined}
        />
        <KpiCard
          label="Spend history on file"
          value={t.spendShare !== undefined ? pct(t.spendShare) : "—"}
          tone={t.spendShare !== undefined && t.spendShare < 0.5 ? "caution" : undefined}
          sub={t.spendWeeks !== undefined ? <>{t.spendWeeks} of {t.totalWeeks} weeks</> : "No channel spend in this run"}
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

      {result.multicollinearity?.warning && (
        <Alert variant="warning" title="Some channels moved together, so their estimates are directional">
          {sentenceCase(humanizeFeatureNames(result.multicollinearity.warning.replace(/^High multicollinearity detected\s*[—:-]\s*/i, "")))}
        </Alert>
      )}

      <Ledger rows={ledger} modeled={result.weekly.reduce((acc, w) => acc + w.predicted, 0)} />

      {live ? (
        <AiCard commentary={commentary} onAsk={onAsk} onReadout={onReadout} />
      ) : (
        <div className="card ai-card ai-card-off">
          <SectionHeader
            title={
              <>
                AI readout <span className="ai-tag">Signed-in only</span>
              </>
            }
            caption="When you're signed in, an AI model writes a plain-language reading of the live run here, and you can ask it follow-up questions. It isn't generated for synthetic samples."
          />
        </div>
      )}

      <ActualVsModeled r={result} hatchId={hatchId} live={live} />
      <DeadlineReplay r={result} live={live} />
      <Contributions r={result} ledger={ledger} />
      <Coefficients r={result} />
      <Diagnostics r={result} />

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
