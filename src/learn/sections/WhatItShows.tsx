import type { ReactNode } from "react"
import { IconCheck, IconWarning } from "../../icons"
import { Term } from "../../glossary"
import "./whatitshows.css"

const INTRO =
  "The results page asks: how much of weekly applications lines up with each marketing channel, and how much is just the admissions calendar? Today it can answer only the second part. Read it from top to bottom."

const STAT_TILES = [
  {
    label: "Fit on unseen weeks",
    value: "0.60",
    text: "Out of 1, higher is better. The calendar alone scores 0.78, so the model with marketing does worse on weeks it has not seen. Zero would mean no better than guessing an average week.",
  },
  {
    label: "Typical weekly miss",
    value: "52",
    text: "Applications. On average the model is off by about 52 applications in a week.",
  },
  {
    label: "Spend history on file",
    value: "38%",
    text: "Share of weeks with channel spend data (Oct 2024 to Jan 2026).",
  },
  {
    label: "Data through",
    value: "May 2026",
    text: "Latest week in the model. The current fall cycle is not in yet.",
  },
]

const CHECKS = [
  { label: "Channels ran in the same weeks", status: "Flagged: be careful", ok: false },
  { label: "Marketing beats the calendar alone", status: "Not yet: marketing has not beaten the calendar alone", ok: false },
  { label: "Spend history covers the period", status: "Flagged: not enough weeks of spend data", ok: false },
]

// Rows as the current real-data run shows them (marketing isn't identified,
// so channels read "Can't tell yet" and their numbers aren't shown).
const EXAMPLE_ROWS = [
  { driver: "Calendar & trend", apps: "24,786", share: "84%", weeks: "177", verdict: "The calendar" },
  { driver: "Meta", apps: "—", share: "not estimated", weeks: "61", verdict: "Can't tell yet" },
  { driver: "Google PPC", apps: "—", share: "not estimated", weeks: "55", verdict: "Can't tell yet" },
]

const CHART_STACK = [
  [30, 14, 8],
  [36, 18, 10],
  [44, 22, 14],
  [30, 10, 6],
  [24, 12, 8],
  [38, 20, 12],
]

function Step({
  n,
  title,
  wide,
  children,
  visual,
}: {
  n: number
  title: string
  wide?: boolean
  children?: ReactNode
  visual?: ReactNode
}) {
  return (
    <li className={"lp-what-it-shows-step" + (wide ? " lp-what-it-shows-step--wide" : "")}>
      <div className="lp-what-it-shows-copy">
        <span className="lp-what-it-shows-num" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h3 className="t-h3 lp-what-it-shows-title">{title}</h3>
        {children}
      </div>
      {visual ? <div className="lp-what-it-shows-visual">{visual}</div> : null}
    </li>
  )
}

function StackBars() {
  return (
    <svg
      className="lp-what-it-shows-chart"
      viewBox="0 0 160 96"
      role="img"
      aria-label="Stacked bars: the model's split of applications by factor for each week"
    >
      <line className="lp-what-it-shows-axis" x1="4" y1="90" x2="156" y2="90" />
      {CHART_STACK.map((parts, i) => {
        const x = 8 + i * 25
        const [a, b, c] = parts
        return (
          <g key={i}>
            <rect className="lp-what-it-shows-bar-a" x={x} y={90 - a} width="16" height={a} />
            <rect className="lp-what-it-shows-bar-b" x={x} y={90 - a - b} width="16" height={b} />
            <rect className="lp-what-it-shows-bar-c" x={x} y={90 - a - b - c} width="16" height={c} />
          </g>
        )
      })}
    </svg>
  )
}

export function WhatItShowsSection() {
  return (
    <section
      className="lp-section lp-what-it-shows"
      id="what-it-shows"
      aria-labelledby="what-it-shows-title"
    >
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">04 · What it shows</p>
        <h2 id="what-it-shows-title" className="display t-h2">
          What the results <em>show</em>
        </h2>
        <p className="lp-intro">{INTRO}</p>
      </div>

      <ol role="list" className="lp-what-it-shows-steps">
        <Step
          n={1}
          title="Start with the headline"
          visual={
            <div className="lp-what-it-shows-summary">
              <span className="lp-what-it-shows-tag">Example</span>
              <p className="lp-what-it-shows-summary-text">
                In this run, <strong>84%</strong> of modeled applications are assigned to the admissions calendar and
                long-term trend. No individual channel has an estimate the model can support yet.
              </p>
              <p className="lp-what-it-shows-note">
                This is a model-based allocation, not a causal measurement. It is how the model
                divides up its own predictions, not a count of why students applied. Use it to plan
                around the calendar.
              </p>
            </div>
          }
        >
          <p className="lp-what-it-shows-body">
            The headline sums up the latest run in plain words. Read it first, then check whether
            the details support it.
          </p>
        </Step>

        <Step n={2} title="Four tiles" wide>
          <div className="lp-what-it-shows-tiles">
            {STAT_TILES.map((tile) => (
              <div className="lp-what-it-shows-tile" key={tile.label}>
                <p className="lp-what-it-shows-tile-label">{tile.label}</p>
                <p className="lp-what-it-shows-tile-value">{tile.value}</p>
                <p className="lp-what-it-shows-tile-text">{tile.text}</p>
              </div>
            ))}
          </div>
        </Step>

        <Step
          n={3}
          title="The table of factors"
          visual={
            <div className="lp-what-it-shows-table-wrap">
              <table className="lp-what-it-shows-table">
                <thead>
                  <tr>
                    <th scope="col">Factor</th>
                    <th scope="col">Applications the model predicts</th>
                    <th scope="col">Share of total</th>
                    <th scope="col">Weeks with data</th>
                    <th scope="col">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE_ROWS.map((row) => (
                    <tr key={row.driver}>
                      <th scope="row">{row.driver}</th>
                      <td>{row.apps}</td>
                      <td>{row.share}</td>
                      <td>{row.weeks}</td>
                      <td>
                        <span className="lp-what-it-shows-verdict-chip">{row.verdict}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="lp-what-it-shows-note">Example rows from the current run. Dashes mean the tool declines to give a number, because it cannot yet tell the channel's effect from the calendar.</p>
            </div>
          }
        >
          <p className="lp-what-it-shows-body">
            Each row is one factor, such as Meta, Google search ads or the calendar. It shows the
            applications the model predicts for it, its share of the total, how many weeks it has
            data, and a verdict. About 80 to 90% of modeled applications are assigned to the
            admissions baseline (the calendar row). This is a model-based allocation, not a
            causal measurement.
          </p>
        </Step>

        <Step
          n={4}
          title="The three charts"
          wide
        >
          <p className="lp-what-it-shows-body">
            The first compares actual and modeled applications week by week. The second lines up
            each admissions year, so you can check whether the early November spike (weeks 44 and
            45) repeats. The third stacks the model's split of each week's applications by factor.
            It shows how the model divides them up, not where they definitely came from.
          </p>
          <div className="lp-what-it-shows-charts">
            <figure className="lp-what-it-shows-figure">
              <svg
                className="lp-what-it-shows-chart"
                viewBox="0 0 160 96"
                role="img"
                aria-label="Line chart: actual and modeled applications week by week"
              >
                <line className="lp-what-it-shows-axis" x1="4" y1="90" x2="156" y2="90" />
                <polyline
                  className="lp-what-it-shows-line-muted"
                  points="4,66 20,60 36,56 52,44 68,48 84,32 100,38 116,26 132,28 156,22"
                />
                <polyline
                  className="lp-what-it-shows-line"
                  points="4,70 20,58 36,62 52,40 68,46 84,28 100,36 116,22 132,30 156,18"
                />
              </svg>
              <figcaption>Actual vs modeled</figcaption>
            </figure>
            <figure className="lp-what-it-shows-figure">
              <svg
                className="lp-what-it-shows-chart"
                viewBox="0 0 160 96"
                role="img"
                aria-label="Overlaid admissions year lines with the early November spike highlighted"
              >
                <rect className="lp-what-it-shows-highlight" x="46" y="6" width="22" height="84" />
                <line className="lp-what-it-shows-axis" x1="4" y1="90" x2="156" y2="90" />
                <polyline
                  className="lp-what-it-shows-year-muted"
                  points="4,78 20,74 36,70 52,64 68,70 84,74 100,76 116,78 132,80 156,80"
                />
                <polyline
                  className="lp-what-it-shows-year-muted"
                  points="4,76 20,72 36,66 52,30 68,62 84,70 100,72 116,74 132,76 156,78"
                />
                <polyline
                  className="lp-what-it-shows-line"
                  points="4,74 20,70 36,60 52,18 68,58 84,68 100,72 116,74 132,76 156,78"
                />
              </svg>
              <figcaption>Admissions years overlaid</figcaption>
            </figure>
            <figure className="lp-what-it-shows-figure">
              <StackBars />
              <figcaption>Stacked by factor</figcaption>
            </figure>
          </div>
          <p className="lp-what-it-shows-note">Illustrations of each chart type, not real data.</p>
        </Step>

        <Step
          n={5}
          title="Checks on trust"
          visual={
            <ul role="list" className="lp-what-it-shows-checks">
              {CHECKS.map((c) => (
                <li className="lp-what-it-shows-check" key={c.label}>
                  <span
                    className={
                      "lp-what-it-shows-mark " + (c.ok ? "lp-what-it-shows-mark--ok" : "lp-what-it-shows-mark--warn")
                    }
                  >
                    {c.ok ? <IconCheck size={14} /> : <IconWarning size={14} />}
                  </span>
                  <span className="lp-what-it-shows-check-label">{c.label}</span>
                  <span className="lp-what-it-shows-check-status">{c.status}</span>
                </li>
              ))}
            </ul>
          }
        >
          <p className="lp-what-it-shows-body">
            This panel is a set of warning lights. A warning means channels ran in the same weeks
            (<Term id="collinearity">moved together</Term>) or data is thin, so treat the related
            numbers as a direction only and do not change budgets because of them.
          </p>
        </Step>

        <Step n={6} title="The readout and Augie AI" wide>
          <div className="lp-what-it-shows-pair">
            <div className="lp-what-it-shows-card">
              <p className="lp-what-it-shows-card-label">Readout</p>
              <p className="lp-what-it-shows-card-text">
                When you sign in, an AI readout summarizes the run in plain words, with caveats.
              </p>
            </div>
            <div className="lp-what-it-shows-card">
              <p className="lp-what-it-shows-card-label">Ask Augie AI</p>
              <p className="lp-what-it-shows-card-text">
                Augie AI is a chat where you can ask your own questions about the latest run.
              </p>
            </div>
          </div>
          <p className="lp-what-it-shows-body lp-what-it-shows-note">
            Both explain the results, but neither can prove that a channel causes applications. The
            model only looks at past patterns; it is not a test where we changed spending on
            purpose. AI answers can be wrong, so check important points against the numbers.
          </p>
        </Step>

      </ol>
    </section>
  )
}

export default WhatItShowsSection
