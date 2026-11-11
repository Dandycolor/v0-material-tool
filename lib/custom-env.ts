/* Custom HDRI (KeyShot-style light studio).
   The environment is painted procedurally: a vertical background gradient plus light sources
   (round lights, soft boxes, strips) placed on the sphere around the model. It is rasterised to a
   float equirect image (same layout three uses: u = atan(z, x), v = asin(y)), turned into a PMREM
   by the viewer and used as scene.environment — so every PBR / glass / procedural material picks it
   up. State lives in a small external store shared by the editor panel and the 3D view. */

import { useSyncExternalStore } from "react"

export type EnvLightShape = "circle" | "rect" | "strip"

export interface EnvLight {
  id: string
  name: string
  on: boolean
  shape: EnvLightShape
  lon: number // degrees, -180…180 (0 = +X, 90 = +Z)
  lat: number // degrees, -90…90
  size: number // angular radius / half-width, degrees
  aspect: number // height / width (rect, strip)
  brightness: number // 0…20
  color: string
  softness: number // 0…1
}

export interface CustomEnv {
  lights: EnvLight[]
  top: string
  horizon: string
  bottom: string
  bgIntensity: number // 0…2
  brightness: number // 0…3 global
  contrast: number // 0.5…2
  rotation: number // degrees
}

let uid = 0
const nid = () => `l${Date.now().toString(36)}${(uid++).toString(36)}`

export const newLight = (o: Partial<EnvLight> = {}): EnvLight => ({
  id: nid(),
  name: "Light",
  on: true,
  shape: "rect",
  lon: 45,
  lat: 25,
  size: 14,
  aspect: 1.4,
  brightness: 6,
  color: "#ffffff",
  softness: 0.35,
  ...o,
})

const bg = { top: "#2a2a2e", horizon: "#151517", bottom: "#050506", bgIntensity: 0.6 }

export const ENV_PRESETS: { name: string; make: () => Omit<CustomEnv, "brightness" | "contrast" | "rotation"> }[] = [
  {
    name: "3 Point",
    make: () => ({
      ...bg,
      lights: [
        newLight({ name: "Key", shape: "circle", lon: -50, lat: 30, size: 11, brightness: 9 }),
        newLight({ name: "Fill", shape: "circle", lon: 40, lat: 15, size: 16, brightness: 3.5 }),
        newLight({ name: "Rim", shape: "circle", lon: 150, lat: 35, size: 22, brightness: 6, softness: 0.7 }),
      ],
    }),
  },
  {
    name: "2 Panels",
    make: () => ({
      ...bg,
      lights: [
        newLight({ name: "Panel L", shape: "rect", lon: -60, lat: 10, size: 13, aspect: 1.5, brightness: 7, softness: 0.2 }),
        newLight({ name: "Panel R", shape: "rect", lon: 60, lat: 10, size: 13, aspect: 1.5, brightness: 7, softness: 0.2 }),
        newLight({ name: "Top", shape: "circle", lon: 0, lat: 75, size: 10, brightness: 4 }),
      ],
    }),
  },
  {
    name: "Top Strip",
    make: () => ({
      ...bg,
      lights: [
        newLight({ name: "Strip", shape: "strip", lon: 90, lat: 60, size: 6, aspect: 9, brightness: 9, softness: 0.25 }),
        newLight({ name: "Bounce", shape: "rect", lon: 90, lat: -20, size: 30, aspect: 0.4, brightness: 1.2, softness: 0.8 }),
      ],
    }),
  },
  {
    name: "Ring",
    make: () => ({
      ...bg,
      lights: Array.from({ length: 6 }, (_, i) => newLight({ name: `Ring ${i + 1}`, shape: "circle", lon: -180 + i * 60, lat: 20, size: 9, brightness: 5, softness: 0.3 })),
    }),
  },
  {
    name: "Rim",
    make: () => ({
      ...bg,
      lights: [
        newLight({ name: "Rim L", shape: "strip", lon: 140, lat: 10, size: 5, aspect: 6, brightness: 10, softness: 0.3 }),
        newLight({ name: "Rim R", shape: "strip", lon: -140, lat: 10, size: 5, aspect: 6, brightness: 10, softness: 0.3 }),
        newLight({ name: "Front", shape: "rect", lon: 90, lat: 20, size: 18, aspect: 1, brightness: 1.5, softness: 0.8 }),
      ],
    }),
  },
  {
    name: "Soft Box",
    make: () => ({
      ...bg,
      top: "#4a4a50",
      horizon: "#2a2a2e",
      lights: [newLight({ name: "Soft box", shape: "rect", lon: 70, lat: 35, size: 32, aspect: 1, brightness: 3.5, softness: 0.9 })],
    }),
  },
  {
    name: "Sunset",
    make: () => ({
      top: "#3a4d8f",
      horizon: "#ff9a5c",
      bottom: "#2a1a22",
      bgIntensity: 1.1,
      lights: [newLight({ name: "Sun", shape: "circle", lon: -30, lat: 6, size: 5, brightness: 18, color: "#ffd2a0", softness: 0.4 })],
    }),
  },
]

export const CUSTOM_ENV_DEFAULT: CustomEnv = { ...ENV_PRESETS[0].make(), brightness: 1, contrast: 1, rotation: 0 }

/* ---------- rasteriser ---------- */
const W = 512, H = 256

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.replace("#", ""), 16)
  // sRGB → linear
  const f = (v: number) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
}

export function dirFromLonLat(lon: number, lat: number): [number, number, number] {
  const p = (lon * Math.PI) / 180, t = (lat * Math.PI) / 180
  return [Math.cos(t) * Math.cos(p), Math.sin(t), Math.cos(t) * Math.sin(p)]
}
export function lonLatFromDir(x: number, y: number, z: number): [number, number] {
  const l = Math.hypot(x, y, z) || 1
  return [(Math.atan2(z / l, x / l) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, y / l))) * 180) / Math.PI]
}

/** RGBA float equirect, row 0 = bottom (v = 0), linear colour */
export function rasterEnv(env: CustomEnv, w = W, h = H): Float32Array {
  const out = new Float32Array(w * h * 4)
  const top = hex(env.top), hor = hex(env.horizon), bot = hex(env.bottom)
  const lights = env.lights
    .filter((l) => l.on)
    .map((l) => {
      const L = dirFromLonLat(l.lon, l.lat)
      // tangent frame: right (east), up (north) at the light centre
      const p = (l.lon * Math.PI) / 180, t = (l.lat * Math.PI) / 180
      const R = [-Math.sin(p), 0, Math.cos(p)]
      const U = [-Math.sin(t) * Math.cos(p), Math.cos(t), -Math.sin(t) * Math.sin(p)]
      const c = hex(l.color)
      const wx = (l.size * Math.PI) / 180
      const hy = l.shape === "circle" ? wx : wx * l.aspect
      return { L, R, U, c, wx, hy, b: l.brightness, s: Math.max(0.02, l.softness), shape: l.shape, reach: Math.cos(Math.min(Math.PI * 0.95, Math.max(wx, hy) * 1.6 + 0.05)) }
    })
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h - 0.5) * Math.PI
    const cy = Math.sin(lat), cl = Math.cos(lat)
    // background: bottom → horizon → top
    const k = cy
    let br: number, bgc: number, bb: number
    if (k >= 0) {
      const f = Math.pow(k, 0.6)
      br = hor[0] + (top[0] - hor[0]) * f
      bgc = hor[1] + (top[1] - hor[1]) * f
      bb = hor[2] + (top[2] - hor[2]) * f
    } else {
      const f = Math.pow(-k, 0.5)
      br = hor[0] + (bot[0] - hor[0]) * f
      bgc = hor[1] + (bot[1] - hor[1]) * f
      bb = hor[2] + (bot[2] - hor[2]) * f
    }
    br *= env.bgIntensity
    bgc *= env.bgIntensity
    bb *= env.bgIntensity
    for (let i = 0; i < w; i++) {
      const phi = ((i + 0.5) / w - 0.5) * Math.PI * 2
      const dx = cl * Math.cos(phi), dz = cl * Math.sin(phi)
      let r = br, g = bgc, b = bb
      for (const l of lights) {
        const dl = dx * l.L[0] + cy * l.L[1] + dz * l.L[2]
        if (dl < l.reach) continue
        const ax = Math.atan2(dx * l.R[0] + dz * l.R[2], dl)
        const ay = Math.atan2(dx * l.U[0] + cy * l.U[1] + dz * l.U[2], dl)
        let q: number
        if (l.shape === "circle") q = Math.hypot(ax / l.wx, ay / l.hy)
        else {
          // rounded rectangle (superellipse) — soft boxes / strips
          const px = Math.abs(ax / l.wx), py = Math.abs(ay / l.hy)
          q = Math.pow(Math.pow(px, 6) + Math.pow(py, 6), 1 / 6)
        }
        if (q >= 1 + l.s) continue
        const e0 = 1 - l.s
        const x = q <= e0 ? 1 : 1 - (q - e0) / (2 * l.s)
        const a = x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)
        const f = a * l.b
        r += l.c[0] * f
        g += l.c[1] * f
        b += l.c[2] * f
      }
      const o = (j * w + i) * 4
      const cst = env.contrast, gb = env.brightness
      out[o] = Math.pow(r, cst) * gb
      out[o + 1] = Math.pow(g, cst) * gb
      out[o + 2] = Math.pow(b, cst) * gb
      out[o + 3] = 1
    }
  }
  return out
}
export const ENV_W = W
export const ENV_H = H

/* ---------- store ---------- */
interface State {
  env: CustomEnv
  selected: string | null
  picking: boolean // "place highlight": click on the model
  version: number
}
const KEY = "polya-custom-hdri"
let state: State = { env: CUSTOM_ENV_DEFAULT, selected: CUSTOM_ENV_DEFAULT.lights[0]?.id ?? null, picking: false, version: 0 }
const subs = new Set<() => void>()
let loaded = false
const load = () => {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const env = { ...CUSTOM_ENV_DEFAULT, ...JSON.parse(raw) } as CustomEnv
      state = { ...state, env, selected: env.lights[0]?.id ?? null }
    }
  } catch {}
}
let saveT: ReturnType<typeof setTimeout> | undefined
const set = (u: Partial<State>) => {
  state = { ...state, ...u, version: state.version + 1 }
  subs.forEach((f) => f())
  if (u.env) {
    clearTimeout(saveT)
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state.env))
      } catch {}
    }, 300)
  }
}

export const customEnv = {
  get: () => {
    load()
    return state
  },
  subscribe: (f: () => void) => {
    load()
    subs.add(f)
    return () => subs.delete(f)
  },
  setEnv: (u: Partial<CustomEnv>) => set({ env: { ...state.env, ...u } }),
  setLight: (id: string, u: Partial<EnvLight>) => set({ env: { ...state.env, lights: state.env.lights.map((l) => (l.id === id ? { ...l, ...u } : l)) } }),
  addLight: (o: Partial<EnvLight> = {}) => {
    const l = newLight({ name: `Light ${state.env.lights.length + 1}`, ...o })
    set({ env: { ...state.env, lights: [...state.env.lights, l] }, selected: l.id })
    return l.id
  },
  removeLight: (id: string) => {
    const lights = state.env.lights.filter((l) => l.id !== id)
    set({ env: { ...state.env, lights }, selected: state.selected === id ? (lights[0]?.id ?? null) : state.selected })
  },
  select: (id: string | null) => set({ selected: id }),
  setPicking: (on: boolean) => state.picking !== on && set({ picking: on }),
  applyPreset: (i: number) => {
    const p = ENV_PRESETS[i].make()
    set({ env: { ...state.env, ...p }, selected: p.lights[0]?.id ?? null })
  },
}

export function useCustomEnv() {
  return useSyncExternalStore(customEnv.subscribe, customEnv.get, customEnv.get)
}
