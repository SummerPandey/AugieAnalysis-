/**
 * MMM workflow.
 *
 * Signed out: a four-step tour of the real method on a synthetic sample:
 * Sources → Model settings → Run → Results. The settings are the model's
 * real knobs (adstock decay, annual harmonics, validation folds, admissions
 * calendar flags) and they change the sample the way they'd change the real
 * model. Nothing claims to be Augustana's numbers.
 *
 * Signed in: no wizard. Run the live pipeline and read the results; the run
 * itself (result, AI readout, follow-ups) is owned by App so it survives
 * moving between the overview and this page.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { PipelineResult } from "./api"
import { T } from "./theme"
import { SiteHeader, SiteFooter, AugieMark } from "./chrome"
import { DATA_SOURCES } from "./projectStatus"
import { SourceStatusBadge } from "./sourceStatus"
import { ResultsView, type CommentaryState } from "./results"
import { DEFAULT_SETTINGS, LIMITS, sampleResult, type SampleSettings } from "./sampleResult"
import { Alert, card, InfoTooltip, PageInfoButton, SectionHeader, StepFooter, StepHeader } from "./ui"
import { IconArrowLeft, IconArrowRight, IconCheck, IconRefresh, Spinner } from "./icons"
import "./workflow.css"

/* ── stepper ───────────────────────────────────────────────── */
const DEMO_STEPS = ["Sources", "Model settings", "Run", "Results"] as const
type DemoStep = 1 | 2 | 3 | 4

function Stepper({
  current,
  reached,
  onJump,
  locked,
}: {
  current: number
  reached: number
  onJump: (s: DemoStep) => void
  /** While a run is in progress the steps can't be jumped. */
  locked?: boolean
}) {
  return (
    <nav aria-label="Workflow steps">
      <ol className="stepper" style={{ ["--steps" as string]: DEMO_STEPS.length }}>
        {DEMO_STEPS.map((s, i) => {
          const n = (i + 1) as DemoStep
          const done = n < current
          const active = n === current
          const canJump = !active && !locked && n <= reached
          const inner = (
            <>
              <span className="step-node">{done ? <IconCheck size={14} strokeWidth={2.2} /> : n}</span>
              <span className="step-label">
                {s}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </>
          )
          return (
            <li key={s} className={done ? "step-done" : active ? "step-current" : undefined} aria-current={active ? "step" : undefined}>
              {canJump ? (
                <button type="button" className="step-hit" onClick={() => onJump(n)} aria-label={`Go to step ${n}: ${s}`}>
                  {inner}
                </button>
              ) : (
                inner
              )}
              {i < DEMO_STEPS.length - 1 && <span className="step-line" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ── step 1: sources ───────────────────────────────────────── */
type Role = "outcome" | "toggle" | "reference" | "pending"
interface SourceCard {
  id: string
  /** Entry in DATA_SOURCES (projectStatus.ts) for coverage, caveats and owner. */
  sourceId?: string
  label: string
  description: string
  role: Role
  /** Which sample-run switch this card controls. */
  toggle?: keyof SampleSettings["sources"]
  columns: string[]
  icon: ReactNode
}

const ic = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
)

const SOURCES: SourceCard[] = [
  {
    id: "applications",
    sourceId: "applications",
    label: "Applications",
    description: "Weekly submitted applications from Slate: the outcome the model explains.",
    role: "outcome",
    columns: ["week", "applications"],
    icon: ic(<path d="M2 13.5V9M6 13.5V5.5M10 13.5V7M14 13.5V2.5" />),
  },
  {
    id: "spend",
    sourceId: "spend",
    label: "Channel spend",
    description: "Monthly media plan by channel from Carnegie: Meta, Snapchat, YouTube, Google PPC and IP targeting, display.",
    role: "toggle",
    toggle: "spend",
    columns: ["Strategy", "Month", "Budget"],
    icon: ic(
      <>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 4.5v7M10 6.3c0-.9-.9-1.6-2-1.6s-2 .7-2 1.6.9 1.4 2 1.6 2 .7 2 1.6-.9 1.6-2 1.6-2-.7-2-1.6" />
      </>,
    ),
  },
  {
    id: "impressions",
    sourceId: "impressions",
    label: "Impressions",
    description: "Daily ad impressions from Carnegie: a proxy for advertising where channel spend is missing.",
    role: "toggle",
    toggle: "impressions",
    columns: ["day", "Impressions"],
    icon: ic(
      <>
        <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" />
        <circle cx="8" cy="8" r="2" />
      </>,
    ),
  },
  {
    id: "billboards",
    sourceId: "billboards",
    label: "Billboards",
    description: "QC Airport and Admissions Surge billboard budgets by period, from Lucas.",
    role: "toggle",
    toggle: "billboards",
    columns: ["start_date", "end_date", "total_spend"],
    icon: ic(
      <>
        <rect x="1.5" y="3" width="13" height="6.5" rx="1" />
        <path d="M8 9.5v4.5M5.5 14h5" />
      </>,
    ),
  },
  {
    id: "conversions",
    sourceId: "conversions",
    label: "Tracked conversions",
    description: "Ad-platform conversions from Carnegie. Kept for reference, not a model input.",
    role: "reference",
    columns: ["day", "Total Conversions"],
    icon: ic(
      <>
        <circle cx="8" cy="8" r="6" />
        <circle cx="8" cy="8" r="3" />
      </>,
    ),
  },
  {
    id: "email",
    sourceId: "email",
    label: "Email sends",
    description: "Send volume and engagement by campaign.",
    role: "pending",
    columns: ["send_date", "campaign_name", "sends", "opens", "clicks"],
    icon: ic(
      <>
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.2" />
        <path d="M2 4.5l6 5 6-5" />
      </>,
    ),
  },
  {
    id: "direct_mail",
    sourceId: "direct_mail",
    label: "Direct mail",
    description: "Flight dates and spend per mail drop.",
    role: "pending",
    columns: ["flight_start", "flight_end", "spend", "description"],
    icon: ic(
      <>
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.2" />
        <path d="M4 6h5M4 8.5h3" />
      </>,
    ),
  },
]

function SourceTile({
  src,
  included,
  onToggle,
}: {
  src: SourceCard
  included?: boolean
  onToggle?: (v: boolean) => void
}) {
  const facts = src.sourceId ? DATA_SOURCES.find((s) => s.id === src.sourceId) : undefined
  const pending = src.role === "pending"
  const on = src.role === "outcome" || (src.role === "toggle" && included)
  return (
    <li className={`src-tile${pending ? " src-pending" : ""}${on ? " src-on" : ""}`}>
      <div className="src-head">
        <span className="src-icon" aria-hidden>
          {src.icon}
        </span>
        <div className="src-title">
          <h4>{src.label}</h4>
          <p>{src.description}</p>
        </div>
        {facts && <SourceStatusBadge status={facts.status} />}
      </div>

      {facts && (
        <div className="src-facts">
          <p className="src-coverage">
            {pending ? `${facts.coverageLabel} · waiting on ${facts.owner}` : facts.coverageLabel}
          </p>
          <p className="src-note">{facts.note}</p>
          {pending && (
            <p className="src-cols">
              Expected columns: <code>{src.columns.join(", ")}</code>
            </p>
          )}
        </div>
      )}

      {/* reference and pending tiles need no footer: the badge already says it */}
      {(src.role === "outcome" || src.role === "toggle") && (
        <div className="src-foot">
          {src.role === "outcome" && (
            <span className="src-fixed">
              <IconCheck size={14} /> Always included: it's what the model explains
            </span>
          )}
          {src.role === "toggle" && onToggle && (
            <label className="switch">
              <input type="checkbox" role="switch" checked={!!included} onChange={(e) => onToggle(e.target.checked)} />
              <span className="switch-track" aria-hidden>
                <span className="switch-thumb" />
              </span>
              <span>Include in the sample run</span>
            </label>
          )}
        </div>
      )}
    </li>
  )
}

function SourcesStep({
  settings,
  onChange,
  onNext,
}: {
  settings: SampleSettings
  onChange: (s: SampleSettings) => void
  onNext: () => void
}) {
  const inputs = SOURCES.filter((s) => s.role === "outcome" || s.role === "toggle")
  const other = SOURCES.filter((s) => s.role === "reference" || s.role === "pending")
  const includedCount = 1 + inputs.filter((s) => s.toggle && settings.sources[s.toggle]).length
  return (
    <div className="wf-stack">
      <StepHeader
        eyebrow={`Step 1 of ${DEMO_STEPS.length} · Sources`}
        title={
          <>
            The data behind the <em>model</em>
          </>
        }
        lead="These are Augustana's real sources and what's on file for each. In this demo you choose which ones feed a synthetic sample run; signed in, the model reads the live data."
        info={
          <PageInfoButton title="Why these sources">
            A marketing mix model lines up two kinds of weekly history: the outcome (applications) and everything that
            might move it (spend, impressions, offline media, and the admissions calendar). Augustana's lives in separate
            systems: Slate for applications, Carnegie for digital, Lucas for billboards. Leaving a source out shows how
            much the model leans on it.
          </PageInfoButton>
        }
      />

      <section aria-labelledby="src-in-h">
        <div className="src-section-head">
          <h3 id="src-in-h" className="eyebrow">
            Model inputs
          </h3>
          <p className="num" aria-live="polite">
            {includedCount} of {inputs.length} included
          </p>
        </div>
        <ul role="list" className="src-grid">
          {inputs.map((s) => (
            <SourceTile
              key={s.id}
              src={s}
              included={s.toggle ? settings.sources[s.toggle] : true}
              onToggle={s.toggle ? (v) => onChange({ ...settings, sources: { ...settings.sources, [s.toggle!]: v } }) : undefined}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="src-other-h">
        <div className="src-section-head">
          <h3 id="src-other-h" className="eyebrow">
            On file for reference, or not here yet
          </h3>
        </div>
        <ul role="list" className="src-grid src-grid-quiet">
          {other.map((s) => (
            <SourceTile key={s.id} src={s} />
          ))}
        </ul>
      </section>

      <StepFooter onNext={onNext} nextLabel="Model settings" />
    </div>
  )
}

/* ── step 2: model settings ────────────────────────────────── */
function Segmented<V extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: readonly V[]
  onChange: (v: V) => void
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i)

const FLAG_INFO: { key: keyof SampleSettings["seasonFlags"]; label: string; weeks: string }[] = [
  { key: "winter_surge", label: "Winter surge", weeks: "Weeks 1–8" },
  { key: "yield_period", label: "Yield period", weeks: "Weeks 9–18" },
  { key: "summer_ramp", label: "Summer ramp", weeks: "Weeks 32–40" },
  { key: "peak_deadline", label: "Peak deadline", weeks: "Weeks 44–46" },
]

function SettingsStep({
  settings,
  onChange,
  onBack,
  onNext,
}: {
  settings: SampleSettings
  onChange: (s: SampleSettings) => void
  onBack: () => void
  onNext: () => void
}) {
  const changed = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
  const decayPct = Math.round(settings.adstockDecay * 100)
  return (
    <div className="wf-stack">
      <StepHeader
        eyebrow={`Step 2 of ${DEMO_STEPS.length} · Model settings`}
        title={
          <>
            How the model <em>reads</em> a week
          </>
        }
        lead="These are the real model's settings, at Augustana's defaults. Change one and the sample run responds the way the live model would."
        actions={
          changed ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange({ ...DEFAULT_SETTINGS, sources: settings.sources })}>
              <IconRefresh size={14} /> Reset to defaults
            </button>
          ) : undefined
        }
      />

      <div className="settings-grid">
        <div className="setting card">
          <div className="setting-head">
            <label htmlFor="decay" className="field-label">
              Adstock decay
            </label>
            <InfoTooltip tip="Advertising keeps working after the week it runs. Decay is the share of this week's effect that carries into next week." />
            <span className="setting-value num">{settings.adstockDecay.toFixed(1)}</span>
          </div>
          <input
            id="decay"
            type="range"
            className="range"
            min={LIMITS.adstockDecay.min}
            max={LIMITS.adstockDecay.max}
            step={LIMITS.adstockDecay.step}
            value={settings.adstockDecay}
            onChange={(e) => onChange({ ...settings, adstockDecay: Number(e.target.value) })}
            aria-valuetext={`${settings.adstockDecay.toFixed(1)}: ${decayPct}% carries into the next week`}
            aria-describedby="decay-help"
          />
          <p id="decay-help" className="setting-help">
            {decayPct}% of a week's ad effect carries into the next week. The model's default is 0.5 until each channel
            has enough history to tune its own.
          </p>
        </div>

        <div className="setting card">
          <div className="setting-head">
            <span className="field-label" id="harm-l">
              Annual cycle harmonics
            </span>
            <InfoTooltip tip="Smooth sine and cosine waves that trace the shape of the admissions year. More waves follow the shape more closely, and eventually start chasing noise." />
          </div>
          <Segmented
            label="Annual cycle harmonics"
            value={settings.harmonics}
            options={range(LIMITS.harmonics.min, LIMITS.harmonics.max)}
            onChange={(v) => onChange({ ...settings, harmonics: v })}
          />
          <p className="setting-help">
            {settings.harmonics < 3
              ? "Fewer waves: the model misses some of the year's shape."
              : settings.harmonics > 3
                ? "More waves: a tighter fit on past weeks, usually a worse one on unseen weeks."
                : "Three waves is the model's default."}
          </p>
        </div>

        <div className="setting card">
          <div className="setting-head">
            <span className="field-label">Validation folds</span>
            <InfoTooltip tip="The model is tested on weeks it hasn't seen: it trains on the past, predicts the next stretch, and repeats. Each repetition is a fold." />
          </div>
          <Segmented
            label="Validation folds"
            value={settings.folds}
            options={range(LIMITS.folds.min, LIMITS.folds.max)}
            onChange={(v) => onChange({ ...settings, folds: v })}
          />
          <p className="setting-help">
            {settings.folds} walk-forward tests. Early folds train on little history, so they score lowest.
          </p>
        </div>

        <div className="setting card">
          <div className="setting-head">
            <span className="field-label">Regularization</span>
            <InfoTooltip tip="Ridge regression shrinks estimates so overlapping channels don't swing wildly. Its strength is chosen automatically." />
          </div>
          <p className="setting-fixed">Auto-tuned</p>
          <p className="setting-help">
            The strength (α) is picked by walk-forward validation on every run, so it adapts as history grows.
          </p>
        </div>

        <div className="setting card setting-wide">
          <fieldset className="flag-set">
          <legend className="field-label">Admissions calendar</legend>
          <p className="setting-help" style={{ marginTop: 0 }}>
            Flags for the periods the college already knows are busy. Turn one off to see how much of the year it explains.
          </p>
          <div className="flag-grid">
            {FLAG_INFO.map((f) => (
              <label key={f.key} className={`flag${f.key === "peak_deadline" ? " flag-peak" : ""}`}>
                <input
                  type="checkbox"
                  checked={settings.seasonFlags[f.key]}
                  onChange={(e) => onChange({ ...settings, seasonFlags: { ...settings.seasonFlags, [f.key]: e.target.checked } })}
                />
                <span>
                  <strong>{f.label}</strong>
                  <small>{f.weeks}</small>
                </span>
              </label>
            ))}
          </div>
          </fieldset>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Review & run" />
    </div>
  )
}

/* ── step 3: run (sample) ──────────────────────────────────── */
const SAMPLE_STAGES = [
  "Building weekly features: adstock, calendar flags, annual harmonics",
  "Fitting ridge regression and tuning its strength",
  "Testing on weeks the model hasn't seen",
  "Reading the result: drivers, verdicts, caveats",
]

function Summary({ settings }: { settings: SampleSettings }) {
  const flagsOn = FLAG_INFO.filter((f) => settings.seasonFlags[f.key]).map((f) => f.label)
  const src = [
    "Applications",
    settings.sources.spend && "Channel spend",
    settings.sources.impressions && "Impressions",
    settings.sources.billboards && "Billboards",
  ].filter(Boolean) as string[]
  const rows: [string, string][] = [
    ["Sources", src.join(", ")],
    ["Adstock decay", settings.adstockDecay.toFixed(1)],
    ["Annual harmonics", String(settings.harmonics)],
    ["Validation folds", String(settings.folds)],
    ["Calendar flags", flagsOn.length ? flagsOn.join(", ") : "None"],
    ["Regularization", "Auto-tuned"],
  ]
  return (
    <dl className="summary-grid">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function RunStage({ steps, done, running }: { steps: string[]; done: number; running: boolean }) {
  return (
    <ol className="run-stages">
      {steps.map((s, i) => {
        const isDone = i < done
        const active = running && i === done
        return (
          <li key={s} className={isDone ? "is-done" : active ? "is-active" : undefined}>
            <span className="run-node">{isDone ? <IconCheck size={12} /> : active ? <Spinner size={11} /> : null}</span>
            <span>
              {s}
              <span className="sr-only">{isDone ? ", done" : active ? ", in progress" : ", waiting"}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function SampleRunStep({
  settings,
  running,
  stage,
  onBack,
  onRun,
}: {
  settings: SampleSettings
  running: boolean
  stage: number
  onBack: () => void
  onRun: () => void
}) {
  return (
    <div className="wf-stack">
      <StepHeader
        eyebrow={`Step 3 of ${DEMO_STEPS.length} · Run`}
        title={
          <>
            Review and <em>run</em>
          </>
        }
        lead="The sample run takes a couple of seconds. The live model on Augustana's data takes about ten."
      />
      <div style={{ ...card, padding: 0 }}>
        <SectionHeader title="This run" caption="Change any of these on the previous steps." />
        <div className="section-body">
          <Summary settings={settings} />
        </div>
      </div>
      {(running || stage > 0) && (
        <div className="card" role="status" aria-live="polite" style={{ padding: 20 }}>
          <RunStage steps={SAMPLE_STAGES} done={stage} running={running} />
        </div>
      )}
      <StepFooter
        onBack={running ? undefined : onBack}
        onNext={onRun}
        nextLabel={running ? "Running…" : "Run the sample"}
        nextDisabled={running}
      />
    </div>
  )
}

/* ── signed-in run screen ──────────────────────────────────── */
function useElapsed(running: boolean) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!running) return
    setS(0)
    const t = setInterval(() => setS((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  return s
}

function LiveRunStep({
  running,
  error,
  onRun,
  onBack,
}: {
  running: boolean
  error: string | null
  onRun: () => void
  onBack: () => void
}) {
  const elapsed = useElapsed(running)
  return (
    <div className="card live-run">
      <AugieMark size={52} />
      <div>
        <p className="eyebrow eyebrow-rule" style={{ justifyContent: "center" }}>
          Live Augustana data
        </p>
        <h2 className="step-title" style={{ justifyContent: "center", marginBottom: 8 }} tabIndex={-1} data-step-title>
          Run the model
        </h2>
        <p className="live-run-lead">
          Fits the model to the application, spend and impression data currently on file. It takes about ten seconds;
          the AI readout follows once the numbers are in.
        </p>
      </div>
      {running && (
        <div role="status" aria-live="polite" className="live-run-status">
          <Spinner size={14} />
          <span>
            Fetching data and fitting the model… <span className="num">{elapsed}s</span>
          </span>
        </div>
      )}
      {error && (
        <div style={{ width: "100%", textAlign: "left" }}>
          <Alert variant="error" title="The run didn't finish">
            {error}
          </Alert>
        </div>
      )}
      {!running && (
        <button type="button" onClick={onRun} className="btn btn-primary btn-lg btn-block">
          {error ? "Try again" : "Run the model"} <span className="arrow"><IconArrowRight size={14} /></span>
        </button>
      )}
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
        <IconArrowLeft size={14} /> Back to overview
      </button>
    </div>
  )
}

/* ── root ──────────────────────────────────────────────────── */
export interface LiveRunState {
  result: PipelineResult | null
  ranAt: number
  running: boolean
  error: string | null
  commentary: CommentaryState
}

export default function MMMWorkflow({
  onBack,
  onSignIn,
  userName,
  live,
  onRunLive,
  onAsk,
  onReadout,
}: {
  onBack: () => void
  onSignIn?: () => void
  /** Display name for the shared header when signed in. */
  userName?: string | null
  /** Present when signed in: the live run App owns. */
  live?: LiveRunState
  onRunLive?: () => void
  onAsk?: (q: string) => Promise<string>
  /** Re-generate the AI readout for the live run. */
  onReadout?: () => void
}) {
  const signedIn = !!live
  const [step, setStep] = useState<DemoStep>(1)
  const [reached, setReached] = useState<DemoStep>(1)
  const [settings, setSettings] = useState<SampleSettings>(DEFAULT_SETTINGS)
  const [sample, setSample] = useState<{ result: PipelineResult; ranAt: number; settings: SampleSettings } | null>(null)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  // this page loads lazily, so App's focus call can run before it exists
  useEffect(() => {
    focusTitle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function focusTitle() {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
      const h = mainRef.current?.querySelector<HTMLElement>("[data-step-title]")
      ;(h ?? mainRef.current)?.focus({ preventScroll: true })
    })
  }

  function goTo(s: DemoStep) {
    setStep(s)
    setReached((r) => (s > r ? s : r))
    focusTitle()
  }

  function runSample() {
    if (running) return
    setRunning(true)
    setStage(0)
    const per = 420
    SAMPLE_STAGES.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStage(i + 1), per * (i + 1)))
    })
    timers.current.push(
      window.setTimeout(() => {
        setSample({ result: sampleResult(settings), ranAt: Date.now(), settings })
        setRunning(false)
        goTo(4)
      }, per * SAMPLE_STAGES.length + 200),
    )
  }

  // settings changed since the last sample run → the results are stale
  const sampleStale = sample && JSON.stringify(sample.settings) !== JSON.stringify(settings)
  const notice = useMemo(() => {
    if (!sample) return null
    const s = sample.settings
    const d = DEFAULT_SETTINGS
    const diffs: string[] = []
    if (s.adstockDecay !== d.adstockDecay) diffs.push(`adstock decay ${s.adstockDecay.toFixed(1)}`)
    if (s.harmonics !== d.harmonics) diffs.push(`${s.harmonics} harmonics`)
    if (s.folds !== d.folds) diffs.push(`${s.folds} folds`)
    const offFlags = FLAG_INFO.filter((f) => !s.seasonFlags[f.key]).map((f) => f.label.toLowerCase())
    if (offFlags.length) diffs.push(`without ${offFlags.join(", ")}`)
    const offSrc = (Object.keys(s.sources) as (keyof SampleSettings["sources"])[]).filter((k) => !s.sources[k])
    if (offSrc.length) diffs.push(`without ${offSrc.join(", ")}`)
    return diffs.length ? <>This run: {diffs.join(" · ")}.</> : null
  }, [sample])

  return (
    <div className="site">
      <SiteHeader
        variant={signedIn ? "signedIn" : "demo"}
        name={userName}
        crumb="MMM analysis"
        onBack={onBack}
        backLabel={signedIn ? "Overview" : "All analyses"}
        backAriaLabel={signedIn ? "Back to overview" : "Back to all analyses"}
        onSignIn={signedIn ? undefined : onSignIn}
      />

      {!signedIn && (
        <div className="stepper-bar">
          <div className="container-x" style={{ maxWidth: 760 }}>
            <Stepper current={step} reached={sample ? 4 : reached} onJump={goTo} locked={running} />
          </div>
        </div>
      )}

      <main id="main-content" ref={mainRef} tabIndex={-1} className="wf-container" style={{ outline: "none", flex: "1 0 auto" }}>
        {signedIn && live && (
          <>
            {live.result ? (
              <ResultsView
                result={live.result}
                mode="live"
                ranAt={live.ranAt}
                commentary={live.commentary}
                onAsk={onAsk}
                onReadout={onReadout}
                onRerun={() => onRunLive?.()}
                rerunLabel={live.running ? "Re-running…" : "Re-run"}
                onBack={onBack}
                backLabel="Overview"
                status={
                  live.running ? (
                    <Alert variant="info" title="Re-running the model on live data">
                      The results below are from the previous run and will update when this one finishes.
                    </Alert>
                  ) : live.error ? (
                    <Alert variant="error" title="The re-run didn't finish">
                      {live.error} The results below are from the previous run.
                    </Alert>
                  ) : undefined
                }
              />
            ) : (
              <LiveRunStep running={live.running} error={live.error} onRun={() => onRunLive?.()} onBack={onBack} />
            )}
          </>
        )}

        {!signedIn && step === 1 && <SourcesStep settings={settings} onChange={setSettings} onNext={() => goTo(2)} />}
        {!signedIn && step === 2 && (
          <SettingsStep settings={settings} onChange={setSettings} onBack={() => goTo(1)} onNext={() => goTo(3)} />
        )}
        {!signedIn && step === 3 && (
          <SampleRunStep settings={settings} running={running} stage={stage} onBack={() => goTo(2)} onRun={runSample} />
        )}
        {!signedIn && step === 4 && sample && (
          <>
            {sampleStale && (
              <div style={{ marginBottom: 20 }}>
                <Alert variant="info" title="Settings changed since this run">
                  These results use the earlier settings.{" "}
                  <button type="button" className="link" onClick={() => goTo(3)}>
                    Run again with the new ones
                  </button>
                  .
                </Alert>
              </div>
            )}
            <ResultsView
              result={sample.result}
              mode="sample"
              ranAt={sample.ranAt}
              notice={notice}
              onRerun={() => goTo(2)}
              rerunLabel="Try other settings"
              onBack={() => goTo(3)}
            />
          </>
        )}
        {!signedIn && step === 4 && !sample && (
          <Alert variant="info" title="No sample run yet">
            Run the sample on step 3 first.
          </Alert>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export { T }
