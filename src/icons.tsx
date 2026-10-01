/**
 * Small, consistent stroke icon set (currentColor, 1.6px strokes) used in
 * alerts, badges, buttons and status lists — replaces the old text glyphs
 * (★ ⚠ ℹ ✓ ↓ ←) whose size and baseline varied by font.
 */
import type { SVGProps } from "react"

type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">

function Svg({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className="icon"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v4.5" />
      <circle cx="10" cy="6.3" r="0.4" fill="currentColor" />
    </Svg>
  )
}

export function IconWarning(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 2.8 18 16.5H2L10 2.8z" />
      <path d="M10 8v3.8" />
      <circle cx="10" cy="14" r="0.4" fill="currentColor" />
    </Svg>
  )
}

export function IconError(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.3 7.3l5.4 5.4M12.7 7.3l-5.4 5.4" />
    </Svg>
  )
}

/** Demo / simulated data — a lab flask. */
export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 2.5h4M8.7 2.5v5L4 15.3A1.5 1.5 0 0 0 5.3 17.5h9.4a1.5 1.5 0 0 0 1.3-2.2L11.3 7.5v-5" />
      <path d="M6.2 12.5h7.6" />
    </Svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </Svg>
  )
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </Svg>
  )
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </Svg>
  )
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 3v9.5M6 9l4 4 4-4M3.5 16.5h13" />
    </Svg>
  )
}

export function IconPrint(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 7.5V3h9v4.5" />
      <rect x="2.5" y="7.5" width="15" height="7" rx="1.2" />
      <path d="M5.5 12h9v5h-9z" />
    </Svg>
  )
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 10a6 6 0 1 1-1.8-4.3" />
      <path d="M16 3.5v3.3h-3.3" />
    </Svg>
  )
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </Svg>
  )
}

/** Pending / "later" — shared by the coverage panel, checklist and import step. */
export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.8V10l2.8 1.8" />
    </Svg>
  )
}

export function IconChevron({ open, ...p }: IconProps & { open?: boolean }) {
  return (
    <Svg {...p} style={{ transition: "transform 0.18s ease", transform: open ? "rotate(90deg)" : "none", ...p.style }}>
      <path d="M8 5l5 5-5 5" />
    </Svg>
  )
}

/** Small filled status dot (live data). */
export function Dot({ color = "currentColor", size = 7 }: { color?: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }}
    />
  )
}

/** Indeterminate spinner for the "in progress" row of run checklists. */
export function Spinner({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden focusable="false" className="spin">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="2.4" />
      <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
