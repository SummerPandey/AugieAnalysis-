import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react"
import "./explainer.css"

/**
 * 30-second animated explainer for the "How it works" page. Six scenes of
 * five seconds each, driven by one interval tick. Visuals are plain SVG
 * shapes animated with CSS; captions and controls are HTML so they stay
 * readable and screen-reader friendly at every width.
 */

const SCENE_MS = 5000
const SCENE_COUNT = 6
const TOTAL_MS = SCENE_MS * SCENE_COUNT
const TICK_MS = 100

const CAPTIONS = [
  "Applications spike every year around the early November deadline.",
  "Marketing also runs ads during the same weeks: Meta, Snapchat, search, billboards.",
  "The question: how much came from ads, and how much from the calendar?",
  "The model lines up each week's ads, the calendar, and carryover from past spend.",
  "In the model, most applications are assigned to the calendar. The ads' share is still being measured.",
  "Try the demo to explore the same method on sample data.",
]

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

/* ---------- Scene 1: one admissions year of weekly applications ---------- */

// A stylized year, one bar every two weeks from week 1 to week 51. Shape only
// (winter surge, summer low, early-November peak); no real numbers.
const YEAR_BARS = [
  150, 130, 110, 90, 80, 70, 60, 50, 40, 35, 35, 40, 45, 55, 70, 90, 110, 140, 180, 250, 330, 430, 520, 280, 170, 140,
]
const PEAK_INDEX = YEAR_BARS.indexOf(Math.max(...YEAR_BARS))

function SceneCalendar() {
  const base = 640
  const step = 1040 / YEAR_BARS.length
  return (
    <g>
      <line x1={260} y1={base} x2={1340} y2={base} className="lp-video-axis" />
      {YEAR_BARS.map((h, i) => (
        <rect
          key={i}
          x={280 + i * step}
          y={base - h}
          width={step - 10}
          height={h}
          rx={2}
          className={`${i === PEAK_INDEX ? "lp-video-gold-seg" : "lp-video-bar"} lp-video-grow`}
          style={{ animationDelay: `${0.1 + i * 0.04}s` }}
        />
      ))}
      <text x={280 + PEAK_INDEX * step + (step - 10) / 2} y={base - YEAR_BARS[PEAK_INDEX] - 24} textAnchor="middle" className="lp-video-label">
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

/* ---------- Scene 2: four ad channels feeding one weekly bar ---------- */

const CHANNELS = [
  { x: 350, label: "Social" },
  { x: 650, label: "Video" },
  { x: 950, label: "Search" },
  { x: 1250, label: "Billboards" },
]

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

function SceneChannels() {
  const barTopX = 800
  const barTopY = 560
  return (
    <g>
      {CHANNELS.map((c, i) => (
        <g key={c.label}>
          <g className="lp-video-fadein" style={{ animationDelay: `${i * 0.1}s` }}>
            <ChannelIcon kind={i} x={c.x} />
            <text x={c.x} y={390} textAnchor="middle" className="lp-video-label">
              {c.label}
            </text>
          </g>
        </g>
      ))}
      {CHANNELS.map((c, i) => (
        <circle
          key={`dot-${c.label}`}
          cx={c.x}
          cy={310}
          r={16}
          className="lp-video-dot lp-video-fly"
          style={
            {
              "--dx": `${barTopX - c.x}px`,
              "--dy": `${barTopY - 310}px`,
              animationDelay: `${0.8 + i * 0.25}s`,
            } as CSSProperties
          }
        />
      ))}
      <rect x={720} y={barTopY} width={160} height={660 - barTopY} rx={2} className="lp-video-bar lp-video-grow" style={{ animationDelay: "1.4s" }} />
      <text x={800} y={712} textAnchor="middle" className="lp-video-label">
        One week of ads
      </text>
    </g>
  )
}

/* ---------- Scene 3: one bar, with the ad share as an open question ---------- */

function SceneQuestion() {
  return (
    <g>
      <text x={800} y={190} textAnchor="middle" className="lp-video-display lp-video-question lp-video-pulse-once">
        ?
      </text>
      <rect x={700} y={240} width={200} height={120} rx={2} className="lp-video-dashed" fill="none" />
      <rect x={700} y={360} width={200} height={300} rx={2} className="lp-video-bar lp-video-grow" />
      <text x={940} y={312} className="lp-video-label">
        Ads?
      </text>
      <text x={940} y={522} className="lp-video-label">
        Calendar?
      </text>
    </g>
  )
}

/* ---------- Scene 4: weeks lined up, calendar flags, fading carryover ---------- */

const FLAGS = [
  { x: 330, label: "Deadline" },
  { x: 650, label: "Winter" },
  { x: 970, label: "Yield" },
  { x: 1290, label: "Summer" },
]

const CARRY = [
  { x: 330, w: 300 },
  { x: 642, w: 150 },
  { x: 804, w: 75 },
  { x: 891, w: 38 },
]

function SceneLineup() {
  return (
    <g>
      <text x={330} y={120} textAnchor="middle" className="lp-video-label">
        Calendar flags
      </text>
      {FLAGS.map((f, i) => (
        <g key={f.label} className="lp-video-slide" style={{ "--d": `${i * 0.25}s` } as CSSProperties}>
          <circle
            cx={f.x}
            cy={200}
            r={28}
            className={i === 0 ? "lp-video-dot-gold" : "lp-video-fill-navy"}
          />
          <g className="lp-video-fadein" style={{ animationDelay: `${0.5 + i * 0.25}s` }}>
            <rect x={f.x - 130} y={250} width={260} height={56} rx={3} className="lp-video-fill-navy" />
            <text x={f.x} y={291} textAnchor="middle" className="lp-video-flag-text">
              {f.label}
            </text>
          </g>
        </g>
      ))}
      {CARRY.map((c, i) => (
        <rect
          key={c.x}
          x={c.x}
          y={420}
          width={c.w}
          height={44}
          rx={2}
          className="lp-video-carry lp-video-grow-x"
          style={{ animationDelay: `${1.2 + i * 0.45}s` }}
        />
      ))}
      <text x={330} y={512} className="lp-video-label">
        Carryover from past spend
      </text>
    </g>
  )
}

/* ---------- Scene 5: stacked result, calendar dominant ---------- */

function SceneStack() {
  const top = 200
  const base = 640
  const total = base - top
  const navyH = Math.round(total * 0.85)
  const navyY = base - navyH
  return (
    <g>
      <rect x={360} y={navyY} width={200} height={navyH} className="lp-video-bar lp-video-grow" />
      <rect x={360} y={top} width={200} height={navyY - top} className="lp-video-gold-seg lp-video-grow" style={{ animationDelay: "0.8s" }} />
      <line x1={340} y1={base} x2={580} y2={base} className="lp-video-axis" />
      <text x={620} y={420} className="lp-video-label">
        The calendar
      </text>
      <text x={620} y={470} className="lp-video-sub">
        about 80 to 90% in the model
      </text>
      <text x={620} y={248} className="lp-video-label">
        Ads
      </text>
      <text x={620} y={296} className="lp-video-sub">
        still being measured
      </text>
    </g>
  )
}

/* ---------- Scene 6: demo call to action ---------- */

function SceneDemo() {
  return (
    <g>
      <text x={800} y={230} textAnchor="middle" className="lp-video-display lp-video-title lp-video-fadein">
        Explore the method
      </text>
      <rect x={600} y={380} width={400} height={120} rx={3} className="lp-video-ring" />
      <rect x={600} y={380} width={400} height={120} rx={3} className="lp-video-button" />
      <text x={800} y={455} textAnchor="middle" className="lp-video-button-text">
        Try the demo
      </text>
      <g className="lp-video-fadein" style={{ animationDelay: "0.6s" }}>
        <rect x={620} y={550} width={360} height={64} rx={3} className="lp-video-fill-navy" />
        <text x={800} y={594} textAnchor="middle" className="lp-video-flag-text">
          Synthetic sample
        </text>
      </g>
    </g>
  )
}

function renderScene(index: number) {
  switch (index) {
    case 0:
      return <SceneCalendar />
    case 1:
      return <SceneChannels />
    case 2:
      return <SceneQuestion />
    case 3:
      return <SceneLineup />
    case 4:
      return <SceneStack />
    default:
      return <SceneDemo />
  }
}

export function ExplainerVideo() {
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  // Bumped on every restart or seek so the scene remounts and its CSS animations replay.
  const [run, setRun] = useState(0)

  const ended = elapsed >= TOTAL_MS
  const scene = Math.min(SCENE_COUNT - 1, Math.floor(elapsed / SCENE_MS))

  // Single timeline tick, only while playing. Cleaned up on pause and unmount.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setElapsed((e) => Math.min(TOTAL_MS, e + TICK_MS))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing])

  // Stop at the end of the last scene.
  useEffect(() => {
    if (playing && elapsed >= TOTAL_MS) setPlaying(false)
  }, [playing, elapsed])

  function togglePlay() {
    setStarted(true)
    if (playing) {
      setPlaying(false)
      return
    }
    if (ended || !started) {
      // Start from the top so the first scene animates when play is pressed.
      setElapsed(0)
      setRun((r) => r + 1)
    }
    setPlaying(true)
  }

  function replay() {
    setStarted(true)
    setElapsed(0)
    setRun((r) => r + 1)
    setPlaying(true)
  }

  function seek(index: number) {
    setStarted(true)
    setElapsed(index * SCENE_MS)
    setRun((r) => r + 1)
  }

  function onPlayerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
      e.preventDefault()
      togglePlay()
    }
  }

  const playerClass = `lp-video-player${started ? "" : " is-idle"}`

  return (
    <div className="lp-video-root" role="region" aria-label="30-second preview: how Augie Analysis works">
      <div
        className={playerClass}
        tabIndex={0}
        onKeyDown={onPlayerKeyDown}
        aria-label="Preview player. Press space or enter to play or pause."
      >
        <svg viewBox="0 0 1600 900" className="lp-video-svg" aria-hidden="true" focusable="false">
          <g key={`${run}-${scene}`} className="lp-video-scene">
            {renderScene(scene)}
          </g>
        </svg>

        {!started && (
          <div className="lp-video-overlay">
            <button type="button" className="btn btn-gold btn-lg lp-video-big-play" onClick={togglePlay}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3 1.5 L14 8 L3 14.5 Z" fill="currentColor" />
              </svg>
              Play the 30-second preview
            </button>
          </div>
        )}
      </div>

      <p className="lp-video-caption" aria-live="polite">
        <span className="lp-video-caption-step">Scene {scene + 1} of {SCENE_COUNT}</span>
        <span className="lp-video-caption-text">{CAPTIONS[scene]}</span>
      </p>

      <div className="lp-video-controls">
        <button type="button" className="btn btn-outline btn-sm lp-video-btn" onClick={togglePlay}>
          {playing ? "Pause" : ended ? "Play again" : "Play"}
        </button>
        <button
          type="button"
          className={`btn btn-sm lp-video-btn${ended ? " btn-gold" : " btn-ghost"}`}
          onClick={replay}
        >
          Replay
        </button>

        <div className="lp-video-progress" role="group" aria-label="Scenes">
          {CAPTIONS.map((caption, i) => {
            const fraction = Math.max(0, Math.min(1, (elapsed - i * SCENE_MS) / SCENE_MS))
            return (
              <button
                key={i}
                type="button"
                className="lp-video-seg"
                aria-label={`Scene ${i + 1}: ${caption}`}
                aria-current={i === scene ? "step" : undefined}
                onClick={() => seek(i)}
              >
                <span className="lp-video-seg-fill" style={{ width: `${fraction * 100}%` }} />
              </button>
            )
          })}
        </div>

        <span className="lp-video-time">
          {formatTime(elapsed)} / {formatTime(TOTAL_MS)}
        </span>
      </div>
    </div>
  )
}
