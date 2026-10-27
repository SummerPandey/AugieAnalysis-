import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { SiteFooter, SiteHeader } from "../chrome"
import { IconArrowRight } from "../icons"
import { ExplainerVideo } from "./ExplainerVideo"
import { WhatIsSection } from "./sections/WhatIs"
import { ProcessSection } from "./sections/Process"
import { UnderTheHoodSection } from "./sections/UnderTheHood"
import { WhatItShowsSection } from "./sections/WhatItShows"
import { ReadingSection } from "./sections/Reading"
import { FaqSection } from "./sections/Faq"
import { Term } from "../glossary"
import "./learn.css"

const TOC = [
  { id: "what-is", label: "What this tool is" },
  { id: "process", label: "How it is built" },
  { id: "under-the-hood", label: "The ideas behind it" },
  { id: "what-it-shows", label: "What the results page shows" },
  { id: "reading", label: "How to read and use it" },
  { id: "faq", label: "Questions and glossary" },
] as const

type SectionId = (typeof TOC)[number]["id"]

// Sections plus the cards and steps that rise in on scroll.
const REVEAL_SELECTOR = [
  ".lp-section",
  ".lp-process-card",
  ".lp-under-the-hood-card",
  ".lp-what-it-shows-card",
  ".lp-what-is-compare-card",
  ".lp-reading-step",
  ".lp-faq-term",
].join(", ")

function scrollToSection(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}

export default function LearnPage({
  onBack,
  onDemo,
  onSignIn,
  backLabel,
}: {
  onBack: () => void
  onDemo: () => void
  onSignIn?: () => void
  backLabel: string
}) {
  const [active, setActive] = useState<SectionId>(TOC[0].id)
  const pageRef = useRef<HTMLElement>(null)
  const tocRef = useRef<HTMLUListElement>(null)

  // Scroll reveal. Content stays visible unless the page gets the
  // lp-reveal-ready class, which is only added once the observer exists.
  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || typeof IntersectionObserver === "undefined") return
    const targets = Array.from(page.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))
    if (targets.length === 0) return

    // Stagger cards that share a parent (one row or grid). Sections do not stagger.
    const counts = new Map<Element, number>()
    for (const el of targets) {
      el.classList.add("lp-reveal")
      const parent = el.parentElement
      if (!el.classList.contains("lp-section") && parent) {
        const index = counts.get(parent) ?? 0
        counts.set(parent, index + 1)
        el.style.setProperty("--lp-delay", `${Math.min(index, 4) * 90}ms`)
      }
    }
    page.classList.add("lp-reveal-ready")

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0 },
    )
    targets.forEach((el) => observer.observe(el))

    // The observer only fires when a block crosses into view. Jumping past
    // one (a menu link, End key, find-in-page, restored scroll) would leave it
    // hidden for good, so also reveal everything at or above the viewport.
    // ~30 blocks: cheap enough to check on every scroll event directly.
    const revealPassed = () => {
      const bottom = window.innerHeight
      for (const el of targets) {
        if (!el.classList.contains("is-visible") && el.getBoundingClientRect().top < bottom) {
          el.classList.add("is-visible")
          observer.unobserve(el)
        }
      }
    }
    window.addEventListener("scroll", revealPassed, { passive: true })
    window.addEventListener("resize", revealPassed)
    revealPassed()

    return () => {
      window.removeEventListener("scroll", revealPassed)
      window.removeEventListener("resize", revealPassed)
      observer.disconnect()
      page.classList.remove("lp-reveal-ready")
      targets.forEach((el) => {
        el.classList.remove("lp-reveal", "is-visible")
        el.style.removeProperty("--lp-delay")
      })
    }
  }, [])

  // Position the sliding "On this page" marker under the active item.
  useLayoutEffect(() => {
    const list = tocRef.current
    if (!list) return
    const place = () => {
      const current = list.querySelector<HTMLElement>('[aria-current="true"]')
      if (!current) return
      // Measured against the list itself, so it's right in either layout
      // (offsetTop depends on which ancestor happens to be positioned).
      const y = current.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop
      list.style.setProperty("--lp-toc-y", `${y}px`)
      list.style.setProperty("--lp-toc-h", `${current.offsetHeight}px`)
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [active])

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const elements = TOC.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (elements.length === 0) return

    // A section counts as active while it crosses the upper band of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActive(visible[0].target.id as SectionId)
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <SiteHeader
        variant="guide"
        onBack={onBack}
        backLabel={backLabel}
        onSignIn={onSignIn}
        crumb="How it works"
      />

      <main id="main-content" className="lp" ref={pageRef}>
        <header className="lp-hero">
          <div className="lp-hero-inner">
            <p className="eyebrow eyebrow-rule">How it works</p>
            <h1
              className="display t-h1 lp-title"
              tabIndex={-1}
              data-page-title
            >
              How Augie Analysis <em>works</em>
            </h1>
            <p className="lp-lead">
              A plain-language tour, no statistics needed. It covers what the tool
              does, what it found, and how much to trust it.
            </p>
            <div className="lp-short" role="note">
              <p className="lp-short-title">The short version</p>
              <ol className="lp-short-list">
                <li>
                  This tool checks whether marketing data helps predict weekly applications,
                  beyond what the admissions <Term id="calendar-only">calendar-only</Term> forecast
                  already predicts.
                </li>
                <li>
                  So far it does not. We cannot say what any channel does, so every channel reads{" "}
                  <strong>Can't tell yet</strong>.
                </li>
                <li>
                  You can use the calendar pattern for planning now. The next step is a small,
                  planned spend test.
                </li>
              </ol>
              <p className="lp-short-skip">
                Only need the takeaway? Skip sections 02 and 03 and go to 04 and 05.
              </p>
            </div>
          </div>
        </header>

        <div className="lp-video-wrap" data-guide="learn-explainer">
          <ExplainerVideo onDemo={onDemo} />
        </div>

        <div className="lp-body">
          <nav className="lp-toc" aria-label="On this page">
            <p className="lp-toc-label">On this page</p>
            <ul role="list" className="lp-toc-list" ref={tocRef}>
              {TOC.map((item, index) => {
                const isActive = active === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="lp-toc-link"
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => {
                        setActive(item.id)
                        scrollToSection(item.id)
                      }}
                    >
                      <span className="lp-toc-num" aria-hidden>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="lp-toc-text">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="lp-content">
            <WhatIsSection />
            <ProcessSection />
            <UnderTheHoodSection />
            <WhatItShowsSection />
            <ReadingSection />
            <FaqSection />
          </div>
        </div>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-inner">
            <span className="lp-cta-rule" aria-hidden />
            <h2 id="lp-cta-title" className="display lp-cta-title">
              See it on a sample run
            </h2>
            <p className="lp-cta-text">
              Try it with made-up numbers. The demo shows the same charts and labels as the real
              results, using practice data shaped like ours, so nothing you see is a real finding.
              Pick the sample data, press run, then read the results with what you just learned.
            </p>
            <button type="button" className="btn btn-gold btn-lg" onClick={onDemo}>
              Try the demo
              <IconArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
