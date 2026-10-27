import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import "./glossary.css"

export type GlossaryEntry = { term: string; plain: string; why?: string }

/** Plain-language definitions. Accurate to CLAUDE.md; keep each to one or two everyday sentences. */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  mmm: {
    term: "Marketing mix model",
    plain:
      "A statistical model that looks at past weeks of marketing spend and applications to see how they move together.",
    why: "It shows patterns in the data. It does not prove that any ad caused applications.",
  },
  baseline: {
    term: "Baseline",
    plain:
      "The applications the model expects from the admissions calendar alone: the season, the long-run trend and which data we have.",
    why: "Most of the weekly pattern sits here, so planning can lean on it.",
  },
  "calendar-only": {
    term: "calendar-only model",
    plain:
      "A version of the model that uses only the admissions calendar and no marketing data at all.",
    why: "It is our yardstick. Marketing data only counts if it predicts better than this.",
  },
  benchmark: {
    term: "Benchmark",
    plain: "The score a new model has to beat to be worth using. Here it is the calendar-only model.",
    why: "Without a benchmark, a model can look good just by repeating the seasons.",
  },
  adstock: {
    term: "Adstock",
    plain:
      "A way of counting an ad's effect as fading over several weeks instead of ending the moment the spend stops.",
    why: "People may act on an ad days or weeks after they see it. We fixed the fade rate at 0.5 for every channel; it was not tuned.",
  },
  r2: {
    term: "R²",
    plain:
      "A score for how closely the model's weekly guesses match what happened. 1 is a perfect match; 0 is no better than guessing the average. It can go below 0.",
    why: "Check it on weeks the model has not seen. A high score on old weeks says little.",
  },
  "cross-validation": {
    term: "Cross-validation",
    plain:
      "A test where the model learns from earlier weeks, then predicts later weeks it has not seen, over and over. We call each round a test stretch.",
    why: "It is the fairest check we have of how the model would do on future weeks.",
  },
  "unseen-weeks": {
    term: "Unseen weeks",
    plain: "Weeks that were held back while the model learned, then used to test its predictions.",
    why: "A model that only fits old weeks may fail on new ones.",
  },
  coefficient: {
    term: "Coefficient",
    plain: "A number showing how strongly one input moves with applications in the model, other inputs held steady.",
    why: "Read it as a pattern in the data, not as a proven effect.",
  },
  standardized: {
    term: "Standardized",
    plain: "Rescaled so inputs measured in different units, such as dollars and impressions, can be compared side by side.",
  },
  vif: {
    term: "VIF",
    plain:
      "A warning score for inputs that rise and fall together. Above 10 means the model struggles to tell them apart.",
    why: "High-VIF channels are Directional only, not precise.",
  },
  ridge: {
    term: "Ridge regression",
    plain:
      "The kind of model we use. It keeps its estimates steady when inputs are tangled together.",
    why: "It steadies the numbers but cannot prove what caused what.",
  },
  impressions: {
    term: "Impressions",
    plain: "The number of times an ad was shown on someone's screen, whether or not they clicked.",
    why: "Impressions may reach people who never click, so we test them as a signal. They are not yet shown to matter more than clicks.",
  },
  "view-through": {
    term: "View-through conversion",
    plain: "Someone saw an ad, did not click it, and later took an action such as applying.",
    why: "These never show up in click reports. Carnegie reported that most of its tracked conversions this fiscal year were view-through.",
  },
  decomposition: {
    term: "Decomposition",
    plain: "Splitting each week's predicted applications into pieces: the baseline, impressions and each channel.",
    why: "These shares are a model-based allocation, not a causal measurement.",
  },
  confidence: {
    term: "Confidence",
    plain: "How much weight a result can bear, given how much data we have and how well the model predicts new weeks.",
    why: "Low confidence means treat it as a clue, not a decision.",
  },
  seasonality: {
    term: "Seasonality",
    plain: "Patterns that repeat every year, like the November deadline rush and the quiet summer.",
    why: "Seasonality explains most weekly swings, so it must be separated from marketing.",
  },
  trend: {
    term: "Trend",
    plain: "The slow, long-run drift up or down over the years, apart from the yearly cycle.",
  },
  spend: {
    term: "Spend",
    plain: "Money put into a marketing channel in a given week. Weeks with no spend file are marked as not observed, not as zero.",
  },
  channel: {
    term: "Channel",
    plain: "One place marketing runs, such as Meta, Snapchat, YouTube, Google search ads or display ads.",
  },
  association: {
    term: "Positive association",
    plain: "When a channel's spend and applications rose together in the data.",
    why: "It does not show the channel added applications. Something else may explain both.",
  },
  causal: {
    term: "Causal",
    plain: "Showing that one thing made another happen. This model is not causal: it only sees patterns, not controlled tests.",
    why: "Only a planned test, like switching a channel on and off, can show cause.",
  },
  lift: {
    term: "Marketing lift",
    plain:
      "How much better the model predicts unseen weeks once marketing data is added, compared with the calendar-only model.",
    why: "In the latest run it is negative, so channel effects are Can't tell yet.",
  },
  holdout: {
    term: "Holdout",
    plain: "A group of places or weeks kept free of a campaign so they can be compared with those that got it.",
    why: "It is one of the best ways to learn what advertising really adds.",
  },
  flighting: {
    term: "Flighting",
    plain: "Running a campaign in planned bursts, on for some weeks and off for others, rather than constantly.",
    why: "Switching on and off gives the data the variation it needs to show an effect.",
  },
  collinearity: {
    term: "Collinearity",
    plain: "When two inputs, such as two channels, always move together so the model cannot separate their effects.",
  },
  directional: {
    term: "Directional",
    plain: "A hint about which way a channel points. The size is not reliable, because the channel often ran at the same time as others.",
    why: "Use it as a hint to look into, not as a number to plan a budget on.",
  },
  "cant-tell": {
    term: "Can't tell yet",
    plain: "The data cannot show whether this channel adds applications or not.",
    why: "Marketing has not yet beaten the calendar-only model on unseen weeks.",
  },
  thin: {
    term: "Too little signal",
    plain: "The channel ran too little, or too rarely, for the model to learn anything about it.",
  },
  "iso-week": {
    term: "ISO week",
    plain: "A standard way of numbering weeks (Monday to Sunday), so data from different sources lines up week by week.",
  },
  coverage: {
    term: "Data coverage",
    plain: "Which weeks we actually have a spend or impressions export for. Missing weeks are flagged, not treated as zero.",
    why: "Spend is on file for only some weeks, so channel results rest on limited history.",
  },
}

/**
 * Inline term with a plain-language popover.
 * <Term id="adstock">adstock</Term>
 */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = GLOSSARY[id]
  const [show, setShow] = useState(false)
  const [shift, setShift] = useState(0)
  const pointer = useRef<string | null>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const popId = useId()

  // Keep the popover on screen when the term sits near the right edge.
  useLayoutEffect(() => {
    if (!show || !popRef.current) return setShift(0)
    const r = popRef.current.getBoundingClientRect()
    const over = r.right - (window.innerWidth - 16)
    setShift(over > 0 ? -over : 0)
  }, [show])

  // Escape closes even when focus has moved off the button (e.g. after a tap).
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShow(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [show])

  if (!entry) return <>{children}</>
  return (
    <span className="gl-term-wrap">
      <button
        type="button"
        className="gl-term"
        aria-expanded={show}
        aria-describedby={show ? popId : undefined}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onPointerEnter={(e) => e.pointerType === "mouse" && setShow(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setShow(false)}
        onFocus={() => pointer.current === null && setShow(true)}
        onBlur={() => {
          pointer.current = null
          setShow(false)
        }}
        onClick={() => {
          if (pointer.current !== "mouse") setShow((s) => !s)
          pointer.current = null
        }}
      >
        {children ?? entry.term}
      </button>
      {show && (
        <span
          ref={popRef}
          id={popId}
          role="tooltip"
          className="gl-pop"
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          <strong>{entry.term}</strong>
          {entry.plain}
          {entry.why && <span className="gl-pop-why">{entry.why}</span>}
        </span>
      )}
    </span>
  )
}

/** Every glossary entry as a definition list. */
export function GlossaryList() {
  const items = Object.entries(GLOSSARY).sort((a, b) => a[1].term.localeCompare(b[1].term))
  return (
    <dl className="gl-list">
      {items.map(([id, e]) => (
        <div key={id}>
          <dt id={`gl-${id}`}>{e.term}</dt>
          <dd>
            {e.plain}
            {e.why && <span className="gl-why">{e.why}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
