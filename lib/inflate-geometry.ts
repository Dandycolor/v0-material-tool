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
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  smoothingIterations: 3,
  doubleSided: true,
  gridResolution: 150,
  steinerPoints: 200,
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
// Mesh Operations
// ============================================================================

interface HalfEdge {
  vert: number
  twin?: number
  next: number
  face: number
}

function buildHalfEdgeMesh(coords: number[], triangles: number[]) {
  const numTris = triangles.length / 3
  const halfEdges: HalfEdge[] = []
  
  // Create half-edges for each triangle
  for (let t = 0; t < numTris; t++) {
    for (let e = 0; e < 3; e++) {
      const i = t * 3 + e
      halfEdges.push({
        vert: triangles[t * 3 + e],
        next: t * 3 + ((e + 1) % 3),
        face: t,
      })
    }
  }
  
  // Link twins
  const edgeMap = new Map<string, number>()
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i]
    const v0 = he.vert
    const v1 = halfEdges[he.next].vert
    const key = `${Math.min(v0, v1)}:${Math.max(v0, v1)}`
    const twin = edgeMap.get(key)
    if (twin !== undefined) {
      halfEdges[i].twin = twin
      halfEdges[twin].twin = i
    } else {
      edgeMap.set(key, i)
    }
  }
  
  return halfEdges
}

function buildVertexNeighbors(coords: number[], halfEdges: HalfEdge[]) {
  const numVerts = coords.length / 2
  const neighbors: number[][] = Array.from({ length: numVerts }, () => [])
  
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i]
    const v0 = he.vert
    const v1 = halfEdges[he.next].vert
    if (!neighbors[v0].includes(v1)) {
      neighbors[v0].push(v1)
    }
  }
  
  return neighbors
}

// Cotangent Laplacian weights
function computeCotangentWeights(coords: number[], halfEdges: HalfEdge[]) {
  const numVerts = coords.length / 2
  const weights = new Map<string, number>()
  
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i]
    const v0 = he.vert
    const v1 = halfEdges[he.next].vert
    const v2 = halfEdges[halfEdges[he.next].next].vert
    
    // Cotangent at v2 for edge v0-v1
    const x0 = coords[v0 * 2], y0 = coords[v0 * 2 + 1]
    const x1 = coords[v1 * 2], y1 = coords[v1 * 2 + 1]
    const x2 = coords[v2 * 2], y2 = coords[v2 * 2 + 1]
    
    const dx0 = x0 - x2, dy0 = y0 - y2
    const dx1 = x1 - x2, dy1 = y1 - y2
    
    const dot = dx0 * dx1 + dy0 * dy1
    const cross = dx0 * dy1 - dy0 * dx1
    
    let cot = dot / (cross + 1e-10)
    // For obtuse triangles (cot < 0), use a fallback uniform weight
    // to avoid negative Laplacian weights which cause inversions
    if (cot < 0) cot = 0.1
    cot = Math.min(10, cot) // Clamp for stability
    
    const key = `${Math.min(v0, v1)}:${Math.max(v0, v1)}`
    weights.set(key, (weights.get(key) || 0) + cot * 0.5)
  }
  
  return weights
}

// Solve Poisson equation: Δu = f using cotangent Laplacian (Gauss-Seidel)
function solvePoissonCotangent(
  coords: number[],
  neighbors: number[][],
  weights: Map<string, number>,
  boundary: Set<number>,
  boundaryValues: Map<number, number>,
  rhs: Float32Array,
): Float32Array {
  const numVerts = coords.length / 2
  const u = new Float32Array(numVerts)
  
  // Initialize interior with average of boundary
  let avgBoundary = 0
  let bCount = 0
  boundaryValues.forEach(v => { avgBoundary += v; bCount++ })
  if (bCount > 0) avgBoundary /= bCount
  
  for (let i = 0; i < numVerts; i++) u[i] = avgBoundary
  boundary.forEach(i => { u[i] = boundaryValues.get(i) || 0 })
  
  // Gauss-Seidel iterations (faster convergence than Jacobi)
  for (let iter = 0; iter < 80; iter++) {
    let maxChange = 0
    
    for (let i = 0; i < numVerts; i++) {
      if (boundary.has(i)) continue
      
      let sum = 0
      let weightSum = 0
      
      for (const j of neighbors[i]) {
        const key = `${Math.min(i, j)}:${Math.max(i, j)}`
        const w = weights.get(key) || 0
        sum += w * u[j]
        weightSum += w
      }
      
      if (weightSum > 1e-10) {
        const newVal = (sum - rhs[i]) / weightSum
        maxChange = Math.max(maxChange, Math.abs(newVal - u[i]))
        u[i] = newVal
      }
    }
    
    // Early exit if converged
    if (maxChange < 1e-5) break
  }
  
  return u
}

// Solve biharmonic equation: ∇⁴u = 0 via two Poisson solves
function solveBiharmonic(
  coords: number[],
  neighbors: number[][],
  weights: Map<string, number>,
  boundary: Set<number>,
  boundaryValues: Map<number, number>,
): Float32Array {
  const numVerts = coords.length / 2
  
  // First solve: Δv = 0 with v = 1 on boundary, v = 0 elsewhere (initial guess)
  const rhs1 = new Float32Array(numVerts)
  const v = solvePoissonCotangent(coords, neighbors, weights, boundary, boundaryValues, rhs1)
  
  // Second solve: Δu = v with u = 0 on boundary
  const boundaryZero = new Map<number, number>()
  boundary.forEach(i => boundaryZero.set(i, 0))
  const u = solvePoissonCotangent(coords, neighbors, weights, boundary, boundaryZero, v)
  
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

// ============================================================================
// Main Pipeline
// ============================================================================

export function inflatePolygon(
  polygon: Point2D[],
  options: Partial<InflateOptions> = {},
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (polygon.length < 3) return null

  const bounds = getBounds(polygon)
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  if (w < 1 || h < 1) return null

  const size = Math.max(w, h)
  const cx = bounds.minX + w * 0.5
  const cy = bounds.minY + h * 0.5

  // ── Step 1: Generate vertices ─────────────────────────────────────────────
  // Add boundary vertices
  const coords: number[] = []
  const boundaryIndices = new Set<number>()
  
  for (const p of polygon) {
    boundaryIndices.add(coords.length / 2)
    coords.push(p.x, p.y)
  }
  
  // Add Steiner points inside polygon
  const steinerDensity = Math.floor(Math.sqrt(opts.steinerPoints || 200))
  const step = size / steinerDensity
  
  for (let row = 0; row < steinerDensity; row++) {
    for (let col = 0; col < steinerDensity; col++) {
      const x = bounds.minX + col * step + step * 0.5
      const y = bounds.minY + row * step + step * 0.5
      
      if (pointInPolygon(x, y, polygon)) {
        const dist = distToEdge(x, y, polygon)
        if (dist > step * 0.3) { // Avoid points too close to boundary
          coords.push(x, y)
        }
      }
    }
  }

  const numVerts = coords.length / 2
  if (numVerts < 3) return null

  // ── Step 2: Delaunay triangulation ────────────────────────────────────────
  let triangulation: Delaunator<ArrayLike<number>>
  try {
    triangulation = new Delaunator(coords)
  } catch (e) {
    console.error('[v0] Delaunay triangulation failed:', e)
    return null
  }

  // Filter triangles to only those inside the polygon (Delaunay builds convex hull)
  const rawTriangles = triangulation.triangles
  const triangles: number[] = []

  for (let i = 0; i < rawTriangles.length; i += 3) {
    const a = rawTriangles[i], b = rawTriangles[i + 1], c = rawTriangles[i + 2]
    // Centroid of triangle
    const mx = (coords[a * 2] + coords[b * 2] + coords[c * 2]) / 3
    const my = (coords[a * 2 + 1] + coords[b * 2 + 1] + coords[c * 2 + 1]) / 3
    if (pointInPolygon(mx, my, polygon)) {
      triangles.push(a, b, c)
    }
  }

  if (triangles.length < 3) return null

  // ── Step 3: Build mesh data structures ────────────────────────────────────
  const halfEdges = buildHalfEdgeMesh(coords, triangles)
  const neighbors = buildVertexNeighbors(coords, halfEdges)
  const weights = computeCotangentWeights(coords, halfEdges)
  
  // ── Step 4: Solve for smooth scalar field ─────────────────────────────────
  // Harmonic field: boundary = 0, interior solved so it rises toward center.
  // We use: Δu = 0, u = 0 on boundary.
  // Since all boundary is 0, interior naturally gets non-zero values via the
  // second Poisson solve in biharmonic. We instead solve a plain harmonic
  // where boundary = 0 and we use the "distance" metric to drive it.
  //
  // Simpler & more reliable: solve Δu = -1 with u = 0 on boundary.
  // This is the classic "drum membrane" / Poisson equation which gives a
  // smooth dome-shaped field that peaks at the medial center.
  
  const boundaryZero = new Map<number, number>()
  boundaryIndices.forEach(i => boundaryZero.set(i, 0))
  
  const negOne = new Float32Array(numVerts)
  for (let i = 0; i < numVerts; i++) {
    negOne[i] = boundaryIndices.has(i) ? 0 : -1
  }
  
  const harmonicField = solvePoissonCotangent(coords, neighbors, weights, boundaryIndices, boundaryZero, negOne)
  
  // Normalize to [0, 1] across interior vertices only
  let minF = Infinity, maxF = -Infinity
  for (let i = 0; i < numVerts; i++) {
    if (!boundaryIndices.has(i)) {
      if (harmonicField[i] < minF) minF = harmonicField[i]
      if (harmonicField[i] > maxF) maxF = harmonicField[i]
    }
  }
  
  console.log('[v0] inflate field: numVerts=', numVerts, 'boundary=', boundaryIndices.size, 'interior minF=', minF, 'maxF=', maxF)
  
  const normalizedField = new Float32Array(numVerts)
  const range = maxF - minF
  for (let i = 0; i < numVerts; i++) {
    if (boundaryIndices.has(i)) {
      normalizedField[i] = 0
    } else {
      normalizedField[i] = range > 1e-10 ? (harmonicField[i] - minF) / range : 0
    }
  }
  
  // ── Step 5: Apply height profile ──────────────────────────────────────────
  // r=0 → boundary (zero height), r=1 → center (peak height)
  // inflateProfile(r) = (1 - (1-r)^n)^m gives dome shape
  const heights = new Float32Array(numVerts)
  let minH = Infinity, maxH = -Infinity
  for (let i = 0; i < numVerts; i++) {
    const r = normalizedField[i]
    heights[i] = inflateProfile(r) * opts.amount
    if (heights[i] < minH) minH = heights[i]
    if (heights[i] > maxH) maxH = heights[i]
  }
  console.log('[v0] inflate heights: min=', minH, 'max=', maxH, 'amount=', opts.amount)
  
  // ── Step 6: Build BufferGeometry ──────────────────────────────────────────
  const scale = 2 / size
  const positions: number[] = []
  const indexArr: number[] = []

  // Front face: Y-flipped for correct orientation
  for (let i = 0; i < numVerts; i++) {
    positions.push(
      (coords[i * 2] - cx) * scale,
      -(coords[i * 2 + 1] - cy) * scale,
      heights[i] * scale,
    )
  }

  // Front triangles: CCW winding after Y-flip
  for (let i = 0; i < triangles.length; i += 3) {
    indexArr.push(triangles[i], triangles[i + 1], triangles[i + 2])
  }

  if (opts.doubleSided) {
    // Back face
    for (let i = 0; i < numVerts; i++) {
      positions.push(
        (coords[i * 2] - cx) * scale,
        -(coords[i * 2 + 1] - cy) * scale,
        -heights[i] * scale,
      )
    }

    // Back triangles: reversed winding
    for (let i = 0; i < triangles.length; i += 3) {
      indexArr.push(
        triangles[i + 2] + numVerts,
        triangles[i + 1] + numVerts,
        triangles[i] + numVerts,
      )
    }

    // Stitch boundary edges
    const edgeCount = new Map<string, { a: number; b: number; count: number }>()

    for (let i = 0; i < triangles.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = triangles[i + j]
        const b = triangles[i + (j + 1) % 3]
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        const existing = edgeCount.get(key)
        if (existing) {
          existing.count++
        } else {
          edgeCount.set(key, { a, b, count: 1 })
        }
      }
    }

    edgeCount.forEach(({ a, b, count }) => {
      if (count !== 1) return
      const fa = a, fb = b
      const ba = a + numVerts, bb = b + numVerts
      indexArr.push(fa, bb, fb)
      indexArr.push(fa, ba, bb)
    })
  }

  // Generate UVs
  const uvs: number[] = []
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    uvs.push((x + 1) * 0.5, (y + 1) * 0.5)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indexArr)
  geo.computeVertexNormals()

  return geo
}

export const createInflatedGeometry = inflatePolygon
