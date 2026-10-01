/**
 * The Admissions Year dial: 52 ISO weeks around a circle, the four
 * admissions periods the model knows about (CLAUDE.md: winter surge W01–08,
 * yield W09–18, summer ramp W32–40, peak deadline W44–46), and a marker for
 * today's week. Only the deadline peak is gold. Drawn from the documented
 * calendar and today's date, never from data, so it is safe everywhere,
 * signed in or not. With `dataEnd`, it also shows the stretch between the
 * last week on file and today.
 */
import { useId } from "react"
import { isoWeek } from "./insights"
import "./dial.css"

const WEEKS = 52
const PERIODS = [
  { id: "winter", label: "Winter surge", from: 1, to: 8 },
  { id: "yield", label: "Yield", from: 9, to: 18 },
  { id: "ramp", label: "Summer ramp", from: 32, to: 40 },
  { id: "peak", label: "Deadline peak", from: 44, to: 46 },
] as const
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

const C = 300 // viewBox centre
const rad = (weekPos: number) => ((weekPos / WEEKS) * 360 - 90) * (Math.PI / 180)
const pt = (weekPos: number, r: number) => [C + r * Math.cos(rad(weekPos)), C + r * Math.sin(rad(weekPos))] as const

/** Arc path covering weeks [from, to] inclusive at radius r. */
function arc(from: number, to: number, r: number) {
  const a = from - 1
  const b = Math.min(to, WEEKS + 0.999)
  const [x1, y1] = pt(a, r)
  const [x2, y2] = pt(b, r)
  const large = b - a > WEEKS / 2 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** Where today sits relative to the deadline peak, in plain words. */
export function seasonNote(week: number): string {
  if (week >= 44 && week <= 46) return "Inside the deadline peak"
  if (week < 44) {
    const n = 44 - week
    return `${n} week${n === 1 ? "" : "s"} to the deadline peak`
  }
  const n = WEEKS - week + 44
  return `Peak passed · next in ${n} weeks`
}

export function AdmissionsDial({
  size = 520,
  tone = "dark",
  today = new Date(),
  dataEnd,
  showCenter = true,
  sweep = false,
  className,
}: {
  size?: number | string
  /** "dark" for navy surfaces, "light" for paper/white. */
  tone?: "dark" | "light"
  today?: Date
  /** ISO date of the last week on file; draws the not-yet-on-file stretch. */
  dataEnd?: string
  showCenter?: boolean
  /** Loading-screen variant: a hand sweeps the year. */
  sweep?: boolean
  className?: string
}) {
  const uid = useId().replace(/:/g, "")
  const week = isoWeek(today)
  const dayFrac = ((today.getUTCDay() || 7) - 1) / 7
  const nowPos = week - 1 + dayFrac + 0.5 / 7
  const endWeek = dataEnd ? isoWeek(new Date(dataEnd)) : undefined
  const peakMid = 44.5 // centre of weeks 44–46 on the 0-based ring
  const peakA = pt(peakMid, 231)
  const peakB = pt(peakMid, 190)
  const peakT = pt(peakMid, 160)
  const [tx, ty] = pt(nowPos, 262)
  const [lx, ly] = pt(nowPos, 206)
  const label = `The admissions year. Today is week ${week}: ${seasonNote(week).toLowerCase()}.${
    endWeek ? ` The latest data on file ends at week ${endWeek}.` : ""
  }`

  return (
    <svg
      viewBox="0 0 600 600"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`dial dial-${tone}${className ? ` ${className}` : ""}`}
    >
      <defs>
        {PERIODS.map((p) => {
          const mid = (p.from + p.to) / 2
          const half = Math.max((p.to - p.from + 1) / 2, 5)
          return <path key={p.id} id={`${uid}-${p.id}`} d={arc(mid - half + 0.5, mid + half - 0.5, 224)} />
        })}
        <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="dial-hatch-line" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* faint rings */}
      <circle cx={C} cy={C} r={272} className="dial-ring" />
      <circle cx={C} cy={C} r={196} className="dial-ring dial-ring-inner" />

      {/* week ticks: quarters longer */}
      {Array.from({ length: WEEKS }, (_, i) => {
        const major = i % 13 === 0
        const [x1, y1] = pt(i, major ? 256 : 262)
        const [x2, y2] = pt(i, 272)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={major ? "dial-tick dial-tick-major" : "dial-tick"}
          />
        )
      })}

      {/* months, outside the ring */}
      {MONTHS.map((m, i) => {
        const [x, y] = pt((i + 0.5) * (WEEKS / 12), 292)
        return (
          <text key={i} x={x} y={y} className="dial-month" textAnchor="middle" dominantBaseline="central">
            {m}
          </text>
        )
      })}

      {/* stretch between the last week on file and today */}
      {endWeek !== undefined && endWeek !== week && (
        <g>
          <path
            d={endWeek < week ? arc(endWeek + 1, week, 208) : `${arc(endWeek + 1, WEEKS, 208)} ${arc(1, week, 208)}`}
            className="dial-gap"
            stroke={`url(#${uid}-hatch)`}
          />
          <circle cx={pt(endWeek, 208)[0]} cy={pt(endWeek, 208)[1]} r={5} className="dial-dataend" />
        </g>
      )}

      {/* the admissions periods; the short peak gets a horizontal callout */}
      {PERIODS.map((p) => (
        <g key={p.id} className={`dial-period dial-${p.id}`}>
          <path d={arc(p.from, p.to, 240)} className="dial-arc" />
          {p.id !== "peak" && (
            <text className="dial-label">
              <textPath href={`#${uid}-${p.id}`} startOffset="50%" textAnchor="middle">
                {p.label}
              </textPath>
            </text>
          )}
        </g>
      ))}
      <g className="dial-period dial-peak">
        <line x1={peakA[0]} y1={peakA[1]} x2={peakB[0]} y2={peakB[1]} className="dial-leader" />
        <text x={peakT[0]} y={peakT[1]} textAnchor="middle" className="dial-label dial-callout">
          Deadline peak
        </text>
        <text x={peakT[0]} y={peakT[1] + 20} textAnchor="middle" className="dial-callout-sub">
          Weeks 44–46
        </text>
      </g>

      {/* today */}
      <g className="dial-today">
        <line x1={lx} y1={ly} x2={tx} y2={ty} className="dial-today-hand" />
        <circle cx={tx} cy={ty} r={7} className="dial-today-dot" />
      </g>

      {sweep && (
        <g className="dial-sweep" style={{ transformOrigin: `${C}px ${C}px` }}>
          <line x1={C} y1={C - 150} x2={C} y2={C - 272} className="dial-sweep-hand" />
        </g>
      )}

      {showCenter && (
        <g className="dial-center">
          <text x={C} y={C - 40} textAnchor="middle" className="dial-eyebrow">
            THE ADMISSIONS YEAR
          </text>
          <text x={C} y={C + 26} textAnchor="middle" className="dial-week">
            Week {week}
          </text>
          <text x={C} y={C + 66} textAnchor="middle" className="dial-note">
            {seasonNote(week)}
          </text>
          {endWeek !== undefined && (
            <text x={C} y={C + 94} textAnchor="middle" className="dial-note dial-note-sm">
              Latest data: week {endWeek}
            </text>
          )}
        </g>
      )}
    </svg>
  )
}
