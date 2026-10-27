import type { ReactNode } from "react"
import { Term } from "../../glossary"
import "./process.css"

type Step = {
  num: number
  title: string
  body: ReactNode
  visual?: "decay"
}

const jump = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

const STEPS: Step[] = [
  {
    num: 1,
    title: "Gather the weekly data",
    body: (
      <>
        We pull weekly application counts from Slate, our admissions system, for January 2023 to
        May 2026. We add channel spend and impressions from Carnegie, our digital agency. Billboard
        spend is shown for context only, because we have yearly totals and no flight dates (the
        dates each billboard ran).
        <br />
        Spend is the thinnest input: it exists for only about 38% of the 178 weeks (October 2024 to
        January 2026). That is the main reason the model cannot separate channels yet. Weeks with
        no spend export are marked unknown, not zero.
      </>
    ),
  },
  {
    num: 2,
    title: "Line everything up by week",
    body: (
      <>
        Every source is placed on the same <Term id="iso-week">ISO week</Term>, the standard
        Monday-to-Sunday week numbering, so weeks from different systems line up. Each week becomes
        one row with its applications and channel activity side by side.
      </>
    ),
  },
  {
    num: 3,
    title: "Turn spend into model inputs",
    body: (
      <ul className="lp-process-list">
        <li>
          <strong>Carryover (called <Term id="adstock">adstock</Term>).</strong> An ad can still
          matter next week. We assume half of one week's effect carries into the next, like an
          echo. This is a starting guess used for every channel, not a finding.
        </li>
        <li>
          <strong>Calendar markers.</strong> We tell the model which weeks are deadline season
          (weeks 44 to 46) so it does not credit ads for the normal November rush.
        </li>
        <li>
          <strong>Yearly pattern and trend.</strong> A smooth yearly wave, and whether applications
          are slowly rising or falling over the years.
        </li>
      </ul>
    ),
    visual: "decay",
  },
  {
    num: 4,
    title: "Fit the model",
    body: (
      <>
        The model looks for the mix of inputs that best matches past weekly applications. We use a
        method called <Term id="ridge">Ridge regression</Term>, which keeps the answers from
        swinging wildly when several channels ran at the same time. Steadier is not the same as
        proven: if channels always ran together, the model cannot tell which one did the work. The
        result is not causal.
      </>
    ),
  },
  {
    num: 5,
    title: "Test on weeks it has not seen",
    body: (
      <>
        Think of a practice exam. We hide some weeks, let the model guess them, then compare with
        what really happened. We repeat this five times (<Term id="cross-validation">cross-validation</Term>).
        Scores run up to 1 (perfect). A score of 0 means no better than guessing an average week.
        <br />
        The <Term id="calendar-only">calendar-only</Term> model scored 0.78. The model with
        marketing added scored 0.60. Adding marketing made the guesses worse, so we cannot yet say
        what any channel does. The calendar-only model is the{" "}
        <Term id="benchmark">benchmark</Term>: the score marketing has to beat. The next section
        has the details.
      </>
    ),
  },
  {
    num: 6,
    title: "Read the results with care",
    body: (
      <ul className="lp-process-list">
        <li>
          Each channel gets a verdict, from “The calendar” to “Can’t tell yet.” See{" "}
          <a href="#reading" onClick={jump("reading")}>How to read and use it</a>.
        </li>
        <li>
          About 80 to 90% of modeled applications go to the admissions baseline. That is a
          model-based allocation, not a causal measure.
        </li>
        <li>
          “Positive association” means the pattern fits a positive link, not proven extra
          applications. Channels that moved together are read as a direction, not a size.
        </li>
        <li>
          School visits, events and email are not in the model yet, so channel credit could really
          belong to them.
        </li>
        <li>Next step: a small, planned spend change, then a re-run to check.</li>
      </ul>
    ),
  },
]

const DECAY_BARS = [
  { week: "Wk 44", height: 1 },
  { week: "Wk 45", height: 0.5 },
  { week: "Wk 46", height: 0.25 },
  { week: "Wk 47", height: 0.125 },
  { week: "Wk 48", height: 0.0625 },
]

function DecayDiagram() {
  const width = 260
  const height = 110
  const base = 90
  const maxBar = 70
  const barWidth = 34
  const gap = 18
  const startX = 6

  return (
    <svg
      className="lp-process-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby="lp-process-decay-title"
    >
      <title id="lp-process-decay-title">
        Illustration of carryover: spend in week 44 fades by half each following week
      </title>
      <line className="lp-process-axis" x1="0" y1={base} x2={width} y2={base} />
      {DECAY_BARS.map((bar, i) => {
        const barHeight = bar.height * maxBar
        const x = startX + i * (barWidth + gap)
        return (
          <g key={bar.week}>
            <rect
              className={i === 0 ? "lp-process-bar lp-process-bar--hot" : "lp-process-bar"}
              x={x}
              y={base - barHeight}
              width={barWidth}
              height={barHeight}
            />
            <text className="lp-process-svg-label" x={x + barWidth / 2} y={base + 16} textAnchor="middle">
              {bar.week}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ProcessSection() {
  return (
    <section className="lp-section" id="process" aria-labelledby="process-title">
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">02 · Build process</p>
        <h2 id="process-title" className="display t-h2">
          How we build one, <em>step by step</em>
        </h2>
        <p className="lp-intro">
          Six steps turn agency reports and admissions data into a result you can read. Technical
          section: if you only need to read results, skip to 04 and 05.
        </p>
      </div>

      <ol className="lp-process-steps" role="list">
        {STEPS.map((step) => (
          <li className="lp-process-card" key={step.num}>
            <h3 className="lp-process-heading">
              <span className="lp-process-num">{step.num}</span>
              <span>{step.title}</span>
            </h3>
            <div className="lp-process-body">{step.body}</div>
            {step.visual === "decay" && (
              <div className="lp-process-visual">
                <DecayDiagram />
                <p className="lp-process-caption">
                  Illustration: if you spent in week 44, half of its effect is assumed to remain in
                  week 45, a quarter in week 46, and so on. This is an assumption, not a measurement.
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ProcessSection
