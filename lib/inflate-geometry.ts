/**
 * Inflate Geometry Library - Geometry-Based Pipeline
 *
 * Creates smooth inflated 3D meshes from 2D contours using:
 * - Constrained Delaunay triangulation (delaunator)
 * - Cotangent Laplacian biharmonic field (∇⁴u = 0)
 * - Smooth dome profile z(r) = (1 - r^n)^m
 * - Manifold mesh generation without rasterization
 */

import * as THREE from 'three'
import Delaunator from 'delaunator'

// ============================================================================
// Types
// ============================================================================

export interface Point2D {
  x: number
  y: number
}

export interface InflateOptions {
  amount: number
  smoothingIterations: number
  doubleSided: boolean
  gridResolution: number // legacy, controls steiner point density
  steinerPoints?: number
  sharpRidge?: boolean    // voronoi-like sharp ridge along medial axis
  ridgeSharpness?: number // 1-10, controls power curve of ridge profile
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  smoothingIterations: 3,
  doubleSided: true,
  gridResolution: 150,
  steinerPoints: 200,
  sharpRidge: false,
  ridgeSharpness: 5,
}

// ============================================================================
// Geometry Helpers
// ============================================================================

function getBounds(polygon: Point2D[]) {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

function pointInPolygon(px: number, py: number, polygon: Point2D[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function distToSegSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const ex = ax + t * dx - px
  const ey = ay + t * dy - py
  return ex * ex + ey * ey
}

function distToEdge(px: number, py: number, polygon: Point2D[]): number {
  let min = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n]
    const d = distToSegSq(px, py, a.x, a.y, b.x, b.y)
    if (d < min) min = d
  }
  return Math.sqrt(min)
}

// ============================================================================
// Mesh operations (typed arrays / CSR adjacency — no string keys in hot loops)
// ============================================================================

/** Resample a closed polyline to evenly spaced points (drawn contours often have
    hundreds of uneven points; the mesh only needs boundary spacing ≈ interior spacing). */
function resampleClosed(polygon: Point2D[], spacing: number, maxPts = 1600): Point2D[] {
  const n = polygon.length
  const seg = new Float64Array(n)
  let L = 0
  for (let i = 0; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n]
    seg[i] = Math.hypot(b.x - a.x, b.y - a.y)
    L += seg[i]
  }
  const count = Math.max(24, Math.min(maxPts, Math.round(L / Math.max(spacing, 1e-6))))
  const out: Point2D[] = []
  const d = L / count
  let i = 0, acc = 0
  for (let k = 0; k < count; k++) {
    const t = k * d
    while (i < n - 1 && acc + seg[i] < t) { acc += seg[i]; i++ }
    const a = polygon[i], b = polygon[(i + 1) % n]
    const f = seg[i] > 0 ? (t - acc) / seg[i] : 0
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
  }
  return out
}

/** Undirected edge adjacency in CSR form with summed cotangent weights. */
function buildCotangentCSR(coords: Float64Array, triangles: Uint32Array, numVerts: number) {
  // collect directed half-edges (v0 -> v1) with the cotangent of the opposite corner
  const nT = triangles.length / 3
  const hv0 = new Uint32Array(nT * 3), hv1 = new Uint32Array(nT * 3), hw = new Float64Array(nT * 3)
  for (let t = 0; t < nT; t++) {
    for (let e = 0; e < 3; e++) {
      const v0 = triangles[t * 3 + e], v1 = triangles[t * 3 + ((e + 1) % 3)], v2 = triangles[t * 3 + ((e + 2) % 3)]
      const dx0 = coords[v0 * 2] - coords[v2 * 2], dy0 = coords[v0 * 2 + 1] - coords[v2 * 2 + 1]
      const dx1 = coords[v1 * 2] - coords[v2 * 2], dy1 = coords[v1 * 2 + 1] - coords[v2 * 2 + 1]
      let cot = (dx0 * dx1 + dy0 * dy1) / (dx0 * dy1 - dy0 * dx1 + 1e-10)
      if (cot < 0) cot = 0.1 // obtuse fallback (as before)
      cot = Math.min(10, cot)
      const h = t * 3 + e
      hv0[h] = v0; hv1[h] = v1; hw[h] = cot * 0.5
    }
  }
  // degree count: each undirected edge appears for both endpoints
  const deg = new Uint32Array(numVerts + 1)
  for (let h = 0; h < hv0.length; h++) { deg[hv0[h]]++; deg[hv1[h]]++ }
  const off = new Uint32Array(numVerts + 1)
  for (let v = 0; v < numVerts; v++) off[v + 1] = off[v] + deg[v]
  const nbr = new Int32Array(off[numVerts]).fill(-1)
  const wt = new Float64Array(off[numVerts])
  const fill = off.slice(0, numVerts)
  const addTo = (a: number, b: number, w: number) => {
    // merge duplicates (an interior edge is shared by two triangles)
    for (let k = off[a]; k < fill[a]; k++) if (nbr[k] === b) { wt[k] += w; return }
    nbr[fill[a]] = b; wt[fill[a]] = w; fill[a]++
  }
  for (let h = 0; h < hv0.length; h++) { addTo(hv0[h], hv1[h], hw[h]); addTo(hv1[h], hv0[h], hw[h]) }
  return { off, end: fill, nbr, wt }
}

type CSR = ReturnType<typeof buildCotangentCSR>

/** Δu = rhs with u = 0 on the boundary, Gauss-Seidel (same scheme and iteration count as before). */
function solvePoisson(csr: CSR, boundary: Uint8Array, rhs: Float32Array, numVerts: number) {
  const u = new Float32Array(numVerts)
  const { off, end, nbr, wt } = csr
  for (let iter = 0; iter < 80; iter++) {
    let maxChange = 0
    for (let i = 0; i < numVerts; i++) {
      if (boundary[i]) continue
      let sum = 0, ws = 0
      for (let k = off[i]; k < end[i]; k++) { const w = wt[k]; sum += w * u[nbr[k]]; ws += w }
      if (ws > 1e-10) {
        const nv = (sum - rhs[i]) / ws
        const ch = Math.abs(nv - u[i])
        if (ch > maxChange) maxChange = ch
        u[i] = nv
      }
    }
    if (maxChange < 1e-5) break
  }
  return u
}

// ============================================================================
// Height Profile
// ============================================================================

// Illustrator-like inflate profile: flatter top, steeper sides
// r=0 → boundary (height=0), r=1 → center (height=peak)
// Formula: z = (1 - (1-r)^n)^m
// At r=0: (1 - 1)^m = 0 ✓  At r=1: (1 - 0)^m = 1 ✓
// n controls how quickly it rises from boundary, m controls flatness of top
function inflateProfile(r: number, n = 2.47, m = 0.43): number {
  const clamped = Math.max(0, Math.min(1, r))
  return Math.pow(1 - Math.pow(1 - clamped, n), m)
}

// Sharp ridge (voronoi) profile: raw SDF creates a tent/pyramid with a sharp
// ridge along the medial axis of the polygon.
// r=0 → boundary (zero height), r=1 → medial axis peak (sharp)
// sharpness 1 = very soft cone, 10 = very sharp needle-like ridge
function sharpRidgeProfile(r: number, sharpness = 5): number {
  const clamped = Math.max(0, Math.min(1, r))
  // Map sharpness 1-10 → power 0.3-1.5
  // Low power (<1) = sharp tent peak; high power (>1) = rounded cone
  const power = 0.3 + (1 - (sharpness - 1) / 9) * 1.2
  return Math.pow(clamped, power)
}

// ============================================================================
// Main Pipeline
// ============================================================================

/** Everything that depends only on the contour and the grid resolution (the expensive part). */
interface InflateBase {
  coords: Float64Array
  numVerts: number
  triangles: Uint32Array
  boundary: Uint8Array
  csr: CSR
  dome: Float32Array // smooth Poisson field, 0 on boundary … 1 at the centre
  sdf: Float32Array // raw distance-to-edge field, 0 … 1 (sharp medial ridges)
  boundaryEdges: Uint32Array // pairs of front-face vertex ids on the outline
  cx: number
  cy: number
  size: number
}

const BASE_CACHE = new WeakMap<Point2D[], Map<number, InflateBase | null>>()

function prepareInflate(polygonIn: Point2D[], gridResolution: number): InflateBase | null {
  const bounds = getBounds(polygonIn)
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  if (w < 1 || h < 1) return null
  const size = Math.max(w, h)
  const cx = bounds.minX + w * 0.5
  const cy = bounds.minY + h * 0.5

  const steinerDensity = Math.max(8, Math.floor(gridResolution * 0.6))
  const step = size / steinerDensity
  // boundary sampled at roughly the interior spacing (was: every input point × N subdivisions)
  const polygon = resampleClosed(polygonIn, step * 0.75)
  const P = polygon.length

  const pts: number[] = []
  const nB = P
  for (const p of polygon) pts.push(p.x, p.y)

  // interior Steiner grid — scanline inside test per row instead of a full ray test per point
  const xs: number[] = []
  for (let row = 0; row < steinerDensity; row++) {
    const y = bounds.minY + row * step + step * 0.5
    xs.length = 0
    for (let i = 0, j = P - 1; i < P; j = i++) {
      const yi = polygon[i].y, yj = polygon[j].y
      if (yi > y !== yj > y) xs.push(((polygon[j].x - polygon[i].x) * (y - yi)) / (yj - yi) + polygon[i].x)
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    for (let col = 0; col < steinerDensity; col++) {
      const x = bounds.minX + col * step + step * 0.5
      let inside = false
      for (let k = 0; k < xs.length && xs[k] < x; k++) inside = !inside
      if (inside && distToEdge(x, y, polygon) > step * 0.3) pts.push(x, y)
    }
  }

  const coords = Float64Array.from(pts)
  const numVerts = coords.length / 2
  if (numVerts < 3) return null

  let del: Delaunator<ArrayLike<number>>
  try {
    del = new Delaunator(coords)
  } catch (e) {
    console.error('[v0] Delaunay triangulation failed:', e)
    return null
  }
  const raw = del.triangles
  const tri: number[] = []
  for (let i = 0; i < raw.length; i += 3) {
    const a = raw[i], b = raw[i + 1], c = raw[i + 2]
    const mx = (coords[a * 2] + coords[b * 2] + coords[c * 2]) / 3
    const my = (coords[a * 2 + 1] + coords[b * 2 + 1] + coords[c * 2 + 1]) / 3
    if (pointInPolygon(mx, my, polygon)) tri.push(a, b, c)
  }
  if (tri.length < 3) return null
  const triangles = Uint32Array.from(tri)

  const boundary = new Uint8Array(numVerts)
  for (let i = 0; i < nB; i++) boundary[i] = 1

  const csr = buildCotangentCSR(coords, triangles, numVerts)

  // smooth dome: Δu = -1, u = 0 on the boundary, normalised over interior vertices
  const rhs = new Float32Array(numVerts)
  for (let i = 0; i < numVerts; i++) rhs[i] = boundary[i] ? 0 : -1
  const field = solvePoisson(csr, boundary, rhs, numVerts)
  let minF = Infinity, maxF = -Infinity
  for (let i = 0; i < numVerts; i++) if (!boundary[i]) { if (field[i] < minF) minF = field[i]; if (field[i] > maxF) maxF = field[i] }
  const range = maxF - minF
  const dome = new Float32Array(numVerts)
  for (let i = 0; i < numVerts; i++) dome[i] = boundary[i] || !(range > 1e-10) ? 0 : (field[i] - minF) / range

  // raw SDF for the sharp-ridge mode
  const sdf = new Float32Array(numVerts)
  let maxSdf = 0
  for (let i = 0; i < numVerts; i++) {
    if (boundary[i]) continue
    const d = distToEdge(coords[i * 2], coords[i * 2 + 1], polygon)
    sdf[i] = d
    if (d > maxSdf) maxSdf = d
  }
  if (maxSdf > 0) for (let i = 0; i < numVerts; i++) sdf[i] /= maxSdf

  // outline edges (used once by exactly one triangle) for stitching the two halves
  const edgeUse = new Map<number, number>()
  const key = (a: number, b: number) => (a < b ? a * numVerts + b : b * numVerts + a)
  for (let i = 0; i < triangles.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const k = key(triangles[i + j], triangles[i + ((j + 1) % 3)])
      edgeUse.set(k, (edgeUse.get(k) || 0) + 1)
    }
  const be: number[] = []
  for (let i = 0; i < triangles.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = triangles[i + j], b = triangles[i + ((j + 1) % 3)]
      if (edgeUse.get(key(a, b)) === 1) be.push(a, b)
    }

  return { coords, numVerts, triangles, boundary, csr, dome, sdf, boundaryEdges: Uint32Array.from(be), cx, cy, size }
}

/** Cheap part: heights + buffers. Volume / smoothing / ridge / double-sided changes only run this. */
function buildInflated(base: InflateBase, opts: InflateOptions): THREE.BufferGeometry {
  const { coords, numVerts, triangles, boundary, csr, dome, sdf, boundaryEdges, cx, cy, size } = base
  const heights = new Float32Array(numVerts)
  const tmp = new Float32Array(numVerts)
  const smoothPass = (keep: number) => {
    tmp.set(heights)
    for (let i = 0; i < numVerts; i++) {
      if (boundary[i]) continue
      const a = csr.off[i], b = csr.end[i]
      if (b === a) continue
      let sum = 0
      for (let k = a; k < b; k++) sum += heights[csr.nbr[k]]
      tmp[i] = (sum / (b - a)) * (1 - keep) + heights[i] * keep
    }
    heights.set(tmp)
  }
  if (opts.sharpRidge) {
    for (let i = 0; i < numVerts; i++) heights[i] = sharpRidgeProfile(sdf[i], opts.ridgeSharpness ?? 5) * opts.amount
    smoothPass(0.85)
  } else {
    for (let i = 0; i < numVerts; i++) heights[i] = inflateProfile(dome[i]) * opts.amount
    const it = Math.max(2, opts.smoothingIterations * 3)
    for (let k = 0; k < it; k++) smoothPass(0.4)
  }

  const scale = 2 / size
  const halves = opts.doubleSided ? 2 : 1
  const pos = new Float32Array(numVerts * 3 * halves)
  const uv = new Float32Array(numVerts * 2 * halves)
  for (let hlf = 0; hlf < halves; hlf++) {
    const sgn = hlf === 0 ? 1 : -1
    for (let i = 0; i < numVerts; i++) {
      const o = (hlf * numVerts + i)
      const x = (coords[i * 2] - cx) * scale
      const y = -(coords[i * 2 + 1] - cy) * scale
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = sgn * heights[i] * scale
      uv[o * 2] = (x + 1) * 0.5; uv[o * 2 + 1] = (y + 1) * 0.5
    }
  }
  const idxCount = triangles.length * halves + (opts.doubleSided ? boundaryEdges.length * 3 : 0)
  const index = numVerts * halves > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount)
  index.set(triangles)
  let o = triangles.length
  if (opts.doubleSided) {
    for (let i = 0; i < triangles.length; i += 3) {
      index[o++] = triangles[i + 2] + numVerts
      index[o++] = triangles[i + 1] + numVerts
      index[o++] = triangles[i] + numVerts
    }
    for (let i = 0; i < boundaryEdges.length; i += 2) {
      const a = boundaryEdges[i], b = boundaryEdges[i + 1]
      index[o++] = a; index[o++] = b + numVerts; index[o++] = b
      index[o++] = a; index[o++] = a + numVerts; index[o++] = b + numVerts
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  geo.computeVertexNormals()
  return geo
}

export function inflatePolygon(
  polygon: Point2D[],
  options: Partial<InflateOptions> = {},
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  if (polygon.length < 3) return null
  let byGrid = BASE_CACHE.get(polygon)
  if (!byGrid) { byGrid = new Map(); BASE_CACHE.set(polygon, byGrid) }
  let base = byGrid.get(opts.gridResolution)
  if (base === undefined) {
    base = prepareInflate(polygon, opts.gridResolution)
    byGrid.set(opts.gridResolution, base)
  }
  return base ? buildInflated(base, opts) : null
}

export const createInflatedGeometry = inflatePolygon
