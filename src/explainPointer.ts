/**
 * "Explain this" pointer: DOM helpers that find the part of the page a visitor
 * clicked and describe it for Augie AI. Pure functions, no React.
 */

/** Things that count as one explainable part of a page, matched nearest-first. */
const TARGET_SELECTOR = '[data-explain], .kpi, .card, figure, table, tr, li, section, svg[role="img"], .recharts-wrapper'
/** Never explain the chat itself or the pointer's own hint bar. */
const EXCLUDED_SELECTOR = ".chat, .explain-hint"
const ROOT_SELECTOR = "html, body, #root"
const MIN_TEXT = 20
const MAX_CONTENT = 2500
const MAX_PAGE_CONTEXT = 4000

export const EXPLAIN_PROMPT = "Explain this part of the page in plain language."

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

/** True when the element is the chat, the hint bar, or the page root. */
export function isExcluded(el: Element): boolean {
  return !!el.closest(EXCLUDED_SELECTOR)
}

/** The explainable part under a pointer or click, or null when there is nothing to explain. */
export function pickTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element) || isExcluded(node)) return null
  const hit = node.closest(TARGET_SELECTOR)
  if (hit && !hit.matches(ROOT_SELECTOR)) return hit
  if (!node.matches(ROOT_SELECTOR) && clean(node.textContent).length >= MIN_TEXT) return node
  return null
}

/** Plain-language kind of element, matching the kinds the backend prompt expects. */
export function elementKind(el: Element): string {
  if (el.matches(".kpi")) return "KPI tile"
  if (el.matches("table")) return "table"
  if (el.matches("tr")) return "table row"
  if (el.matches('figure, svg[role="img"], .recharts-wrapper')) return "chart"
  if (el.matches(".card")) return "card"
  if (el.matches("section")) return "section"
  return "text"
}

/** Whether a form around (or inside) the element holds a password field. */
function touchesPasswordForm(el: Element): boolean {
  const hasPassword = (f: Element) => !!f.querySelector('input[type="password"]')
  const form = el.closest("form")
  if (form && hasPassword(form)) return true
  return Array.from(el.querySelectorAll("form")).some(hasPassword)
}

/** The heading the element sits under: its own heading if it is a section, else the nearest one before it. */
export function nearestSection(el: Element): string {
  if (el.matches("section, .card, figure")) {
    const own = el.querySelector("h1, h2, h3")
    if (own) return clean(own.textContent).slice(0, 120)
  }
  let found: Element | null = null
  for (const h of Array.from(document.querySelectorAll("h1, h2, h3"))) {
    if (h.closest(EXCLUDED_SELECTOR) || h.contains(el)) continue
    if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = h
  }
  return found ? clean(found.textContent).slice(0, 120) : ""
}

/**
 * The element's visible text, plus any aria-label or caption that describes it
 * (charts usually carry one). Input, textarea and select values are dropped.
 * Returns null when the element sits in or holds a form with a password field.
 */
function describeContent(el: Element): string | null {
  if (touchesPasswordForm(el)) return null

  const labels: string[] = []
  const own = el.getAttribute("aria-label")
  if (own) labels.push(clean(own))
  el.querySelectorAll(":not(input):not(textarea):not(select)").forEach((n) => {
    if (n.tagName === "FIGCAPTION" || n.tagName === "CAPTION") labels.push(clean(n.textContent))
    else if (n.getAttribute("aria-label")) labels.push(clean(n.getAttribute("aria-label")))
  })

  // innerText keeps the visual breaks between parts ("0.25" and "Calendar
  // alone" stay separate words). It never includes what's typed into an
  // input; textarea/select text could slip in, so those take the clone path.
  let text: string
  if (el instanceof HTMLElement && !el.querySelector("textarea, select")) {
    text = clean(el.innerText.replace(/\n+/g, " · "))
  } else {
    const copy = el.cloneNode(true) as Element
    copy.querySelectorAll("script, style, noscript, input, textarea, select").forEach((n) => n.remove())
    text = clean(copy.textContent)
  }

  const uniqueLabels = Array.from(new Set(labels.filter(Boolean)))
  return [uniqueLabels.length ? `Label: ${uniqueLabels.join(" | ")}` : "", text].filter(Boolean).join("\n")
}

/**
 * The page_context string the chat API expects, plus a short label for the
 * user's bubble. Returns null when the part of the page must not be sent.
 */
export function buildPageContext(pageName: string, el: Element): { context: string; label: string } | null {
  const content = describeContent(el)
  if (content === null) return null
  const section = nearestSection(el)
  const kind = elementKind(el)
  const context = [`Page: ${pageName}`, `Section: ${section}`, `Element: ${kind}`, "Content:", content.slice(0, MAX_CONTENT)]
    .join("\n")
    .slice(0, MAX_PAGE_CONTEXT)
  // name the thing itself (e.g. "Fit on unseen weeks"), not the page heading above it
  const ownText = content.replace(/^Label: [^\n]*\n?/, "").trim()
  const label = (ownText || section || kind).slice(0, 60) + (ownText.length > 60 ? "…" : "")
  return { context, label }
}
