import type { CSSProperties } from "react"
import "./scenes56.css"

/* ---------- Scene 5: stacked result, calendar dominant ---------- */

export function SceneStack() {
  const top = 200
  const base = 640
  const total = base - top
  const navyH = Math.round(total * 0.85)
  const navyY = base - navyH
  const label = (delay: string): CSSProperties => ({ animationDelay: delay })
  return (
    <g>
      <rect x={360} y={navyY} width={200} height={navyH} className="lp-video-bar lp-s56-settle" />
      <rect
        x={360}
        y={top}
        width={200}
        height={navyY - top}
        className="lp-s56-gold lp-s56-settle"
        style={{ animationDelay: "0.45s" }}
      />
      <rect x={360} y={top} width={200} height={navyY - top} className="lp-s56-shimmer" />
      <line x1={340} y1={base} x2={580} y2={base} className="lp-video-axis" />
      <line x1={566} y1={405} x2={610} y2={405} className="lp-s56-lead" style={label("0.6s")} />
      <text x={620} y={420} className="lp-video-label lp-s56-label-in" style={label("0.7s")}>
        The calendar
      </text>
      <text x={620} y={470} className="lp-video-sub lp-s56-label-in" style={label("0.8s")}>
        about 80 to 90% in the model
      </text>
      <line x1={566} y1={233} x2={610} y2={233} className="lp-s56-lead" style={label("0.95s")} />
      <text x={620} y={248} className="lp-video-label lp-s56-label-in" style={label("1s")}>
        Ads
      </text>
      <text x={620} y={296} className="lp-video-sub lp-s56-label-in" style={label("1.1s")}>
        still being measured
      </text>
    </g>
  )
}
