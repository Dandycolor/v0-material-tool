/* 3D brush state: strokes, brush settings and the current mesh.
   A small external store (like the rotation store): the page edits it, the 3D view reads it.
   Meshing runs in a worker, latest request wins. Strokes are kept in this browser between visits. */

import * as THREE from "three"
import { useSyncExternalStore } from "react"
import { meshStrokes, type BrushMeshResult, type BrushStroke } from "./core"

export interface BrushSettings {
  size: number // bead radius (local units, the scene is ≈ 2 units across)
  puff: number // 0.25…1: flat bead → round tube
  blend: number // 0…1: how much touching strokes melt together
  smooth: number // 0…1: steadies the hand
  taper: number // 0…1: thinner ends
  quality: number // grid cells across the drawing
}

export const BRUSH_DEFAULT: BrushSettings = { size: 0.07, puff: 0.65, blend: 0.35, smooth: 0.5, taper: 0.5, quality: 160 }

interface State {
  strokes: BrushStroke[]
  redo: BrushStroke[]
  settings: BrushSettings
  drawing: boolean // draw mode on (orbit off)
  geometry: THREE.BufferGeometry
  busy: boolean
  version: number
}

const KEY = "polya-brush"
const empty = () => new THREE.BufferGeometry()
let state: State = { strokes: [], redo: [], settings: { ...BRUSH_DEFAULT }, drawing: true, geometry: empty(), busy: false, version: 0 }
const subs = new Set<() => void>()
const set = (u: Partial<State>) => {
  state = { ...state, ...u, version: state.version + 1 }
  subs.forEach((f) => f())
}

/* ---------- persistence ---------- */
let loaded = false
function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      state = { ...state, strokes: d.strokes || [], settings: { ...BRUSH_DEFAULT, ...(d.settings || {}) } }
      if (state.strokes.length) remesh()
    }
  } catch {}
}
let saveT: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(saveT)
  saveT = setTimeout(() => {
    try {
      const r = (n: number) => Math.round(n * 1e4) / 1e4
      localStorage.setItem(KEY, JSON.stringify({ strokes: state.strokes.map((s) => ({ p: s.p.map(r), n: s.n.map(r) })), settings: state.settings }))
    } catch {}
  }, 300)
}

/* ---------- meshing (worker, latest wins) ---------- */
let worker: Worker | null | undefined
let inflight = 0
let queued = false
let seq = 0

const params = () => ({ puff: state.settings.puff, blend: state.settings.blend * 0.22, res: state.settings.quality })

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
  // dispose after the view has switched
  setTimeout(() => old.dispose(), 500)
}
function getWorker() {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL("./brush.worker.ts", import.meta.url), { type: "module" })
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
    done(meshStrokes(state.strokes, params()))
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

/* ---------- public API ---------- */
export const brush = {
  get: () => {
    load()
    return state
  },
  subscribe: (f: () => void) => {
    load()
    subs.add(f)
    return () => subs.delete(f)
  },
  addStroke(s: BrushStroke) {
    set({ strokes: [...state.strokes, s], redo: [] })
    save()
    remesh()
  },
  undo() {
    if (!state.strokes.length) return
    const last = state.strokes[state.strokes.length - 1]
    set({ strokes: state.strokes.slice(0, -1), redo: [...state.redo, last] })
    save()
    remesh()
  },
  redoStroke() {
    if (!state.redo.length) return
    const s = state.redo[state.redo.length - 1]
    set({ strokes: [...state.strokes, s], redo: state.redo.slice(0, -1) })
    save()
    remesh()
  },
  clear() {
    if (!state.strokes.length) return
    set({ strokes: [], redo: [...state.redo, ...state.strokes.slice().reverse()] })
    save()
    remesh()
  },
  setSettings(u: Partial<BrushSettings>) {
    const prev = state.settings
    set({ settings: { ...prev, ...u } })
    save()
    // the shape of existing strokes depends on these
    if (u.puff !== undefined && u.puff !== prev.puff) remesh()
    else if (u.blend !== undefined && u.blend !== prev.blend) remesh()
    else if (u.quality !== undefined && u.quality !== prev.quality) remesh()
  },
  setDrawing(on: boolean) {
    if (state.drawing !== on) set({ drawing: on })
  },
}

export function useBrush() {
  return useSyncExternalStore(brush.subscribe, brush.get, brush.get)
}
