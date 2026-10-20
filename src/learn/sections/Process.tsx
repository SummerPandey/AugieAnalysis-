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
    body: "We pull weekly application counts from Slate, Augustana's admissions system, for January 2023 to May 2026. We add channel spend and impressions from Carnegie, our digital agency. Billboard spend is shown for context only, because it is on file as yearly totals with no flight dates. Spend is the thinnest input. It covers only about 38% of the weeks, October 2024 to January 2026. Weeks without a spend export are marked as unknown, not as zero spend.",
  },
  {
    num: 2,
    title: "Line everything up by week",
    body: "Every source is placed on the same ISO week, so each week becomes one row with its applications and channel activity side by side. Think of stacking several calendars so matching weeks line up.",
  },
  {
    num: 3,
    title: "Turn spend into model inputs",
    body: "Ads keep working after they run, so adstock lets part of each week's effect carry forward. At a starting decay of 0.5, half the effect moves into the next week, like an echo. The same 0.5 is used for every channel. Channels may really carry over at different speeds, so per-channel tuning is a next step. Calendar flags mark the admissions season, including the deadline weeks 44 to 46, so the model is less likely to credit ads for the normal November rush. A smooth yearly pattern and a trend term complete the inputs.",
    visual: "decay",
  },
  {
    num: 4,
    title: "Fit the model",
    body: "The model finds the mix of inputs that best explains past weekly applications. We use Ridge regression, which keeps estimates steady when channels run in the same weeks. Steadier does not mean causal: when channels always run together, the model can split credit between them without knowing which one did the work.",
  },
  {
    num: 5,
    title: "Test on weeks it has not seen",
    body: "We train on at least a year of earlier weeks, test on later weeks the model never saw, and repeat five times. We run the same test with the calendar alone: that is the benchmark. Marketing only gets credit if adding it predicts unseen weeks better. Today the full model scores 0.60 and the calendar alone 0.78, so channel numbers aren't supported yet. Under the hood explains the details.",
  },
  {
    num: 6,
    title: "Read the results with care",
    body: "Each channel gets a verdict, from \u201cThe calendar\u201d to \u201cCan\u2019t tell yet.\u201d In the current breakdown, about 80 to 90% of modeled applications go to the admissions baseline. That is a model-based allocation, not a causal measure. \u201cPositive association\u201d means the pattern fits a positive link, not proven extra applications. Channels that moved together are read as a direction, not an exact size. Recruitment events, school visits and email campaigns are not in the model yet, so channel credit could absorb their effects. The best next step is a small, time-boxed spend shift, then a re-run to check. The Reading section explains each verdict.",
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
          Six steps turn agency reports and admissions data into a result you can read. Augie Analysis, our
          Marketing Mix Model, estimates how much each channel may be linked to weekly applications,
          and how much of the total the admissions calendar accounts for in the model.
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
