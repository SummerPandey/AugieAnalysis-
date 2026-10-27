import type { CSSProperties } from "react"
import "./scenes34.css"

/* ---------- Scene 4: weeks lined up, calendar flags, fading carryover ---------- */

const FLAGS = [
  { x: 330, label: "Deadline" },
  { x: 650, label: "Winter" },
  { x: 970, label: "Yield (admits decide)" },
  { x: 1290, label: "Summer" },
]

const CARRY = [
  { x: 330, w: 300 },
  { x: 642, w: 150 },
  { x: 804, w: 75 },
  { x: 891, w: 38 },
]

export function SceneLineup() {
  return (
    <g>
      <text x={330} y={120} textAnchor="middle" className="lp-video-label">
        Time of year
      </text>
      {FLAGS.map((f, i) => (
        <g key={f.label} className="lp-s34-flag" style={{ "--d": `${i * 0.15}s` } as CSSProperties}>
          <circle
            cx={f.x}
            cy={200}
            r={28}
            className={i === 0 ? "lp-video-dot-gold lp-s34-dot-idle" : "lp-video-fill-navy"}
          />
          <g className="lp-s34-tag" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
            <rect x={f.x - 130} y={250} width={260} height={56} rx={3} className="lp-video-fill-navy" />
            <text x={f.x} y={291} textAnchor="middle" className="lp-video-flag-text">
              {f.label}
            </text>
          </g>
        </g>
      ))}
      {CARRY.map((c, i) => {
        const start = 0.8 + i * 0.32
        return (
          <g key={c.x}>
            <rect
              x={c.x}
              y={420}
              width={c.w}
              height={44}
              rx={2}
              className="lp-video-carry lp-s34-carry"
              style={{ "--d": `${start}s` } as CSSProperties}
            />
            <rect
              x={c.x}
              y={420}
              width={c.w}
              height={44}
              rx={2}
              className="lp-s34-flash"
              style={{ "--f": `${start + 0.35}s` } as CSSProperties}
            />
          </g>
        )
      })}
      <text x={330} y={512} className="lp-video-label">
        Ads from earlier weeks may still linger
      </text>
    </g>
  )
}
