import type { CSSProperties } from "react"
import "./scenes56.css"

/* ---------- Scene 6: demo call to action ---------- */

// Small celebratory shapes around the button. Each one flies out once.
const STAR = "M0 -16 Q2 -2 16 0 Q2 2 0 16 Q-2 2 -16 0 Q-2 -2 0 -16 Z"
const BURST: { x: number; y: number; kind: "star" | "dot"; dx: number; dy: number; delay: string }[] = [
  { x: 556, y: 368, kind: "star", dx: -22, dy: -20, delay: "1s" },
  { x: 800, y: 336, kind: "star", dx: 0, dy: -26, delay: "1.05s" },
  { x: 1044, y: 368, kind: "star", dx: 22, dy: -20, delay: "1.1s" },
  { x: 540, y: 448, kind: "dot", dx: -28, dy: 4, delay: "1.02s" },
  { x: 1060, y: 448, kind: "dot", dx: 28, dy: 4, delay: "1.08s" },
  { x: 800, y: 528, kind: "dot", dx: 0, dy: 20, delay: "1.12s" },
]

export function SceneDemo() {
  return (
    <g>
      <text x={800} y={230} textAnchor="middle" className="lp-video-display lp-video-title lp-s56-title">
        See it with practice data
      </text>
      <g className="lp-s56-fade" style={{ animationDelay: "0.4s" }}>
        <rect x={600} y={380} width={400} height={120} rx={3} className="lp-video-ring" />
      </g>
      {BURST.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`}>
          <g
            className="lp-s56-burst"
            style={{ animationDelay: b.delay, "--dx": `${b.dx}px`, "--dy": `${b.dy}px` } as CSSProperties}
          >
            {b.kind === "star" ? (
              <path d={STAR} className="lp-s56-spark" />
            ) : (
              <circle r={7} className="lp-video-fill-navy" />
            )}
          </g>
        </g>
      ))}
      <g className="lp-s56-pop" style={{ animationDelay: "0.5s" }}>
        <g className="lp-s56-idle" style={{ animationDelay: "1.2s" }}>
          <rect x={600} y={380} width={400} height={120} rx={3} className="lp-video-button" />
          <text x={800} y={455} textAnchor="middle" className="lp-video-button-text">
            Try the demo
          </text>
        </g>
      </g>
      <g className="lp-s56-tag" style={{ animationDelay: "0.7s" }}>
        <rect x={620} y={550} width={360} height={64} rx={3} className="lp-video-fill-navy" />
        <text x={800} y={594} textAnchor="middle" className="lp-video-flag-text">
          Made-up data, not real results
        </text>
      </g>
    </g>
  )
}
