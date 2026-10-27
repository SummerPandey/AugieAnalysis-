import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import "./explainer.css"
import { SceneCalendar } from "./scenes/Scene1Calendar"
import { SceneChannels } from "./scenes/Scene2Channels"
import { SceneQuestion } from "./scenes/Scene3Question"
import { SceneLineup } from "./scenes/Scene4Lineup"
import { SceneStack } from "./scenes/Scene5Stack"
import { SceneWhy } from "./scenes/SceneWhy"
import { SceneDemo } from "./scenes/Scene6Demo"

/**
 * 30-second animated explainer for the "How it works" page. Seven scenes
 * sharing 30 seconds (about 4.3 s each), driven by one interval tick. Visuals are plain
 * SVG shapes animated with CSS; captions and controls are HTML so they stay
 * readable and screen-reader friendly at every width.
 */

// The site promises "30 seconds", so scenes share that budget.
const TOTAL_MS = 30_000
const SCENE_COUNT = 7
const SCENE_MS = TOTAL_MS / SCENE_COUNT
const TICK_MS = 100
// After a seek, or on first load, a paused stage still plays the scene's
// entrance for this long so the picture is visible, then freezes.
const SETTLE_MS = 2600

const CAPTIONS = [
  "Applications spike every year around the early November deadline.",
  "Marketing also runs ads in those same weeks: Facebook and Instagram (Meta), Snapchat, YouTube and Google search.",
  "The question: how much came from ads, and how much from the calendar?",
  "The model lines up each week's ads, the time of year (deadline, winter, yield, summer) and ads from earlier weeks that may still linger. Yield is when admitted students decide.",
  "In the model, most applications are assigned to the calendar. The ads' share is unclear for now: the data can't tell it apart from the calendar yet.",
  "Why it may help: knowing the normal level for each time of year helps you plan, test and judge spend fairly.",
  "Try the demo, or read the plain-language steps below. The demo uses made-up practice data.",
]

type SceneSlot = { key: string; scene: number }

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
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
    case 5:
      return <SceneWhy />
    default:
      return <SceneDemo />
  }
}

export function ExplainerVideo({ onDemo }: { onDemo?: () => void } = {}) {
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  // True while the stage is allowed to animate even though the timeline is paused.
  const [settling, setSettling] = useState(true)
  // Bumped on every restart or seek so the scene remounts and its CSS animations replay.
  const [run, setRun] = useState(0)
  // The previous scene, kept mounted briefly so it can fade out under the new one.
  const [leaving, setLeaving] = useState<SceneSlot | null>(null)
  const lastSlot = useRef<SceneSlot>({ key: "0-0", scene: 0 })
  const settleTimer = useRef<number | undefined>(undefined)
  const playButtonRef = useRef<HTMLButtonElement>(null)

  const ended = elapsed >= TOTAL_MS
  const scene = Math.min(SCENE_COUNT - 1, Math.floor(elapsed / SCENE_MS))
  const sceneKey = `${run}-${scene}`
  const frozen = !playing && !settling

  // Single timeline tick, only while playing. Elapsed time comes from the
  // clock, not a tick count, so throttled timers (background tabs, busy
  // phones) can't stretch the 30 seconds. Restarts on play, seek and replay.
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed
  useEffect(() => {
    if (!playing) return
    const start = performance.now() - elapsedRef.current
    const id = window.setInterval(() => {
      setElapsed(Math.min(TOTAL_MS, performance.now() - start))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, run])

  // Stop at the end of the last scene.
  useEffect(() => {
    if (playing && elapsed >= TOTAL_MS) setPlaying(false)
  }, [playing, elapsed])

  // First load: let scene 1 settle into view under the overlay, then freeze.
  useEffect(() => {
    const timer = settleTimer
    timer.current = window.setTimeout(() => setSettling(false), SETTLE_MS)
    return () => window.clearTimeout(timer.current)
  }, [])

  // The big overlay button disappears once started; keep keyboard focus on the controls.
  useEffect(() => {
    if (started && document.activeElement === document.body) playButtonRef.current?.focus()
  }, [started])

  // When the scene changes, keep the old one mounted so it can fade out.
  useEffect(() => {
    const last = lastSlot.current
    if (last.key === sceneKey) return
    lastSlot.current = { key: sceneKey, scene }
    setLeaving(last)
  }, [sceneKey, scene])

  // A paused stage must not leave a half-faded outgoing scene behind.
  useEffect(() => {
    if (frozen) setLeaving(null)
  }, [frozen])

  function settleStage() {
    setSettling(true)
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => setSettling(false), SETTLE_MS)
  }

  function togglePlay() {
    setStarted(true)
    if (playing) {
      window.clearTimeout(settleTimer.current)
      setSettling(false)
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
    settleStage()
  }

  function onPlayerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
      e.preventDefault()
      togglePlay()
    }
  }

  const playerClass = `lp-video-player${started ? "" : " is-idle"}${frozen ? " is-frozen" : ""}`

  return (
    <div className="lp-video-root" role="region" aria-label="30-second preview: how Augie Analysis works">
      <div
        className={playerClass}
        role="group"
        tabIndex={0}
        onKeyDown={onPlayerKeyDown}
        aria-label="Preview player. Press space or enter to play or pause."
      >
        <svg viewBox="0 0 1600 900" className="lp-video-svg" aria-hidden="true" focusable="false">
          {leaving && (
            <g
              key={`leave-${leaving.key}`}
              className="lp-video-scene lp-video-scene-leave"
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setLeaving(null)
              }}
            >
              {renderScene(leaving.scene)}
            </g>
          )}
          <g key={sceneKey} className="lp-video-scene">
            {renderScene(scene)}
          </g>
        </svg>

        {/* The last scene draws a "Try the demo" button; make it a real one. */}
        {onDemo && started && scene === SCENE_COUNT - 1 && (
          <button type="button" className="lp-video-demo-hit" onClick={onDemo}>
            <span className="sr-only">Try the demo</span>
          </button>
        )}

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

      <p className="lp-video-hint">Pause, or click a bar below, to take your time.</p>

      <p className="lp-video-caption" aria-live="polite">
        <span className="lp-video-caption-step">Scene {scene + 1} of {SCENE_COUNT}</span>
        <span key={scene} className="lp-video-caption-text">{CAPTIONS[scene]}</span>
      </p>

      <div className="lp-video-controls">
        <button
          ref={playButtonRef}
          type="button"
          className="btn btn-outline btn-sm lp-video-btn lp-video-play"
          onClick={togglePlay}
        >
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
                <span className="lp-video-seg-fill" style={{ transform: `scaleX(${fraction})` }} />
              </button>
            )
          })}
        </div>

        <span className="lp-video-time">
          {formatTime(elapsed)} / {formatTime(TOTAL_MS)}
        </span>
      </div>
      <details className="lp-video-transcript">
        <summary>Read all {SCENE_COUNT} steps as text</summary>
        <ol>
          {CAPTIONS.map((caption, i) => (
            <li key={i}>{caption}</li>
          ))}
        </ol>
      </details>
    </div>
  )
}
