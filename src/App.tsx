import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { T } from "./theme"
import { AugieMark, SiteHeader, SiteFooter } from "./chrome"
import { IconArrowRight, IconWarning } from "./icons"
import { DataCoveragePanel, summarizeSources } from "./coverage"
import { ProjectChecklist } from "./checklist"
import { DATA_SOURCES, MODEL_WINDOW, STATUS_AS_OF, formatStatusDate } from "./projectStatus"
import { AdmissionsDial } from "./admissionsDial"
import { chatBrief, driverLedger, headline, trust, FIT_WORDS, VERDICT_LABEL } from "./insights"
import { EXPLAIN_PROMPT, buildPageContext, isExcluded, pickTarget } from "./explainPointer"
import type { LiveRunState } from "./mmm"
import {
  AuthError,
  getInsights,
  googleSignInUrl,
  login as apiLogin,
  readOAuthRedirect,
  runPipeline,
  sendChatMessage,
  type ChatTurn,
  type PipelineResult,
} from "./api"
import Guide from "./guide"
import { Term } from "./glossary"
import "./app.css"

// The workflow pulls in Recharts; load it only when someone opens an analysis.
const MMMWorkflow = lazy(() => import("./mmm"))
const LearnPage = lazy(() => import("./learn/LearnPage"))

/* ── pages + hash routing ──────────────────────────────────── */
// Hash routes so the browser's Back button and a refresh keep your place.
type Page = "landing" | "login" | "options" | "demo" | "overview" | "analysis" | "learn"
const ROUTES: Record<Page, string> = {
  landing: "#/",
  login: "#/sign-in",
  options: "#/demo",
  demo: "#/demo/mmm",
  overview: "#/overview",
  analysis: "#/analysis",
  learn: "#/how-it-works",
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
// Google sign-in comes back with the session (or a refusal) in the URL fragment.
// Read it once at load, before the hash routing in App rewrites the address.
const oauthAtLoad = readOAuthRedirect()
if (oauthAtLoad && "token" in oauthAtLoad) {
  ss.set("mmm_auth_token", oauthAtLoad.token)
  if (oauthAtLoad.email) ss.set("mmm_auth_email", oauthAtLoad.email)
}
const RUN_KEY = "augie_live_run_v1"
const EMPTY_RUN: LiveRunState = { result: null, ranAt: 0, running: false, error: null, commentary: { status: "idle" } }
function loadRun(): LiveRunState {
  try {
    const raw = ss.get(RUN_KEY)
    if (!raw) return EMPTY_RUN
    const v = JSON.parse(raw) as { result: PipelineResult; ranAt: number; commentary?: string }
    // a run cached by an older version (or a partial one) must not crash the page
    const r = v?.result
    const ok =
      r &&
      Array.isArray(r.weekly) &&
      Array.isArray(r.channel_contribution_weekly) &&
      Array.isArray(r.cross_validation?.per_fold_r2) &&
      typeof r.cross_validation?.mean_r2 === "number" &&
      r.in_sample_metrics &&
      r.coefficients
    if (!ok) return EMPTY_RUN
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
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/* ── AI chat widget ────────────────────────────────────────── */
/** The model sometimes answers with **bold** markdown; show it as bold, not asterisks. */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}
type ChatMsg = { role: "user" | "ai"; text: string; failed?: boolean }
const spendPct = DATA_SOURCES.find((s) => s.id === "spend")?.coverageLabel.match(/\d+%/)?.[0]
const STARTERS = [
  "What's the main finding, in one sentence?",
  "Can I trust this?",
  "Should we change our ad spending?",
  "What does “Can't tell yet” mean?",
  spendPct ? `What data is missing? (spend is on file for only ${spendPct} of weeks)` : "What data is missing?",
  "What is a Marketing Mix Model?",
]

/** Readable names for each page, sent to the chat so it knows what the visitor is looking at. */
const PAGE_NAMES: Record<Page, string> = {
  landing: "Landing",
  login: "Sign in",
  options: "Choose an analysis (data status)",
  demo: "Results (demo sample)",
  overview: "Results (your latest run)",
  analysis: "Analysis (your latest run)",
  learn: "How it works",
}

/** A part of the page the visitor pointed at, ready to send. */
type Picked = { context: string; label: string; typed: string }

function ChatWidget({
  onDark,
  token,
  resultsBrief,
  resultsSource,
  page,
}: {
  onDark: boolean
  token: string | null
  /** Summary of the latest run (live, else demo sample); null when there isn't one. */
  resultsBrief: string | null
  /** Which run the summary describes, so the footer doesn't call the sample "your run". */
  resultsSource: "live" | "sample" | null
  /** The current page; pointer mode ends when it changes. */
  page: Page
}) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "ai", text: "Hi, I'm Augie AI. I can explain anything on this page in plain words. Try a question below, or click Point at something and then click any part of the page." },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [pointing, setPointing] = useState(false)
  const [pointNote, setPointNote] = useState<string | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" })
  }, [msgs, typing])
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])
  // closing the panel or changing page ends pointer mode
  useEffect(() => {
    setPointing(false)
  }, [open, page])

  // pointer mode: hover outlines the part under the pointer, a click on it
  // is captured so the page's own buttons and links don't fire
  useEffect(() => {
    if (!pointing) return
    const body = document.body
    body.classList.add("explain-picking")
    let hovered: Element | null = null

    const place = () => {
      const box = boxRef.current
      if (!box) return
      if (!hovered || !hovered.isConnected) {
        box.style.display = "none"
        return
      }
      const r = hovered.getBoundingClientRect()
      box.style.display = "block"
      box.style.top = `${r.top}px`
      box.style.left = `${r.left}px`
      box.style.width = `${r.width}px`
      box.style.height = `${r.height}px`
    }
    const onMove = (e: MouseEvent) => {
      hovered = pickTarget(e.target)
      place()
    }
    const pick = (node: EventTarget | null) => {
      const el = pickTarget(node)
      if (!el) {
        setPointNote("Point at text, a number, a chart or a table.")
        return
      }
      const built = buildPageContext(PAGE_NAMES[page], el)
      if (!built) {
        setPointNote("That part of the page has a sign-in form, so it can't be sent.")
        return
      }
      if (typing) {
        setPointNote("Augie AI is still answering. Point again once the reply is in.")
        return
      }
      setPicked({ ...built, typed: inputRef.current?.value.trim() ?? "" })
      setPointing(false)
    }
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && isExcluded(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      pick(e.target)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPointing(false)
      // keyboard users: Tab to a part of the page, then Enter picks it
      else if (e.key === "Enter" && document.activeElement && !isExcluded(document.activeElement)) {
        e.preventDefault()
        e.stopPropagation()
        pick(document.activeElement)
      }
    }
    const onFocus = (e: FocusEvent) => {
      hovered = pickTarget(e.target)
      place()
    }
    const onScroll = () => place()

    document.addEventListener("mousemove", onMove)
    document.addEventListener("click", onClick, true)
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("focusin", onFocus)
    window.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("focusin", onFocus)
      window.removeEventListener("scroll", onScroll, { capture: true })
      window.removeEventListener("resize", onScroll)
      body.classList.remove("explain-picking")
      if (boxRef.current) boxRef.current.style.display = "none"
    }
  }, [pointing, page, typing])

  // a part of the page was picked: open the chat and ask about it
  useEffect(() => {
    if (!picked) return
    setPicked(null)
    setOpen(true)
    const shown = picked.typed
      ? `${picked.typed} (about “${picked.label}”)`
      : `Explain: “${picked.label}”`
    send(picked.typed || EXPLAIN_PROMPT, { pageContext: picked.context, shown })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked])

  function close() {
    setOpen(false)
    toggleRef.current?.focus()
  }

  function togglePointing() {
    setPointNote(null)
    setPointing((p) => !p)
  }

  async function send(textIn?: string, explain?: { pageContext: string; shown: string }) {
    const text = (textIn ?? input).trim()
    if (!text || typing) return
    setInput("")
    const history: ChatTurn[] = msgs
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }))
    setMsgs((m) => [...m, { role: "user", text: explain?.shown ?? text }])
    setTyping(true)
    try {
      const reply = await sendChatMessage(text, history, token, resultsBrief, explain?.pageContext ?? null)
      setMsgs((m) => [...m, { role: "ai", text: reply }])
    } catch (err) {
      // Keep the unanswered question out of future history (no back-to-back
      // user turns) and put it back in the box so it can be sent again.
      // A pointed-at part is not kept, since the page context isn't stored.
      setMsgs((m) => [
        ...m.slice(0, -1),
        { ...m[m.length - 1], failed: true },
        {
          role: "ai",
          text: explain
            ? `I couldn't answer just now. ${errText(err)} Point at it again to retry.`
            : `I couldn't answer just now. ${errText(err)} Your question is back in the box to try again.`,
          failed: true,
        },
      ])
      if (!explain) setInput((cur) => cur || text)
    } finally {
      setTyping(false)
    }
  }

  const onlyGreeting = msgs.length === 1

  return (
    <div
      className="chat no-print"
      role="region"
      aria-label="Augie AI assistant"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          if (pointing) setPointing(false)
          else close()
        }
      }}
    >
      {pointing && (
        <div className="explain-hint" role="status">
          <span>Click any part of the page to ask Augie AI about it (or Tab to it and press Enter) · Esc to cancel</span>
          {pointNote && <span className="explain-note">{pointNote}</span>}
          <button type="button" className="explain-cancel" onClick={() => setPointing(false)}>
            Cancel
          </button>
        </div>
      )}
      {pointing && <div ref={boxRef} className="explain-box" aria-hidden="true" />}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Augie AI chat"
          className={`chat-panel card animate-scale-in${pointing ? " is-pointing" : ""}`}
        >
          <div className="chat-head">
            <div className="chat-title">
              <AugieMark size={20} boxed={false} />
              <span>Augie AI</span>
            </div>
            <div className="chat-head-actions">
              <button
                type="button"
                onClick={togglePointing}
                aria-pressed={pointing}
                className="chat-point"
                title="Point at a part of the page to ask Augie AI about it"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 0.5v3M7 10.5v3M0.5 7h3M10.5 7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Point at something
              </button>
              <button type="button" onClick={close} aria-label="Close chat" className="chat-close">
                ×
              </button>
            </div>
          </div>
          <div role="log" aria-live="polite" aria-label="Chat messages" className="chat-log scroll-thin">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg chat-${m.role}${m.failed ? " chat-failed" : ""}`}>
                {m.role === "ai" ? withBold(m.text) : m.text}
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
              placeholder={typing ? "Waiting for the reply…" : "Ask in your own words…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="field"
              maxLength={600}
            />
            <button type="submit" aria-label="Send message" className="chat-send" aria-disabled={!input.trim() || typing || undefined}>
              <IconArrowRight size={15} />
            </button>
          </form>
          <p className="chat-foot">
            AI answers can be wrong.{" "}
            {resultsSource === "live"
              ? "It can see a summary of your latest run."
              : resultsSource === "sample"
                ? "It can see a summary of the demo's sample run."
                : "Run the analysis (or the demo sample) so it can see the results."}
          </p>
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        aria-expanded={open}
        data-guide="chat-button"
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
  // a ref, so a re-render of the parent can't restart the timer
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), prefersReducedMotion() ? 400 : 1100)
    return () => clearTimeout(t)
  }, [])
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
  { title: "What each ad channel shows so far", body: "Each channel gets a plain label, such as Can't tell yet or Positive association, and a note on how far to trust it. Right now the data can't separate any channel's effect." },
  { title: "How much is just the time of year", body: "Shows how much of weekly applications the admissions calendar already accounts for, so you can see what is left for marketing." },
  { title: "How much to trust it", body: "We hide recent weeks, ask the tool to predict them, then compare with what really happened. We also show where the data has gaps." },
]

function LandingPage({ onDemo, onLogin, onLearn }: { onDemo: () => void; onLogin: () => void; onLearn: () => void }) {
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
          <h1 className="display t-hero landing-title" tabIndex={-1} data-page-title data-guide="home-title">
            Augie <em>Analysis</em>
          </h1>
          <p className="lead landing-lead">
            Augie Analysis asks one question: do our digital ads add applications beyond what the admissions calendar
            already brings in? It compares past weekly applications with past ad spending, using a{" "}
            <Term id="mmm">marketing mix model</Term>, and tells you how far to trust each answer.
          </p>
          <div className="landing-ctas" data-guide="home-ctas">
            <button type="button" onClick={onLogin} className="btn btn-gold btn-lg">
              Sign in <span className="arrow"><IconArrowRight size={15} /></span>
            </button>
            <button type="button" onClick={onDemo} className="btn btn-outline-light btn-lg">
              Try the demo (rescaled real results, about 2 minutes)
            </button>
          </div>
          <p className="landing-where">First time here? Start with the demo. Have an account? Sign in to see Augustana's real results.</p>
          <p className="landing-finding" data-guide="home-finding">
            <strong>Latest finding:</strong> the time of year predicts weekly applications better than ad data does, so
            no channel's effect is established yet. That doesn't show ads don't help. The data so far just can't tell.
            Please don't cut or increase any channel based on this tool alone. The yardstick is the admissions{" "}
            <Term id="calendar-only">calendar-only</Term> forecast, and fuller spend history is the next step.
          </p>
          <p className="landing-learn">
            New here?{" "}
            <button type="button" className="link landing-learn-link" onClick={onLearn}>
              Get a 30-second explanation
            </button>
          </p>
          <p className="landing-status">
            Data we have: {sources.live + sources.partial} sources in use · {sources.reference} kept for background ·{" "}
            {sources.pending} still waiting to arrive ·{" "}
            <span className="nowrap">
              Last checked <time dateTime={STATUS_AS_OF}>{formatStatusDate()}</time>
            </span>
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
  initialError,
}: {
  onBack: () => void
  onDemo: () => void
  onSignedIn: (token: string, email: string | null) => void
  notice: string | null
  initialError: string | null
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

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

  async function signInWithGoogle() {
    if (googleBusy) return
    setError(null)
    setGoogleBusy(true)
    try {
      // back to this page's address; the sign-in hash is dropped on purpose
      const url = await googleSignInUrl(window.location.origin + window.location.pathname)
      window.location.assign(url)
    } catch (err) {
      setError(errText(err))
      setGoogleBusy(false)
    }
  }

  return (
    <div className="hero login">
      <main id="main-content" className="login-card on-dark animate-scale-in">
        <button type="button" className="login-back" onClick={onBack}>
          ← Back
        </button>
        <div className="login-head">
          <div className="login-mark">
            <AugieMark size={48} />
          </div>
          <p className="eyebrow eyebrow-rule login-eyebrow">Augustana College</p>
          <h1 className="display t-h3 login-title" tabIndex={-1} data-page-title>
            Sign in to <em>Augie Analysis</em>
          </h1>
        </div>
        {notice && (
          <p role="status" className="login-notice">
            <IconWarning size={15} /> {notice}
          </p>
        )}
        <form onSubmit={submit} className="login-form" aria-busy={loading || undefined}>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleBusy}
            className="btn btn-outline-light btn-lg btn-block"
          >
            Sign in with Google
          </button>
          <p className="login-hint">Use your @augustana.edu Google account.</p>
          <div className="login-divider" aria-hidden="true">
            <span>or</span>
          </div>
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
            Try the demo instead (rescaled real results)
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
    <section aria-labelledby="data-status-title" className="data-status" data-guide="data-status">
      <div className="data-status-head">
        <p className="eyebrow eyebrow-rule">Data &amp; next steps</p>
        <h2 id="data-status-title" className="display t-h3">
          Where the data <em>stands</em>
        </h2>
        <p className="step-lead">What data the tool has today, and what is still needed before its answers can be firmer.</p>
      </div>
      <DataCoveragePanel />
      <div className="data-status-list">
        <ProjectChecklist variant="compact" headingLevel={3} collapsible />
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
  onLearn,
  signedIn,
}: {
  onOpen: () => void
  onHome: () => void
  onSignIn?: () => void
  onLearn: () => void
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
              The demo shows the real results with application counts rescaled (an average week reads 100) and no dollar amounts.{" "}
              {onSignIn ? (
                <>
                  <button type="button" className="link" onClick={onSignIn}>
                    Sign in
                  </button>{" "}
                  to see the real results.
                </>
              ) : (
                <>
                  Your live results are on{" "}
                  <button type="button" className="link" onClick={onHome}>
                    your overview
                  </button>
                  .
                </>
              )}{" "}
              New here?{" "}
              <button type="button" className="link" onClick={onLearn}>
                Read the short explanation
              </button>
              .
            </p>
          </div>

          <ul className="options-grid" role="list">
            <li>
              <button type="button" className="card card-interactive option-main" onClick={onOpen} data-guide="options-open">
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
                  Do digital ads (Instagram and Facebook, Google search and others) add applications beyond what the
                  admissions calendar already explains? And how far can you trust the answer?
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
                      <strong>{spendFacts.coverageLabel.match(/\d+%/)?.[0] ?? spendFacts.coverageLabel}</strong> of weeks with spend on file
                    </span>
                  )}
                </span>
                <span className="btn btn-primary btn-sm option-cta" aria-hidden>
                  Run the sample analysis <IconArrowRight size={14} />
                </span>
              </button>
            </li>
            {[
              { label: "General analysis", sub: "Trends & anomalies", reason: "Planned once the MMM is on firmer data." },
              {
                label: "Deep dive",
                sub: "Cohort & funnel",
                reason: "Needs admits and deposits data, which isn't on file yet.",
              },
            ].map((o) => (
              <li key={o.label}>
                <div className="option-soon">
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
/** Keeps the AI consistent with the verdicts on screen (used for the readout and every follow-up). */
function verdictSteer(r: PipelineResult): string {
  const rows = driverLedger(r).filter((x) => x.key !== "baseline")
  const verdicts = rows.map((x) => `${x.label}: ${VERDICT_LABEL[x.verdict].toLowerCase()}`).join("; ")
  const unidentified = r.marketing_lift && !r.marketing_lift.identified
  const negative = rows.filter((x) => x.verdict === "cant-tell" && x.total < 0).map((x) => x.label)
  return [
    `Keep it consistent with the reliability verdicts shown on the results page: ${verdicts}.`,
    unidentified
      ? "Marketing did not beat the calendar-only model on unseen weeks, so no channel's estimate is supported: don't name any channel as working or worth more budget, and don't recommend cutting one."
      : negative.length
        ? `${negative.join(" and ")} came out negative because of overlap or coarse data. Don't recommend cutting them; say the model can't tell yet.`
        : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function readoutBrief(r: PipelineResult): string {
  return `Write the standard readout for this run. ${verdictSteer(r)}`
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => ss.get("mmm_auth_token"))
  const [email, setEmail] = useState<string | null>(() => ss.get("mmm_auth_email"))
  const [page, setPage] = useState<Page>(() =>
    oauthAtLoad && "error" in oauthAtLoad ? "login" : guard(pageFromHash(location.hash), !!ss.get("mmm_auth_token")),
  )
  // a refused or failed Google sign-in, shown in the sign-in form
  const [oauthError, setOauthError] = useState<string | null>(() => (oauthAtLoad && "error" in oauthAtLoad ? oauthAtLoad.error : null))
  const [intro, setIntro] = useState(() => !ss.get("augie_intro_seen"))
  const [live, setLive] = useState<LiveRunState>(() => (ss.get("mmm_auth_token") ? loadRun() : EMPTY_RUN))
  // latest live run for callbacks that shouldn't re-create on every update
  const liveRef = useRef(live)
  liveRef.current = live
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  // latest demo (rescaled) run, so the chat can discuss it too
  const [demoRun, setDemoRun] = useState<{ result: PipelineResult; ranAt: number } | null>(null)
  // set synchronously, so a double click can't start two runs before React re-renders
  const runningRef = useRef(false)
  // bumped on sign-out: any request still in flight from the old session is ignored
  const epochRef = useRef(0)
  const firstRender = useRef(true)

  // a Google error belongs to the sign-in screen it arrived on; drop it once they leave
  useEffect(() => {
    if (page !== "login") setOauthError(null)
  }, [page])

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

  // on every page change after the first: jump to the top (not a long smooth
  // scroll back) and focus the page title. Lazy pages mount a moment later, so
  // keep looking for the title for about half a second.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    let frames = 0
    let raf = 0
    const focusTitle = () => {
      const el = document.querySelector<HTMLElement>("[data-page-title], [data-step-title]")
      if (el) el.focus({ preventScroll: true })
      else if (++frames < 30) raf = requestAnimationFrame(focusTitle)
    }
    raf = requestAnimationFrame(focusTitle)
    return () => cancelAnimationFrame(raf)
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
      const r = liveRef.current.result
      try {
        // answer about the run on screen, with the same verdict steer as the readout
        return (await getInsights(tk, r ? `${q}\n\n(${verdictSteer(r)})` : q, r)).commentary
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

      {page === "landing" && (
        <LandingPage onDemo={() => go("options")} onLogin={() => go("login")} onLearn={() => go("learn")} />
      )}
      {page === "login" && (
        <LoginPage
          onBack={() => go("landing")}
          onDemo={() => go("options")}
          onSignedIn={handleSignedIn}
          notice={loginNotice}
          initialError={oauthError}
        />
      )}
      {page === "options" && (
        <OptionsPage
          onOpen={() => go("demo")}
          onHome={() => go(signedIn ? "overview" : "landing")}
          onSignIn={signedIn ? undefined : () => go("login")}
          onLearn={() => go("learn")}
          signedIn={signedIn}
        />
      )}
      {page === "learn" && (
        <Suspense
          fallback={
            <div className="workflow-loading" role="status">
              Loading…
            </div>
          }
        >
          <LearnPage
            onBack={() => go(signedIn ? "overview" : "landing")}
            backLabel={signedIn ? "Overview" : "Home"}
            onDemo={() => go("options")}
            onSignIn={signedIn ? undefined : () => go("login")}
          />
        </Suspense>
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
                onSampleRun={(result, ranAt) => setDemoRun({ result, ranAt })}
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
      <Guide onLanding={page === "landing"} />
      <ChatWidget
        onDark={onDark}
        token={token}
        resultsBrief={
          token && live.result
            ? chatBrief(live.result, live.ranAt)
            : demoRun
              ? chatBrief(demoRun.result, demoRun.ranAt, "demo")
              : null
        }
        resultsSource={token && live.result ? "live" : demoRun ? "sample" : null}
        page={page}
      />
    </>
  )
}
