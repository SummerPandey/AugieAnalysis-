import type { ReactNode } from "react"
import { IconCheck, IconWarning } from "../../icons"
import "./whatitshows.css"

const INTRO =
  "The results page answers one question: how much does each channel move weekly applications, and how much is simply the admissions calendar? Read it from top to bottom."

const STAT_TILES = [
  {
    label: "Fit on unseen weeks",
    value: "0.31",
    text: "How well the model predicts weeks it never saw in training. Zero means no better than guessing the average week.",
  },
  {
    label: "Typical weekly miss",
    value: "49",
    text: "The average gap between the model's estimate and the actual count for a week.",
  },
  {
    label: "Spend history on file",
    value: "37%",
    text: "Share of weeks with channel spend data (Oct 2024 to Jan 2026).",
  },
  {
    label: "Data through",
    value: "May 2026",
    text: "Latest week in the model. The current fall cycle is not in yet.",
  },
]

const CHECKS = [
  { label: "Channels ran in the same weeks", status: "Flagged", ok: false },
  { label: "Fit checked on unseen weeks", status: "Clear", ok: true },
  { label: "Spend history covers the period", status: "Flagged", ok: false },
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

function Placeholder({ wide }: { wide?: boolean }) {
  return (
    <span
      className={"lp-what-it-shows-ph" + (wide ? " lp-what-it-shows-ph--wide" : "")}
      aria-hidden="true"
    />
  )
}

function StackBars() {
  return (
    <svg
      className="lp-what-it-shows-chart"
      viewBox="0 0 160 96"
      role="img"
      aria-label="Stacked bars: modeled applications by driver for each week"
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
              <span className="lp-what-it-shows-tag">Summary</span>
              <Placeholder wide />
              <Placeholder wide />
              <Placeholder />
            </div>
          }
        >
          <p className="lp-what-it-shows-body">
            The headline is a plain-language summary of the latest run. Read it first, then use
            the rest of the page to check whether the details support it.
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
          title="The driver table"
          visual={
            <div className="lp-what-it-shows-table-wrap">
              <table className="lp-what-it-shows-table">
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">Modeled applications</th>
                    <th scope="col">Share of total</th>
                    <th scope="col">Weeks active</th>
                    <th scope="col">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {["Calendar", "Meta", "Google PPC"].map((driver) => (
                    <tr key={driver}>
                      <th scope="row">{driver}</th>
                      <td>
                        <Placeholder />
                      </td>
                      <td>
                        <Placeholder />
                      </td>
                      <td>
                        <Placeholder />
                      </td>
                      <td>
                        <Placeholder />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          <p className="lp-what-it-shows-body">
            Each row is one driver, such as Meta, Google PPC or the calendar. It shows modeled
            applications, its share of the total, how many weeks it was active, and a verdict. The
            calendar row usually accounts for about 80 to 90% of applications.
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
            45) repeats. The third stacks modeled applications by driver, showing where each
            week's volume came from.
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
              <figcaption>Stacked by driver</figcaption>
            </figure>
          </div>
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
            The diagnostics section checks whether the numbers can be trusted. A flag means channels
            ran in the same weeks and moved together, so the model cannot cleanly separate their
            effects. Read flagged channels as a direction, not an exact size.
          </p>
        </Step>

        <Step n={6} title="The readout and Augie AI" wide>
          <div className="lp-what-it-shows-pair">
            <div className="lp-what-it-shows-card">
              <p className="lp-what-it-shows-card-label">Readout</p>
              <p className="lp-what-it-shows-card-text">
                When you sign in, an AI readout summarizes the run in plain language, with caveats.
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
            Both explain the results, but neither can prove cause, because this is a regression on
            history rather than a controlled test.
          </p>
        </Step>

      </ol>
    </section>
  )
}

export default WhatItShowsSection
