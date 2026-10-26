/* Object rotation for the Knopika orbit rig.
   A tiny external store: the 3D view reads it every frame (no React re-render of the page),
   the rig and the Rotate panel subscribe to it. Angles are in degrees. */

import { useSyncExternalStore } from "react"

export interface RotState {
  turn: number // around the vertical axis, 0…360
  tilt: number // towards / away from the viewer, -90…90
  auto: boolean
  speed: number // deg / s
  snap: boolean
}

let state: RotState = { turn: 0, tilt: 0, auto: false, speed: 40, snap: false }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

let raf = 0
let lastT = 0
let tween: { from: [number, number]; to: [number, number]; t0: number; dur: number } | null = null

const norm = (a: number) => ((a % 360) + 360) % 360
const clampTilt = (v: number) => Math.max(-90, Math.min(90, v))

function loop(t: number) {
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0
  lastT = t
  let next = state
  if (tween) {
    const k = Math.min(1, (t - tween.t0) / tween.dur)
    const e = 1 - Math.pow(1 - k, 3)
    let dTurn = tween.to[0] - tween.from[0]
    if (dTurn > 180) dTurn -= 360
    if (dTurn < -180) dTurn += 360
    next = { ...next, turn: norm(tween.from[0] + dTurn * e), tilt: tween.from[1] + (tween.to[1] - tween.from[1]) * e }
    if (k >= 1) tween = null
  } else if (state.auto) {
    next = { ...next, turn: norm(state.turn + state.speed * dt) }
  }
  if (next !== state) {
    state = next
    emit()
  }
  if (tween || state.auto) raf = requestAnimationFrame(loop)
  else {
    raf = 0
    lastT = 0
  }
}
const kick = () => {
  if (!raf && typeof window !== "undefined") raf = requestAnimationFrame(loop)
}

export const rot = {
  get: () => state,
  subscribe: (f: () => void) => {
    subs.add(f)
    return () => subs.delete(f)
  },
  set(p: Partial<RotState>) {
    const n = { ...state, ...p }
    if (p.turn !== undefined) n.turn = norm(n.snap ? Math.round(p.turn / 15) * 15 : p.turn)
    if (p.tilt !== undefined) n.tilt = clampTilt(n.snap ? Math.round(p.tilt / 15) * 15 : p.tilt)
    if (p.turn !== undefined || p.tilt !== undefined) tween = null
    state = n
    emit()
    kick()
  },
  view(turn: number, tilt: number) {
    tween = { from: [state.turn, state.tilt], to: [turn, tilt], t0: performance.now(), dur: 520 }
    state = { ...state, auto: false }
    emit()
    kick()
  },
}

export const useRot = () => useSyncExternalStore(rot.subscribe, rot.get, rot.get)
