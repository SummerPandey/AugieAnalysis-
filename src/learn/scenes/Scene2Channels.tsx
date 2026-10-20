import type { CSSProperties } from "react"
import "./scenes12.css"

/* ---------- Scene 2: four ad channels feeding one weekly bar ---------- */

const CHANNELS = [
  { x: 350, label: "Social" },
  { x: 650, label: "Video" },
  { x: 950, label: "Search" },
  { x: 1250, label: "Billboards" },
]

// Icons pop in one by one; each dot leaves after its icon has settled.
const ICON_START_S = 0.05
const ICON_STEP_S = 0.12
const DOT_START_S = 0.5
const DOT_STEP_S = 0.2

function ChannelIcon({ kind, x }: { kind: number; x: number }) {
  return (
    <g transform={`translate(${x} 260)`} className="lp-video-fill-navy">
      {kind === 0 && (
        <>
          <rect x={-32} y={-52} width={64} height={104} rx={8} />
          <circle cx={0} cy={38} r={5} className="lp-video-fill-paper" />
        </>
      )}
      {kind === 1 && (
        <>
          <circle r={58} />
          <path d="M-16 -26 L26 0 L-16 26 Z" className="lp-video-fill-paper" />
        </>
      )}
      {kind === 2 && (
        <>
          <circle cx={-8} cy={-8} r={38} className="lp-video-stroke-navy" fill="none" strokeWidth={14} />
          <line x1={18} y1={18} x2={50} y2={50} className="lp-video-stroke-navy" strokeWidth={16} strokeLinecap="round" />
        </>
      )}
      {kind === 3 && (
        <>
          <rect x={-72} y={-56} width={144} height={92} rx={4} />
          <line x1={-40} y1={36} x2={-40} y2={72} className="lp-video-stroke-navy" strokeWidth={10} />
          <line x1={40} y1={36} x2={40} y2={72} className="lp-video-stroke-navy" strokeWidth={10} />
        </>
      )}
    </g>
  )
}

export function SceneChannels() {
  const barTopX = 800
  const barTopY = 560
  return (
    <g>
      {CHANNELS.map((c, i) => (
        <g key={c.label} className="lp-s12-pop" style={{ animationDelay: `${(ICON_START_S + i * ICON_STEP_S).toFixed(2)}s` }}>
          <ChannelIcon kind={i} x={c.x} />
          <text x={c.x} y={390} textAnchor="middle" className="lp-video-label">
            {c.label}
          </text>
        </g>
      ))}
      {CHANNELS.map((c, i) => {
        const delay = `${(DOT_START_S + i * DOT_STEP_S).toFixed(2)}s`
        return (
          <g
            key={`dot-${c.label}`}
            className="lp-s12-fly-x"
            style={{ "--dx": `${barTopX - c.x}px`, animationDelay: delay } as CSSProperties}
          >
            <circle
              cx={c.x}
              cy={310}
              r={16}
              className="lp-video-dot lp-s12-fly-y"
              style={{ "--dy": `${barTopY - 310}px`, animationDelay: delay } as CSSProperties}
            />
          </g>
        )
      })}
      <g className="lp-s12-squash">
        <rect
          x={720}
          y={barTopY}
          width={160}
          height={660 - barTopY}
          rx={2}
          className="lp-s12-fill lp-s12-grow-bar"
          style={{ animationDelay: "0.75s" }}
        />
      </g>
      <text x={800} y={712} textAnchor="middle" className="lp-video-label">
        One week of ads
      </text>
    </g>
  )
}
