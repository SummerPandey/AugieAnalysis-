import { IconArrowRight, IconWarning } from "../../icons"
import "./whatis.css"

/** Harbor illustration: boats lifted above a rising admissions-calendar tide. */
function HarborVisual() {
  const boats = [
    { x: 78, label: "Meta" },
    { x: 170, label: "Google" },
    { x: 262, label: "Billboards" },
  ]
  return (
    <svg
      className="lp-what-is-harbor"
      viewBox="0 0 340 200"
      role="img"
      aria-label="Boats lifted slightly above a rising admissions calendar tide line"
    >
      <rect x="0" y="0" width="340" height="200" rx="3" className="lp-what-is-harbor-sky" />
      <rect x="0" y="128" width="340" height="72" className="lp-what-is-harbor-water" />
      <path
        d="M0 128 Q 20 120 40 128 T 80 128 T 120 128 T 160 128 T 200 128 T 240 128 T 280 128 T 320 128 T 340 128"
        className="lp-what-is-harbor-wave"
      />
      <path
        d="M0 152 Q 20 144 40 152 T 80 152 T 120 152 T 160 152 T 200 152 T 240 152 T 280 152 T 320 152 T 340 152"
        className="lp-what-is-harbor-wave lp-what-is-harbor-wave-soft"
      />
      {boats.map((b) => (
        <line
          key={`lift-${b.label}`}
          x1={b.x}
          y1={128}
          x2={b.x}
          y2={106}
          className="lp-what-is-harbor-lift"
        />
      ))}
      <line x1="0" y1="128" x2="340" y2="128" className="lp-what-is-harbor-tide" />
      <text x="10" y="120" className="lp-what-is-harbor-tide-label">
        admissions calendar
      </text>
      {boats.map((b) => (
        <g key={b.label}>
          <text x={b.x} y={72} textAnchor="middle" className="lp-what-is-harbor-boat-label">
            {b.label}
          </text>
          <line x1={b.x} y1={78} x2={b.x} y2={62} className="lp-what-is-harbor-mast" />
          <path d={`M${b.x} 62 L${b.x + 12} 74 L${b.x} 74 Z`} className="lp-what-is-harbor-sail" />
          <path
            d={`M${b.x - 18} 84 L${b.x + 18} 84 L${b.x + 12} 94 L${b.x - 12} 94 Z`}
            className="lp-what-is-harbor-hull"
          />
        </g>
      ))}
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
          admissions season. A Marketing Mix Model, or MMM, separates that calendar effect from
          what each marketing channel adds on top.
        </p>
      </div>

      <div className="lp-what-is">
        {/* 1. The question it answers */}
        <div className="lp-what-is-block lp-what-is-block-split">
          <div className="lp-what-is-text">
            <h3 className="display">The question it answers</h3>
            <p>
              For each week, how many applications did each channel add beyond what the calendar
              would have brought anyway? Think of the calendar as a rising tide that lifts every boat
              in the harbor. The model estimates how far each channel lifts applications above that
              tide, using past data. It is an estimate, not a guarantee.
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
            <li>Billboard spend for QC Airport and Lamar</li>
          </ul>
          <p className="lp-what-is-note">Email sends and direct mail are not included yet.</p>
        </div>

        {/* 4. Why not just read click reports */}
        <div className="lp-what-is-block">
          <h3 className="display">Why not just read click reports</h3>
          <p>
            Carnegie reported that most tracked conversions were view-through: people saw an ad,
            never clicked, and applied later. Click reports miss that entirely. Comparing spend and
            impressions with weekly applications can capture it.
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
