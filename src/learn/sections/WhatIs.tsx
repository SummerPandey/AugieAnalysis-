import { IconArrowRight, IconWarning } from "../../icons"
import "./whatis.css"

/** Harbor illustration: boats lifted above a rising admissions-calendar tide. */
function HarborVisual() {
  // The water level is the admissions calendar: it lifts every boat. Each
  // dashed gold arrow is the extra lift a channel might add on top — the
  // part the model is still trying to measure.
  const tide = 112
  const boats = [
    { x: 70, label: "Meta" },
    { x: 170, label: "Google" },
    { x: 270, label: "Snapchat" },
  ]
  const wave = (y: number) =>
    `M0 ${y} Q 21 ${y - 6} 42.5 ${y} T 85 ${y} T 127.5 ${y} T 170 ${y} T 212.5 ${y} T 255 ${y} T 297.5 ${y} T 340 ${y}`
  return (
    <svg
      className="lp-what-is-harbor"
      viewBox="0 0 340 200"
      role="img"
      aria-label="Three boats, labeled Meta, Google and Snapchat, float on water labeled the admissions calendar. A dashed arrow above each boat marks the extra lift a channel might add."
    >
      <rect x="0" y="0" width="340" height="200" rx="4" className="lp-what-is-harbor-sky" />
      <path d={`${wave(tide)} L340 200 L0 200 Z`} className="lp-what-is-harbor-water" />
      <path d={wave(tide)} className="lp-what-is-harbor-wave" />
      <path d={wave(tide + 46)} className="lp-what-is-harbor-wave lp-what-is-harbor-wave-soft" />

      {boats.map((b) => (
        <g key={b.label}>
          {/* extra lift: not yet measured */}
          <line x1={b.x} y1={50} x2={b.x} y2={28} className="lp-what-is-harbor-lift" />
          <path d={`M${b.x - 5} 33 L${b.x} 26 L${b.x + 5} 33`} className="lp-what-is-harbor-lift-head" />
          {/* boat sitting on the tide */}
          <line x1={b.x} y1={tide - 12} x2={b.x} y2={58} className="lp-what-is-harbor-mast" />
          <path d={`M${b.x + 2} 60 L${b.x + 24} ${tide - 16} L${b.x + 2} ${tide - 16} Z`} className="lp-what-is-harbor-sail" />
          <path
            d={`M${b.x - 26} ${tide - 12} L${b.x + 26} ${tide - 12} L${b.x + 18} ${tide + 2} L${b.x - 18} ${tide + 2} Z`}
            className="lp-what-is-harbor-hull"
          />
          <text x={b.x} y={tide + 24} textAnchor="middle" className="lp-what-is-harbor-boat-label">
            {b.label}
          </text>
        </g>
      ))}

      <text x="170" y="186" textAnchor="middle" className="lp-what-is-harbor-tide-label">
        The tide: the admissions calendar
      </text>
    </svg>
  )
}

export function WhatIsSection() {
  return (
    <section className="lp-section" id="what-is" aria-labelledby="what-is-title">
      <div className="lp-section-head">
        <p className="eyebrow eyebrow-rule">01 · The basics</p>
        <h2 id="what-is-title" className="display t-h2">
          What a Marketing Mix Model <em>is</em>
        </h2>
        <p className="lp-intro">
          Applications climb every fall toward the early-November deadline, partly because it is
          admissions season. A Marketing Mix Model, or MMM, tries to separate that calendar effect
          from what each marketing channel may add on top.
        </p>
      </div>

      <div className="lp-what-is">
        {/* 1. The question it answers */}
        <div className="lp-what-is-block lp-what-is-block-split">
          <div className="lp-what-is-text">
            <h3 className="display">The question it answers</h3>
            <p>
              For each week, how many extra applications might each channel have brought beyond what
              the calendar would have brought anyway? Think of the calendar as a rising tide that lifts
              every boat in the harbor. The model estimates how far each channel may lift applications
              above that tide, using past data. It is an estimate, not a proof. Today the calendar alone
              predicts unseen weeks better, so channel numbers are not yet reliable.
            </p>
          </div>
          <div className="lp-what-is-visual">
            <HarborVisual />
          </div>
        </div>

        {/* 2. What goes in */}
        <div className="lp-what-is-block">
          <h3 className="display">What goes in</h3>
          <div className="lp-what-is-flow" aria-hidden="true">
            <span className="lp-what-is-chip">Slate</span>
            <span className="lp-what-is-chip">Carnegie</span>
            <span className="lp-what-is-chip">Billboards</span>
            <span className="lp-what-is-arrow">
              <IconArrowRight size={16} />
            </span>
            <span className="lp-what-is-out">one row per week</span>
          </div>
          <ul role="list" className="lp-what-is-list">
            <li>
              Weekly submitted applications from Slate, Augustana's admissions system, January 2023
              to May 2026
            </li>
            <li>
              Spend and impressions from Carnegie, the digital agency, for Meta, Snapchat, YouTube,
              Google search and IP targeting, and display retargeting
            </li>
            <li>Billboard spend for QC Airport and Lamar, shown for context but not modeled, since it is on file only as yearly totals</li>
          </ul>
          <p className="lp-what-is-note">Email sends and direct mail are not included yet.</p>
        </div>

        {/* 4. Why not just read click reports */}
        <div className="lp-what-is-block">
          <h3 className="display">Why not just read click reports</h3>
          <p>
            Carnegie reported that most tracked conversions were view-through: people saw an ad,
            never clicked, and applied later. Click reports do not count those people. A mix model
            can potentially pick up effects that do not involve clicks, by comparing spend and
            impressions with weekly applications. It still needs enough variation and history to
            separate those effects from seasonality and other influences.
          </p>
          <div className="lp-what-is-compare">
            <div className="lp-what-is-compare-card">
              <strong>Click reports</strong>
              <span>only people who clicked</span>
            </div>
            <div className="lp-what-is-compare-card lp-what-is-compare-card-strong">
              <strong>Mix model</strong>
              <span>spend and impressions over time</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

export default WhatIsSection
