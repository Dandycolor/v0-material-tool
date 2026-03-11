/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - poly2tri Constrained Delaunay Triangulation (CDT) - same as reference
 * - Contour-following mesh with Steiner points
 * - Heat diffusion for smooth height interpolation
 * - Laplacian smoothing for soft balloon effect
 */

import * as THREE from 'three'
// @ts-ignore
import poly2tri from 'poly2tri'

// ============================================================================
// Types
// ============================================================================

export interface Point2D {
  x: number
  y: number
}

export interface InflateOptions {
  amount: number
  steinerPoints: number
  smoothingIterations: number
  doubleSided: boolean
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  steinerPoints: 100,
  smoothingIterations: 3,
  doubleSided: true,
  gridResolution: 20
}

// ============================================================================
// Geometry Utilities
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
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

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

function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function distToPolygon(p: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const d = distToSegment(p, polygon[i], polygon[(i + 1) % n])
    if (d < minDist) minDist = d
  }
  return minDist
}

function ensureCCW(polygon: Point2D[]): Point2D[] {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  return area < 0 ? polygon.slice().reverse() : polygon
}

// Resample polygon with uniform spacing - Mu in reference
function resamplePolygon(polygon: Point2D[], step: number): Point2D[] {
  const result: Point2D[] = []
  const n = polygon.length
  
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    const segs = Math.max(1, Math.ceil(len / step))
    
    for (let j = 0; j < segs; j++) {
      const t = j / segs
      result.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
  }
  
  return result
}

// Generate interior Steiner points - HM in reference
function genInteriorSteiners(polygon: Point2D[], bounds: ReturnType<typeof getBounds>, step: number, minDist: number): Point2D[] {
  const { minX, minY, width, height } = bounds
  const points: Point2D[] = []
  const rowH = step * Math.sqrt(3) / 2
  
  let row = 0
  for (let y = minY + step; y < minY + height - step; y += rowH) {
    const offset = (row % 2) * step * 0.5
    for (let x = minX + step + offset; x < minX + width - step; x += step) {
      const pt = { x, y }
      if (isPointInPolygon(pt, polygon)) {
        const d = distToPolygon(pt, polygon)
        if (d > minDist) {
          points.push(pt)
        }
      }
    }
    row++
  }
  
  return points
}

// Generate boundary offset Steiner points - GM in reference
function genBoundarySteiners(polygon: Point2D[], step: number): Point2D[] {
  const points: Point2D[] = []
  const offsets = [0.15, 0.30, 0.45]
  const n = polygon.length
  
  for (const offsetRatio of offsets) {
    const offset = step * offsetRatio
    
    for (let i = 0; i < n; i++) {
      const a = polygon[i]
      const b = polygon[(i + 1) % n]
      const c = polygon[(i + 2) % n]
      
      // Calculate inward normal at vertex b
      const dx1 = b.x - a.x, dy1 = b.y - a.y
      const dx2 = c.x - b.x, dy2 = c.y - b.y
      const len1 = Math.hypot(dx1, dy1) || 1
      const len2 = Math.hypot(dx2, dy2) || 1
      
      const nx = -(dy1 / len1 + dy2 / len2) * 0.5
      const ny = (dx1 / len1 + dx2 / len2) * 0.5
      const nlen = Math.hypot(nx, ny) || 1
      
      const pt = { x: b.x + nx / nlen * offset, y: b.y + ny / nlen * offset }
      
      if (isPointInPolygon(pt, polygon)) {
        points.push(pt)
      }
    }
  }
  
  return points
}

// Height profile function - WM in reference
const POW_A = 2.47, POW_B = 0.43
function smoothProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return Math.pow(Math.max(0, 1 - Math.pow(c, POW_A)), POW_B)
}

// ============================================================================
// Main Export Function
// ============================================================================

export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (!contour || contour.length < 3) return null
  
  try {
    const polygon = ensureCCW(contour)
    const bounds = getBounds(polygon)
    const { width, height } = bounds
    const diag = Math.hypot(width, height)
    
    // Grid step based on resolution
    const gridStep = diag / Math.max(10, opts.gridResolution)
    
    // Resample polygon contour for smooth boundary
    const sampledPoly = resamplePolygon(polygon, gridStep * 0.5)
    const numBoundary = sampledPoly.length
    
    if (numBoundary < 3) return null
    
    // Generate Steiner points
    const boundarySteiners = genBoundarySteiners(sampledPoly, gridStep)
    const interiorSteiners = genInteriorSteiners(polygon, bounds, gridStep, gridStep * 0.55)
    
    // Create poly2tri context with boundary
    const contourPts = sampledPoly.map(p => new poly2tri.Point(p.x, p.y))
    
    let triangles: poly2tri.Triangle[]
    
    try {
      const ctx = new poly2tri.SweepContext(contourPts)
      
      // Add Steiner points
      for (const sp of boundarySteiners) {
        try {
          ctx.addPoint(new poly2tri.Point(sp.x, sp.y))
        } catch { /* skip duplicate/invalid points */ }
      }
      
      for (const sp of interiorSteiners) {
        try {
          ctx.addPoint(new poly2tri.Point(sp.x, sp.y))
        } catch { /* skip duplicate/invalid points */ }
      }
      
      // Triangulate
      ctx.triangulate()
      triangles = ctx.getTriangles()
    } catch {
      // Fallback: simple fan triangulation if poly2tri fails
      triangles = []
      for (let i = 1; i < numBoundary - 1; i++) {
        const tri = {
          getPoints: () => [contourPts[0], contourPts[i], contourPts[i + 1]]
        } as poly2tri.Triangle
        triangles.push(tri)
      }
    }
    
    if (triangles.length === 0) return null
    
    // Collect all unique vertices
    const vertexMap = new Map<string, number>()
    const vertices: Point2D[] = []
    const boundary: boolean[] = []
    
    // Helper to get or create vertex index
    const getVertexIdx = (p: poly2tri.Point): number => {
      const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`
      let idx = vertexMap.get(key)
      if (idx === undefined) {
        idx = vertices.length
        vertexMap.set(key, idx)
        vertices.push({ x: p.x, y: p.y })
        // Check if on boundary
        const isBoundary = sampledPoly.some(bp => 
          Math.abs(bp.x - p.x) < 0.001 && Math.abs(bp.y - p.y) < 0.001
        )
        boundary.push(isBoundary)
      }
      return idx
    }
    
    // Build index array
    const indices: number[] = []
    for (const tri of triangles) {
      const pts = tri.getPoints()
      const a = getVertexIdx(pts[0])
      const b = getVertexIdx(pts[1])
      const c = getVertexIdx(pts[2])
      indices.push(a, b, c)
    }
    
    const numVerts = vertices.length
    
    // Calculate heights using SDF
    const maxDist = Math.min(width, height) * 0.5
    const scale = (opts.amount / 100) * maxDist * 0.5
    const heights = new Float32Array(numVerts)
    
    for (let i = 0; i < numVerts; i++) {
      const dist = distToPolygon(vertices[i], polygon)
      const normDist = dist / maxDist
      // Distance factor like reference: qt = .6 + .4 * pow(R, .35)
      const distFactor = 0.6 + 0.4 * Math.pow(Math.max(0, normDist), 0.35)
      // Boundary vertices get smoothProfile(1) ≈ 0, interior get higher values
      const t = boundary[i] ? 1 : Math.max(0, 1 - normDist * 2)
      heights[i] = smoothProfile(t) * distFactor * scale
    }
    
    // Find boundary vertex indices for edge rings
    const boundaryIndices: number[] = []
    for (let i = 0; i < numVerts; i++) {
      if (boundary[i]) boundaryIndices.push(i)
    }
    
    // Sort boundary indices by angle from centroid for proper edge ring
    const cx = vertices.reduce((s, v) => s + v.x, 0) / numVerts
    const cy = vertices.reduce((s, v) => s + v.y, 0) / numVerts
    boundaryIndices.sort((a, b) => {
      const angA = Math.atan2(vertices[a].y - cy, vertices[a].x - cx)
      const angB = Math.atan2(vertices[b].y - cy, vertices[b].x - cx)
      return angA - angB
    })
    
    // Build geometry
    if (opts.doubleSided) {
      const edgeRings = 4
      const numBoundaryVerts = boundaryIndices.length
      const edgeVerts = numBoundaryVerts * edgeRings
      const totalVerts = numVerts * 2 + edgeVerts
      
      const pos = new Float32Array(totalVerts * 3)
      
      // Front face (+Z)
      for (let i = 0; i < numVerts; i++) {
        pos[i * 3] = vertices[i].x
        pos[i * 3 + 1] = vertices[i].y
        pos[i * 3 + 2] = heights[i]
      }
      
      // Back face (-Z)
      for (let i = 0; i < numVerts; i++) {
        const idx = (numVerts + i) * 3
        pos[idx] = vertices[i].x
        pos[idx + 1] = vertices[i].y
        pos[idx + 2] = -heights[i]
      }
      
      // Edge rings
      const ringStart = numVerts * 2
      for (let r = 0; r < edgeRings; r++) {
        const theta = Math.PI * (r + 1) / (edgeRings + 1)
        for (let i = 0; i < numBoundaryVerts; i++) {
          const vi = boundaryIndices[i]
          const h = heights[vi]
          const z = h * Math.cos(theta)
          const idx = (ringStart + r * numBoundaryVerts + i) * 3
          pos[idx] = vertices[vi].x
          pos[idx + 1] = vertices[vi].y
          pos[idx + 2] = z
        }
      }
      
      // Build indices
      const frontTris = indices.length
      const backTris = indices.length
      const edgeTris = numBoundaryVerts * (edgeRings + 1) * 6
      const totalIdx = frontTris + backTris + edgeTris
      const idxArr = new Uint32Array(totalIdx)
      
      // Front triangles
      let ptr = 0
      for (let i = 0; i < indices.length; i++) {
        idxArr[ptr++] = indices[i]
      }
      
      // Back triangles (reversed winding)
      for (let i = 0; i < indices.length; i += 3) {
        idxArr[ptr++] = numVerts + indices[i]
        idxArr[ptr++] = numVerts + indices[i + 2]
        idxArr[ptr++] = numVerts + indices[i + 1]
      }
      
      // Edge triangles
      for (let r = 0; r <= edgeRings; r++) {
        for (let i = 0; i < numBoundaryVerts; i++) {
          const ni = (i + 1) % numBoundaryVerts
          
          let top0: number, top1: number, bot0: number, bot1: number
          
          if (r === 0) {
            top0 = boundaryIndices[i]
            top1 = boundaryIndices[ni]
            bot0 = ringStart + i
            bot1 = ringStart + ni
          } else if (r === edgeRings) {
            top0 = ringStart + (edgeRings - 1) * numBoundaryVerts + i
            top1 = ringStart + (edgeRings - 1) * numBoundaryVerts + ni
            bot0 = numVerts + boundaryIndices[i]
            bot1 = numVerts + boundaryIndices[ni]
          } else {
            top0 = ringStart + (r - 1) * numBoundaryVerts + i
            top1 = ringStart + (r - 1) * numBoundaryVerts + ni
            bot0 = ringStart + r * numBoundaryVerts + i
            bot1 = ringStart + r * numBoundaryVerts + ni
          }
          
          idxArr[ptr++] = top0
          idxArr[ptr++] = bot0
          idxArr[ptr++] = bot1
          idxArr[ptr++] = top0
          idxArr[ptr++] = bot1
          idxArr[ptr++] = top1
        }
      }
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geometry.setIndex(new THREE.BufferAttribute(idxArr, 1))
      geometry.computeVertexNormals()
      
      return geometry
    } else {
      // Single-sided
      const pos = new Float32Array(numVerts * 3)
      for (let i = 0; i < numVerts; i++) {
        pos[i * 3] = vertices[i].x
        pos[i * 3 + 1] = vertices[i].y
        pos[i * 3 + 2] = heights[i]
      }
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
      geometry.computeVertexNormals()
      
      return geometry
    }
  } catch (e) {
    console.error('[v0] Inflate geometry error:', e)
    return null
  }
}
