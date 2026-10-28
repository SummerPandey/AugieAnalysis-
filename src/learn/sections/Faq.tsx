import type { ReactNode } from "react"
import { IconArrowRight, IconChevron, IconInfo } from "../../icons"
import { GlossaryList, Term } from "../../glossary"
import "./faq.css"

type FaqItem = {
  heading: string
  body: ReactNode
  visual: "pair" | "bars" | "tag" | "steps" | "checklist" | "toggle" | "none"
}

const FAQS: FaqItem[] = [
  {
    heading: "Why not just use clicks?",
    body: "Clicks only count people who clicked. Many applicants may have seen an ad and applied later without clicking. See \u201cWhat this tool is\u201d above for how the model tries to account for that.",
    visual: "pair",
  },
  {
    heading: "Why are there two scores, 0.70 and 0.60?",
    body: "0.70 grades the model on weeks it already studied, like marking a student on practice questions they memorized. 0.60 grades it on weeks it did not see, which is the fairer number. The calendar alone scores 0.78 on the same test, so marketing data has not helped yet. More spend history is the main fix.",
    visual: "bars",
  },
  {
    heading: "Why are some channels negative?",
    body: "Sometimes the model's guess for a channel is below zero. That does not mean the channel hurt applications. It usually means channels ran in the same weeks, or there was not enough data to tell. We label these Can't tell yet, and they are never a reason to cut a channel.",
    visual: "tag",
  },
  {
    heading: "Does this prove a channel works?",
    body: "No. It looks at past patterns. It is not causal, and it cannot show that spending caused applications. The best way to find out is a small planned change in spending, then a re-run.",
    visual: "steps",
  },
  {
    heading: "What would make it better?",
    body: "- Longer channel spend history (ask Irene)\n- Email sends (Anthony) and direct mail (Lucas), which are not in the model yet\n- Billboard flight dates (Lucas)\n- Recruitment events, school visits and their dates\n- Small, planned spend tests across regions or time periods\n- Enrollment and deposit data, so applications can be weighed by how many students enroll\n- Data after May 2026, so the current fall cycle is visible",
    visual: "checklist",
  },
  {
    heading: "Demo or live?",
    body: "The demo shows the real results with application counts rescaled (an average week reads 100) and no dollar amounts, so you can practice reading results safely. Signing in (staff only) shows the actual counts and runs the model live.",
    visual: "toggle",
  },
]

const GLOSSARY_BODY =
  "- Can't tell yet: no conclusion either way. The data cannot separate this channel's effect. It does not mean the channel hurts.\n- Positive association: a hint worth testing. The channel moved up with applications. Not proof it caused them.\n- Directional: a weaker hint. Read the direction, not the size, because channels moved together.\n- Too little signal: the channel ran in too few weeks to tell. Collect more data.\n- calendar-only: a forecast that uses only the time of year. It is the benchmark marketing has to beat.\n- model-based allocation: how the model divides up its own predictions. It is not causal and not a count of where applicants came from.\n- Baseline: applications assigned to the calendar and trend. About 80 to 90% of modeled applications.\n- R-squared: a score for how well the model's guesses match reality. 1 is perfect, 0 is no better than guessing an average week, and below 0 is worse.\n- Cross-validation: a practice test on weeks the model has not seen. It is how we get the 0.60 score.\n- Multicollinearity (VIF): channels that rise and fall together, so the model cannot separate their effects. VIF is the number that flags it.\n- Adstock: carryover. An ad's effect can last into later weeks. We assume half carries over each week, for every channel.\n- Seasonality: the yearly admissions rhythm, such as the early-November spike in weeks 44 and 45."

const GLOSSARY_HEADING = "Key words"

const isList = (body: ReactNode): body is string => typeof body === "string" && body.startsWith("- ")
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
            <span className="lp-faq-mini-text">counts every time an ad was shown</span>
          </div>
        </div>
      )
    case "bars":
      return (
        <div className="lp-faq-bars">
          <div className="lp-faq-bar-row">
            <span className="lp-faq-bar-label">Learned weeks</span>
            <span className="lp-faq-track" aria-hidden="true">
              <span className="lp-faq-fill" style={{ width: "70%" }} />
            </span>
            <span className="lp-faq-bar-value">0.70</span>
          </div>
          <div className="lp-faq-bar-row">
            <span className="lp-faq-bar-label">Unseen weeks</span>
            <span className="lp-faq-track" aria-hidden="true">
              <span className="lp-faq-fill lp-faq-fill--gold" style={{ width: "60%" }} />
            </span>
            <span className="lp-faq-bar-value">0.60</span>
          </div>
          <div className="lp-faq-bar-row">
            <span className="lp-faq-bar-label">Calendar alone</span>
            <span className="lp-faq-track" aria-hidden="true">
              <span className="lp-faq-fill" style={{ width: "78%" }} />
            </span>
            <span className="lp-faq-bar-value">0.78</span>
          </div>
          <p className="lp-faq-note">unseen weeks · more spend history will help</p>
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
          Quick answers to common questions, then the words you will see on the results page.
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
        <details className="lp-faq-item">
          <summary>
            <h3 className="lp-faq-q">Words we use (full list)</h3>
            <span className="lp-faq-chev" aria-hidden="true">
              <IconChevron size={18} open={false} />
            </span>
          </summary>
          <div className="lp-faq-body">
            <GlossaryList />
          </div>
        </details>
      </div>
    </section>
  )
}
