/**
 * Design tokens for inline styles, SVG props and Recharts. These mirror the
 * CSS custom properties in index.css — change both together.
 *
 * Brand values are Augustana's own (sampled from augustana.edu): primary navy
 * #002F6C, deep navy #000F37, the #00437B / #0067B9 blues, and the warm grays
 * #D7D2CB / #EDEBE8. Gold is the Vikings accent the project already used.
 */
export const T = {
  // brand
  navy: "#002F6C",
  navyHover: "#013a87",
  navyDeep: "#000F37",
  navy900: "#001B47",
  navy700: "#00437B",
  blue: "#0067B9",
  blueTint: "#EBF1F9",
  blueTint2: "#C3D7EE",
  gold: "#FFDD00",
  goldDeep: "#B87D00", // antique gold — the gold that still reads on white
  goldTint: "#FFF7CC",

  // warm neutrals
  bg: "#F7F5F2",
  surface: "#FFFFFF",
  sand: "#EDEBE8",
  border: "#E3DFD8",
  borderStrong: "#D7D2CB",

  // text — all ≥ 4.5:1 on both surface and bg
  tp: "#0B1B36", // primary
  ts: "#46536B", // secondary
  tm: "#6D6E70", // muted (labels, axis text)

  // status — always paired with an icon + label, never colour alone
  success: "#1F6F43",
  successBg: "#EDF7F1",
  error: "#9E2A2B",
  errorBg: "#FBEDED",
  warning: "#7B5E00",
  warningBg: "#FFF8E1",
  infoBg: "#EBF1F9",
  infoBorder: "#C3D7EE",

  // chart chrome
  grid: "#ECE9E3",
  axis: "#D7D2CB",
  neutralSeries: "#CFCAC0", // "baseline / everything else" — context, not identity

  /**
   * Categorical series palette, fixed order, assigned per entity (see
   * channels.ts) and never cycled. Validated with the dataviz skill's
   * validate_palette.js on a white surface: worst adjacent colour-blind ΔE
   * 10.0 (target ≥ 8), worst adjacent normal-vision ΔE 20.5 (floor ≥ 15).
   * Gold and rose sit under 3:1 on white by design, so every chart ships a
   * legend and a table view as the relief channel.
   */
  ch: [
    "#2563b0", // 1 blue
    "#dd6b3d", // 2 orange
    "#1a9a86", // 3 teal
    "#e0a30b", // 4 gold
    "#d9779f", // 5 rose
    "#2f8a2f", // 6 green
    "#5b47b8", // 7 violet
    "#d24545", // 8 red
  ],
  /** Two-series charts (actual vs modeled): brand navy and antique gold. */
  actual: "#002F6C",
  modeled: "#B87D00",
  /** Diverging pair for signed values — warm/cool poles, neutral midpoint. */
  pos: "#2563b0",
  neg: "#dd6b3d",
} as const
