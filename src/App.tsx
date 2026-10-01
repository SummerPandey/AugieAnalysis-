import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { T } from "./theme"
import { AugieMark, SiteHeader, SiteFooter } from "./chrome"
import { IconArrowRight, IconWarning } from "./icons"
import { DataCoveragePanel, summarizeSources } from "./coverage"
import { ProjectChecklist } from "./checklist"
import { DATA_SOURCES, MODEL_WINDOW, STATUS_AS_OF, formatStatusDate } from "./projectStatus"
import { AdmissionsDial } from "./admissionsDial"
import { driverLedger, headline, trust, FIT_WORDS, VERDICT_LABEL } from "./insights"
import type { LiveRunState } from "./mmm"
import {
  AuthError,
  getInsights,
  login as apiLogin,
  runPipeline,
  sendChatMessage,
  type ChatTurn,
  type PipelineResult,
} from "./api"
import "./app.css"

// The workflow pulls in Recharts; load it only when someone opens an analysis.
const MMMWorkflow = lazy(() => import("./mmm"))

/* ── pages + hash routing ──────────────────────────────────── */
// Hash routes so the browser's Back button and a refresh keep your place.
type Page = "landing" | "login" | "options" | "demo" | "overview" | "analysis"
const ROUTES: Record<Page, string> = {
  landing: "#/",
  login: "#/sign-in",
  options: "#/demo",
  demo: "#/demo/mmm",
  overview: "#/overview",
  analysis: "#/analysis",
}
function pageFromHash(hash: string): Page {
  const hit = (Object.keys(ROUTES) as Page[]).find((p) => ROUTES[p] === hash)
  return hit ?? "landing"
}
/** Keep people on pages they're allowed to see. */
function guard(p: Page, signedIn: boolean): Page {
  if (!signedIn && (p === "overview" || p === "analysis")) return "login"
  if (signedIn && (p === "landing" || p === "login")) return "overview"
  return p
}

/* ── session storage (always guarded) ──────────────────────── */
const ss = {
  get(k: string) {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      // storage full or blocked: the app still works for this page load
    }
  },
  del(k: string) {
    try {
      sessionStorage.removeItem(k)
    } catch {
      // ignore
    }
  },
}
const RUN_KEY = "augie_live_run_v1"
const EMPTY_RUN: LiveRunState = { result: null, ranAt: 0, running: false, error: null, commentary: { status: "idle" } }
function loadRun(): LiveRunState {
  try {
    const raw = ss.get(RUN_KEY)
    if (!raw) return EMPTY_RUN
    const v = JSON.parse(raw) as { result: PipelineResult; ranAt: number; commentary?: string }
    if (!v?.result?.weekly) return EMPTY_RUN
    return {
      result: v.result,
      ranAt: v.ranAt,
      running: false,
      error: null,
      commentary: v.commentary ? { status: "ready", text: v.commentary } : { status: "idle" },
    }
  } catch {
    return EMPTY_RUN
  }
}

function displayName(email: string | null): string {
  if (!email) return "there"
  const local = email.split("@")[0]
  if (/^irene\b/i.test(local)) return "Irene"
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/* ── AI chat widget ────────────────────────────────────────── */
type ChatMsg = { role: "user" | "ai"; text: string; failed?: boolean }
const spendPct = DATA_SOURCES.find((s) => s.id === "spend")?.coverageLabel.match(/\d+%/)?.[0]
const STARTERS = [
  "Explain R² in plain English",
  "What is adstock?",
  spendPct ? `Why is spend coverage only ${spendPct}?` : "Why is some spend history missing?",
  "What does “directional” mean for a channel?",
]

function ChatWidget({ onDark, token }: { onDark: boolean; token: string | null }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "ai", text: "Hi, I'm Augie AI. Ask me about the model, the data behind it, or how to read a result." },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [msgs, typing])
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  function close() {
    setOpen(false)
    toggleRef.current?.focus()
  }

  async function send(textIn?: string) {
    const text = (textIn ?? input).trim()
    if (!text || typing) return
    setInput("")
    const history: ChatTurn[] = msgs
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }))
    setMsgs((m) => [...m, { role: "user", text }])
    setTyping(true)
    try {
      const reply = await sendChatMessage(text, history, token)
      setMsgs((m) => [...m, { role: "ai", text: reply }])
    } catch (err) {
      setMsgs((m) => [...m, { role: "ai", text: `I couldn't answer just now. ${errText(err)}`, failed: true }])
    } finally {
      setTyping(false)
    }
  }

  const onlyGreeting = msgs.length === 1

  return (
    <div className="chat no-print" role="region" aria-label="Augie AI assistant" onKeyDown={(e) => e.key === "Escape" && open && close()}>
      {open && (
        <div role="dialog" aria-modal="false" aria-label="Augie AI chat" className="chat-panel card animate-scale-in">
          <div className="chat-head">
            <div className="chat-title">
              <AugieMark size={20} boxed={false} />
              <span>Augie AI</span>
            </div>
            <button type="button" onClick={close} aria-label="Close chat" className="chat-close">
              ×
            </button>
          </div>
          <div role="log" aria-live="polite" aria-label="Chat messages" className="chat-log scroll-thin">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg chat-${m.role}${m.failed ? " chat-failed" : ""}`}>
                {m.text}
              </div>
            ))}
            {onlyGreeting && (
              <div className="chat-starters" aria-label="Suggested questions">
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {typing && (
              <div className="chat-msg chat-ai chat-typing" aria-label="Augie AI is typing">
                {[0, 1, 2].map((j) => (
                  <span key={j} className="animate-shimmer" style={{ animationDelay: `${j * 0.15}s` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              ref={inputRef}
              aria-label="Chat message"
              placeholder={typing ? "Waiting for the reply…" : "Ask about the model or the data…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="field"
              maxLength={600}
            />
            <button type="submit" aria-label="Send message" className="chat-send" aria-disabled={!input.trim() || typing || undefined}>
              <IconArrowRight size={15} />
            </button>
          </form>
          <p className="chat-foot">AI answers can be wrong. It doesn't see your live results.</p>
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        aria-expanded={open}
        className={`chat-toggle${onDark ? " on-navy" : ""}`}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 17 17" fill="none" aria-hidden>
            <path
              d="M1.5 4A2.5 2.5 0 014 1.5h9A2.5 2.5 0 0115.5 4v5.5A2.5 2.5 0 0113 12H9.5l-3 3v-3H4A2.5 2.5 0 011.5 9.5V4z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="5.5" cy="6.75" r="1" fill="currentColor" />
            <circle cx="8.5" cy="6.75" r="1" fill="currentColor" />
            <circle cx="11.5" cy="6.75" r="1" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  )
}

/* ── intro (once per session) ──────────────────────────────── */
function IntroScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1100)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="hero intro" role="status" aria-label="Loading Augie Analysis">
      <div className="intro-inner animate-fade-in">
        <AdmissionsDial size={220} showCenter={false} sweep />
        <p className="display intro-word">
          Augie <em>Analysis</em>
        </p>
      </div>
    </div>
  )
}

/* ── landing ───────────────────────────────────────────────── */
// Each point maps to something the results page really shows.
const LANDING_POINTS = [
  { title: "Which channels help", body: "Each channel's modeled applications, with an honest verdict on how far to trust it." },
  { title: "What the calendar explains", body: "Separates the admissions cycle from what marketing added." },
  { title: "How far to trust it", body: "Fit on weeks the model never saw, and the data gaps, stated plainly." },
]

function LandingPage({ onDemo, onLogin }: { onDemo: () => void; onLogin: () => void }) {
  const sources = summarizeSources()
  return (
    <div className="hero landing">
      <div aria-hidden className="landing-grid-bg" />
      <main id="main-content" className="landing-inner">
        <div className="landing-copy animate-fade-in">
          <p className="eyebrow eyebrow-rule landing-eyebrow">
            <span>
              Augustana College<span className="hide-sm"> · Marketing &amp; Communications</span>
            </span>
          </p>
          <h1 className="display t-hero landing-title" tabIndex={-1} data-page-title>
            Augie <em>Analysis</em>
          </h1>
          <p className="lead landing-lead">
            A Marketing Mix Model for Augustana's admissions marketing: how much each channel, from Meta to billboards,
            actually moves weekly applications, and how much is simply the admissions calendar.
          </p>
          <div className="landing-ctas">
            <button type="button" onClick={onLogin} className="btn btn-gold btn-lg">
              Sign in <span className="arrow"><IconArrowRight size={15} /></span>
            </button>
            <button type="button" onClick={onDemo} className="btn btn-outline-light btn-lg">
              Explore the demo
            </button>
          </div>
          <p className="landing-status">
            {sources.onFile} of {sources.total} data sources on file · Status as of{" "}
            <time dateTime={STATUS_AS_OF}>{formatStatusDate()}</time>
          </p>
        </div>
        <div className="landing-art">
          <AdmissionsDial size="100%" tone="dark" />
        </div>
        <ul className="landing-points" role="list" aria-label="What Augie Analysis answers">
          {LANDING_POINTS.map((p) => (
            <li key={p.title} className="landing-point">
              <p className="landing-point-title">{p.title}</p>
              <p className="landing-point-body">{p.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

/* ── sign in ───────────────────────────────────────────────── */
function LoginPage({
  onBack,
  onDemo,
  onSignedIn,
  notice,
}: {
  onBack: () => void
  onDemo: () => void
  onSignedIn: (token: string, email: string | null) => void
  notice: string | null
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const r = await apiLogin(email.trim(), password)
      onSignedIn(r.token, r.email)
    } catch (err) {
      setError(errText(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hero login">
      <main id="main-content" className="login-card on-dark animate-scale-in">
        <button type="button" className="login-back" onClick={onBack}>
          ← Back
        </button>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AugieMark size={48} />
          </div>
          <p className="eyebrow eyebrow-rule" style={{ justifyContent: "center", color: "rgba(255,255,255,0.6)", marginTop: 20 }}>
            Augustana College
          </p>
          <h1 className="display t-h3" style={{ color: "#fff", marginTop: 8 }} tabIndex={-1} data-page-title>
            Sign in to <em style={{ color: T.gold }}>Augie Analysis</em>
          </h1>
        </div>
        {notice && (
          <p role="status" className="login-notice">
            <IconWarning size={15} /> {notice}
          </p>
        )}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="email" className="field-label login-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@augustana.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field field-dark"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label login-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field field-dark"
            />
          </div>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          <button type="submit" aria-disabled={loading || undefined} className="btn btn-gold btn-lg btn-block">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button type="button" onClick={onDemo} className="btn btn-ghost btn-block login-demo">
            Continue with the demo (sample data)
          </button>
        </form>
      </main>
    </div>
  )
}

/* ── data status section (Options + Overview) ──────────────── */
// Reads the audited facts in projectStatus.ts, so it renders whether or not
// the backend is reachable.
function DataStatusSection() {
  return (
    <section aria-labelledby="data-status-title" className="data-status">
      <div style={{ marginBottom: 22 }}>
        <p className="eyebrow eyebrow-rule">Data &amp; next steps</p>
        <h2 id="data-status-title" className="display t-h3" style={{ marginTop: 8 }}>
          Where the data <em>stands</em>
        </h2>
        <p className="step-lead">What the model has to learn from today, and what's still needed to firm up its estimates.</p>
      </div>
      <div className="cov-layout">
        <DataCoveragePanel />
        <ProjectChecklist variant="compact" headingLevel={3} />
      </div>
    </section>
  )
}

/* ── choose an analysis (signed out) ───────────────────────── */
const spendFacts = DATA_SOURCES.find((s) => s.id === "spend")
const fmtYM = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

function OptionsPage({
  onOpen,
  onHome,
  onSignIn,
  signedIn,
}: {
  onOpen: () => void
  onHome: () => void
  onSignIn?: () => void
  signedIn: boolean
}) {
  return (
    <div className="site bg-mesh">
      <SiteHeader
        variant="demo"
        onBack={onHome}
        backLabel={signedIn ? "Overview" : "Home"}
        backAriaLabel={signedIn ? "Back to your overview" : "Back to home"}
        onSignIn={onSignIn}
      />
      <main className="section" id="main-content">
        <div className="container-x" style={{ maxWidth: 1040 }}>
          <div className="options-intro animate-fade-in">
            <p className="eyebrow eyebrow-rule" style={{ justifyContent: "center" }}>
              Choose an analysis
            </p>
            <h1 className="display t-h1" style={{ marginTop: 10 }} tabIndex={-1} data-page-title>
              What do you want to <em>understand</em>?
            </h1>
            <p className="lead">
              The demo runs on a synthetic sample shaped like Augustana's data.{" "}
              {onSignIn ? (
                <>
                  <button type="button" className="link" onClick={onSignIn}>
                    Sign in
                  </button>{" "}
                  to run the model on the real thing.
                </>
              ) : (
                <>
                  Your live results are on{" "}
                  <button type="button" className="link" onClick={onHome}>
                    your overview
                  </button>
                  .
                </>
              )}
            </p>
          </div>

          <ul className="options-grid" role="list">
            <li>
              <button type="button" className="card card-interactive option-main" onClick={onOpen}>
                <span className="option-icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <circle cx="9" cy="9" r="7" />
                    <path d="M9 9V4M9 9l4 2.5" />
                    <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                  </svg>
                </span>
                <span className="option-kicker">Available now</span>
                <span className="option-title display">Marketing Mix Model</span>
                <span className="option-desc">
                  How much each channel, from Meta to billboards, contributes to weekly applications once the admissions
                  calendar is accounted for, and how far each estimate can be trusted.
                </span>
                <span className="option-facts">
                  <span>
                    <strong>{fmtYM(MODEL_WINDOW.start)} – {fmtYM(MODEL_WINDOW.end)}</strong> model window
                  </span>
                  <span>
                    <strong>{DATA_SOURCES.length}</strong> data sources tracked
                  </span>
                  {spendFacts && (
                    <span>
                      <strong>{spendFacts.coverageLabel.replace(" of the window", "")}</strong> spend history on file
                    </span>
                  )}
                </span>
                <span className="btn btn-primary btn-sm option-cta" aria-hidden>
                  Open the MMM demo <IconArrowRight size={14} />
                </span>
              </button>
            </li>
            {[
              { label: "General analysis", sub: "Trends & anomalies", reason: "Not built yet. Planned once the MMM is on firmer data." },
              {
                label: "Deep dive",
                sub: "Cohort & funnel",
                reason: "Needs admits and deposits data, which isn't on file yet.",
              },
            ].map((o) => (
              <li key={o.label}>
                <div className="option-soon" aria-label={`${o.label}: coming soon. ${o.reason}`}>
                  <span className="badge">Coming soon</span>
                  <span className="option-title-sm">{o.label}</span>
                  <span className="option-sub">{o.sub}</span>
                  <span className="option-reason">{o.reason}</span>
                </div>
              </li>
            ))}
          </ul>

          <DataStatusSection />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── overview (signed in) ──────────────────────────────────── */
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

function Overview({
  name,
  live,
  onOpen,
  onRun,
  onSignOut,
}: {
  name: string
  live: LiveRunState
  onOpen: () => void
  onRun: () => void
  onSignOut: () => void
}) {
  const r = live.result
  const ledger = useMemo(() => (r ? driverLedger(r) : []), [r])
  const t = useMemo(() => (r ? trust(r) : null), [r])
  const h = ledger.length ? headline(ledger) : null
  const elapsed = useElapsed(live.running)

  return (
    <div className="site bg-mesh">
      <SiteHeader variant="signedIn" name={name} onSignOut={onSignOut} />
      <main className="section" id="main-content" style={{ paddingTop: 52 }}>
        <div className="container-x" style={{ maxWidth: 1080 }}>
          <div className="overview-hero animate-fade-in">
            <div className="overview-copy">
              <p className="eyebrow eyebrow-rule">Augustana College · Marketing &amp; Communications</p>
              <h1 className="display t-h1" style={{ marginTop: 10 }} tabIndex={-1} data-page-title>
                Welcome back, <em style={{ color: T.goldDeep }}>{name}</em>
              </h1>

              {live.running && !r && (
                <div role="status" className="overview-loading">
                  <div className="skeleton" style={{ height: 22, width: "88%" }} />
                  <div className="skeleton" style={{ height: 22, width: "70%" }} />
                  <p>
                    Running the model on Augustana's live data… <span className="num">{elapsed}s</span>
                  </p>
                </div>
              )}

              {live.error && !r && (
                <div className="alert alert-error" role="alert" style={{ marginTop: 22 }}>
                  <IconWarning size={18} />
                  <div className="alert-body">
                    <span className="alert-title">The latest run didn't finish</span>
                    {live.error}
                    <div style={{ marginTop: 14 }}>
                      <button type="button" onClick={onRun} className="btn btn-primary btn-sm">
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {r && live.running && (
                <p role="status" className="overview-rerun">
                  Re-running the model on live data… <span className="num">{elapsed}s</span>. The figures below are from the
                  previous run.
                </p>
              )}
              {r && live.error && !live.running && (
                <div className="alert alert-error" role="alert" style={{ marginTop: 22 }}>
                  <IconWarning size={18} />
                  <div className="alert-body">
                    <span className="alert-title">The re-run didn't finish</span>
                    {live.error} Showing the previous run.
                  </div>
                </div>
              )}

              {r && h && t && (
                <>
                  <p className="overview-finding">
                    {h.lead} <mark className="finding-mark">{h.figure}</mark> {h.rest}
                  </p>
                  <p className="overview-paid">{h.paid}</p>
                  <dl className="overview-figures">
                    <div>
                      <dt>Fit on unseen weeks</dt>
                      <dd>
                        <span className="num">{t.cvMean.toFixed(2)}</span> <small>{FIT_WORDS[t.rating].toLowerCase()}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Typical weekly miss</dt>
                      <dd>
                        <span className="num">{t.mae !== undefined ? Math.round(t.mae) : "—"}</span>{" "}
                        <small>{t.maeShare !== undefined ? `apps · ${Math.round(t.maeShare * 100)}% of a week` : "apps"}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Data through</dt>
                      <dd>
                        {new Date(t.dataEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{" "}
                        <small>{t.weeksStale} wks ago</small>
                      </dd>
                    </div>
                  </dl>
                  <div className="overview-actions">
                    <button type="button" onClick={onOpen} className="btn btn-gold btn-lg">
                      Open the full analysis <span className="arrow"><IconArrowRight size={15} /></span>
                    </button>
                    <button type="button" onClick={onRun} className="btn btn-ghost" aria-disabled={live.running || undefined}>
                      {live.running ? "Re-running…" : "Re-run"}
                    </button>
                  </div>
                  <p className="overview-stamp">
                    Run {new Date(live.ranAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </>
              )}
            </div>
            <div className="overview-dial card">
              <AdmissionsDial size="100%" tone="light" dataEnd={t?.dataEnd} />
              <p className="overview-dial-cap">
                {t
                  ? "Hatched: weeks between the latest data and today, which no run can see yet."
                  : "Where Augustana is in the admissions year."}
              </p>
            </div>
          </div>

          <DataStatusSection />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── root ──────────────────────────────────────────────────── */
/** Steer the AI readout with the page's own verdicts so the two can't disagree. */
function readoutBrief(r: PipelineResult): string {
  const rows = driverLedger(r).filter((x) => x.key !== "baseline")
  const verdicts = rows.map((x) => `${x.label}: ${VERDICT_LABEL[x.verdict].toLowerCase()}`).join("; ")
  const cant = rows.filter((x) => x.verdict === "cant-tell").map((x) => x.label)
  return [
    "Write the standard readout for this run.",
    `Keep it consistent with the reliability verdicts shown on the results page: ${verdicts}.`,
    cant.length
      ? `${cant.join(" and ")} came out negative because of overlap or coarse data. Don't recommend cutting them; say the model can't tell yet.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => ss.get("mmm_auth_token"))
  const [email, setEmail] = useState<string | null>(() => ss.get("mmm_auth_email"))
  const [page, setPage] = useState<Page>(() => guard(pageFromHash(location.hash), !!ss.get("mmm_auth_token")))
  const [intro, setIntro] = useState(() => !ss.get("augie_intro_seen"))
  const [live, setLive] = useState<LiveRunState>(() => (ss.get("mmm_auth_token") ? loadRun() : EMPTY_RUN))
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  // set synchronously, so a double click can't start two runs before React re-renders
  const runningRef = useRef(false)
  // bumped on sign-out: any request still in flight from the old session is ignored
  const epochRef = useRef(0)
  const firstRender = useRef(true)

  // hash ↔ page. Hashes that aren't routes (the skip link's #main-content)
  // are in-page anchors, not navigation, so they're left alone.
  useEffect(() => {
    if (location.hash !== ROUTES[page]) history.replaceState(null, "", ROUTES[page])
    const onHash = () => {
      if (!(Object.values(ROUTES) as string[]).includes(location.hash)) return
      const next = guard(pageFromHash(location.hash), !!ss.get("mmm_auth_token"))
      if (location.hash !== ROUTES[next]) history.replaceState(null, "", ROUTES[next])
      setPage(next)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Navigate. `replace` swaps the current history entry (after sign-in and sign-out). */
  const go = useCallback((p: Page, replace = false) => {
    if (replace) {
      history.replaceState(null, "", ROUTES[p])
      setPage(p)
    } else if (location.hash === ROUTES[p]) setPage(p)
    else location.hash = ROUTES[p]
  }, [])

  // on every page change after the first: top of page, focus the page title
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-page-title], [data-step-title]")?.focus({ preventScroll: true }))
  }, [page])

  // keep the latest live run for this tab, so a refresh doesn't re-run it
  useEffect(() => {
    if (!live.result) return
    ss.set(
      RUN_KEY,
      JSON.stringify({ result: live.result, ranAt: live.ranAt, commentary: live.commentary.status === "ready" ? live.commentary.text : undefined }),
    )
  }, [live.result, live.ranAt, live.commentary])

  const signOut = useCallback(
    (notice: string | null = null) => {
      epochRef.current++
      runningRef.current = false
      setToken(null)
      setEmail(null)
      setLive(EMPTY_RUN)
      ss.del("mmm_auth_token")
      ss.del("mmm_auth_email")
      ss.del(RUN_KEY)
      setLoginNotice(notice)
      go(notice ? "login" : "landing", true)
    },
    [go],
  )

  /** Write (or rewrite) the AI readout for the current run. */
  const readout = useCallback(
    async (result: PipelineResult, ranAt: number) => {
      const tk = ss.get("mmm_auth_token")
      const epoch = epochRef.current
      if (!tk) return
      setLive((l) => (l.ranAt === ranAt ? { ...l, commentary: { status: "loading" } } : l))
      try {
        const ins = await getInsights(tk, readoutBrief(result))
        if (epoch !== epochRef.current) return
        setLive((l) => (l.ranAt === ranAt ? { ...l, commentary: { status: "ready", text: ins.commentary } } : l))
      } catch (err) {
        if (epoch !== epochRef.current) return
        if (err instanceof AuthError) return signOut(err.message)
        setLive((l) => (l.ranAt === ranAt ? { ...l, commentary: { status: "error", error: errText(err) } } : l))
      }
    },
    [signOut],
  )

  const runLive = useCallback(async () => {
    const tk = ss.get("mmm_auth_token")
    if (!tk || runningRef.current) return
    const epoch = epochRef.current
    runningRef.current = true
    setLive((l) => ({ ...l, running: true, error: null }))
    let result: PipelineResult
    try {
      result = await runPipeline(tk)
    } catch (err) {
      if (epoch !== epochRef.current) return
      runningRef.current = false
      if (err instanceof AuthError) return signOut(err.message)
      setLive((l) => ({ ...l, running: false, error: errText(err) }))
      return
    }
    if (epoch !== epochRef.current) return
    runningRef.current = false
    const ranAt = Date.now()
    // numbers first; the AI readout fills in when it's ready
    setLive({ result, ranAt, running: false, error: null, commentary: { status: "loading" } })
    readout(result, ranAt)
  }, [signOut, readout])

  const ask = useCallback(
    async (q: string) => {
      const tk = ss.get("mmm_auth_token")
      if (!tk) throw new AuthError()
      try {
        return (await getInsights(tk, q)).commentary
      } catch (err) {
        if (err instanceof AuthError) signOut(err.message)
        throw err
      }
    },
    [signOut],
  )

  // the overview shows the latest run; start one if this session has none
  useEffect(() => {
    if (page === "overview" && token && !live.result && !live.running && !live.error) runLive()
  }, [page, token, live.result, live.running, live.error, runLive])

  // a cached run restored without its readout (refresh mid-readout): write it now
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || !token || !live.result || live.commentary.status !== "idle") return
    restoredRef.current = true
    readout(live.result, live.ranAt)
  }, [token, live.result, live.ranAt, live.commentary.status, readout])

  function handleSignedIn(tk: string, em: string | null) {
    epochRef.current++
    setToken(tk)
    setEmail(em)
    ss.set("mmm_auth_token", tk)
    if (em) ss.set("mmm_auth_email", em)
    setLoginNotice(null)
    setLive(EMPTY_RUN)
    // replace the sign-in entry, so Back doesn't return to a page that bounces
    go("overview", true)
  }

  if (intro)
    return (
      <IntroScreen
        onDone={() => {
          ss.set("augie_intro_seen", "1")
          setIntro(false)
        }}
      />
    )

  const name = displayName(email)
  const onDark = page === "landing" || page === "login"
  const signedIn = !!token

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault()
          const main = document.getElementById("main-content")
          if (main) {
            if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1")
            main.focus()
          }
        }}
      >
        Skip to main content
      </a>

      {page === "landing" && <LandingPage onDemo={() => go("options")} onLogin={() => go("login")} />}
      {page === "login" && (
        <LoginPage onBack={() => go("landing")} onDemo={() => go("options")} onSignedIn={handleSignedIn} notice={loginNotice} />
      )}
      {page === "options" && (
        <OptionsPage
          onOpen={() => go("demo")}
          onHome={() => go(signedIn ? "overview" : "landing")}
          onSignIn={signedIn ? undefined : () => go("login")}
          signedIn={signedIn}
        />
      )}
      {page === "overview" && token && (
        <Overview name={name} live={live} onOpen={() => go("analysis")} onRun={runLive} onSignOut={() => signOut()} />
      )}
      {(page === "demo" || page === "analysis") && (
        <div className="workflow-scroll">
          <Suspense
            fallback={
              <div className="workflow-loading" role="status">
                Loading the analysis…
              </div>
            }
          >
            {page === "demo" ? (
              <MMMWorkflow
                onBack={() => go("options")}
                onSignIn={signedIn ? undefined : () => go("login")}
                userName={signedIn ? name : undefined}
              />
            ) : (
              <MMMWorkflow
                onBack={() => go("overview")}
                userName={name}
                live={live}
                onRunLive={runLive}
                onAsk={ask}
                onReadout={() => live.result && readout(live.result, live.ranAt)}
              />
            )}
          </Suspense>
        </div>
      )}
      <ChatWidget onDark={onDark} token={token} />
    </>
  )
}
