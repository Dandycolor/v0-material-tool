/* Knopika theme engine: derives every ground / panel token from one background colour.
   Panels are always darker than the ground and keep its hue; on dark grounds they get a contour (--edge). */

type RGB = [number, number, number]

const rgbOf = (hex: string): RGB => {
  let h = String(hex).trim().replace("#", "")
  if (h.length === 3) h = h.replace(/./g, "$&$&")
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lumOf = (c: RGB) => {
  const a = c.map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB
const css = (c: RGB) => `rgb(${c.join(",")})`

export interface GroundOptions {
  /** false keeps panels black instead of a deep shade of the ground */
  tintPanels?: boolean
  /** 0.6 … 1 — how dark the panels are */
  panelDepth?: number
}

export function groundTokens(hex: string, opts: GroundOptions = {}) {
  const c = rgbOf(hex)
  const L = lumOf(c)
  const dark = L < 0.18
  const on: RGB = dark ? [255, 255, 255] : [0, 0, 0]
  const W: RGB = [255, 255, 255]
  const K: RGB = [0, 0, 0]
  const vars: Record<string, string> = {
    "--ground": hex,
    "--ground-tint": css(mix(c, on, dark ? 0.13 : 0.08)),
    "--on-ground": dark ? "#ffffff" : "#000000",
    "--on-ground-faint": dark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)",
    "--ground-active": dark ? "#ffffff" : "#000000",
    "--on-ground-active": dark ? "#000000" : "#ffffff",
    "--ground-pop": dark ? css(mix(c, on, 0.18)) : "#ffffff",
    "--on-ground-pop": dark ? "#ffffff" : "#000000",
    "--ground-pop-ring": L > 0.75 ? "rgba(0,0,0,0.85)" : dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0)",
  }
  const dep = opts.panelDepth ?? 0.86
  const pan = opts.tintPanels === false ? K : dark ? mix(c, K, Math.min(0.9, (0.6 * dep) / 0.86)) : mix(c, K, dep)
  if (opts.tintPanels === false) {
    vars["--panel"] = "#000000"
    vars["--panel-raised"] = "#161616"
    vars["--panel-line"] = "#2a2a2a"
    vars["--panel-muted"] = "#8f8f8f"
  } else {
    vars["--panel"] = css(pan)
    vars["--panel-raised"] = css(mix(pan, W, 0.07))
    vars["--panel-line"] = css(mix(pan, W, 0.15))
    vars["--panel-muted"] = css(mix(pan, W, 0.56))
  }
  return { vars, dark, luminance: L }
}

export interface KnopikaTheme {
  style: "classic" | "expressive" | "block"
  shape: "cookie" | "sunny" | "clover" | "squircle"
  tint: boolean
  depth: number // 60…100
  edge: number // 0…100
  radiusSm: number
  radiusMd: number
  radiusLg: number
  radiusPill: number
  radiusControl: number // %
  radiusKnob: number // %
  controlSm: number
  controlMd: number
  controlLg: number
  knob: number
  swatch: number
  unit: number
  gapBlock: number
  padPanel: number
  padCard: number
  gapRow: number
  iconSize: number
  iconWeight: number // 0…6
  display: string
  ui: string
  caps: boolean
  track: number // caps letter-spacing, 1/100 em
}

/* base style ("Violet", Classic) — the CSS + JSON export Sava picked as the main style */
export const THEME_DEFAULT: KnopikaTheme = {
  style: "classic",
  shape: "cookie",
  tint: true,
  depth: 100,
  edge: 0,
  radiusSm: 7,
  radiusMd: 18,
  radiusLg: 10,
  radiusPill: 999,
  radiusControl: 22,
  radiusKnob: 15,
  controlSm: 32,
  controlMd: 40,
  controlLg: 56,
  knob: 16,
  swatch: 26,
  unit: 3,
  gapBlock: 9,
  padPanel: 17,
  padCard: 18,
  gapRow: 14,
  iconSize: 18,
  iconWeight: 3,
  display: "Helvetica",
  ui: "Helvetica",
  caps: false,
  track: 5,
}

type NumKey = { [K in keyof KnopikaTheme]: KnopikaTheme[K] extends number ? K : never }[keyof KnopikaTheme]
export interface TunerRow {
  k: NumKey
  css?: string
  label: string
  min: number
  max: number
  step: number
  unit: "px" | "%" | ""
  icon: string
}

/* the same rows as the concept's tuner */
export const TUNER_ROWS: Record<"radius" | "size" | "space" | "icon", TunerRow[]> = {
  radius: [
    { k: "radiusSm", css: "--radius-sm", label: "Lists & tiles", min: 0, max: 16, step: 1, unit: "px", icon: "circle" },
    { k: "radiusMd", css: "--radius-md", label: "Nested cards", min: 0, max: 28, step: 1, unit: "px", icon: "circle" },
    { k: "radiusLg", css: "--radius-lg", label: "Panels", min: 0, max: 44, step: 1, unit: "px", icon: "circle" },
    { k: "radiusPill", css: "--radius-pill", label: "Pills", min: 0, max: 41, step: 1, unit: "px", icon: "circle" },
    { k: "radiusControl", css: "--radius-control", label: "Buttons & swatches", min: 0, max: 50, step: 1, unit: "%", icon: "circle" },
    { k: "radiusKnob", css: "--radius-knob", label: "Knobs", min: 0, max: 50, step: 1, unit: "%", icon: "circle" },
  ],
  size: [
    { k: "controlMd", css: "--control-md", label: "Button", min: 22, max: 48, step: 1, unit: "px", icon: "plus" },
    { k: "controlSm", css: "--control-sm", label: "Small button", min: 18, max: 36, step: 1, unit: "px", icon: "plus" },
    { k: "controlLg", css: "--control-lg", label: "Round main button", min: 34, max: 64, step: 1, unit: "px", icon: "plus" },
    { k: "knob", css: "--knob", label: "Slider knob", min: 10, max: 24, step: 1, unit: "px", icon: "plus" },
    { k: "swatch", css: "--swatch", label: "Colour swatch", min: 16, max: 34, step: 1, unit: "px", icon: "plus" },
  ],
  space: [
    { k: "unit", label: "Spacing step", min: 3, max: 6, step: 1, unit: "px", icon: "width" },
    { k: "gapBlock", css: "--gap-block", label: "Between blocks", min: 0, max: 24, step: 1, unit: "px", icon: "width" },
    { k: "padPanel", css: "--pad-panel", label: "Panel padding", min: 6, max: 24, step: 1, unit: "px", icon: "width" },
    { k: "padCard", css: "--pad-card", label: "Block padding", min: 6, max: 24, step: 1, unit: "px", icon: "width" },
    { k: "gapRow", css: "--gap-row", label: "Between rows", min: 2, max: 20, step: 1, unit: "px", icon: "width" },
  ],
  icon: [
    { k: "iconSize", css: "--icon-size", label: "Icon size", min: 12, max: 24, step: 1, unit: "px", icon: "grid" },
    { k: "iconWeight", label: "Icon weight", min: 0, max: 6, step: 1, unit: "", icon: "grid" },
  ],
}

const HSTACK = '"Helvetica Neue", Helvetica, "Inter Tight", Arial'
export const FONTS_DISPLAY: Record<string, string> = {
  Helvetica: HSTACK,
  "Inter Tight": '"Inter Tight"',
  "IBM Plex Sans": '"IBM Plex Sans"',
  "F5.6": '"F5.6"',
  "Dela Gothic One": '"Dela Gothic One"',
  Unbounded: '"Unbounded"',
  Syne: '"Syne"',
  "Bricolage Grotesque": '"Bricolage Grotesque"',
}
export const FONTS_UI: Record<string, string> = {
  Helvetica: HSTACK,
  "Inter Tight": '"Inter Tight"',
  "F5.6": '"F5.6"',
  "Zen Kaku Gothic New": '"Zen Kaku Gothic New"',
  Manrope: '"Manrope"',
  Onest: '"Onest"',
  "IBM Plex Sans": '"IBM Plex Sans"',
}
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Dela+Gothic+One&family=Unbounded:wght@500;700&family=Syne:wght@700;800&family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Manrope:wght@500;700&family=Onest:wght@500;700&family=IBM+Plex+Sans:wght@500;700&display=swap"

export const GROUNDS = [
  { hex: "#9724f5", name: "Violet" },
  { hex: "#f6551f", name: "Field" },
  { hex: "#0c0c0c", name: "Night" },
  { hex: "#b3c2cd", name: "Fog" },
  { hex: "#f4f1ec", name: "Paper" },
  { hex: "#1b2626", name: "Pine" },
  { hex: "#3423f5", name: "Ultramarine" },
]

export const fmtRow = (r: TunerRow, v: number) =>
  r.k === "radiusPill" && v >= 41 ? "max" : r.unit ? `${v}${r.unit}` : String(v)

/** Size / radius / spacing / type tokens (everything except colours). */
export function sizeVars(t: KnopikaTheme) {
  const o: Record<string, string> = {}
  Object.values(TUNER_ROWS).flat().forEach((r) => {
    if (!r.css) return
    const v = r.k === "radiusPill" && t.radiusPill >= 41 ? 999 : (t[r.k] as number)
    o[r.css] = `${v}${r.unit}`
  })
  ;[1, 2, 3, 4, 6].forEach((n) => (o[`--space-${n}`] = `${t.unit * n}px`))
  o["--caps-track"] = `${t.track / 100}em`
  o["--edge"] = String(t.edge / 100)
  o["--font-display"] = `${FONTS_DISPLAY[t.display] || HSTACK}, system-ui, sans-serif`
  o["--font-ui"] = `${FONTS_UI[t.ui] || HSTACK}, system-ui, sans-serif`
  return o
}

/** All CSS custom properties for the app root. */
export function themeVars(ground: string, t: KnopikaTheme) {
  const g = groundTokens(ground, { tintPanels: t.tint, panelDepth: t.depth / 100 })
  return { dark: g.dark, colors: g.vars, vars: { ...g.vars, ...sizeVars(t) } as Record<string, string> }
}

const COLOR_KEYS = ["ground", "ground-tint", "on-ground", "on-ground-faint", "ground-active", "on-ground-active", "ground-pop", "on-ground-pop", "panel", "panel-raised", "panel-line", "panel-muted"]

export function exportCss(ground: string, t: KnopikaTheme) {
  const { vars } = themeVars(ground, t)
  return `/* Knopika · style: ${t.style}${t.style === "expressive" ? ` · shape: ${t.shape}` : ""} */\n:root{\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}\n`
}

export function exportJson(ground: string, t: KnopikaTheme, weights: readonly string[]) {
  const { vars } = themeVars(ground, t)
  const pick = (pre: string) => Object.keys(vars).filter((k) => k.startsWith(`--${pre}`)).map((k) => ({ name: k.slice(2), value: vars[k] }))
  return JSON.stringify(
    {
      name: "Knopika (custom)",
      color: { themes: [{ id: "custom", name: "Custom" }], tokens: COLOR_KEYS.map((k) => ({ name: k, value: { custom: vars[`--${k}`] } })) },
      type: { families: { display: vars["--font-display"], ui: vars["--font-ui"] } },
      spacing: { tokens: pick("space").concat(["gap-block", "pad-panel", "pad-card", "gap-row"].map((k) => ({ name: k, value: vars[`--${k}`] }))) },
      radius: { tokens: pick("radius") },
      size: { tokens: ["control-sm", "control-md", "control-lg", "knob", "swatch"].map((k) => ({ name: k, value: vars[`--${k}`] })) },
      icon: { tokens: pick("icon").concat([{ name: "icon-weight", value: weights[t.iconWeight] }]) },
      opacity: { tokens: [{ name: "edge", value: String(t.edge / 100) }] },
      meta: { style: t.style, shape: t.shape, caps: t.caps, depth: t.depth / 100 },
    },
    null,
    2,
  )
}
