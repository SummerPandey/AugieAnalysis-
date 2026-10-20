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
import "./learn.css"

const TOC = [
  { id: "what-is", label: "What an MMM is" },
  { id: "process", label: "How we build it" },
  { id: "under-the-hood", label: "Under the hood" },
  { id: "what-it-shows", label: "What it shows" },
  { id: "reading", label: "Reading the results" },
  { id: "faq", label: "Questions & glossary" },
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
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
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
        variant="demo"
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
              A plain-language tour of how we turn marketing spend and application
              data into a model you can read, from the first spreadsheet to the
              final chart.
            </p>
          </div>
        </header>

        <div className="lp-video-wrap">
          <ExplainerVideo />
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
              The demo runs this whole method on a synthetic sample shaped like
              Augustana's data, with the same charts and verdicts the team sees.
            </p>
            <button type="button" className="btn btn-gold btn-lg" onClick={onDemo}>
              Explore the demo
              <IconArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
