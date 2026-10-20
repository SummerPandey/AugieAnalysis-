import "./scenes12.css"

/* ---------- Scene 1: one admissions year of weekly applications ---------- */

// A stylized year, one bar every two weeks from week 1 to week 51. Shape only
// (winter surge, summer low, early-November peak); no real numbers.
const YEAR_BARS = [
  150, 130, 110, 90, 80, 70, 60, 50, 40, 35, 35, 40, 45, 55, 70, 90, 110, 140, 180, 250, 330, 430, 520, 280, 170, 140,
]
const PEAK_INDEX = YEAR_BARS.indexOf(Math.max(...YEAR_BARS))

// Bars rise in a left-to-right wave; the peak lands on its own step of the wave.
const WAVE_START_S = 0.1
const WAVE_STEP_S = 0.035

export function SceneCalendar() {
  const base = 640
  const step = 1040 / YEAR_BARS.length
  const peakX = 280 + PEAK_INDEX * step
  const peakTop = base - YEAR_BARS[PEAK_INDEX]
  return (
    <g>
      <line x1={260} y1={base} x2={1340} y2={base} className="lp-video-axis" />
      <rect
        x={peakX - 10}
        y={peakTop - 12}
        width={step - 10 + 20}
        height={YEAR_BARS[PEAK_INDEX] + 12}
        rx={6}
        className="lp-s12-glow"
      />
      {YEAR_BARS.map((h, i) => (
        <rect
          key={i}
          x={280 + i * step}
          y={base - h}
          width={step - 10}
          height={h}
          rx={2}
          className={i === PEAK_INDEX ? "lp-s12-peak" : "lp-s12-fill lp-s12-wave"}
          style={{ animationDelay: `${(WAVE_START_S + i * WAVE_STEP_S).toFixed(3)}s` }}
        />
      ))}
      <text x={peakX + (step - 10) / 2} y={peakTop - 24} textAnchor="middle" className="lp-video-label lp-s12-drop">
        Early Nov deadline
      </text>
      <text x={280 + 10 * step} y={712} textAnchor="middle" className="lp-video-label">
        Summer low
      </text>
      <text x={280} y={712} className="lp-video-sub">
        Jan
      </text>
      <text x={1340} y={712} textAnchor="end" className="lp-video-sub">
        Dec
      </text>
    </g>
  )
}
