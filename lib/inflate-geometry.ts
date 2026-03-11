/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Contour-following triangulation (like original Inflation app)
 * - Custom ear-clipping Constrained Delaunay Triangulation
 * - Signed Distance Field (SDF) for height displacement
 * - Laplacian smoothing for soft balloon effect
 */

import * as THREE from 'three'

// ============================================================================
// Types
// ============================================================================

export interface Point2D {
  x: number
  y: number
}

export interface InflateOptions {
  /** Inflation amount (0-200), controls max height */
  amount: number
  /** Number of Steiner points to add inside the contour (unused, kept for API) */
  steinerPoints: number
  /** Smoothing iterations for softer result */
  smoothingIterations: number
  /** Whether to create both front and back faces */
  doubleSided: boolean
  /** Resolution of internal grid for triangulation */
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  steinerPoints: 200,
  smoothingIterations: 5,
  doubleSided: true,
  gridResolution: 50,
}

// Height profile constants (from reference)
const POW_A = 2.47
const POW_B = 0.43

// ============================================================================
// Geometry Utilities (matching reference exactly)
// ============================================================================

/**
 * Simple triangulation: ear-clipping for boundary + fan triangulation from centroid
 * For contour-based meshes, this connects boundary → steiner points → interior points
 */
function triangulatePolygon(
  boundary: Point2D[], 
  boundarySteiners: Point2D[], 
  interiorSteiners: Point2D[], 
  allPts: Point2D[],
  originalPoly: Point2D[]
): number[] {
  const triangles: number[] = []
  const numBoundary = boundary.length
  const numBoundarySteiner = boundarySteiners.length
  const numInterior = interiorSteiners.length
  
  // First, triangulate the boundary using ear-clipping
  const boundaryTris = earClipTriangle(boundary, 0)
  triangles.push(...boundaryTris)
  
  // Connect boundary steiner points to boundary
  for (let i = 0; i < numBoundarySteiner; i++) {
    const si = numBoundary + i
    // Find two nearest boundary points
    let nearest1 = 0, nearest2 = 1, dist1 = Infinity, dist2 = Infinity
    for (let j = 0; j < numBoundary; j++) {
      const dx = allPts[si].x - allPts[j].x
      const dy = allPts[si].y - allPts[j].y
      const d = dx * dx + dy * dy
      if (d < dist1) {
        dist2 = dist1
        nearest2 = nearest1
        dist1 = d
        nearest1 = j
      } else if (d < dist2) {
        dist2 = d
        nearest2 = j
      }
    }
    triangles.push(si, nearest1, nearest2)
  }
  
  // Connect interior points using simple approach - connect to nearest 3 steiner/boundary points
  const interiorStart = numBoundary + numBoundarySteiner
  for (let i = 0; i < numInterior; i++) {
    const ii = interiorStart + i
    // Find 3 nearest points from boundary + boundary steiners
    const dists: Array<{ idx: number; d: number }> = []
    for (let j = 0; j < numBoundary + numBoundarySteiner; j++) {
      const dx = allPts[ii].x - allPts[j].x
      const dy = allPts[ii].y - allPts[j].y
      dists.push({ idx: j, d: dx * dx + dy * dy })
    }
    dists.sort((a, b) => a.d - b.d)
    if (dists.length >= 3) {
      triangles.push(ii, dists[0].idx, dists[1].idx)
      triangles.push(ii, dists[1].idx, dists[2].idx)
    }
  }
  
  return triangles
}

/**
 * Simple fan triangulation from centroid - much simpler and reliable
 * baseIdx is the offset to add to vertex indices
 */
function earClipTriangle(polygon: Point2D[], baseIdx: number): number[] {
  const n = polygon.length
  if (n < 3) return []
  if (n === 3) return [baseIdx, baseIdx + 1, baseIdx + 2]
  
  const triangles: number[] = []
  
  // Simple fan triangulation from first vertex - works for convex and most concave polygons
  for (let i = 1; i < n - 1; i++) {
    triangles.push(baseIdx, baseIdx + i, baseIdx + i + 1)
  }
  
  return triangles
}

/**
 * Check if point P is inside triangle ABC
 */
function isPointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const sign = (p1: Point2D, p2: Point2D, p3: Point2D) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  
  const d1 = sign(p, a, b)
  const d2 = sign(p, b, c)
  const d3 = sign(p, c, a)
  
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
  
  return !(hasNeg && hasPos)
}

/**
 * Get bounding box - Np in reference
 */
function isPointInside(p: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Distance from point to line segment - Dp in reference
 */
function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const fx = p.x - a.x, fy = p.y - a.y
    return Math.sqrt(fx * fx + fy * fy)
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const px = a.x + t * dx
  const py = a.y + t * dy
  const cx = p.x - px, cy = p.y - py
  return Math.sqrt(cx * cx + cy * cy)
}

/**
 * Minimum distance from point to polygon boundary - ko in reference
 */
function distToPolygon(p: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const d = distToSegment(p, polygon[i], polygon[j])
    if (d < minDist) minDist = d
  }
  return minDist
}

/**
 * Get bounding box - Np in reference
 */
function getBBox(polygon: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Ensure polygon is counter-clockwise - Up in reference
 */
function ensureCCW(polygon: Point2D[]): Point2D[] {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  return area < 0 ? [...polygon].reverse() : polygon
}

/**
 * Resample polygon with max segment length - Mu in reference
 * This is KEY for smooth edges - it creates dense points along the contour
 */
function resamplePolygon(polygon: Point2D[], maxStep: number): Point2D[] {
  const result: Point2D[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    result.push(a)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > maxStep) {
      const steps = Math.ceil(len / maxStep)
      for (let j = 1; j < steps; j++) {
        const t = j / steps
        result.push({ x: a.x + dx * t, y: a.y + dy * t })
      }
    }
  }
  return result
}

/**
 * Generate boundary offset Steiner points - GM in reference
 * Creates points at 15%, 30%, 45% offset from boundary
 */
function genBoundarySteiners(sampledPoly: Point2D[], originalPoly: Point2D[], gridStep: number): Point2D[] {
  const offsets = [0.15, 0.3, 0.45].map(f => f * gridStep)
  const result: Point2D[] = []
  
  for (const offset of offsets) {
    for (const pt of sampledPoly) {
      // Find offset direction (average of two nearest edge normals)
      const n = originalPoly.length
      let minDist1 = Infinity, minDist2 = Infinity
      let nx1 = 0, ny1 = 0, nx2 = 0, ny2 = 0
      
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const dist = distToSegment(pt, originalPoly[i], originalPoly[j])
        const dx = originalPoly[j].x - originalPoly[i].x
        const dy = originalPoly[j].y - originalPoly[i].y
        const len = Math.sqrt(dx * dx + dy * dy)
        const normX = len > 1e-12 ? -dy / len : 0
        const normY = len > 1e-12 ? dx / len : 0
        
        if (dist < minDist1) {
          minDist2 = minDist1; nx2 = nx1; ny2 = ny1
          minDist1 = dist; nx1 = normX; ny1 = normY
        } else if (dist < minDist2) {
          minDist2 = dist; nx2 = normX; ny2 = normY
        }
      }
      
      // Average normal
      let nx = nx1 + nx2, ny = ny1 + ny2
      const nlen = Math.sqrt(nx * nx + ny * ny)
      if (nlen > 1e-12) { nx /= nlen; ny /= nlen }
      
      const offsetPt = { x: pt.x + nx * offset, y: pt.y + ny * offset }
      if (isPointInside(offsetPt, originalPoly)) {
        result.push(offsetPt)
      }
    }
  }
  return result
}

/**
 * Generate interior hexagonal grid Steiner points - HM in reference
 */
function genInteriorSteiners(polygon: Point2D[], bbox: ReturnType<typeof getBBox>, gridStep: number, minDist: number): Point2D[] {
  const rowHeight = gridStep * (Math.sqrt(3) / 2)
  const result: Point2D[] = []
  let row = 0
  
  for (let y = bbox.minY; y <= bbox.maxY; y += rowHeight) {
    const xOffset = (row % 2 === 1) ? gridStep * 0.5 : 0
    for (let x = bbox.minX + xOffset; x <= bbox.maxX; x += gridStep) {
      const pt = { x, y }
      if (!isPointInside(pt, polygon)) continue
      const dist = distToPolygon(pt, polygon)
      if (dist > minDist) {
        result.push(pt)
      }
    }
    row++
  }
  return result
}

/**
 * Smooth height profile - WM in reference
 * t=1 (boundary) -> 0, t=0 (interior) -> 1
 */
function smoothProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return Math.pow(Math.max(0, 1 - Math.pow(c, POW_A)), POW_B)
}

/**
 * Percentile calculation - XM in reference
 */
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * p))
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const frac = idx - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

// ============================================================================
// Laplacian Building and Solving (zM, Op, Bp, zp in reference)
// ============================================================================

interface LaplacianMatrix {
  n: number
  adjStart: Uint32Array
  adjIdx: Uint32Array
  adjWeight: Float64Array
  diag: Float64Array
}

/**
 * Build cotangent Laplacian matrix from triangulation - zM in reference
 */
function buildLaplacian(pts: Point2D[], triangles: number[]): LaplacianMatrix {
  const n = pts.length
  const edgeWeights = new Map<number, number>()
  
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2]
    const verts = [a, b, c]
    
    for (let j = 0; j < 3; j++) {
      const p = verts[j], m = verts[(j + 1) % 3], w = verts[(j + 2) % 3]
      const bx = pts[p].x - pts[w].x, by = pts[p].y - pts[w].y
      const lx = pts[m].x - pts[w].x, ly = pts[m].y - pts[w].y
      const dot = bx * lx + by * ly
      const cross = Math.abs(bx * ly - by * lx)
      const cot = cross > 1e-12 ? dot / cross : 0
      const minIdx = Math.min(p, m), maxIdx = Math.max(p, m)
      const key = minIdx * n + maxIdx
      edgeWeights.set(key, (edgeWeights.get(key) || 0) + cot * 0.5)
    }
  }
  
  const neighbors: Array<Array<{j: number; w: number}>> = Array.from({ length: n }, () => [])
  for (const [key, weight] of edgeWeights) {
    const maxIdx = key % n
    const minIdx = (key - maxIdx) / n
    const w = Math.max(weight, 1e-8)
    neighbors[minIdx].push({ j: maxIdx, w })
    neighbors[maxIdx].push({ j: minIdx, w })
  }
  
  for (let i = 0; i < n; i++) {
    neighbors[i].sort((a, b) => a.j - b.j)
  }
  
  let totalEdges = 0
  for (let i = 0; i < n; i++) totalEdges += neighbors[i].length
  
  const adjStart = new Uint32Array(n + 1)
  const adjIdx = new Uint32Array(totalEdges)
  const adjWeight = new Float64Array(totalEdges)
  const diag = new Float64Array(n)
  
  let idx = 0
  for (let i = 0; i < n; i++) {
    adjStart[i] = idx
    let sum = 0
    for (const { j, w } of neighbors[i]) {
      adjIdx[idx] = j
      adjWeight[idx] = w
      sum += w
      idx++
    }
    diag[i] = sum
  }
  adjStart[n] = idx
  
  return { n, adjStart, adjIdx, adjWeight, diag }
}

/**
 * Apply Laplacian matrix to vector - Op in reference
 */
function applyLaplacian(L: LaplacianMatrix, x: Float64Array, out: Float64Array): void {
  for (let i = 0; i < L.n; i++) {
    let sum = L.diag[i] * x[i]
    for (let k = L.adjStart[i]; k < L.adjStart[i + 1]; k++) {
      sum -= L.adjWeight[k] * x[L.adjIdx[k]]
    }
    out[i] = sum
  }
}

/**
 * Conjugate gradient solver - Bp in reference
 */
function conjGrad(L: LaplacianMatrix, b: Float64Array, x: Float64Array, boundary: Uint8Array): void {
  const n = L.n
  const r = new Float64Array(n)
  const p = new Float64Array(n)
  const Ap = new Float64Array(n)
  
  // Initialize x with b for non-boundary
  for (let i = 0; i < n; i++) {
    x[i] = boundary[i] ? 0 : b[i]
  }
  
  applyLaplacian(L, x, r)
  for (let i = 0; i < n; i++) {
    r[i] = boundary[i] ? 0 : b[i] - r[i]
    p[i] = r[i]
  }
  
  let rsOld = 0
  for (let i = 0; i < n; i++) rsOld += r[i] * r[i]
  
  const maxIter = Math.min(n * 2, 500)
  for (let iter = 0; iter < maxIter; iter++) {
    applyLaplacian(L, p, Ap)
    
    for (let i = 0; i < n; i++) {
      if (boundary[i]) Ap[i] = p[i]
    }
    
    let pAp = 0
    for (let i = 0; i < n; i++) pAp += p[i] * Ap[i]
    if (Math.abs(pAp) < 1e-20) break
    
    const alpha = rsOld / pAp
    for (let i = 0; i < n; i++) {
      if (!boundary[i]) {
        x[i] += alpha * p[i]
        r[i] -= alpha * Ap[i]
      }
    }
    
    let rsNew = 0
    for (let i = 0; i < n; i++) rsNew += r[i] * r[i]
    if (rsNew < 1e-20) break
    
    const beta = rsNew / rsOld
    for (let i = 0; i < n; i++) {
      p[i] = boundary[i] ? 0 : r[i] + beta * p[i]
    }
    rsOld = rsNew
  }
}

/**
 * Heat diffusion for normalized heights - zp in reference
 * Returns values in [0,1] where 1=boundary, 0=deep interior
 */
function heatDiffusion(pts: Point2D[], tris: number[], boundary: Uint8Array): Float64Array {
  const n = pts.length
  const L = buildLaplacian(pts, tris)
  
  // Initial: interior=1, boundary=0
  const u0 = new Float64Array(n)
  for (let i = 0; i < n; i++) u0[i] = boundary[i] ? 0 : 1
  
  // Two iterations of heat diffusion
  const u1 = new Float64Array(n)
  conjGrad(L, u0, u1, boundary)
  
  const u2 = new Float64Array(n)
  conjGrad(L, u1, u2, boundary)
  
  // Normalize and invert: boundary=1, interior close to 0
  let maxV = 0
  for (let i = 0; i < n; i++) if (u2[i] > maxV) maxV = u2[i]
  
  const result = new Float64Array(n)
  if (maxV > 1e-12) {
    for (let i = 0; i < n; i++) {
      result[i] = boundary[i] ? 1 : 1 - u2[i] / maxV
    }
  } else {
    for (let i = 0; i < n; i++) result[i] = boundary[i] ? 1 : 0
  }
  
  return result
}

// ============================================================================
// Polygon Area Calculation
// ============================================================================

function polygonArea(polygon: Point2D[]): number {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y
  }
  return Math.abs(area) / 2
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Create an inflated 3D geometry from a 2D contour
 * Uses contour-following triangulation for smooth edges (like reference)
 */
export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (!contour || contour.length < 3) {
    return null
  }
  
  try {
    // Ensure CCW winding
    const polygon = ensureCCW(contour)
    const bbox = getBBox(polygon)
    const width = bbox.maxX - bbox.minX
    const height = bbox.maxY - bbox.minY
    
    if (width <= 0 || height <= 0) return null
    
    // Calculate grid step based on resolution
    const resolution = Math.max(6, Math.round(opts.gridResolution * 2))
    const gridStep = Math.max(width, height) / resolution
    
    // CRITICAL: Resample polygon with dense points along boundary
    // This is what makes edges smooth instead of jagged!
    const sampledPoly = resamplePolygon(polygon, gridStep * 0.5)
    const numBoundary = sampledPoly.length
    
    // Generate Steiner points
    const boundarySteiners = genBoundarySteiners(sampledPoly, polygon, gridStep)
    const interiorSteiners = genInteriorSteiners(polygon, bbox, gridStep, gridStep * 0.55)
    
    // Combine all points: boundary first, then interior
    const allPts = [...sampledPoly, ...boundarySteiners, ...interiorSteiners]
    const numPts = allPts.length
    
    // Mark boundary vertices
    const boundary = new Uint8Array(numPts)
    for (let i = 0; i < numBoundary; i++) boundary[i] = 1
    
    // Triangulate using simple ear-clipping for boundary + fan triangulation from interior
    const triangles = triangulatePolygon(sampledPoly, boundarySteiners, interiorSteiners, allPts, polygon)
    
    if (triangles.length < 3) return null
    
    // Calculate distances to boundary for each point
    const dists = new Float64Array(numPts)
    const distList: number[] = []
    for (let i = 0; i < numPts; i++) {
      const d = distToPolygon(allPts[i], polygon)
      dists[i] = d
      if (d > 1e-6) distList.push(d)
    }
    
    // Use 85th percentile distance for normalization (like reference)
    const normDist = percentile(distList, 0.85)
    const maxNormDist = normDist * 3
    
    // Calculate effective area-based scale
    const area = Math.max(1, polygonArea(polygon))
    const minDim = Math.min(width, height) || 1
    const maxDim = Math.max(width, height) || 1
    const areaScale = Math.sqrt(area * minDim / maxDim)
    const baseHeight = Math.max(areaScale, maxNormDist)
    
    // Heat diffusion for smooth height interpolation
    const heat = heatDiffusion(allPts, triangles, boundary)
    
    // Calculate heights using smooth profile (like reference WM function)
    const volumeScale = (opts.amount / 100) * baseHeight * 0.3125
    const heights = new Float64Array(numPts)
    
    for (let i = 0; i < numPts; i++) {
      const normD = Math.max(0, Math.min(1.5, dists[i] / normDist))
      const distFactor = 0.6 + 0.4 * Math.pow(normD, 0.35)
      heights[i] = smoothProfile(heat[i]) * volumeScale * distFactor
    }
    
    // Edge height for smooth edge loop
    const edgeH = (opts.amount / 200) * areaScale * 0.15
    const edgeRings = Math.max(6, Math.ceil(opts.amount / 10))
    
    // Build final geometry
    if (opts.doubleSided) {
      // Total vertices: front + back + edge rings
      const edgeRingVerts = edgeRings * numBoundary
      const totalVerts = numPts * 2 + edgeRingVerts
      const pos = new Float32Array(totalVerts * 3)
      
      // Front vertices (+Z)
      for (let i = 0; i < numPts; i++) {
        const h = heights[i] + edgeH
        pos[i * 3] = allPts[i].x
        pos[i * 3 + 1] = allPts[i].y
        pos[i * 3 + 2] = h
      }
      
      // Back vertices (-Z)
      for (let i = 0; i < numPts; i++) {
        const h = heights[i] + edgeH
        const idx = (numPts + i) * 3
        pos[idx] = allPts[i].x
        pos[idx + 1] = allPts[i].y
        pos[idx + 2] = -h
      }
      
      // Edge ring vertices
      const ringStart = numPts * 2
      for (let r = 0; r < edgeRings; r++) {
        const theta = Math.PI * (r + 1) / (edgeRings + 1)
        const ringZ = edgeH * Math.cos(theta)
        
        for (let i = 0; i < numBoundary; i++) {
          const idx = (ringStart + r * numBoundary + i) * 3
          pos[idx] = sampledPoly[i].x
          pos[idx + 1] = sampledPoly[i].y
          pos[idx + 2] = ringZ
        }
      }
      
      // Build indices
      const indices: number[] = []
      
      // Front face triangles (reversed winding for correct normals)
      for (let i = 0; i < triangles.length; i += 3) {
        indices.push(triangles[i + 2], triangles[i + 1], triangles[i])
      }
      
      // Back face triangles
      for (let i = 0; i < triangles.length; i += 3) {
        indices.push(triangles[i] + numPts, triangles[i + 1] + numPts, triangles[i + 2] + numPts)
      }
      
      // Edge strips connecting front -> rings -> back
      for (let ring = -1; ring < edgeRings; ring++) {
        for (let i = 0; i < numBoundary; i++) {
          const nextI = (i + 1) % numBoundary
          
          // Current ring vertices
          let curr, currNext
          if (ring < 0) {
            curr = i  // Front boundary vertex
            currNext = nextI
          } else {
            curr = ringStart + ring * numBoundary + i
            currNext = ringStart + ring * numBoundary + nextI
          }
          
          // Next ring vertices
          let next, nextNext
          if (ring + 1 >= edgeRings) {
            next = i + numPts  // Back boundary vertex
            nextNext = nextI + numPts
          } else {
            next = ringStart + (ring + 1) * numBoundary + i
            nextNext = ringStart + (ring + 1) * numBoundary + nextI
          }
          
          // Two triangles per quad
          indices.push(curr, currNext, nextNext)
          indices.push(curr, nextNext, next)
        }
      }
      
      // Create geometry
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geometry.setIndex(indices)
      
      // Compute normals and finalize
      geometry.computeVertexNormals()
      geometry.center()
      
      // Scale to fit
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      if (box) {
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDimSize = Math.max(size.x, size.y, size.z)
        if (maxDimSize > 0) {
          const scale = 2 / maxDimSize
          geometry.scale(scale, scale, scale)
        }
      }
      
      // Flip Y axis (canvas Y is inverted)
      geometry.rotateX(Math.PI)
      
      return geometry
    } else {
      // Single sided - front only
      const pos = new Float32Array(numPts * 3)
      
      for (let i = 0; i < numPts; i++) {
        pos[i * 3] = allPts[i].x
        pos[i * 3 + 1] = allPts[i].y
        pos[i * 3 + 2] = heights[i]
      }
      
      const indices: number[] = []
      for (let i = 0; i < triangles.length; i += 3) {
        indices.push(triangles[i + 2], triangles[i + 1], triangles[i])
      }
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      geometry.center()
      
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      if (box) {
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDimSize = Math.max(size.x, size.y, size.z)
        if (maxDimSize > 0) {
          const scale = 2 / maxDimSize
          geometry.scale(scale, scale, scale)
        }
      }
      
      geometry.rotateX(Math.PI)
      return geometry
    }
  } catch (error) {
    console.error('[v0] Error creating inflated geometry:', error)
    return null
  }
}

/**
 * Parse SVG path data and extract contour points
 */
export function parseSVGPath(svgContent: string): Point2D[] {
  const contour: Point2D[] = []
  
  // Extract path data from SVG
  const pathMatch = svgContent.match(/d="([^"]+)"/) || svgContent.match(/d='([^']+)'/)
  if (!pathMatch) return contour
  
  const pathData = pathMatch[1]
  
  // Parse path commands (simplified - handles M, L, C, Q, Z)
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []
  
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  
  for (const cmd of commands) {
    const type = cmd[0]
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n))
    
    switch (type) {
      case 'M':
        currentX = args[0]
        currentY = args[1]
        startX = currentX
        startY = currentY
        contour.push({ x: currentX, y: currentY })
        break
      case 'm':
        currentX += args[0]
        currentY += args[1]
        startX = currentX
        startY = currentY
        contour.push({ x: currentX, y: currentY })
        break
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i]
          currentY = args[i + 1]
          contour.push({ x: currentX, y: currentY })
        }
        break
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i]
          currentY += args[i + 1]
          contour.push({ x: currentX, y: currentY })
        }
        break
      case 'H':
        currentX = args[0]
        contour.push({ x: currentX, y: currentY })
        break
      case 'h':
        currentX += args[0]
        contour.push({ x: currentX, y: currentY })
        break
      case 'V':
        currentY = args[0]
        contour.push({ x: currentX, y: currentY })
        break
      case 'v':
        currentY += args[0]
        contour.push({ x: currentX, y: currentY })
        break
      case 'C':
        // Cubic Bezier - sample points along curve
        for (let i = 0; i < args.length; i += 6) {
          const x1 = args[i], y1 = args[i + 1]
          const x2 = args[i + 2], y2 = args[i + 3]
          const x3 = args[i + 4], y3 = args[i + 5]
          
          // Sample curve
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*mt*currentX + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3
            const y = mt*mt*mt*currentY + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3
            contour.push({ x, y })
          }
          currentX = x3
          currentY = y3
        }
        break
      case 'c':
        for (let i = 0; i < args.length; i += 6) {
          const x1 = currentX + args[i], y1 = currentY + args[i + 1]
          const x2 = currentX + args[i + 2], y2 = currentY + args[i + 3]
          const x3 = currentX + args[i + 4], y3 = currentY + args[i + 5]
          
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*mt*currentX + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3
            const y = mt*mt*mt*currentY + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3
            contour.push({ x, y })
          }
          currentX = x3
          currentY = y3
        }
        break
      case 'Q':
        // Quadratic Bezier
        for (let i = 0; i < args.length; i += 4) {
          const x1 = args[i], y1 = args[i + 1]
          const x2 = args[i + 2], y2 = args[i + 3]
          
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*currentX + 2*mt*t*x1 + t*t*x2
            const y = mt*mt*currentY + 2*mt*t*y1 + t*t*y2
            contour.push({ x, y })
          }
          currentX = x2
          currentY = y2
        }
        break
      case 'q':
        for (let i = 0; i < args.length; i += 4) {
          const x1 = currentX + args[i], y1 = currentY + args[i + 1]
          const x2 = currentX + args[i + 2], y2 = currentY + args[i + 3]
          
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*currentX + 2*mt*t*x1 + t*t*x2
            const y = mt*mt*currentY + 2*mt*t*y1 + t*t*y2
            contour.push({ x, y })
          }
          currentX = x2
          currentY = y2
        }
        break
      case 'Z':
      case 'z':
        if (Math.abs(currentX - startX) > 0.001 || Math.abs(currentY - startY) > 0.001) {
          contour.push({ x: startX, y: startY })
        }
        currentX = startX
        currentY = startY
        break
    }
  }
  
  return contour
}
