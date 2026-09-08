import { useState, useEffect, useRef } from "react"
import { MMMWorkflow, T } from "./mmm"

/* ── types ─────────────────────────────────────────────────── */
type Page = "landing" | "options" | "mmm"
type ChatMsg = { role: "user" | "ai"; text: string }

/* ── AI chat widget ─────────────────────────────────────────── */
const AI_REPLIES: Record<string, string> = {
  default: "I'm here to help with your analysis. Ask me anything.",
  mmm: "MMM attributes conversions across media channels using Bayesian regression.",
  attribution:
    "Attribution assigns credit across touchpoints in the customer journey.",
  retention:
    "Retention dipped 3.1% — the July cohort overlap is worth investigating.",
  session:
    "Sessions peaked at 14:30, likely correlated with the 14:00 email send.",
  import:
    "Upload a CSV or Excel file with daily or weekly media spend and revenue data.",
  roi: "ROI curves show how marginal return changes as you increase or decrease spend per channel.",
}

function pickReply(t: string): string {
  const l = t.toLowerCase()
  if (l.includes("mmm") || l.includes("media mix")) return AI_REPLIES.mmm
  if (l.includes("attribution")) return AI_REPLIES.attribution
  if (l.includes("retention")) return AI_REPLIES.retention
  if (l.includes("session")) return AI_REPLIES.session
  if (l.includes("import") || l.includes("upload") || l.includes("csv"))
    return AI_REPLIES.import
  if (l.includes("roi") || l.includes("return")) return AI_REPLIES.roi
  return AI_REPLIES.default
}

function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: "Hey — ask me anything about your data or the workflow.",
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

  function send() {
    const text = input.trim()
    if (!text) return
    setInput("")
    setMsgs((m) => [...m, { role: "user", text }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { role: "ai", text: pickReply(text) }])
    }, 850)
  }

  const card: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    overflow: "hidden",
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3"
      role="region"
      aria-label="AI chat assistant"
    >
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Augie AI chat"
          style={{
            ...card,
            width: 300,
            height: 380,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
          className="animate-scale-in"
        >
          {/* header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: T.navy,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  background: T.gold,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 .5L6.2 3.3l3 .4-2.1 2 .5 3L5 7.2 2.4 8.7l.5-3L.8 3.7l3-.4z"
                    fill={T.navy}
                  />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
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
                    maxWidth: "82%",
                    padding: "8px 12px",
                    fontSize: 12,
                    lineHeight: 1.5,
                    background: m.role === "user" ? T.navy : T.surface,
                    color: m.role === "user" ? "#fff" : T.tp,
                    borderRadius:
                      m.role === "user"
                        ? "12px 12px 3px 12px"
                        : "12px 12px 12px 3px",
                    border: m.role === "ai" ? `1px solid ${T.border}` : "none",
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
                    borderRadius: "12px 12px 12px 3px",
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
                      style={{
                        background: T.ts,
                        animationDelay: `${j * 0.15}s`,
                      }}
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
              style={{
                flex: 1,
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.tp,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              aria-label="Send message"
              disabled={!input.trim()}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
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
          width: 44,
          height: 44,
          borderRadius: 12,
          background: T.navy,
          boxShadow: "0 4px 14px rgba(0,47,108,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke={T.gold}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
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
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: T.navy }}
      aria-label="Loading"
      role="status"
    >
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: T.gold,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(255,221,0,0.28)",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <rect x="3" y="15" width="4" height="8" rx="1" fill={T.navy} />
            <rect x="9" y="9" width="4" height="14" rx="1" fill={T.navy} />
            <rect x="15" y="5" width="4" height="18" rx="1" fill={T.navy} />
            <rect x="21" y="12" width="4" height="11" rx="1" fill={T.navy} />
          </svg>
        </div>
        <h1
          style={{
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: 44,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          Augie
          <br />
          <span style={{ color: T.gold }}>Analysis</span>
        </h1>
        <div
          role="progressbar"
          aria-label="Loading"
          style={{
            width: 160,
            height: 2,
            borderRadius: 1,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            className="h-full animate-progress"
            style={{
              background: T.gold,
              borderRadius: 1,
              animationDelay: "0.2s",
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Landing / login ────────────────────────────────────────── */
function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-10"
      style={{ background: T.navy, overflow: "hidden" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(#FFDD00 1px,transparent 1px),linear-gradient(90deg,#FFDD00 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: "1px solid rgba(255,221,0,0.08)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: "1px solid rgba(255,221,0,0.13)",
          pointerEvents: "none",
        }}
      />

      <div className="relative flex flex-col items-center gap-8 animate-fade-in">
        <div
          aria-hidden
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: T.gold,
            boxShadow: "0 8px 32px rgba(255,221,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="21" width="5" height="11" rx="1.5" fill={T.navy} />
            <rect x="12" y="14" width="5" height="18" rx="1.5" fill={T.navy} />
            <rect x="20" y="7" width="5" height="25" rx="1.5" fill={T.navy} />
            <rect x="28" y="16" width="5" height="16" rx="1.5" fill={T.navy} />
            <path
              d="M6.5 17L14.5 11L22.5 14L30.5 6"
              stroke={T.navy}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          style={{
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: 52,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          Augie
          <br />
          <span style={{ color: T.gold }}>Analysis</span>
        </h1>

        <button
          onClick={onStart}
          className="hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 28px",
            borderRadius: 10,
            background: T.gold,
            color: T.navy,
            fontSize: 15,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(255,221,0,0.35)",
          }}
        >
          Login
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M2.5 7.5h10M9 4l3.5 3.5L9 11"
              stroke={T.navy}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle
          cx="9"
          cy="9"
          r="7"
          stroke={isH ? T.gold : T.navy}
          strokeWidth="1.3"
          fill="none"
        />
        <path
          d="M9 9V4"
          stroke={isH ? T.gold : T.navy}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M9 9l4 2.5"
          stroke={isH ? T.gold : T.navy}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="9" cy="9" r="1.5" fill={isH ? T.gold : T.navy} />
      </svg>
    ),
  },
  {
    id: "general",
    label: "General Analysis",
    sub: "Trends & anomalies",
    active: false,
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect
          x="2"
          y="11"
          width="3"
          height="5"
          rx="0.8"
          fill={isH ? T.gold : T.navy}
        />
        <rect
          x="7"
          y="7"
          width="3"
          height="9"
          rx="0.8"
          fill={isH ? T.gold : T.navy}
        />
        <rect
          x="12"
          y="3"
          width="3"
          height="13"
          rx="0.8"
          fill={isH ? T.gold : T.navy}
        />
      </svg>
    ),
  },
  {
    id: "deep",
    label: "Deep Dive",
    sub: "Cohort & funnel",
    active: false,
    icon: (isH: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle
          cx="9"
          cy="7.5"
          r="5"
          stroke={isH ? T.gold : T.navy}
          strokeWidth="1.3"
          fill="none"
        />
        <path
          d="M9 12.5v4"
          stroke={isH ? T.gold : T.navy}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7.5" r="2" fill={isH ? T.gold : T.navy} />
      </svg>
    ),
  },
]

function OptionsPage({ onSelect }: { onSelect: (id: string) => void }) {
  const [hov, setHov] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: T.bg }}>
      <header
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: T.navy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="8" width="2.5" height="5" rx="0.5" fill={T.gold} />
            <rect x="5" y="5" width="2.5" height="8" rx="0.5" fill={T.gold} />
            <rect x="9" y="2" width="2.5" height="11" rx="0.5" fill={T.gold} />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.tp }}>
          Augie Analysis
        </span>
      </header>

      <div
        className="flex-1 flex flex-col items-center justify-center px-8 gap-8 animate-fade-in"
        role="main"
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.ts,
          }}
        >
          Choose analysis
        </p>

        <div
          className="grid gap-3 w-full"
          style={{
            maxWidth: 560,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
          role="list"
        >
          {OPTIONS.map((opt) => {
            const isH = hov === opt.id
            return (
              <button
                key={opt.id}
                role="listitem"
                className="text-left flex flex-col gap-3 p-5 transition-all duration-150"
                style={{
                  background: T.surface,
                  border: `1.5px solid ${
                    isH && opt.active ? T.navy : T.border
                  }`,
                  borderRadius: 10,
                  boxShadow:
                    isH && opt.active
                      ? "0 4px 16px rgba(0,47,108,0.12)"
                      : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: isH && opt.active ? "translateY(-2px)" : "none",
                  cursor: opt.active ? "pointer" : "default",
                  opacity: opt.active ? 1 : 0.45,
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
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isH ? T.navy : "#EEF2F8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {opt.icon(isH)}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: T.tp,
                      marginBottom: 2,
                    }}
                  >
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 12, color: T.ts }}>
                    {opt.active ? opt.sub : "Coming soon"}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Root ───────────────────────────────────────────────────── */
export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState<Page>("landing")

  if (!loaded) return <LoadingScreen onDone={() => setLoaded(true)} />

  return (
    <>
      {/* skip link for keyboard users */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          top: -40,
          left: 0,
          background: T.navy,
          color: "#fff",
          padding: "8px 16px",
          zIndex: 9999,
          fontSize: 13,
          fontWeight: 600,
          transition: "top 0.1s",
          borderRadius: "0 0 6px 0",
        }}
        onFocus={(e) => (e.currentTarget.style.top = "0")}
        onBlur={(e) => (e.currentTarget.style.top = "-40px")}
      >
        Skip to main content
      </a>

      {page === "landing" && <LandingPage onStart={() => setPage("options")} />}
      {page === "options" && (
        <OptionsPage onSelect={(id) => id === "mmm" && setPage("mmm")} />
      )}
      {page === "mmm" && (
        <div
          className="fixed inset-0 overflow-auto animate-fade-in"
          style={{ animationDuration: "0.35s" }}
        >
          <MMMWorkflow onBack={() => setPage("options")} />
        </div>
      )}
      <ChatWidget />
    </>
  )
}
