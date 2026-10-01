/**
 * Project checklist — what's done, what's next, and who owns it.
 *
 * Items come from CHECKLIST in ./projectStatus (update that file, not this
 * one). Each viewer's ticks persist in their own browser under
 * "augie_checklist_v1"; every storage call is guarded, and the component
 * works (unsaved, with a notice) when storage is blocked or unavailable.
 *
 * Pattern notes: grouped task lists with a short heading per group and the
 * status stated in words (GOV.UK task list); an "X of Y complete" summary
 * with a bar; one clear owner per item.
 */
import { useEffect, useId, useState, useSyncExternalStore } from "react"
import {
  CHECKLIST,
  STATUS_AS_OF,
  formatStatusDate,
  type ChecklistItem,
  type ChecklistPhase,
} from "./projectStatus"
import {
  IconArrowRight,
  IconCheck,
  IconChevron,
  IconClock,
  IconRefresh,
  IconWarning,
} from "./icons"
import "./checklist.css"

export interface ProjectChecklistProps {
  /** Compact = open work only (Phase 1 + Phase 2), for sidebars/overview. */
  variant?: "full" | "compact"
  /** Heading level of the component title; groups sit one level below. */
  headingLevel?: 2 | 3
}

/* ── per-viewer state (localStorage, always guarded) ─────────── */
const STORAGE_KEY = "augie_checklist_v1"

/** Only the items a viewer has flipped away from `defaultDone` are stored, so
 *  items they never touched keep following projectStatus.ts. */
type Overrides = Record<string, boolean>

interface Snapshot {
  overrides: Overrides
  /** False once storage has thrown — ticks then live in memory only. */
  persisted: boolean
}

const DEFAULT_DONE = new Map(CHECKLIST.map((i) => [i.id, i.defaultDone]))

function parseOverrides(raw: string | null): Overrides {
  const out: Overrides = {}
  if (!raw) return out
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [id, value] of Object.entries(parsed)) {
        if (typeof value === "boolean" && DEFAULT_DONE.has(id) && value !== DEFAULT_DONE.get(id)) {
          out[id] = value
        }
      }
    }
  } catch {
    // corrupt value — fall back to defaults
  }
  return out
}

function readStored(): Snapshot {
  try {
    return { overrides: parseOverrides(window.localStorage.getItem(STORAGE_KEY)), persisted: true }
  } catch {
    return { overrides: {}, persisted: false }
  }
}

let snapshot: Snapshot | null = null
const listeners = new Set<() => void>()

function getSnapshot(): Snapshot {
  if (snapshot === null) snapshot = readStored()
  return snapshot
}

function commit(overrides: Overrides) {
  let persisted = true
  try {
    if (Object.keys(overrides).length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    persisted = false
  }
  snapshot = { overrides, persisted }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // another tab changed the ticks
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return
    snapshot = readStored()
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function setItemDone(item: ChecklistItem, done: boolean) {
  const next = { ...getSnapshot().overrides }
  if (done === item.defaultDone) delete next[item.id]
  else next[item.id] = done
  commit(next)
}

/* ── vocabulary ─────────────────────────────────────────────── */
const PHASES: { id: ChecklistPhase; heading: string; caption: string }[] = [
  { id: "now", heading: "Now · Phase 1", caption: "Immediate priorities" },
  { id: "later", heading: "Later · Phase 2", caption: "Once the Phase 1 data is in" },
  { id: "done", heading: "Done", caption: "Already in place" },
]

const OWNER_ORDER = ["Irene", "Anthony", "Lucas", "Summer"]
const rankOwner = (o: string) => {
  const i = OWNER_ORDER.indexOf(o)
  return i === -1 ? OWNER_ORDER.length : i
}
/** Owners as they appear in CHECKLIST, in the team's usual order. */
const OWNERS = Array.from(new Set(CHECKLIST.map((i) => i.owner))).sort((a, b) => rankOwner(a) - rankOwner(b))

function PhaseIcon({ phase, size = 14 }: { phase: ChecklistPhase; size?: number }) {
  if (phase === "done") return <IconCheck size={size} />
  if (phase === "now") return <IconArrowRight size={size} />
  return <IconClock size={size} />
}

/* ── one row ────────────────────────────────────────────────── */
function ChecklistRow({
  item,
  id,
  checked,
  hidden,
}: {
  item: ChecklistItem
  id: string
  checked: boolean
  hidden: boolean
}) {
  const detailId = `${id}-detail`
  return (
    <li className={`cl-item${checked ? " is-done" : ""}${hidden ? " is-hidden" : ""}`}>
      <input
        id={id}
        className="cl-check"
        type="checkbox"
        checked={checked}
        onChange={(e) => setItemDone(item, e.target.checked)}
        aria-describedby={detailId}
      />
      <div className="cl-body">
        <div className="cl-head">
          <label htmlFor={id} className="cl-title">
            {item.title}
          </label>
          <span className="badge badge-info cl-owner">
            <span className="sr-only">Owner: </span>
            {item.owner}
          </span>
        </div>
        <p id={detailId} className="cl-detail">
          {item.detail}
        </p>
      </div>
    </li>
  )
}

/* ── the checklist ──────────────────────────────────────────── */
export function ProjectChecklist({ variant = "full", headingLevel = 2 }: ProjectChecklistProps) {
  const uid = useId()
  const { overrides, persisted } = useSyncExternalStore(subscribe, getSnapshot)
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [laterOpen, setLaterOpen] = useState(false)
  // true after "Reset to defaults" until the viewer changes a tick again
  const [justReset, setJustReset] = useState(false)
  const hasOverrides = Object.keys(overrides).length > 0
  // any tick after a reset (here, another instance or another tab) retires the
  // message, so unticking back to defaults later doesn't re-announce it
  useEffect(() => {
    if (hasOverrides) setJustReset(false)
  }, [hasOverrides])

  const compact = variant === "compact"
  const H = `h${headingLevel}` as "h2" | "h3"
  const GroupH = `h${headingLevel + 1}` as "h3" | "h4"

  const isDone = (i: ChecklistItem) => overrides[i.id] ?? i.defaultDone
  const total = CHECKLIST.length
  const doneCount = CHECKLIST.filter(isDone).length
  const openIn = (phase: ChecklistPhase) => CHECKLIST.filter((i) => i.phase === phase && !isDone(i)).length
  const phase1Open = openIn("now")

  const phases = compact ? PHASES.filter((p) => p.id !== "done") : PHASES
  const matchesOwner = (i: ChecklistItem) => ownerFilter === null || i.owner === ownerFilter
  const shownCount = CHECKLIST.filter((i) => phases.some((p) => p.id === i.phase) && matchesOwner(i)).length

  function resetToDefaults() {
    if (!hasOverrides) return // aria-disabled: keep focus, do nothing
    commit({})
    setJustReset(true)
  }

  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0

  function renderList(phase: ChecklistPhase) {
    return (
      <ul className="cl-list" role="list">
        {CHECKLIST.filter((i) => i.phase === phase).map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            id={`${uid}-${item.id}`}
            checked={isDone(item)}
            hidden={!matchesOwner(item)}
          />
        ))}
      </ul>
    )
  }

  return (
    <section className={`card cl${compact ? " cl-compact" : ""}`} aria-label="Project checklist">
      {/* ── header ── */}
      {compact ? (
        <>
          <p className="eyebrow eyebrow-rule">Project checklist</p>
          <H className="cl-h">
            {phase1Open > 0 ? `${phase1Open} open for Phase 1` : "Phase 1 complete"}
          </H>
        </>
      ) : (
        <>
          <H className="display t-h3 cl-h" style={{ marginTop: 0 }}>
            Project checklist
          </H>
          <p className="cl-lead">
            Data requests and modeling work, grouped by phase, each with a named owner.
          </p>
        </>
      )}

      {/* ── progress ── */}
      <div className="cl-summary">
        <p className="cl-count" aria-live="polite" aria-atomic="true">
          <strong>
            {doneCount} of {total}
          </strong>{" "}
          complete
        </p>
        <div
          className="cl-bar"
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of ${total} complete`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* ── owner filter (full only) ── */}
      {!compact && (
        <>
          <div className="cl-filter no-print" role="group" aria-label="Filter by owner">
            {[null, ...OWNERS].map((owner) => {
              const pressed = ownerFilter === owner
              const open = CHECKLIST.filter((i) => (owner === null || i.owner === owner) && !isDone(i)).length
              return (
                <button
                  key={owner ?? "all"}
                  type="button"
                  className="cl-chip"
                  aria-pressed={pressed}
                  onClick={() => setOwnerFilter(owner)}
                >
                  {pressed && <IconCheck size={12} />}
                  {owner ?? "All"}
                  <span className="cl-chip-n">
                    {open}
                    <span className="sr-only"> open</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="sr-only" role="status">
            {ownerFilter ? `Showing ${shownCount} items owned by ${ownerFilter}` : ""}
          </p>
        </>
      )}

      {/* ── groups ── */}
      <div className="cl-groups">
        {phases.map((p) => {
          const items = CHECKLIST.filter((i) => i.phase === p.id)
          const visible = items.filter(matchesOwner)
          const groupDone = visible.filter(isDone).length
          const groupClass = `cl-group${visible.length === 0 ? " is-hidden" : ""}`
          const count = `${groupDone} of ${visible.length} done`

          // compact: "Later" sits behind a disclosure so the column stays short
          if (compact && p.id === "later") {
            const panelId = `${uid}-later`
            return (
              <section key={p.id} className={groupClass}>
                <GroupH className="cl-group-h">
                  <button
                    type="button"
                    className="cl-toggle"
                    aria-expanded={laterOpen}
                    aria-controls={panelId}
                    onClick={() => setLaterOpen((o) => !o)}
                  >
                    <span className="cl-toggle-label">
                      <span className="cl-toggle-chevron">
                        <IconChevron open={laterOpen} size={14} />
                      </span>
                      <PhaseIcon phase={p.id} />
                      {p.heading}
                    </span>
                    <span className="cl-group-n">{openIn(p.id)} open</span>
                  </button>
                </GroupH>
                <div id={panelId} className="cl-panel" hidden={!laterOpen}>
                  <p className="cl-group-cap">{p.caption}</p>
                  {renderList(p.id)}
                </div>
              </section>
            )
          }

          return (
            <section key={p.id} className={groupClass}>
              <GroupH className="cl-group-h">
                <PhaseIcon phase={p.id} />
                {p.heading}
                <span className="cl-group-n">{count}</span>
              </GroupH>
              <p className="cl-group-cap">{p.caption}</p>
              {renderList(p.id)}
            </section>
          )
        })}
      </div>

      {/* ── footer: where the ticks live + reset ── */}
      <div className="cl-foot">
        <p className="cl-note">
          {!persisted && <IconWarning size={14} />}
          <span>
            {persisted
              ? "Ticks are saved in this browser only."
              : "Browser storage is unavailable, so ticks reset when you leave this page."}{" "}
            Status as of {formatStatusDate(STATUS_AS_OF)}.
          </span>
        </p>
        <div className="cl-actions no-print">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={resetToDefaults}
            aria-disabled={!hasOverrides}
          >
            <IconRefresh size={13} />
            Reset to defaults
          </button>
          <p className="sr-only" role="status">
            {justReset && !hasOverrides ? "Checklist reset to defaults" : ""}
          </p>
        </div>
      </div>
    </section>
  )
}
