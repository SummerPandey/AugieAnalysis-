/**
 * "Guide me": a small tour for people who are new to the tool.
 * A pill on the home page starts it. While it runs, a compact card stays on
 * screen across pages, highlights the part of the page being described, and
 * can click through the demo for you. Steps are plain data (see STEPS).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import "./guide.css"

type StepAction = {
  label: string
  /** go to this hash route */
  goto?: string
  /** click the element with this data-guide id */
  click?: string
  /** how many times to click it (the page re-renders between clicks) */
  times?: number
  /** skip the click when the target's text matches (so a tour click never starts a run by mistake) */
  skipIfText?: RegExp
}

type Step = {
  route: string
  target?: string
  title: string
  body: string
  /** shown instead of `body` when the target isn't on screen */
  missing?: string
  action?: StepAction
}

const STEPS: Step[] = [
  {
    route: "#/",
    target: "home-title",
    title: "What this tool is",
    body: "Augie Analysis looks at Augustana's weekly applications and asks one question: does digital marketing add anything that the admissions calendar does not already explain?",
  },
  {
    route: "#/",
    target: "home-finding",
    title: "The latest finding",
    body: "So far, the calendar predicts applications better than marketing data does, so no channel's effect is established yet. Read the full finding on this page, and please don't cut or add to any channel because of it.",
  },
  {
    route: "#/",
    target: "home-ctas",
    title: "Try it without signing in",
    body: "The demo uses made-up sample data, so anyone can look around. Nothing you do there changes real data.",
    action: { label: "Open the demo", goto: "#/demo" },
  },
  {
    route: "#/demo",
    target: "options-open",
    title: "Pick the sample analysis",
    body: "This card opens the sample workflow. It shows how a real run goes, from picking data to reading the answer.",
    missing: "On this page, choose the sample analysis card to open the workflow.",
    action: { label: "Open it for me", click: "options-open" },
  },
  {
    route: "#/demo/mmm",
    target: "wf-stepper",
    title: "Four steps, left to right",
    body: "Data (what the model learns from), Settings (optional: how cautious it is), Run, and What it found. You can click a finished step to go back to it.",
  },
  {
    route: "#/demo/mmm",
    target: "step-next",
    title: "Data and settings",
    body: "The starting choices are fine for a first look. Press \"Next: settings (optional)\", then \"Next: review and run\", or let the guide do it.",
    missing: "Press \"Next: settings (optional)\", then \"Next: review and run\". The starting choices are fine.",
    action: { label: "Press both Next buttons for me", click: "step-next", times: 2, skipIfText: /^\s*run/i },
  },
  {
    route: "#/demo/mmm",
    target: "step-next",
    title: "Run the sample",
    body: "This runs the model on sample data. It takes a couple of seconds. The results appear on their own afterwards.",
    missing: "Go back to the Run step and press \"Run the sample\".",
    action: { label: "Run the sample", click: "step-next" },
  },
  {
    route: "#/demo/mmm",
    target: "results-finding",
    title: "Reading the verdict",
    body: "Each channel gets a label. \"Can't tell yet\" means the data cannot say whether it adds applications. \"Positive association\" means it moved with applications, which is not proof it caused them. The How it works page explains the other labels.",
    missing: "Once the sample run finishes, the headline finding and the channel labels appear here.",
  },
  {
    route: "#/demo/mmm",
    target: "results-view-switch",
    title: "Prefer plain words?",
    body: "Choose \"Plain English\" for the same results with no statistics. \"Full detail\" shows every chart and caveat.",
    missing: "After the sample run, a \"Reading level\" switch here lets you choose \"Plain English\" or \"Full detail\".",
    action: { label: "Show Plain English", click: "view-easy" },
  },
  {
    route: "#/demo",
    target: "data-status",
    title: "What data is missing",
    body: "This shows which data the model has and which it still needs. Spend is on file for only some weeks, so estimates stay uncertain until the rest arrives.",
    missing: "On this page, the data section shows what the model has today and what is still missing.",
  },
  {
    route: "#/demo",
    target: "chat-button",
    title: "Ask in your own words",
    body: "Augie AI answers questions about the model and the sample results. Ask something like \"What does Can't tell yet mean?\" It can be wrong, so check anything important.",
  },
  {
    route: "#/how-it-works",
    target: "learn-explainer",
    title: "The 30-second explainer",
    body: "The How it works page explains the idea in plain language, with a short video and a glossary. That is the end of the tour. You can restart it from the home page.",
    missing: "The How it works page explains the idea in plain language, with a short explainer and a glossary.",
  },
]

const KEY = "augie_guide_step"
const norm = (h: string) => (h === "" || h === "#" ? "#/" : h)
const reduced = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
const load = (): number | null => {
  try {
    const v = sessionStorage.getItem(KEY)
    if (v === null) return null
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : null
  } catch {
    return null
  }
}
const save = (n: number | null) => {
  try {
    if (n === null) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, String(n))
  } catch {
    /* storage can be blocked */
  }
}
const find = (id: string) => document.querySelector<HTMLElement>(`[data-guide="${id}"]`)

function IconCompass({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z" />
    </svg>
  )
}

type Seen = { rect: DOMRect | null; actionReady: boolean }

export function Guide({ onLanding }: { onLanding: boolean }) {
  const [idx, setIdx] = useState<number | null>(load)
  const [seen, setSeen] = useState<Seen>({ rect: null, actionReady: false })
  const [waited, setWaited] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const scrolledFor = useRef<HTMLElement | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  const set = useCallback((n: number | null) => {
    save(n)
    setIdx(n)
  }, [])
  const close = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    set(null)
    // give focus back to where the visitor was, or the page content
    const back = returnTo.current
    returnTo.current = null
    window.setTimeout(() => {
      const target = back && back.isConnected ? back : document.getElementById("main-content") ?? document.querySelector<HTMLElement>("[data-page-title]")
      if (target && (document.activeElement === document.body || !document.activeElement)) {
        if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute("tabindex", "-1")
        target.focus({ preventScroll: true })
      }
    }, 50)
  }, [set])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const step = idx === null ? null : STEPS[idx]

  // go to the step's page, move focus to the card
  useEffect(() => {
    if (idx === null) return
    const s = STEPS[idx]
    if (norm(location.hash) !== s.route) location.hash = s.route
    scrolledFor.current = null
    setSeen({ rect: null, actionReady: false })
    setWaited(false)
    const w = window.setTimeout(() => setWaited(true), 1800)
    const f = window.setTimeout(() => cardRef.current?.focus({ preventScroll: true }), 30)
    // the new page may move focus to its own title a little later; take it back unless the visitor went elsewhere
    const f2 = window.setTimeout(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || a === document.body || a.hasAttribute("data-page-title") || a.hasAttribute("data-step-title")) {
        cardRef.current?.focus({ preventScroll: true })
      }
    }, 700)
    return () => {
      clearTimeout(w)
      clearTimeout(f)
      clearTimeout(f2)
    }
  }, [idx])

  // keep looking for the target (pages mount late) and follow it as it moves
  useEffect(() => {
    if (idx === null) return
    const s = STEPS[idx]
    const update = () => {
      const el = s.target ? find(s.target) : null
      const hidden = el && el.getClientRects().length === 0
      if (el && !hidden) {
        if (scrolledFor.current !== el) {
          scrolledFor.current = el
          // tall targets go to the top so the card has room underneath
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.35
          el.scrollIntoView({ block: window.innerWidth < 640 || tall ? "start" : "center", behavior: reduced() ? "auto" : "smooth" })
        }
        const r = el.getBoundingClientRect()
        setSeen((p) => {
          const o = p.rect
          const same = o && Math.abs(o.top - r.top) < 1 && Math.abs(o.left - r.left) < 1 && Math.abs(o.width - r.width) < 1 && Math.abs(o.height - r.height) < 1
          const ready = s.action?.click ? !!find(s.action.click) : true
          return same && p.actionReady === ready ? p : { rect: r, actionReady: ready }
        })
      } else {
        scrolledFor.current = null
        setSeen((p) => {
          const ready = s.action?.click ? !!find(s.action.click) : true
          return !p.rect && p.actionReady === ready ? p : { rect: null, actionReady: ready }
        })
      }
    }
    update()
    const t = window.setInterval(update, 250)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      clearInterval(t)
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [idx])

  // Escape closes (unless the chat is where it was pressed)
  useEffect(() => {
    if (idx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if ((e.target as HTMLElement | null)?.closest?.(".chat")) return
      close()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [idx, close])

  function next() {
    if (idx === null) return
    if (idx >= STEPS.length - 1) close()
    else set(idx + 1)
  }
  function back() {
    if (idx !== null && idx > 0) set(idx - 1)
  }
  function runAction(a: StepAction) {
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
    if (a.goto) {
      location.hash = a.goto
      later(next, 450)
      return
    }
    if (a.click) {
      const total = a.times ?? 1
      let done = 0
      const tick = () => {
        const el = find(a.click!)
        if (el && !(a.skipIfText && a.skipIfText.test(el.textContent ?? ""))) el.click()
        done += 1
        later(done < total ? tick : next, done < total ? 450 : 500)
      }
      tick()
    }
  }

  if (idx === null || !step) {
    if (!onLanding) return null
    return (
      <button type="button" className="guide-pill no-print" onClick={(e) => {
          returnTo.current = e.currentTarget
          set(0)
        }}>
        <IconCompass /> Guide me
      </button>
    )
  }

  const rect = seen.rect
  // beside the target when there's room for the card, otherwise above or below it, whichever has more space
  const CARD_W = 392
  const pos = !rect
    ? "is-center"
    : window.innerWidth >= 640 && rect.left >= CARD_W
      ? "is-bottom"
      : window.innerWidth >= 640 && window.innerWidth - rect.right >= CARD_W
        ? "is-top is-right"
        : rect.top > window.innerHeight - rect.bottom
          ? "is-top"
          : "is-bottom"
  const showMissing = !rect && waited && step.missing
  const pad = 6
  const a = step.action
  const canAct = a && (a.goto || (a.click && seen.actionReady))

  return (
    <>
      {rect && (
        <div
          className="guide-ring"
          aria-hidden="true"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div ref={cardRef} role="dialog" aria-modal="false" aria-label="Site guide" tabIndex={-1} className={`guide-card no-print ${pos}`}>
        <div className="guide-head">
          <p className="guide-count">
            <IconCompass size={15} /> Step {idx + 1} of {STEPS.length}
          </p>
          <button type="button" className="guide-close" onClick={close} aria-label="Close guide">
            Close
          </button>
        </div>
        <h2 className="guide-title">{step.title}</h2>
        <p className="guide-body" aria-live="polite">
          {showMissing ? step.missing : step.body}
        </p>
        {canAct && (
          <button type="button" className="guide-act" onClick={() => runAction(a!)}>
            {a!.label}
          </button>
        )}
        <div className="guide-nav">
          <button type="button" className="guide-btn" onClick={back} disabled={idx === 0}>
            Back
          </button>
          <button type="button" className="guide-btn guide-btn-main" onClick={next}>
            {idx === STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  )
}

export default Guide
