import { IconArrowRight, IconChevron, IconInfo } from "../../icons"
import "./faq.css"

type FaqItem = {
  heading: string
  body: string
  visual: "pair" | "bars" | "tag" | "steps" | "checklist" | "toggle" | "none"
}

const FAQS: FaqItem[] = [
  {
    heading: "Why not just use clicks?",
    body: "Clicks only count people who click. Carnegie reported that most tracked conversions were view-through: people who saw an ad on Meta or Snapchat and applied without clicking. The model reads spend and impressions against weekly applications, so it can capture that effect.",
    visual: "pair",
  },
  {
    heading: "Why is the fit on unseen weeks lower?",
    body: "The 0.74 score measures fit on weeks the model learned from, where the admissions calendar explains most of the pattern. The 0.31 score comes from walk-forward testing: the model trains on earlier weeks and predicts later weeks it never saw. It is the more honest number. Channel spend covers only about 37% of weeks, from October 2024 to January 2026, so more history is the main fix.",
    visual: "bars",
  },
  {
    heading: "Why are some channels negative?",
    body: "A negative estimate usually means channels ran at the same time and the data cannot separate them, or the weekly data is too coarse. It does not prove a channel hurt applications. These results are labeled Can't tell yet, and they are never a reason to cut a channel.",
    visual: "tag",
  },
  {
    heading: "Does this prove a channel works?",
    body: "No. The model learns from history, not from a controlled test, so it shows association, not proven cause. The best use is a small, time-boxed spend shift, followed by a re-run to see what changed.",
    visual: "steps",
  },
  {
    heading: "What would make it better?",
    body: "- Longer channel spend history\n- Email sends and direct mail, which are not in the model yet\n- Data after May 2026, so the current fall cycle is visible",
    visual: "checklist",
  },
  {
    heading: "Demo or live?",
    body: "The demo runs the same method on a synthetic sample shaped like Augustana's data, so every number is generated. Signing in runs the same method on the real data.",
    visual: "toggle",
  },
]

const GLOSSARY_BODY =
  "- MMM (marketing mix model): estimates how much each channel moves weekly applications.\n- Adstock: carryover. Part of a week's effect lingers into later weeks. The default decay is 0.5, so half carries forward.\n- Seasonality: the yearly admissions rhythm, such as the early-November spike in weeks 44 and 45.\n- Baseline: applications the calendar brings in on its own. It is usually 80 to 90 percent of the total.\n- R-squared: the share of weekly ups and downs the model explains, from 0 to 1.\n- Cross-validation: testing on held-out weeks, repeated across five splits.\n- Multicollinearity (VIF): channels that rise and fall together, so their separate effects are hard to tell apart.\n- Directional: positive but shaky. Read it as a direction, not a size."

const GLOSSARY_HEADING = "Glossary"

const isList = (body: string) => body.startsWith("- ")
const listItems = (body: string) =>
  body
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))

function splitTerm(entry: string): { term: string; def: string } {
  const idx = entry.indexOf(": ")
  if (idx === -1) return { term: entry, def: "" }
  return { term: entry.slice(0, idx), def: entry.slice(idx + 2) }
}

function Visual({ kind }: { kind: FaqItem["visual"] }) {
  switch (kind) {
    case "pair":
      return (
        <div className="lp-faq-pair">
          <div className="card lp-faq-mini">
            <span className="lp-faq-mini-label">Clicks</span>
            <span className="lp-faq-mini-text">counts only clickers</span>
          </div>
          <div className="card lp-faq-mini lp-faq-mini--hl">
            <span className="lp-faq-mini-label">Impressions</span>
            <span className="lp-faq-mini-text">counts everyone who saw an ad</span>
          </div>
        </div>
      )
    case "bars":
      return (
        <div className="lp-faq-bars">
          <div className="lp-faq-bar-row">
            <span className="lp-faq-bar-label">Learned weeks</span>
            <span className="lp-faq-track" aria-hidden="true">
              <span className="lp-faq-fill" style={{ width: "74%" }} />
            </span>
            <span className="lp-faq-bar-value">0.74</span>
          </div>
          <div className="lp-faq-bar-row">
            <span className="lp-faq-bar-label">Unseen weeks</span>
            <span className="lp-faq-track" aria-hidden="true">
              <span className="lp-faq-fill lp-faq-fill--gold" style={{ width: "31%" }} />
            </span>
            <span className="lp-faq-bar-value">0.31</span>
          </div>
          <p className="lp-faq-note">more history will help</p>
        </div>
      )
    case "tag":
      return (
        <div className="lp-faq-tagrow">
          <span className="lp-faq-tag">
            <IconInfo size={14} />
            Can't tell yet
          </span>
          <span className="lp-faq-note">not proof of harm</span>
        </div>
      )
    case "steps":
      return (
        <ol className="lp-faq-steps" role="list">
          <li className="lp-faq-step">
            <span className="lp-faq-step-num">1</span>
            Shift spend
          </li>
          <li className="lp-faq-arrow" aria-hidden="true">
            <IconArrowRight size={14} />
          </li>
          <li className="lp-faq-step">
            <span className="lp-faq-step-num">2</span>
            Wait
          </li>
          <li className="lp-faq-arrow" aria-hidden="true">
            <IconArrowRight size={14} />
          </li>
          <li className="lp-faq-step">
            <span className="lp-faq-step-num">3</span>
            Re-run
          </li>
        </ol>
      )
    case "toggle":
      return (
        <div className="lp-faq-toggle" aria-hidden="true">
          <span className="lp-faq-seg lp-faq-seg--on">Demo (sample data)</span>
          <span className="lp-faq-seg">Live (signed in, real data)</span>
        </div>
      )
    default:
      return null
  }
}

export function FaqSection() {
  const glossaryTerms = listItems(GLOSSARY_BODY).map(splitTerm)

  return (
    <section className="lp-section" id="faq" aria-labelledby="faq-title">
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">06 · FAQ and glossary</p>
        <h2 id="faq-title" className="display t-h2">
          Questions and <em>glossary</em>
        </h2>
        <p className="lp-intro">
          Quick answers to the questions new staff ask most, then the terms you will see on the
          results page.
        </p>
      </div>

      <div className="lp-faq-list">
        {FAQS.map((item, i) => (
          <details key={item.heading} className="lp-faq-item" open={i === 0}>
            <summary>
              <h3 className="lp-faq-q">{item.heading}</h3>
              <span className="lp-faq-chev" aria-hidden="true">
                <IconChevron size={18} open={false} />
              </span>
            </summary>
            <div className="lp-faq-body">
              {isList(item.body) ? (
                <ul role="list" className="lp-faq-check">
                  {listItems(item.body).map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <p>{item.body}</p>
              )}
              <Visual kind={item.visual} />
            </div>
          </details>
        ))}
      </div>

      <div className="lp-faq-gloss">
        <h3 className="t-h3 lp-faq-gloss-title">{GLOSSARY_HEADING}</h3>
        <dl className="lp-faq-terms">
          {glossaryTerms.map(({ term, def }) => (
            <div key={term} className="lp-faq-term">
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
