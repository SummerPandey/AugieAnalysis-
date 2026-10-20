import "./underthehood.css"

const PREFIX = "lp-under-the-hood"

const CARDS = [
  {
    num: "01",
    heading: "Ads keep working after they run",
    body:
      "An ad's effect does not stop the week it runs. The model lets part of it carry forward, an idea called adstock. With the default setting, half of a week's effect carries into the next week, and half of what is left carries into the week after. Think of a cup with a slow leak: each week, half spills out and the rest stays. A radio jingle you heard on Monday can still be in your head on Wednesday, and that is the same idea.",
  },
  {
    num: "02",
    heading: "The admissions calendar comes first",
    body:
      "Applications follow the school year whether or not ads run. The model labels the key stretches: the deadline peak (weeks 44 to 46, the early-November spike), the winter surge (weeks 1 to 8), the yield period (weeks 9 to 18), and the summer ramp (weeks 32 to 40). Summer weeks 20 to 30 stay low every year. The model also adds a smooth yearly wave and a long-term trend. The calendar usually explains about 80 to 90 percent of applications, like a tide that comes in no matter who is on the beach. Channels are judged only on what the calendar cannot explain.",
  },
  {
    num: "03",
    heading: "Ridge regression when channels overlap",
    body:
      "Channels often run in the same weeks, so their effects can blur together, like two people talking at once. Ridge regression is a standard fitting method that shrinks overlapping estimates so they stay steady and modest. Its strength is tuned automatically. Channels that moved together are flagged as directional, meaning a direction to read rather than a precise size.",
  },
  {
    num: "04",
    heading: "Testing on weeks the model never saw",
    body:
      "The model learns from earlier weeks, predicts the next stretch, then moves forward and repeats this five times. It is like a practice test made only of questions the student has not studied. The score on unseen weeks (0.31 R-squared, where 1 would be perfect) is the honest one; the 0.74 on learned weeks looks higher because the calendar explains most of that history.",
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
        Each week, about half of the effect carries forward.
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
          Four ideas sit under every number on the results page. Each one is simple once you see it,
          even if the name sounds technical.
        </p>
      </div>

      <div className={`${PREFIX}-grid`}>
        {CARDS.map((card) => (
          <article key={card.num} className={`${PREFIX}-card`}>
            <p className={`${PREFIX}-num`} aria-hidden="true">
              {card.num}
            </p>
            <h3 className={`${PREFIX}-heading`}>{card.heading}</h3>
            <p className={`${PREFIX}-body`}>{card.body}</p>
            {card.num === "01" ? <AdstockDiagram /> : null}
          </article>
        ))}
      </div>

    </section>
  )
}

export default UnderTheHoodSection
