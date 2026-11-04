/* Latest-wins queue in front of the extrusion worker: while one job runs, only the newest
   request waits — intermediate slider values are dropped instead of piling up. */
import * as THREE from "three"
import { extrudeFlatShapes, resultToGeometry, type ExtrudeParams, type FlatShape } from "./core"

type Job = { shapes: FlatShape[]; params: ExtrudeParams; resolve: (g: THREE.BufferGeometry | null) => void; reject: (e: unknown) => void }

let worker: Worker | null | undefined
let busy = false
let pending: Job | null = null
let seq = 0
const inflight = new Map<number, Job>()

function getWorker() {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL("./extrude.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e) => {
      const { id, result, error } = e.data
      const job = inflight.get(id)
      inflight.delete(id)
      busy = false
      if (job) {
        if (error) job.reject(error)
        else job.resolve(result ? resultToGeometry(result) : null)
      }
      pump()
    }
    worker.onerror = () => {
      worker = null // fall back to the main thread from now on
      busy = false
      inflight.forEach((j) => run(j))
      inflight.clear()
      pump()
    }
  } catch {
    worker = null
  }
  return worker
}

function run(job: Job) {
  const w = getWorker()
  if (!w) {
    try {
      const r = extrudeFlatShapes(job.shapes, job.params)
      job.resolve(r ? resultToGeometry(r) : null)
    } catch (e) {
      job.reject(e)
    }
    return
  }
  busy = true
  const id = ++seq
  inflight.set(id, job)
  w.postMessage({ id, shapes: job.shapes, params: job.params })
}

function pump() {
  if (busy || !pending) return
  const job = pending
  pending = null
  run(job)
}

/** Resolves with the geometry, or with `undefined` if a newer request superseded this one. */
export function extrudeAsync(shapes: FlatShape[], params: ExtrudeParams): Promise<THREE.BufferGeometry | null | undefined> {
  return new Promise((resolve, reject) => {
    if (pending) pending.resolve(undefined as any)
    pending = { shapes, params, resolve: resolve as any, reject }
    pump()
  })
}

export function flattenShape(shape: THREE.Shape): FlatShape {
  const flat = (pts: THREE.Vector2[]) => {
    const a = new Float32Array(pts.length * 2)
    pts.forEach((p, i) => {
      a[i * 2] = p.x
      a[i * 2 + 1] = p.y
    })
    return a
  }
  return { outer: flat(shape.getPoints(1)), holes: shape.holes.map((h) => flat(h.getPoints(1))) }
}
