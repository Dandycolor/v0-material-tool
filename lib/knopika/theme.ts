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
  radiusControl: number // %
  iconWeight: number // 0…6
  caps: boolean
}

export const THEME_DEFAULT: KnopikaTheme = {
  style: "classic",
  shape: "cookie",
  tint: true,
  depth: 100,
  edge: 0,
  radiusSm: 7,
  radiusMd: 18,
  radiusLg: 10,
  radiusControl: 22,
  iconWeight: 3,
  caps: false,
}

export const GROUNDS = [
  { hex: "#9724f5", name: "Violet" },
  { hex: "#f6551f", name: "Field" },
  { hex: "#0c0c0c", name: "Night" },
  { hex: "#b3c2cd", name: "Fog" },
  { hex: "#f4f1ec", name: "Paper" },
  { hex: "#1b2626", name: "Pine" },
  { hex: "#3423f5", name: "Ultramarine" },
]

/** All CSS custom properties for the app root. */
export function themeVars(ground: string, t: KnopikaTheme) {
  const g = groundTokens(ground, { tintPanels: t.tint, panelDepth: t.depth / 100 })
  return {
    dark: g.dark,
    vars: {
      ...g.vars,
      "--edge": String(t.edge / 100),
      "--radius-sm": `${t.radiusSm}px`,
      "--radius-md": `${t.radiusMd}px`,
      "--radius-lg": `${t.radiusLg}px`,
      "--radius-control": `${t.radiusControl}%`,
    } as Record<string, string>,
  }
}
