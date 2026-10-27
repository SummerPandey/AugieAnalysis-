import type { ReactNode } from "react"
import { Term } from "../../glossary"
import "./underthehood.css"

const PREFIX = "lp-under-the-hood"

const CARDS: { num: string; heading: string; body: ReactNode }[] = [
  {
    num: "01",
    heading: "Ads keep working after they run",
    body:
      (
        <>
          <Term id="adstock">Adstock</Term> is just carryover: an ad you see this week can still
          nudge you next week. We assume half of the effect carries into the next week, and half of
          what is left into the week after. Picture a YouTube video you watched on Monday that is
          still on your mind on Wednesday. The same setting is used for every channel. It is a
          starting setting, not a finding.
        </>
      ),
  },
  {
    num: "02",
    heading: "The admissions calendar comes first",
    body:
      (
        <>
          Applications follow the school year whether or not ads run. The model marks the key
          stretches: the deadline peak (weeks 44 to 46, the early-November spike), the winter surge
          (weeks 1 to 8), the <strong>yield period</strong> (weeks 9 to 18, when admitted students
          decide whether to enroll), and the summer ramp (weeks 32 to 40). Summer weeks 20 to 30
          stay low every year.
          <br />
          In the model, about 80 to 90 percent of modeled applications are assigned to the
          admissions <Term id="baseline">baseline</Term>: the calendar, the long-term trend, and
          notes about which data we have. That is a model-based allocation, not a causal
          measurement. Anything channels get is only a share of what is left, and it is the least
          certain part.
        </>
      ),
  },
  {
    num: "03",
    heading: "Ridge regression when channels overlap",
    body:
      (
        <>
          Channels often run in the same weeks, so their effects tangle together, like two people
          talking at once. <Term id="ridge">Ridge regression</Term> is a standard method that stops
          the model from making wild guesses in that situation. It does not untangle them. So we
          mark these channels <strong>Directional</strong>: read it as a direction (up or down),
          not a size, and do not rely on the exact number. Steadier is not causal.
        </>
      ),
  },
  {
    num: "04",
    heading: "Testing on weeks the model never saw",
    body:
      (
        <>
          <strong>Result:</strong> the <Term id="calendar-only">calendar-only</Term> model scored
          0.78 on weeks it had not seen. The model with marketing scored 0.60. So marketing has not
          yet earned credit. That calendar-only score is the benchmark marketing has to beat.
          <br />
          <strong>How the test works:</strong> the model studies earlier weeks, predicts the next
          stretch, then moves forward and repeats five times. It is like a practice test made of
          questions the student has not studied. The score runs from 1 (perfect), through 0 (no
          better than guessing the average week), to below 0 (worse). The 0.70 you may see
          elsewhere grades the model on weeks it already studied, so it looks better than it is.
          <br />
          <em>For analysts:</em> inputs are scaled inside each training window. The regularization
          setting is tuned on the same test folds, which makes scores look a bit better than they
          are. A stricter check gives lower scores for both models, and the calendar alone still wins.
        </>
      ),
  },
]


/* Inline diagram for "Ads keep working after they run": one spend week,
   then bars that halve each week. */
function AdstockDiagram() {
  const bars = [
    { label: "Spend week", value: 120 },
    { label: "Week +1", value: 60 },
    { label: "Week +2", value: 30 },
    { label: "Week +3", value: 15 },
    { label: "Week +4", value: 7.5 },
    { label: "Week +5", value: 3.75 },
  ]
  const baseline = 130
  const barWidth = 34
  const gap = 18
  const startX = 14
  const width = startX * 2 + bars.length * barWidth + (bars.length - 1) * gap

  return (
    <figure className={`${PREFIX}-diagram`}>
      <svg
        viewBox={`0 0 ${width} 170`}
        role="img"
        aria-labelledby={`${PREFIX}-adstock-title`}
        className={`${PREFIX}-svg`}
      >
        <title id={`${PREFIX}-adstock-title`}>
          One tall bar for the spend week, then bars at half height, a quarter, and so on, fading out.
        </title>
        <line
          x1={startX - 4}
          x2={width - startX + 4}
          y1={baseline}
          y2={baseline}
          className={`${PREFIX}-axis`}
        />
        {bars.map((bar, i) => {
          const x = startX + i * (barWidth + gap)
          const h = bar.value
          return (
            <g key={bar.label}>
              <rect
                x={x}
                y={baseline - h}
                width={barWidth}
                height={h}
                rx={2}
                className={i === 0 ? `${PREFIX}-bar-hot` : `${PREFIX}-bar`}
                style={{ opacity: i === 0 ? 1 : Math.max(0.25, 1 - i * 0.15) }}
              />
              <text
                x={x + barWidth / 2}
                y={baseline + 18}
                textAnchor="middle"
                className={`${PREFIX}-tick`}
              >
                {i === 0 ? "Spend" : `+${i}`}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className={`${PREFIX}-caption`}>
        Illustration: at the starting setting of 0.5, about half of the effect carries forward each week. An assumption, not a measurement.
      </figcaption>
    </figure>
  )
}

export function UnderTheHoodSection() {
  return (
    <section className="lp-section" id="under-the-hood" aria-labelledby="under-the-hood-title">
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">03 · Under the hood</p>
        <h2 id="under-the-hood-title" className="display t-h2">
          Four ideas <em>under the hood</em>
        </h2>
        <p className="lp-intro">
          Four ideas sit under every number on the results page. You do not need them to read the
          verdicts, but they explain why we are cautious.
        </p>
      </div>

      <div className={`${PREFIX}-grid`}>
        {CARDS.map((card) => (
          <article key={card.num} className={`${PREFIX}-card`}>
            <p className={`${PREFIX}-num`} aria-hidden="true">
              {card.num}
            </p>
            <h3 className={`${PREFIX}-heading`}>{card.heading}</h3>
            <div className={`${PREFIX}-body`}>{card.body}</div>
            {card.num === "01" ? <AdstockDiagram /> : null}
          </article>
        ))}
      </div>

    </section>
  )
}

export default UnderTheHoodSection
