import "./scenes34.css"

/* ---------- Scene 3: one bar, with the ad share as an open question ---------- */

export function SceneQuestion() {
  return (
    <g>
      <g className="lp-s34-float">
        <text x={800} y={190} textAnchor="middle" className="lp-video-display lp-video-question lp-s34-question">
          ?
        </text>
      </g>
      <rect x={700} y={240} width={200} height={120} rx={2} className="lp-video-dashed lp-s34-draw-top" fill="none" />
      <rect x={700} y={360} width={200} height={300} rx={2} className="lp-video-bar lp-s34-rise" />
      <text x={940} y={312} className="lp-video-label">
        Ads?
      </text>
      <text x={940} y={522} className="lp-video-label">
        Calendar?
      </text>
    </g>
  )
}
