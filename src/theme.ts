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

  // spacing + radii — mirror --space-* / --radius* in index.css :root
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 9: 48 },
  radius: { sm: 3, md: 4 },

  // chart chrome
  axisText: 12, // axis tick + legend font size (px)
  grid: "#ECE9E3",
  axis: "#D7D2CB",
  neutralSeries: "#CFCAC0", // "baseline / everything else" — context, not identity

  /**
   * Categorical series palette, fixed order, assigned per entity (see
   * channels.ts) and never cycled. Brand-led: Augustana blue and gold carry
   * the first two slots, and antique gold marks ad impressions, the largest
   * advertising band; violet, sky, brick, teal and plum are muted accents
   * that keep eight channels apart. Validated with the dataviz skill's
   * validate_palette.js (light, adjacent pairs): lightness band and chroma
   * floor pass, worst CVD ΔE 9.8, worst normal-vision ΔE 24.2. Gold and sky
   * sit under 3:1 on white, so every chart ships a legend and a table view,
   * and fills keep white gaps.
   */
  ch: [
    "#0067B9", // 1 Augustana blue — Meta
    "#D9A514", // 2 gold — Google PPC
    "#563E98", // 3 violet — Snapchat
    "#46ABD4", // 4 sky — YouTube
    "#B94834", // 5 brick — Display retargeting
    "#14938D", // 6 teal — Google IP targeting
    "#8F4280", // 7 plum — Billboards
    "#B87D00", // 8 antique gold — Ad impressions
  ],
  /** Two-series charts (actual vs modeled): brand navy and antique gold. */
  actual: "#002F6C",
  modeled: "#B87D00",
  /** Diverging pair for signed values — blue/gold is the most CVD-safe pair. */
  pos: "#0067B9",
  neg: "#B87D00",
} as const
