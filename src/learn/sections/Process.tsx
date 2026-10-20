import "./process.css"

type Step = {
  num: number
  title: string
  body: string
  visual?: "decay"
}

const STEPS: Step[] = [
  {
    num: 1,
    title: "Gather the weekly data",
    body: "We pull weekly application counts from Slate, Augustana's admissions system, for January 2023 to May 2026. We add channel spend from Carnegie, our digital agency, plus impressions and billboard spend. Spend is the thinnest input. It covers only about 37% of the weeks, October 2024 to January 2026.",
  },
  {
    num: 2,
    title: "Line everything up by week",
    body: "Every source is placed on the same ISO week, so each week becomes one row with its applications and channel activity side by side. Think of stacking several calendars so matching weeks line up.",
  },
  {
    num: 3,
    title: "Turn spend into model inputs",
    body: "Ads keep working after they run, so adstock lets part of each week's effect carry forward. At our default decay of 0.5, half the effect moves into the next week, like an echo. Calendar flags mark the admissions season, including the deadline weeks 44 to 46, so ads are not credited for the normal November rush. A smooth yearly pattern and a trend term complete the inputs.",
    visual: "decay",
  },
  {
    num: 4,
    title: "Fit the model",
    body: "The model finds the mix of inputs that best explains past weekly applications. We use Ridge regression, which keeps estimates steady when channels run in the same weeks. Its strength is tuned automatically.",
  },
  {
    num: 5,
    title: "Test on weeks it has not seen",
    body: "We train on earlier weeks, test on later ones, and repeat five times, like checking yourself on practice questions you did not study. The model scores 0.74 on the history it learned from, but 0.31 on unseen weeks. A typical miss is about 49 applications a week, which is why the results need careful reading.",
  },
  {
    num: 6,
    title: "Read the results with care",
    body: "Each channel gets a verdict, from \u201cThe calendar\u201d (usually about 80 to 90% of applications) to \u201cCan\u2019t tell yet.\u201d Channels that moved together are read as a direction, not an exact size. The best next step is a small, time-boxed spend shift, then a re-run to check. The Reading section explains each verdict.",
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
        Adstock decay: a burst of spend in week 44 halves in each following week
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
          Six steps turn agency reports and admissions data into one answer. Augie Analysis, our
          Marketing Mix Model, shows how much each channel moves weekly applications, and how much
          is simply the admissions calendar.
        </p>
      </div>

      <ol className="lp-process-steps" role="list">
        {STEPS.map((step) => (
          <li className="lp-process-card" key={step.num}>
            <h3 className="lp-process-heading">
              <span className="lp-process-num">{step.num}</span>
              <span>{step.title}</span>
            </h3>
            <p className="lp-process-body">{step.body}</p>
            {step.visual === "decay" && (
              <div className="lp-process-visual">
                <DecayDiagram />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ProcessSection
