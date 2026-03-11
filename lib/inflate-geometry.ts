/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using the exact algorithm
 * from the reference implementation:
 * - Delaunator for triangulation
 * - Hexagonal grid Steiner points for interior
 * - Boundary offset Steiner points for smooth edges
 * - Cotangent-weighted Laplacian for heat diffusion heights
 * - Edge rings for smooth front-to-back transition
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
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  smoothingIterations: 5,
  doubleSided: true,
  gridResolution: 40,
}

// ============================================================================
// Core Geometry Functions (from reference)
// ============================================================================

// Point in polygon (ray casting) - Xs in reference
function isPointInPolygon(p: Point2D, polygon: Point2D[]): boolean {
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

// Point to segment distance - Dp in reference
function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  
  if (lenSq === 0) {
    const fx = p.x - a.x, fy = p.y - a.y
    return Math.sqrt(fx * fx + fy * fy)
  }
  
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  const ex = p.x - projX
  const ey = p.y - projY
  
  return Math.sqrt(ex * ex + ey * ey)
}

// Min distance to polygon boundary - ko in reference
function distToPolygon(p: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dist = pointToSegmentDist(p, polygon[i], polygon[j])
    if (dist < minDist) minDist = dist
  }
  return minDist
}

// Bounding box - Np in reference
function getBBox(polygon: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
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

// Signed area - BM in reference
function signedArea(polygon: Point2D[]): number {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  return area / 2
}

// Ensure CCW - Up in reference
function ensureCCW(polygon: Point2D[]): Point2D[] {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : polygon
}

// ============================================================================
// Steiner Point Generation (from reference: HM, GM, Fp)
// ============================================================================

// Hexagonal grid interior points - HM in reference
function genInteriorSteiner(
  polygon: Point2D[],
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  spacing: number,
  minEdgeDist: number
): Point2D[] {
  const rowHeight = spacing * (Math.sqrt(3) / 2)
  const points: Point2D[] = []
  let row = 0
  
  for (let y = bbox.minY; y <= bbox.maxY; y += rowHeight) {
    const offset = row % 2 === 1 ? spacing * 0.5 : 0
    for (let x = bbox.minX + offset; x <= bbox.maxX; x += spacing) {
      const p = { x, y }
      if (!isPointInPolygon(p, polygon)) continue
      
      const dist = distToPolygon(p, polygon)
      if (dist > minEdgeDist) {
        points.push(p)
      }
    }
    row++
  }
  
  return points
}

// Compute offset point - Fp in reference
function computeOffsetPt(p: Point2D, polygon: Point2D[], offset: number): Point2D {
  const n = polygon.length
  let nearestDist = Infinity, nx1 = 0, ny1 = 0
  let secondDist = Infinity, nx2 = 0, ny2 = 0
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dist = pointToSegmentDist(p, polygon[i], polygon[j])
    
    const dx = polygon[j].x - polygon[i].x
    const dy = polygon[j].y - polygon[i].y
    const len = Math.sqrt(dx * dx + dy * dy)
    const normX = len > 1e-12 ? -dy / len : 0
    const normY = len > 1e-12 ? dx / len : 0
    
    if (dist < nearestDist) {
      secondDist = nearestDist; nx2 = nx1; ny2 = ny1
      nearestDist = dist; nx1 = normX; ny1 = normY
    } else if (dist < secondDist) {
      secondDist = dist; nx2 = normX; ny2 = normY
    }
  }
  
  let fx: number, fy: number
  if (secondDist - nearestDist < offset * 0.5) {
    fx = nx1 + nx2; fy = ny1 + ny2
    const len = Math.sqrt(fx * fx + fy * fy)
    if (len > 1e-12) { fx /= len; fy /= len }
    else { fx = nx1; fy = ny1 }
  } else {
    fx = nx1; fy = ny1
  }
  
  return { x: p.x + fx * offset, y: p.y + fy * offset }
}

// Boundary offset points - GM in reference
function genBoundarySteiner(polygon: Point2D[], spacing: number): Point2D[] {
  const offsets = [0.15, 0.3, 0.45].map(s => s * spacing)
  const points: Point2D[] = []
  
  for (const off of offsets) {
    for (const p of polygon) {
      const op = computeOffsetPt(p, polygon, off)
      if (isPointInPolygon(op, polygon)) {
        points.push(op)
      }
    }
  }
  
  return points
}

// ============================================================================
// Laplacian System (cotangent weights) - zM, Bp, Op in reference
// ============================================================================

interface LaplacianSys {
  n: number
  adjStart: Uint32Array
  adjIdx: Uint32Array
  adjWt: Float64Array
  diag: Float64Array
}

// Build cotangent Laplacian - zM in reference
function buildLaplacian(pts: Point2D[], tris: number[]): LaplacianSys {
  const n = pts.length
  const edgeWt = new Map<number, number>()
  
  for (let f = 0; f < tris.length; f += 3) {
    const i0 = tris[f], i1 = tris[f + 1], i2 = tris[f + 2]
    const vs = [i0, i1, i2]
    
    for (let k = 0; k < 3; k++) {
      const a = vs[k], b = vs[(k + 1) % 3], c = vs[(k + 2) % 3]
      
      const ax = pts[a].x - pts[c].x, ay = pts[a].y - pts[c].y
      const bx = pts[b].x - pts[c].x, by = pts[b].y - pts[c].y
      
      const dot = ax * bx + ay * by
      const cross = Math.abs(ax * by - ay * bx)
      const cot = cross > 1e-12 ? dot / cross : 0
      
      const minI = Math.min(a, b), maxI = Math.max(a, b)
      const key = minI * n + maxI
      edgeWt.set(key, (edgeWt.get(key) || 0) + cot * 0.5)
    }
  }
  
  const adj: Array<Array<{ j: number; w: number }>> = Array.from({ length: n }, () => [])
  
  for (const [key, wt] of edgeWt) {
    const j = key % n, i = (key - j) / n
    const w = Math.max(wt, 1e-8)
    adj[i].push({ j, w }); adj[j].push({ j: i, w })
  }
  
  for (let i = 0; i < n; i++) adj[i].sort((a, b) => a.j - b.j)
  
  let total = 0
  for (let i = 0; i < n; i++) total += adj[i].length
  
  const adjStart = new Uint32Array(n + 1)
  const adjIdx = new Uint32Array(total)
  const adjWt = new Float64Array(total)
  const diag = new Float64Array(n)
  
  let idx = 0
  for (let i = 0; i < n; i++) {
    adjStart[i] = idx
    let dsum = 0
    for (const { j, w } of adj[i]) {
      adjIdx[idx] = j; adjWt[idx] = w; dsum += w; idx++
    }
    diag[i] = dsum
  }
  adjStart[n] = idx
  
  return { n, adjStart, adjIdx, adjWt, diag }
}

// L * x - Op in reference
function lapMult(L: LaplacianSys, x: Float64Array, out: Float64Array): void {
  for (let i = 0; i < L.n; i++) {
    let v = L.diag[i] * x[i]
    for (let k = L.adjStart[i]; k < L.adjStart[i + 1]; k++) {
      v -= L.adjWt[k] * x[L.adjIdx[k]]
    }
    out[i] = v
  }
}

// Conjugate gradient - Bp in reference
function conjGrad(L: LaplacianSys, b: Float64Array, x: Float64Array, boundary: Uint8Array, maxIt = 300, tol = 1e-6): void {
  const n = L.n
  const r = new Float64Array(n), p = new Float64Array(n)
  const Ap = new Float64Array(n), z = new Float64Array(n)
  const prec = new Float64Array(n)
  
  for (let i = 0; i < n; i++) prec[i] = L.diag[i] > 1e-12 ? 1 / L.diag[i] : 1
  
  lapMult(L, x, Ap)
  for (let i = 0; i < n; i++) r[i] = boundary[i] ? 0 : b[i] - Ap[i]
  for (let i = 0; i < n; i++) z[i] = prec[i] * r[i]
  for (let i = 0; i < n; i++) p[i] = z[i]
  
  let rz = 0
  for (let i = 0; i < n; i++) rz += r[i] * z[i]
  
  for (let it = 0; it < maxIt; it++) {
    lapMult(L, p, Ap)
    for (let i = 0; i < n; i++) if (boundary[i]) Ap[i] = p[i]
    
    let pAp = 0
    for (let i = 0; i < n; i++) pAp += p[i] * Ap[i]
    if (Math.abs(pAp) < 1e-30) break
    
    const alpha = rz / pAp
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i] }
    
    let rNorm = 0
    for (let i = 0; i < n; i++) rNorm += r[i] * r[i]
    if (Math.sqrt(rNorm) < tol) break
    
    for (let i = 0; i < n; i++) z[i] = prec[i] * r[i]
    
    let rzNew = 0
    for (let i = 0; i < n; i++) rzNew += r[i] * z[i]
    
    const beta = rzNew / (rz + 1e-30)
    rz = rzNew
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i]
  }
}

// Heat diffusion for heights - zp in reference
function heatDiffusion(pts: Point2D[], tris: number[], boundary: Uint8Array): Float64Array {
  const n = pts.length
  const L = buildLaplacian(pts, tris)
  
  const u0 = new Float64Array(n)
  for (let i = 0; i < n; i++) u0[i] = boundary[i] ? 0 : 1
  
  const u1 = new Float64Array(n)
  conjGrad(L, u0, u1, boundary)
  
  const u2 = new Float64Array(n)
  conjGrad(L, u1, u2, boundary)
  
  let maxV = 0
  for (let i = 0; i < n; i++) if (u2[i] > maxV) maxV = u2[i]
  
  const res = new Float64Array(n)
  if (maxV > 1e-12) {
    for (let i = 0; i < n; i++) res[i] = boundary[i] ? 1 : 1 - u2[i] / maxV
  } else {
    for (let i = 0; i < n; i++) res[i] = boundary[i] ? 1 : 0
  }
  
  return res
}

// ============================================================================
// Height Profile - WM in reference
// ============================================================================

const POW_A = 2.47, POW_B = 0.43

function smoothProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return Math.pow(Math.max(0, 1 - Math.pow(c, POW_A)), POW_B)
}

// Percentile - XM in reference
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0
  const s = arr.slice().sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(s.length - 1, (s.length - 1) * p))
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return s[lo]
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

// ============================================================================
// Main Inflate Function
// ============================================================================

export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (contour.length < 3) return null
  
  try {
    // Ensure CCW
    const polygon = ensureCCW(contour)
    const bbox = getBBox(polygon)
    const width = bbox.maxX - bbox.minX
    const height = bbox.maxY - bbox.minY
    
    if (width <= 0 || height <= 0) return null
    
    // Calculate spacing from area
    const area = Math.abs(signedArea(polygon))
    const minDim = Math.min(width, height) || 1
    const maxDim = Math.max(width, height) || 1
    const spacing = Math.sqrt(area * minDim / maxDim)
    
    // Generate Steiner points
    const boundarySteiner = genBoundarySteiner(polygon, spacing)
    const interiorSteiner = genInteriorSteiner(polygon, bbox, spacing, spacing * 0.55)
    
    // Combine: polygon + boundary steiner + interior steiner
    const allPts = [...polygon, ...boundarySteiner, ...interiorSteiner]
    const numPts = allPts.length
    const numBoundary = polygon.length
    
    // Mark boundary
    const isBoundary = new Uint8Array(numPts)
    for (let i = 0; i < numBoundary; i++) isBoundary[i] = 1
    
    // Triangulate with Delaunator
    const coords = new Float64Array(numPts * 2)
    for (let i = 0; i < numPts; i++) {
      coords[i * 2] = allPts[i].x
      coords[i * 2 + 1] = allPts[i].y
    }
    
    const del = new Delaunator(coords)
    
    // Filter triangles inside polygon
    const tris: number[] = []
    const triArr = del.triangles
    
    for (let i = 0; i < triArr.length; i += 3) {
      const a = triArr[i], b = triArr[i + 1], c = triArr[i + 2]
      const cx = (allPts[a].x + allPts[b].x + allPts[c].x) / 3
      const cy = (allPts[a].y + allPts[b].y + allPts[c].y) / 3
      
      if (isPointInPolygon({ x: cx, y: cy }, polygon)) {
        tris.push(a, b, c)
      }
    }
    
    if (tris.length < 3) return null
    
    // Compute distances to boundary
    const dists = new Float64Array(numPts)
    const nonZeroDists: number[] = []
    
    for (let i = 0; i < numPts; i++) {
      const d = distToPolygon(allPts[i], polygon)
      dists[i] = d
      if (d > 1e-6) nonZeroDists.push(d)
    }
    
    // Reference distance (85th percentile)
    const refDist = Math.max(1e-6, percentile(nonZeroDists, 0.85))
    const maxH = refDist * 3
    const inflateScale = Math.max(spacing, maxH)
    
    // Heat diffusion heights
    const heat = heatDiffusion(allPts, tris, isBoundary)
    
    // Final heights
    const heightScale = (opts.amount / 100) * inflateScale * 0.3125
    const heights = new Float64Array(numPts)
    
    for (let i = 0; i < numPts; i++) {
      const normDist = Math.max(0, Math.min(1.5, dists[i] / refDist))
      const distFactor = 0.6 + 0.4 * Math.pow(normDist, 0.35)
      heights[i] = smoothProfile(heat[i]) * heightScale * distFactor
    }
    
    // Edge parameters
    const edgeH = (opts.amount / 200) * spacing * 0.15
    const edgeRings = Math.max(6, Math.ceil(opts.amount / 10))
    
    // Build geometry
    if (opts.doubleSided) {
      const totalVerts = numPts * 2 + edgeRings * numBoundary
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
          pos[idx] = polygon[i].x
          pos[idx + 1] = polygon[i].y
          pos[idx + 2] = ringZ
        }
      }
      
      // Build indices
      const indices: number[] = []
      
      // Front face (reversed winding)
      for (let i = 0; i < tris.length; i += 3) {
        indices.push(tris[i + 2], tris[i + 1], tris[i])
      }
      
      // Back face
      for (let i = 0; i < tris.length; i += 3) {
        indices.push(tris[i] + numPts, tris[i + 1] + numPts, tris[i + 2] + numPts)
      }
      
      // Front to first ring
      for (let i = 0; i < numBoundary; i++) {
        const next = (i + 1) % numBoundary
        indices.push(i, ringStart + i, ringStart + next)
        indices.push(i, ringStart + next, next)
      }
      
      // Between rings
      for (let r = 0; r < edgeRings - 1; r++) {
        const currRing = ringStart + r * numBoundary
        const nextRing = ringStart + (r + 1) * numBoundary
        
        for (let i = 0; i < numBoundary; i++) {
          const next = (i + 1) % numBoundary
          indices.push(currRing + i, nextRing + i, nextRing + next)
          indices.push(currRing + i, nextRing + next, currRing + next)
        }
      }
      
      // Last ring to back
      const lastRing = ringStart + (edgeRings - 1) * numBoundary
      for (let i = 0; i < numBoundary; i++) {
        const next = (i + 1) % numBoundary
        indices.push(lastRing + i, numPts + i, numPts + next)
        indices.push(lastRing + i, numPts + next, lastRing + next)
      }
      
      // Create geometry
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geom.setIndex(indices)
      geom.computeVertexNormals()
      
      // UVs
      const uvs = new Float32Array(totalVerts * 2)
      for (let i = 0; i < totalVerts; i++) {
        uvs[i * 2] = (pos[i * 3] - bbox.minX) / width
        uvs[i * 2 + 1] = (pos[i * 3 + 1] - bbox.minY) / height
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      
      geom.center()
      return geom
    } else {
      // Single sided
      const pos = new Float32Array(numPts * 3)
      
      for (let i = 0; i < numPts; i++) {
        pos[i * 3] = allPts[i].x
        pos[i * 3 + 1] = allPts[i].y
        pos[i * 3 + 2] = heights[i]
      }
      
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geom.setIndex(tris)
      geom.computeVertexNormals()
      
      const uvs = new Float32Array(numPts * 2)
      for (let i = 0; i < numPts; i++) {
        uvs[i * 2] = (allPts[i].x - bbox.minX) / width
        uvs[i * 2 + 1] = (allPts[i].y - bbox.minY) / height
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      
      geom.center()
      return geom
    }
  } catch (err) {
    console.error('[inflate] error:', err)
    return null
  }
}

// ============================================================================
// Utilities
// ============================================================================

export function ensureClosedContour(points: Point2D[]): Point2D[] {
  if (points.length < 2) return points
  const first = points[0], last = points[points.length - 1]
  const d = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2)
  return d > 0.001 ? [...points, { x: first.x, y: first.y }] : points
}

export function normalizeContour(points: Point2D[], targetSize = 100): Point2D[] {
  if (points.length < 2) return points
  const bbox = getBBox(points)
  const w = bbox.maxX - bbox.minX, h = bbox.maxY - bbox.minY
  const maxD = Math.max(w, h)
  if (maxD === 0) return points
  const scale = targetSize / maxD
  const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2
  return points.map(p => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }))
}
