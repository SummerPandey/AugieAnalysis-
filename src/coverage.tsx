/**
 * Data-coverage panel — a swimlane timeline of which months each data source
 * covers across the model window, plus an equivalent table view. Every fact
 * (sources, segments, window, as-of date) comes from projectStatus.ts; update
 * that file, not this one, when a new export arrives.
 */
import { useId, useState } from "react"
import {
  DATA_SOURCES,
  MODEL_WINDOW,
  STATUS_AS_OF,
  STATUS_LABEL,
  formatStatusDate,
  type DataSource,
  type SourceStatus,
} from "./projectStatus"
import { SourceStatusBadge } from "./sourceStatus"
import "./coverage.css"

/* ── month maths ───────────────────────────────────────────── */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2024-10" → a single sortable month number. */
function monthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number)
  return y * 12 + (m - 1)
}

function monthLabel(i: number): string {
  return `${MONTH_SHORT[i % 12]} ${Math.floor(i / 12)}`
}

function rangeLabel(a: number, b: number, joiner = " – "): string {
  return a === b ? monthLabel(a) : `${monthLabel(a)}${joiner}${monthLabel(b)}`
}

const WIN_START = monthIndex(MODEL_WINDOW.start)
const WIN_END = monthIndex(MODEL_WINDOW.end)
const WIN_MONTHS = Math.max(1, WIN_END - WIN_START + 1)

/** Position of a month boundary along the track, as a percentage. */
function pct(i: number): string {
  return `${(((i - WIN_START) / WIN_MONTHS) * 100).toFixed(3)}%`
}

/** A year tick on the axis; `months` is how much room its label has. */
const YEAR_TICKS = (() => {
  const starts: number[] = []
  for (let i = WIN_START; i <= WIN_END; i++) if (i === WIN_START || i % 12 === 0) starts.push(i)
  return starts.map((index, n) => ({
    index,
    year: Math.floor(index / 12),
    months: (starts[n + 1] ?? WIN_END + 1) - index,
  }))
})()

type Span = [number, number]

/** A source's segments clipped to the model window, sorted and merged. */
function coveredSpans(source: DataSource): Span[] {
  const spans = source.segments
    .map((s): Span => [Math.max(monthIndex(s.start), WIN_START), Math.min(monthIndex(s.end), WIN_END)])
    .filter(([a, b]) => a <= b)
    .sort((x, y) => x[0] - y[0])
  const merged: Span[] = []
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

/** Months in the window that a source has nothing for. */
function missingSpans(covered: Span[]): Span[] {
  const out: Span[] = []
  let cursor = WIN_START
  for (const [a, b] of covered) {
    if (a > cursor) out.push([cursor, a - 1])
    cursor = b + 1
  }
  if (cursor <= WIN_END) out.push([cursor, WIN_END])
  return out
}

/* ── shared summaries (also used by the landing page) ──────── */
export function summarizeSources() {
  const count = (s: SourceStatus) => DATA_SOURCES.filter((d) => d.status === s).length
  return {
    total: DATA_SOURCES.length,
    onFile: DATA_SOURCES.filter((d) => d.segments.length > 0).length,
    live: count("live"),
    partial: count("partial"),
    reference: count("reference"),
    pending: count("pending"),
  }
}

/* ── one swimlane ──────────────────────────────────────────── */
function Lane({ source, order }: { source: DataSource; order: number }) {
  const covered = coveredSpans(source)
  const missing = missingSpans(covered)
  const empty = covered.length === 0

  const spansToSpeech = (spans: Span[]) => spans.map(([a, b]) => rangeLabel(a, b, " to ")).join(", ")
  const trackLabel = empty
    ? `No data on file yet. Waiting on ${source.owner}.`
    : missing.length === 0
      ? `On file for the whole window, ${spansToSpeech(covered)}.`
      : `On file: ${spansToSpeech(covered)}. Not on file: ${spansToSpeech(missing)}.`

  return (
    <li className="cov-lane" data-status={source.status}>
      <div className="cov-lane-head">
        <div className="cov-lane-id">
          <p className="cov-lane-name">{source.label}</p>
          <p className="cov-lane-sub">
            {source.owner}
            {!empty && (
              <>
                {" · "}
                <span className="num">{source.coverageLabel}</span>
              </>
            )}
          </p>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>

      <div
        className={`cov-track${empty ? " cov-track-empty" : ""}`}
        role="img"
        aria-label={trackLabel}
      >
        {empty ? (
          <span className="cov-empty-text">
            {source.coverageLabel} · waiting on {source.owner}
          </span>
        ) : (
          <>
            {YEAR_TICKS.slice(1).map((t) => (
              <span key={t.index} className="cov-tick" style={{ left: pct(t.index) }} />
            ))}
            {covered.map(([a, b]) => (
              <span
                key={a}
                className="cov-seg"
                title={rangeLabel(a, b)}
                style={{
                  left: pct(a),
                  width: `${(((b - a + 1) / WIN_MONTHS) * 100).toFixed(3)}%`,
                  animationDelay: `${order * 45}ms`,
                }}
              />
            ))}
          </>
        )}
      </div>

      <p className="cov-note">{source.note}</p>
    </li>
  )
}

/* ── the equivalent table ──────────────────────────────────── */
function CoverageTable() {
  return (
    <div className="cov-table-wrap scroll-thin" role="region" aria-label="Data coverage as a table" tabIndex={0}>
      <table className="cov-table">
        <caption className="sr-only">
          Months of data on file for each source, across the model window {rangeLabel(WIN_START, WIN_END)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th scope="col">Coverage</th>
            <th scope="col">Months on file</th>
            <th scope="col">Not on file</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {DATA_SOURCES.map((src) => {
            const covered = coveredSpans(src)
            const missing = missingSpans(covered)
            return (
              <tr key={src.id}>
                <th scope="row">
                  {src.label}
                  <span className="cov-owner">{src.owner}</span>
                </th>
                <td>
                  <SourceStatusBadge status={src.status} />
                </td>
                <td>{src.coverageLabel}</td>
                <td>
                  {covered.length === 0 ? (
                    <span className="cov-none">None yet</span>
                  ) : (
                    covered.map(([a, b]) => (
                      <span key={a} className="cov-range">
                        {rangeLabel(a, b)}
                      </span>
                    ))
                  )}
                </td>
                <td>
                  {covered.length === 0 ? (
                    <span className="cov-none">Whole window</span>
                  ) : missing.length === 0 ? (
                    <span className="cov-none">Nothing missing</span>
                  ) : (
                    missing.map(([a, b]) => (
                      <span key={a} className="cov-range">
                        {rangeLabel(a, b)}
                      </span>
                    ))
                  )}
                </td>
                <td>{src.note}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── the panel ─────────────────────────────────────────────── */
type View = "timeline" | "table"

export function DataCoveragePanel() {
  const [view, setView] = useState<View>("timeline")
  const titleId = useId()
  const sum = summarizeSources()

  if (DATA_SOURCES.length === 0) {
    return (
      <section className="card cov" aria-labelledby={titleId}>
        <div className="section-head">
          <div>
            <h3 className="section-title" id={titleId}>
              Data coverage
            </h3>
            <p className="section-caption">No data sources are registered yet.</p>
          </div>
        </div>
      </section>
    )
  }

  const tally = (["live", "partial", "reference", "pending"] as const)
    .filter((k) => sum[k] > 0)
    .map((k) => `${sum[k]} ${STATUS_LABEL[k].toLowerCase()}`)
    .join(" · ")

  return (
    <section className="card cov" aria-labelledby={titleId}>
      <div className="section-head">
        <div>
          <h3 className="section-title" id={titleId}>
            Data coverage
          </h3>
          <p className="section-caption">
            Months each source has data for, across the model window ({rangeLabel(WIN_START, WIN_END)}).
          </p>
        </div>
        <div className="seg" role="group" aria-label="Coverage view">
          <button type="button" aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>
            Timeline
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            Table
          </button>
        </div>
      </div>

      <div className="cov-summary-row">
        <p className="cov-summary">
          <strong>
            {sum.onFile} of {sum.total} sources on file
          </strong>
          {tally && <span> · {tally}</span>}
        </p>
        <p className="cov-asof">
          Data as of <time dateTime={STATUS_AS_OF}>{formatStatusDate()}</time>
        </p>
      </div>

      {view === "timeline" ? (
        <div className="cov-body">
          <div className="cov-axis" aria-hidden>
            <div className="cov-axis-spacer" />
            <div className="cov-axis-track">
              {YEAR_TICKS.map((t) => (
                <span key={t.index} className="cov-year" style={{ left: pct(t.index) }}>
                  {t.months >= 3 ? t.year : ""}
                </span>
              ))}
            </div>
          </div>

          <ul className="cov-lanes" role="list">
            {DATA_SOURCES.map((src, n) => (
              <Lane key={src.id} source={src} order={n} />
            ))}
          </ul>

          <div className="legend cov-foot">
            <span className="legend-item">
              <span className="cov-swatch cov-swatch-on" aria-hidden />
              Months with data
            </span>
            <span className="legend-item">
              <span className="cov-swatch cov-swatch-off" aria-hidden />
              Not on file
            </span>
            <span className="legend-item">
              <span className="cov-swatch cov-swatch-none" aria-hidden />
              Nothing on file yet
            </span>
          </div>
        </div>
      ) : (
        <CoverageTable />
      )}
    </section>
  )
}
