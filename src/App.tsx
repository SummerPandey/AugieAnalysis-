import { useState, useEffect, useRef } from "react"
import { MMMWorkflow } from "./mmm"
import { T } from "./theme"
import { humanizeChannel } from "./channels"
import {
  login as apiLogin,
  sendChatMessage,
  runPipeline,
  type ChatTurn,
  type PipelineResult,
} from "./api"

/* ── types ─────────────────────────────────────────────────── */
type Page = "landing" | "options" | "mmm" | "profile"
type ChatMsg = { role: "user" | "ai"; text: string }

/* ── shared mark ───────────────────────────────────────────── */
function AugieMark({ size = 28, boxed = true }: { size?: number; boxed?: boolean }) {
  const shield = (
    <svg width={size * 0.5} height={size * 0.56} viewBox="0 0 24 27" fill="none" aria-hidden>
      <path
        d="M12 1L2.5 4.6v6.6c0 6.4 4 11.3 9.5 14 5.5-2.7 9.5-7.6 9.5-14V4.6L12 1z"
        fill={T.gold}
      />
      <path d="M12 6.5l3.4 3.4-3.4 3.4-3.4-3.4L12 6.5z" fill={T.navy} />
      <rect x="7.8" y="15.8" width="8.4" height="2" rx="1" fill={T.navy} />
    </svg>
  )
  if (!boxed) return shield
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: T.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {shield}
    </div>
  )
}

/* ── site chrome: header + footer ─────────────────────────────
 * Shared by every "real page" (Options, Profile) so the app reads as one
 * institutional site rather than a set of disconnected app screens. The
 * full-bleed Landing/Loading moments intentionally skip this chrome. */
function SiteHeader({
  variant,
  name,
  onSignOut,
}: {
  variant: "demo" | "signedIn"
  name?: string | null
  onSignOut?: () => void
}) {
  return (
    <header className="site-header">
      <div className="utility-bar">
        <div
          className="container-x"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 32 }}
        >
          <span>Augustana College</span>
          <span>Marketing &amp; Communications</span>
        </div>
      </div>
      <div
        className="container-x"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <AugieMark size={30} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.tp, lineHeight: 1.15 }}>Augie Analysis</p>
            <p style={{ fontSize: 10.5, color: T.ts, letterSpacing: "0.03em" }}>Marketing Mix Model</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {variant === "demo" && <span className="badge badge-demo">★ Demo mode</span>}
          {variant === "signedIn" && (
            <>
              <span style={{ fontSize: 12.5, color: T.ts, whiteSpace: "nowrap" }}>
                Signed in as <strong style={{ color: T.tp }}>{name}</strong>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function SiteFooter() {
  const listItem: React.CSSProperties = { color: "rgba(255,255,255,0.62)", lineHeight: 1.5 }
  return (
    <footer className="site-footer">
      <div
        className="container-x"
        style={{ padding: "48px 0 28px", display: "grid", gap: "32px 24px", gridTemplateColumns: "1.3fr 1fr 1fr" }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <AugieMark size={26} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Augie Analysis</span>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 320, color: "rgba(255,255,255,0.62)" }}>
            An internal Marketing Mix Model for Augustana College admissions marketing — built to
            show which channels move weekly applications, using Augustana's own Slate, Carnegie,
            and billboard data.
          </p>
        </div>
        <div>
          <h2>Project</h2>
          <ul>
            <li style={listItem}>Sponsor: Irene, Marketing &amp; Communications</li>
            <li style={listItem}>Analyst: Summer Pandey, CS &amp; Data Science</li>
            <li style={listItem}>Ridge regression · walk-forward cross-validation</li>
          </ul>
        </div>
        <div>
          <h2>Data sources</h2>
          <ul>
            <li style={listItem}>Slate applications</li>
            <li style={listItem}>Carnegie spend &amp; impressions</li>
            <li style={listItem}>Billboards · email · direct mail</li>
          </ul>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div
          className="container-x"
          style={{
            padding: "16px 0",
            fontSize: 11.5,
            color: "rgba(255,255,255,0.5)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>© {new Date().getFullYear()} Augustana College · Rock Island, Illinois</span>
          <span>Internal tool — not for public distribution</span>
        </div>
      </div>
    </footer>
  )
}

/* ── AI chat widget ─────────────────────────────────────────── */
function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: "Hey — ask me anything about MMM or Augustana's marketing data.",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [msgs, typing])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput("")
    const history: ChatTurn[] = msgs.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }))
    setMsgs((m) => [...m, { role: "user", text }])
    setTyping(true)
    try {
      const reply = await sendChatMessage(text, history)
      setMsgs((m) => [...m, { role: "ai", text: reply }])
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: `Sorry, I couldn't reach the assistant just now (${err instanceof Error ? err.message : String(err)}).`,
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 no-print"
      role="region"
      aria-label="AI chat assistant"
    >
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Augie AI chat"
          className="card animate-scale-in"
          style={{ width: 310, height: 400, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}
        >
          {/* header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              background: T.navyDeep,
              borderBottom: `2px solid ${T.gold}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AugieMark size={20} boxed={false} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
                Augie AI
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 18,
                lineHeight: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* messages */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="scroll-thin"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: T.bg,
            }}
          >
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "84%",
                    padding: "9px 12px",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    background: m.role === "user" ? T.navy : T.surface,
                    color: m.role === "user" ? "#fff" : T.tp,
                    borderRadius: m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    border: m.role === "ai" ? `1px solid ${T.border}` : "none",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  aria-label="Augie AI is typing"
                  style={{
                    padding: "10px 14px",
                    background: T.surface,
                    borderRadius: "10px 10px 10px 2px",
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full animate-shimmer"
                      style={{ background: T.ts, animationDelay: `${j * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: T.surface,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <input
              ref={inputRef}
              aria-label="Chat message"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="field"
              style={{ minHeight: 38, fontSize: 13, padding: "6px 11px" }}
            />
            <button
              onClick={send}
              aria-label="Send message"
              disabled={!input.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: T.navy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                opacity: input.trim() ? 1 : 0.4,
                flexShrink: 0,
                transition: "opacity 0.1s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M2 6.5h9M8 3l3 3.5-3 3.5"
                  stroke={T.gold}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        aria-expanded={open}
        className="active:scale-95"
        style={{
          width: 46,
          height: 46,
          borderRadius: 8,
          background: T.navy,
          boxShadow: "0 6px 20px rgba(0,15,55,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s, transform 0.15s",
        }}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 17 17" fill="none">
            <path
              d="M1.5 4A2.5 2.5 0 014 1.5h9A2.5 2.5 0 0115.5 4v5.5A2.5 2.5 0 0113 12H9.5l-3 3v-3H4A2.5 2.5 0 011.5 9.5V4z"
              stroke={T.gold}
              strokeWidth="1.4"
              fill="none"
              strokeLinejoin="round"
            />
            <circle cx="5.5" cy="6.75" r="1" fill={T.gold} />
            <circle cx="8.5" cy="6.75" r="1" fill={T.gold} />
            <circle cx="11.5" cy="6.75" r="1" fill={T.gold} />
          </svg>
        )}
      </button>
    </div>
  )
}

/* ── Loading screen ─────────────────────────────────────────── */
function LoadingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="hero fixed inset-0 flex flex-col items-center justify-center"
      aria-label="Loading"
      role="status"
    >
      <div className="flex flex-col items-center gap-7 animate-fade-in">
        <AugieMark size={56} />
        <h1 className="display t-h1" style={{ color: "#fff", textAlign: "center" }}>
          Augie <em style={{ color: T.gold }}>Analysis</em>
        </h1>
        <div
          role="progressbar"
          aria-label="Loading"
          style={{ width: 160, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}
        >
          <div
            className="h-full animate-progress"
            style={{ background: T.gold, borderRadius: 1, animationDelay: "0.15s" }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Landing / login ────────────────────────────────────────── */
function LandingPage({
  onStart,
  onSignedIn,
}: {
  onStart: () => void
  onSignedIn: (token: string, email: string | null) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await apiLogin(email, password)
      onSignedIn(result.token, result.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const fieldOnDark: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.22)",
    color: "#fff",
  }

  if (showForm) {
    return (
      <div className="hero fixed inset-0 flex items-center justify-center px-6">
        <div className="on-dark animate-scale-in" style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <AugieMark size={44} />
            <p
              className="eyebrow eyebrow-rule"
              style={{ justifyContent: "center", color: "rgba(255,255,255,0.55)", marginTop: 20 }}
            >
              Augustana College
            </p>
            <h1 className="display t-h3" style={{ color: "#fff", marginTop: 8 }}>
              Sign in to <em style={{ color: T.gold }}>Augie Analysis</em>
            </h1>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label htmlFor="email" className="field-label" style={{ color: "rgba(255,255,255,0.68)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@augustana.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                style={fieldOnDark}
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label" style={{ color: "rgba(255,255,255,0.68)" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                style={fieldOnDark}
              />
            </div>
            {error && (
              <p role="alert" style={{ color: "#FFC4C4", fontSize: 13 }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn btn-gold btn-lg btn-block">
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={onStart}
              className="btn btn-ghost btn-block"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Continue without an account (demo data)
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="hero fixed inset-0 flex flex-col items-center justify-center text-center px-6" style={{ overflow: "hidden" }}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#FFDD00 1px,transparent 1px),linear-gradient(90deg,#FFDD00 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{ width: 460, height: 460, borderRadius: "50%", border: "1px solid rgba(255,221,0,0.08)" }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{ width: 260, height: 260, borderRadius: "50%", border: "1px solid rgba(255,221,0,0.14)" }}
      />

      <div className="relative animate-fade-in" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AugieMark size={76} />
        </div>
        <p
          className="eyebrow eyebrow-rule"
          style={{ justifyContent: "center", color: "rgba(255,255,255,0.58)", marginTop: 26 }}
        >
          Augustana College · Marketing &amp; Communications
        </p>
        <h1 className="display t-hero" style={{ color: "#fff", marginTop: 16 }}>
          Augie <em style={{ color: T.gold }}>Analysis</em>
        </h1>
        <p className="lead" style={{ color: "rgba(255,255,255,0.72)", marginTop: 18, maxWidth: 480, marginInline: "auto" }}>
          A Marketing Mix Model for Augustana's admissions marketing — how much each
          channel, from Meta to billboards, actually moves weekly applications.
        </p>

        <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowForm(true)} className="btn btn-gold btn-lg hover-lift">
            Login <span className="arrow">→</span>
          </button>
          <button onClick={onStart} className="btn btn-outline-light btn-lg">
            Explore the demo
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Options page ───────────────────────────────────────────── */
const OPTIONS = [
  {
    id: "mmm",
    label: "MMM",
    sub: "Media Mix Modeling",
    active: true,
    info: "Marketing Mix Modeling estimates how much each channel — Meta, Snapchat, Google, billboards, plus seasonality — actually contributes to applications, using historical spend and outcome data instead of click-level tracking. It outputs: per-channel contribution over time, model fit quality (R², cross-validated), which channels are over/under-invested, and where multicollinearity makes an estimate unreliable.",
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke={isH ? T.gold : T.navy} strokeWidth="1.3" fill="none" />
        <path d="M9 9V4" stroke={isH ? T.gold : T.navy} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M9 9l4 2.5" stroke={isH ? T.gold : T.navy} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="9" cy="9" r="1.5" fill={isH ? T.gold : T.navy} />
      </svg>
    ),
  },
  {
    id: "general",
    label: "General Analysis",
    sub: "Trends & anomalies",
    active: false,
    info: "",
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="11" width="3" height="5" rx="0.8" fill={isH ? T.gold : T.navy} />
        <rect x="7" y="7" width="3" height="9" rx="0.8" fill={isH ? T.gold : T.navy} />
        <rect x="12" y="3" width="3" height="13" rx="0.8" fill={isH ? T.gold : T.navy} />
      </svg>
    ),
  },
  {
    id: "deep",
    label: "Deep Dive",
    sub: "Cohort & funnel",
    active: false,
    info: "",
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="7.5" r="5" stroke={isH ? T.gold : T.navy} strokeWidth="1.3" fill="none" />
        <path d="M9 12.5v4" stroke={isH ? T.gold : T.navy} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="9" cy="7.5" r="2" fill={isH ? T.gold : T.navy} />
      </svg>
    ),
  },
]

function OptionsPage({ onSelect }: { onSelect: (id: string) => void }) {
  const [hov, setHov] = useState<string | null>(null)

  return (
    <div className="site bg-mesh">
      <SiteHeader variant="demo" />
      <main className="section" id="main-content">
        <div className="container-x" style={{ maxWidth: 920 }}>
          <div className="animate-fade-in" style={{ textAlign: "center", marginBottom: 44 }}>
            <p className="eyebrow eyebrow-rule" style={{ justifyContent: "center" }}>
              Choose an analysis
            </p>
            <h1 className="display t-h1" style={{ marginTop: 10 }}>
              What do you want to <em>understand</em>?
            </h1>
            <p className="lead" style={{ maxWidth: 540, marginInline: "auto", marginTop: 12 }}>
              Marketing Mix Modeling is live on Augustana's real data. The rest are on the
              roadmap as more history comes in from Anthony and Lucas.
            </p>
          </div>

          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
            role="list"
          >
            {OPTIONS.map((opt) => {
              const isH = hov === opt.id
              return (
                <div key={opt.id} style={{ position: "relative" }}>
                  <button
                    role="listitem"
                    className={`card text-left${opt.active ? " card-interactive" : ""}`}
                    style={{
                      padding: 22,
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      borderColor: isH && opt.active ? T.navy : undefined,
                      cursor: opt.active ? "pointer" : "default",
                      opacity: opt.active ? 1 : 0.55,
                      outline: "none",
                    }}
                    onMouseEnter={() => opt.active && setHov(opt.id)}
                    onMouseLeave={() => setHov(null)}
                    onFocus={() => opt.active && setHov(opt.id)}
                    onBlur={() => setHov(null)}
                    onClick={() => opt.active && onSelect(opt.id)}
                    aria-disabled={!opt.active}
                    tabIndex={opt.active ? 0 : -1}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 4,
                        background: isH ? T.navy : T.sand,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.2s ease",
                      }}
                    >
                      {opt.icon(isH)}
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: T.tp, marginBottom: 2 }}>{opt.label}</p>
                      <p style={{ fontSize: 12.5, color: T.ts }}>{opt.active ? opt.sub : "Coming soon"}</p>
                    </div>
                  </button>
                  {isH && opt.info && (
                    <div
                      role="tooltip"
                      className="card"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        padding: "14px 16px",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        color: T.ts,
                        boxShadow: "var(--shadow-lg)",
                        pointerEvents: "none",
                      }}
                    >
                      {opt.info}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── Profile overview ───────────────────────────────────────── */
function displayName(email: string | null): string {
  if (!email) return "there"
  const local = email.split("@")[0]
  if (/^irene\b/i.test(local)) return "Irene"
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function ProfileOverview({
  email,
  token,
  onEnterMMM,
  onSignOut,
}: {
  email: string | null
  token: string
  onEnterMMM: () => void
  onSignOut: () => void
}) {
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    runPipeline(token)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const name = displayName(email)

  // Rank spend channels by their standardized adstock coefficient — the
  // model's read on which channels move applications most, positively or
  // negatively, given everything else it's controlling for.
  const channelCoefs = result
    ? Object.entries(result.coefficients)
        .filter(([k]) => k.endsWith("_spend_adstock"))
        .map(([k, v]) => ({ channel: humanizeChannel(k.replace("_adstock", "")), coef: v }))
        .sort((a, b) => b.coef - a.coef)
    : []
  const topChannel = channelCoefs[0]
  const spendCoveragePct = result?.spend_coverage
    ? Math.round((result.spend_coverage.weeks_covered / result.spend_coverage.total_weeks) * 100)
    : null

  return (
    <div className="site bg-mesh">
      <SiteHeader variant="signedIn" name={name} onSignOut={onSignOut} />
      <main className="section" id="main-content" style={{ paddingTop: 52 }}>
        <div className="container-x animate-fade-in" style={{ maxWidth: 900 }}>
          <p className="eyebrow eyebrow-rule">Augustana College · Marketing &amp; Communications</p>
          <h1 className="display t-h1" style={{ marginTop: 10, marginBottom: 32 }}>
            Welcome back, <em style={{ color: T.goldDeep }}>{name}</em>
          </h1>

          {loading && (
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: T.ts }}>Loading the latest model run…</p>
            </div>
          )}

          {!loading && error && (
            <div className="card" style={{ padding: 20, borderColor: T.error }}>
              <p style={{ fontSize: 14, color: T.error, marginBottom: 14 }}>
                Couldn't load a live snapshot ({error}). You can still open the full analysis below.
              </p>
              <button onClick={onEnterMMM} className="btn btn-primary">
                Open MMM Analysis <span className="arrow">→</span>
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}
              >
                <div className="card" style={{ padding: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    Data on file
                  </p>
                  <p className="num" style={{ fontSize: 24, fontWeight: 700, color: T.navy }}>
                    {result.rows} weeks
                  </p>
                  <p style={{ fontSize: 12, color: T.ts, marginTop: 4 }}>
                    {result.date_range[0]} → {result.date_range[1]}
                  </p>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    Model fit
                  </p>
                  <p className="num" style={{ fontSize: 24, fontWeight: 700, color: T.navy }}>
                    R² {result.in_sample_metrics["R²"]?.toFixed(2)}
                  </p>
                  <p style={{ fontSize: 12, color: T.ts, marginTop: 4 }}>
                    Cross-val {result.cross_validation.mean_r2.toFixed(2)} out-of-sample
                  </p>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    Spend coverage
                  </p>
                  <p className="num" style={{ fontSize: 24, fontWeight: 700, color: T.navy }}>
                    {spendCoveragePct !== null ? `${spendCoveragePct}%` : "—"}
                  </p>
                  <p style={{ fontSize: 12, color: T.ts, marginTop: 4 }}>
                    {result.spend_channels.length} channels tracked
                  </p>
                </div>
              </div>

              {topChannel && (
                <div className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    What's driving applications right now
                  </p>
                  <p style={{ fontSize: 14, color: T.tp, lineHeight: 1.6 }}>
                    <strong>{topChannel.channel}</strong> has the strongest positive association with weekly
                    applications among tracked channels. Seasonality — especially the November deadline
                    spike — still explains most of the variance year over year.
                  </p>
                  {result.multicollinearity?.warning && (
                    <p className="alert alert-warning" style={{ marginTop: 12 }}>
                      <span aria-hidden>⚠</span>
                      <span>{result.multicollinearity.warning}</span>
                    </p>
                  )}
                </div>
              )}

              <button onClick={onEnterMMM} className="btn btn-gold btn-lg hover-lift">
                Open full MMM analysis <span className="arrow">→</span>
              </button>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── Root ───────────────────────────────────────────────────── */
export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState<Page>("landing")
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("mmm_auth_token")
    } catch {
      return null
    }
  })
  const [authEmail, setAuthEmail] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("mmm_auth_email")
    } catch {
      return null
    }
  })

  function handleSignedIn(token: string, email: string | null) {
    setAuthToken(token)
    setAuthEmail(email)
    try {
      sessionStorage.setItem("mmm_auth_token", token)
      if (email) sessionStorage.setItem("mmm_auth_email", email)
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — token still
      // works for this page load via component state.
    }
    setPage("profile")
  }

  function handleSignOut() {
    setAuthToken(null)
    setAuthEmail(null)
    try {
      sessionStorage.removeItem("mmm_auth_token")
      sessionStorage.removeItem("mmm_auth_email")
    } catch {
      // ignore
    }
    setPage("landing")
  }

  if (!loaded) return <LoadingScreen onDone={() => setLoaded(true)} />

  return (
    <>
      {/* skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {page === "landing" && <LandingPage onStart={() => setPage("options")} onSignedIn={handleSignedIn} />}
      {page === "options" && <OptionsPage onSelect={(id) => id === "mmm" && setPage("mmm")} />}
      {page === "profile" && authToken && (
        <ProfileOverview
          email={authEmail}
          token={authToken}
          onEnterMMM={() => setPage("mmm")}
          onSignOut={handleSignOut}
        />
      )}
      {page === "mmm" && (
        <div className="fixed inset-0 overflow-auto animate-fade-in" style={{ animationDuration: "0.35s" }}>
          <MMMWorkflow onBack={() => setPage(authToken ? "profile" : "options")} authToken={authToken} />
        </div>
      )}
      <ChatWidget />
    </>
  )
}
