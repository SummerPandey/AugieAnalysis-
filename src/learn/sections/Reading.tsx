import { IconWarning } from "../../icons"
import { Term } from "../../glossary"
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
    text: "a hint worth testing. The channel's estimate was positive and held up across the test periods. It is not proof of extra applications, so the next step is a small planned test.",
  },
  {
    key: "directional",
    name: "Directional",
    text: "a weaker hint. It looks positive, but it moved with other channels or the run is shaky. Read the direction, ignore the size, and test before big changes.",
  },
  {
    key: "signal",
    name: "Too little signal",
    text: "the channel ran in too few weeks for the model to tell its effect apart from nothing. Collect more weeks first.",
  },
  {
    key: "unsure",
    name: "Can't tell yet",
    text: "no conclusion either way. The data cannot separate this channel's effect from everything else. This happens when the model's guess for the channel is below zero, or when adding marketing did not improve predictions over the calendar-only model. It does not mean the channel hurts applications. Do not cut or scale a channel because of this verdict. Today every channel reads Can't tell yet.",
  },
]

const NUMBERS = [
  {
    value: "0.60",
    label: "score on unseen weeks",
    text: "out of 1, higher is better. The calendar-only model is the benchmark, and it scores 0.78 on the same weeks. Adding marketing made the guesses worse, so channel numbers show as Can't tell yet.",
  },
  {
    value: "0.70",
    label: "score on past weeks",
    text: "looks better than it is. This score grades the model on weeks it already studied, so do not rely on it.",
  },
  {
    value: "About 52",
    label: "applications a week",
    text: "a typical week's prediction is off by about this much, so treat single-week forecasts as rough.",
  },
]

const LIMITS = [
  {
    label: "Cause",
    text: "it learns from history, not from a planned experiment, so it shows an association and is not causal.",
  },
  {
    label: "Missing spend",
    text: "channel spend covers only about 38 percent of weeks (Oct 2024 to Jan 2026). This is the biggest limit.",
  },
  {
    label: "Other recruiting activity",
    text: "school visits, events and emails are not in the model, so a channel may get credit that belongs to them.",
  },
  {
    label: "The current cycle",
    text: "data ends in May 2026, so it cannot yet see this fall.",
  },
]

const STEPS = [
  {
    title: "Shift",
    text: "Pick one channel and change its spend by a small amount for a set period, such as a few weeks, agreed in advance. Talk to Summer or Irene before changing a budget.",
  },
  {
    title: "Wait",
    text: "Give applications time to show it.",
  },
  {
    title: "Re-run",
    text: "Add the new data and run the model again. Compare with what the calendar-only forecast expected, and treat the result as one input to your judgment.",
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
          In short: this tool can tell you the calendar matters. It cannot yet tell you what any
          single ad channel does. Read the verdict first, check the numbers behind it, then act in
          small steps.
        </p>
      </div>

      <div className="lp-reading-blocks">
        {/* 1. Start with the calendar */}
        <div className="lp-reading-block">
          <h3 className="lp-reading-h3">Start with the calendar</h3>
          <p className="lp-reading-body">
            Weeks 44 and 45, the early-November deadline, spike every year, while summer weeks 20 to
            30 stay quiet. In the current model, about 80 to 90 percent of modeled applications are
            assigned to the admissions <Term id="baseline">baseline</Term>. This is a model-based
            allocation, not a causal measurement. The rest is not credited to channels with
            confidence: the model cannot yet say which channel, if any, is linked to marketing.
          </p>
          <figure className="lp-reading-figure">
            <div className="lp-reading-bar-labels" aria-hidden="true">
              <span>Illustration. Calendar and trend (about 84%) | everything else: marketing and unexplained, too uncertain to split</span>
            </div>
            <svg
              className="lp-reading-bar"
              viewBox="0 0 1000 44"
              preserveAspectRatio="none"
              role="img"
              aria-label="Illustration, stacked bar: the calendar and trend are assigned most modeled applications; the thin remainder is marketing and unexplained, too uncertain to split"
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
          <p className="lp-reading-body">Start with the first one. The score of a model is its <Term id="r2">R-squared</Term>.</p>
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
