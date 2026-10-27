import "./scenes56.css"
import "./sceneWhy.css"

/* ---------- Scene 6: why this data is useful ---------- */

// Three plain benefits that hold even before any channel is measurable:
// the calendar baseline, a way to test changes, and impressions that catch
// people who never click.
const CARDS = [
  { x: 200, top: "Plan around", bottom: "the calendar", icon: "calendar", delay: "0.35s" },
  { x: 620, top: "Test before", bottom: "shifting budget", icon: "flask", delay: "0.6s" },
  { x: 1040, top: "Look at views too,", bottom: "not just clicks", icon: "eye", delay: "0.85s" },
] as const

function Icon({ kind, cx }: { kind: (typeof CARDS)[number]["icon"]; cx: number }) {
  const cy = 410
  if (kind === "calendar")
    return (
      <g>
        <rect x={cx - 56} y={cy - 48} width={112} height={100} rx={8} className="lp-s7-stroke" />
        <rect x={cx - 56} y={cy - 48} width={112} height={26} rx={6} className="lp-s7-fill" />
        <rect x={cx + 14} y={cy + 6} width={26} height={26} rx={4} className="lp-s7-gold" />
      </g>
    )
  if (kind === "flask")
    return (
      <g>
        <path
          d={`M${cx - 18} ${cy - 52} h36 M${cx - 12} ${cy - 52} v34 l-40 64 a10 10 0 0 0 9 15 h86 a10 10 0 0 0 9 -15 l-40 -64 v-34`}
          className="lp-s7-stroke"
        />
        <path d={`M${cx - 34} ${cy + 26} h68 l14 22 a6 6 0 0 1 -5 9 h-86 a6 6 0 0 1 -5 -9 z`} className="lp-s7-gold" />
      </g>
    )
  return (
    <g>
      <path d={`M${cx - 66} ${cy} Q${cx} ${cy - 62} ${cx + 66} ${cy} Q${cx} ${cy + 62} ${cx - 66} ${cy} Z`} className="lp-s7-stroke" />
      <circle cx={cx} cy={cy} r={24} className="lp-s7-fill" />
      <circle cx={cx + 8} cy={cy - 8} r={7} className="lp-s7-gold" />
    </g>
  )
}

export function SceneWhy() {
  return (
    <g>
      <text x={800} y={180} textAnchor="middle" className="lp-video-display lp-video-title lp-s56-title">
        Why this data may help
      </text>
      {CARDS.map((c) => (
        <g key={c.icon} className="lp-s56-pop" style={{ animationDelay: c.delay }}>
          <rect x={c.x} y={270} width={360} height={420} rx={6} className="lp-s7-card" />
          <Icon kind={c.icon} cx={c.x + 180} />
          <text x={c.x + 180} y={570} textAnchor="middle" className="lp-video-label">
            {c.top}
          </text>
          <text x={c.x + 180} y={620} textAnchor="middle" className="lp-video-label">
            {c.bottom}
          </text>
        </g>
      ))}
    </g>
  )
}
