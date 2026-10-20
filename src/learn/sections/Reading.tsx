import { IconWarning } from "../../icons"
import "./reading.css"

const VERDICTS = [
  {
    key: "calendar",
    name: "The calendar",
    text: "baseline demand from the admissions cycle. Plan around it, and do not credit it to ads.",
  },
  {
    key: "helping",
    name: "Positive association",
    text: "a positive estimate that held up across the test periods. It is evidence of an association, not proof of extra applications, so the next step is a small, time-boxed test.",
  },
  {
    key: "directional",
    name: "Directional",
    text: "positive, but it moved with other channels or the run is shaky. Read the direction, not the size, and test before big changes.",
  },
  {
    key: "signal",
    name: "Too little signal",
    text: "too few active weeks to tell it apart from zero. Gather more weeks first.",
  },
  {
    key: "unsure",
    name: "Can't tell yet",
    text: "the estimate came out negative, or marketing as a whole didn't beat the calendar alone on unseen weeks. Either way the data can't separate the channel yet. It is not proof the channel hurts, so never cut one on this verdict alone.",
  },
]

const NUMBERS = [
  {
    value: "0.70",
    label: "fit on past weeks",
    text: "how closely the model traces history. 1 is a perfect fit and 0 is no better than the average week. Seasonality does most of that work.",
  },
  {
    value: "0.60",
    label: "fit on unseen weeks",
    text: "tested on weeks it never learned from, and it can fall below zero. The calendar-only model is the benchmark, and it scores 0.78 on the same weeks. So today marketing doesn't improve the forecast, and channel numbers show as Can't tell yet.",
  },
  {
    value: "About 52",
    label: "applications a week",
    text: "the typical miss on any one week. Use the model to read direction, not to forecast a single week.",
  },
]

const LIMITS = [
  {
    label: "Cause",
    text: "it learns from history rather than a controlled experiment, so it shows association, not proven cause.",
  },
  {
    label: "Missing spend",
    text: "channel spend covers only about 38 percent of weeks (Oct 2024 to Jan 2026). This is the biggest limit.",
  },
  {
    label: "The current cycle",
    text: "data ends in May 2026, so it cannot yet see this fall.",
  },
]

const STEPS = [
  {
    title: "Shift",
    text: "Make small, time-boxed spend shifts instead of large cuts or launches.",
  },
  {
    title: "Wait",
    text: "Let the shift run long enough to show up in applications.",
  },
  {
    title: "Re-run",
    text: "Re-run the model to see what changed, and treat each result as one input to your judgment.",
  },
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function ReadingSection() {
  return (
    <section className="lp-section" id="reading" aria-labelledby="reading-title">
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">05 · Reading the results</p>
        <h2 id="reading-title" className="display t-h2">
          How to <em>read</em> and use it
        </h2>
        <p className="lp-intro">
          Augie Analysis gives each channel a verdict. Read the verdict first, check the numbers
          behind it, then act in small steps.
        </p>
      </div>

      <div className="lp-reading-blocks">
        {/* 1. Start with the calendar */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">Start with the calendar</h3>
          <p className="lp-reading-body">
            Weeks 44 and 45, the early-November deadline, spike every year, while summer weeks 20 to
            30 stay quiet. In the current model decomposition, about 80 to 90 percent of modeled
            applications are assigned to the admissions baseline. This is a model-based allocation,
            not a causal measurement, so the channels share the rest and their share is the least
            certain part.
          </p>
          <figure className="lp-reading-figure">
            <div className="lp-reading-bar-labels" aria-hidden="true">
              <span>The calendar</span>
            </div>
            <svg
              className="lp-reading-bar"
              viewBox="0 0 1000 44"
              preserveAspectRatio="none"
              role="img"
              aria-label="Stacked bar: the admissions baseline is assigned most modeled applications, with thin slices for each channel"
            >
              <rect x="0" y="0" width="860" height="44" fill="var(--color-navy)" />
              <rect x="860" y="0" width="40" height="44" fill="var(--color-gold)" />
              <rect x="900" y="0" width="35" height="44" fill="var(--color-blue)" />
              <rect x="935" y="0" width="35" height="44" fill="var(--color-navy-700)" />
              <rect x="970" y="0" width="30" height="44" fill="var(--color-line-strong)" />
            </svg>
          </figure>
        </div>

        {/* 2. The five verdicts */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">The five verdicts</h3>
          <ul role="list" className="lp-reading-verdicts">
            {VERDICTS.map((v) => (
              <li key={v.key} className={`lp-reading-verdict lp-reading-verdict--${v.key}`}>
                <p className="lp-reading-verdict-name">{v.name}</p>
                <p className="lp-reading-verdict-text">{cap(v.text)}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. The three numbers */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">The three numbers</h3>
          <ul role="list" className="lp-reading-numbers">
            {NUMBERS.map((n) => (
              <li key={n.value} className="lp-reading-number">
                <p className="lp-reading-num">{n.value}</p>
                <p className="lp-reading-num-label">{n.label}</p>
                <p className="lp-reading-num-text">{cap(n.text)}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. What the model cannot tell you */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">What the model cannot tell you</h3>
          <ul role="list" className="lp-reading-limits">
            {LIMITS.map((l) => (
              <li key={l.label} className="lp-reading-limit">
                <span className="lp-reading-limit-icon" aria-hidden="true">
                  <IconWarning size={16} />
                </span>
                <p>
                  <strong>{l.label}:</strong> {l.text}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* 5. How to act on it */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">How to act on it</h3>
          <ol role="list" className="lp-reading-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="lp-reading-step">
                <span className="lp-reading-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="lp-reading-step-title">{s.title}</p>
                <p className="lp-reading-step-text">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
