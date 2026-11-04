/* Sketch inflate state: strokes, settings, current mesh. Same shape as the brush store:
   external store, worker meshing (latest wins), strokes kept in this browser. */

import * as THREE from "three"
import { useSyncExternalStore } from "react"
import type { BrushMeshResult } from "../brush/core"
import { meshSketch, type SketchParams, type SketchStroke } from "./core"

export interface SketchSettings {
  width: number // band width for lines (local units)
  volume: number // slope / height 0.1…2
  sharp: number // 0 round … 1 sharp crease
  plateau: number // 0…1 flat tops
  taper: number // 0…1
  smooth: number // 0…1 outline softening
  fill: boolean // fill closed shapes
  doubleSided: boolean
  steady: number // input smoothing 0…1
  quality: number
}

export const SKETCH_DEFAULT: SketchSettings = {
  width: 0.08,
  volume: 0.7,
  sharp: 0.85,
  plateau: 0,
  taper: 0.7,
  smooth: 0.3,
  fill: true,
  doubleSided: true,
  steady: 0.5,
  quality: 200,
}

interface State {
  strokes: SketchStroke[]
  redo: SketchStroke[]
  settings: SketchSettings
  drawing: boolean
  geometry: THREE.BufferGeometry
  busy: boolean
  version: number
}

const KEY = "polya-sketch"
let state: State = { strokes: [], redo: [], settings: { ...SKETCH_DEFAULT }, drawing: true, geometry: new THREE.BufferGeometry(), busy: false, version: 0 }
const subs = new Set<() => void>()
const set = (u: Partial<State>) => {
  state = { ...state, ...u, version: state.version + 1 }
  subs.forEach((f) => f())
}

let loaded = false
function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      state = { ...state, strokes: d.strokes || [], settings: { ...SKETCH_DEFAULT, ...(d.settings || {}) } }
    }
  } catch {}
  if (!state.strokes.length) state = { ...state, strokes: starter() }
  remesh()
}
let saveT: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(saveT)
  saveT = setTimeout(() => {
    try {
      const r = (n: number) => Math.round(n * 1e4) / 1e4
      localStorage.setItem(KEY, JSON.stringify({ strokes: state.strokes.map((s) => ({ ...s, p: s.p.map(r) })), settings: state.settings }))
    } catch {}
  }, 300)
}

/** first visit: a filled blob with a hole and a tail, so the mode never opens empty */
function starter(): SketchStroke[] {
  const ring = (rx: number, ry: number, cx: number, cy: number, wob: number) => {
    const p: number[] = []
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const k = 1 + wob * Math.sin(a * 3 + 0.6)
      p.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k)
    }
    return p
  }
  const tail: number[] = []
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    tail.push(0.55 + t * 0.35, -0.35 - t * 0.45 + Math.sin(t * 3.2) * 0.12)
  }
  return [
    { p: ring(0.62, 0.5, -0.05, 0.05, 0.12), closed: true, w: 0.08 },
    { p: ring(0.18, 0.15, 0.05, 0.1, 0.05), closed: true, w: 0.08 },
    { p: tail, closed: false, w: 0.1 },
  ]
}

let worker: Worker | null | undefined
let inflight = 0
let queued = false
let seq = 0
const params = (): SketchParams => {
  const s = state.settings
  return { fill: s.fill, volume: s.volume, sharp: s.sharp, plateau: s.plateau, taper: s.taper, doubleSided: s.doubleSided, smooth: s.smooth, res: s.quality }
}
function toGeometry(r: BrushMeshResult | null) {
  const g = new THREE.BufferGeometry()
  if (!r) return g
  g.setAttribute("position", new THREE.BufferAttribute(r.position, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(r.normal, 3))
  g.setIndex(new THREE.BufferAttribute(r.index, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}
function done(r: BrushMeshResult | null) {
  const old = state.geometry
  set({ geometry: toGeometry(r), busy: false })
  setTimeout(() => old.dispose(), 500)
}
function getWorker() {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL("./sketch.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e) => {
      const { id, result } = e.data
      if (id === seq) done(result || null)
      inflight = 0
      if (queued) {
        queued = false
        remesh()
      }
    }
    worker.onerror = () => {
      worker = null
      inflight = 0
      remesh()
    }
  } catch {
    worker = null
  }
  return worker
}
function remesh() {
  if (!state.strokes.length) {
    seq++
    done(null)
    return
  }
  const w = getWorker()
  if (!w) {
    done(meshSketch(state.strokes, params()))
    return
  }
  if (inflight) {
    queued = true
    return
  }
  inflight = ++seq
  if (!state.busy) set({ busy: true })
  w.postMessage({ id: seq, strokes: state.strokes, params: params() })
}

const SHAPE_KEYS: (keyof SketchSettings)[] = ["volume", "sharp", "plateau", "taper", "smooth", "fill", "doubleSided", "quality"]

export const sketch = {
  get: () => {
    load()
    return state
  },
  subscribe: (f: () => void) => {
    load()
    subs.add(f)
    return () => subs.delete(f)
  },
  addStroke(s: SketchStroke) {
    set({ strokes: [...state.strokes, s], redo: [] })
    save()
    remesh()
  },
  undo() {
    if (!state.strokes.length) return
    set({ strokes: state.strokes.slice(0, -1), redo: [...state.redo, state.strokes[state.strokes.length - 1]] })
    save()
    remesh()
  },
  redoStroke() {
    if (!state.redo.length) return
    set({ strokes: [...state.strokes, state.redo[state.redo.length - 1]], redo: state.redo.slice(0, -1) })
    save()
    remesh()
  },
  clear() {
    if (!state.strokes.length) return
    set({ strokes: [], redo: [...state.redo, ...state.strokes.slice().reverse()] })
    save()
    remesh()
  },
  setSettings(u: Partial<SketchSettings>) {
    const prev = state.settings
    set({ settings: { ...prev, ...u } })
    save()
    if (SHAPE_KEYS.some((k) => k in u && u[k] !== prev[k])) remesh()
  },
  setDrawing(on: boolean) {
    if (state.drawing !== on) set({ drawing: on })
  },
}

export function useSketch() {
  return useSyncExternalStore(sketch.subscribe, sketch.get, sketch.get)
}
