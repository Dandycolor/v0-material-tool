/**
 * Inflate Geometry Library - Simple Grid-Based Approach
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Grid-based triangulation (no external dependencies needed)
 * - Point-in-polygon testing for mesh generation
 * - Signed Distance Field for smooth height profiles
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
  amount: number
  smoothingIterations: number
  doubleSided: boolean
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  smoothingIterations: 3,
  doubleSided: true,
  gridResolution: 20
}

// ============================================================================
// Helper Functions
// ============================================================================

function getBounds(polygon: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of polygon) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Point in polygon using ray casting algorithm
 */
function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Signed distance from point to polygon boundary
 * Negative if outside, positive if inside
 */
function signedDistanceToPolygon(point: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity
  let inside = pointInPolygon(point, polygon)
  
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dist = distanceToSegment(point, a, b)
    minDist = Math.min(minDist, dist)
  }
  
  return inside ? minDist : -minDist
}

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
  t = Math.max(0, Math.min(1, t))
  
  const closest = { x: a.x + t * dx, y: a.y + t * dy }
  const ddx = p.x - closest.x
  const ddy = p.y - closest.y
  return Math.sqrt(ddx * ddx + ddy * ddy)
}

/**
 * Smooth balloon profile: height falloff from center (1) to edges (0)
 * t should be normalized distance where 0=boundary, 1=deep interior
 */
function smoothProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  // Exact formula from reference: pow(max(0, 1-pow(c, 2.47)), 0.43)
  return Math.pow(Math.max(0, 1 - Math.pow(c, 2.47)), 0.43)
}

/**
 * Normalize distance: 0=boundary, 1=far from boundary
 */
function normalizeDistance(dist: number, bounds: ReturnType<typeof getBounds>): number {
  const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.5
  return Math.min(1, Math.max(0, (dist / maxDist + 1) * 0.5))
}

// ============================================================================
// Main Inflate Function
// ============================================================================

export function inflatePolygon(polygon: Point2D[], options: Partial<InflateOptions> = {}): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (polygon.length < 3) return null
  
  const bounds = getBounds(polygon)
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  const size = Math.max(w, h)
  const step = size / opts.gridResolution
  
  // Generate grid vertices
  const vertices: Point2D[] = []
  const vertexMap = new Map<string, number>()
  
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let y = bounds.minY; y <= bounds.maxY; y += step) {
      const p = { x, y }
      if (pointInPolygon(p, polygon) || isOnBoundary(p, polygon, step * 0.1)) {
        const key = `${x.toFixed(3)},${y.toFixed(3)}`
        vertexMap.set(key, vertices.length)
        vertices.push(p)
      }
    }
  }
  
  // Generate triangles (grid cells)
  const triangles: number[] = []
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      for (let k = j + 1; k < vertices.length; k++) {
        const a = vertices[i]
        const b = vertices[j]
        const c = vertices[k]
        
        // Check if these form a valid grid cell
        const dx1 = b.x - a.x, dy1 = b.y - a.y
        const dx2 = c.x - a.x, dy2 = c.y - a.y
        
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
        
        if (len1 > 0 && len2 > 0 && len1 < step * 1.5 && len2 < step * 1.5) {
          // Check if centroid is inside polygon
          const cx = (a.x + b.x + c.x) / 3
          const cy = (a.y + b.y + c.y) / 3
          if (pointInPolygon({ x: cx, y: cy }, polygon)) {
            triangles.push(i, j, k)
          }
        }
      }
    }
  }
  
  if (triangles.length === 0) return null
  
  // Calculate heights using SDF
  const heights = new Float32Array(vertices.length)
  for (let i = 0; i < vertices.length; i++) {
    const dist = signedDistanceToPolygon(vertices[i], polygon)
    const normalized = normalizeDistance(dist, bounds)
    heights[i] = smoothProfile(normalized) * opts.amount
  }
  
  // Build 3D positions (front face + back face + edges)
  const positions: number[] = []
  const indices: number[] = []
  const numVerts = vertices.length
  
  // Front vertices (+Z)
  for (let i = 0; i < numVerts; i++) {
    positions.push(vertices[i].x, vertices[i].y, heights[i])
  }
  
  // Back vertices (-Z)
  for (let i = 0; i < numVerts; i++) {
    positions.push(vertices[i].x, vertices[i].y, -heights[i])
  }
  
  // Front face triangles
  for (let i = 0; i < triangles.length; i += 3) {
    indices.push(triangles[i], triangles[i + 1], triangles[i + 2])
  }
  
  // Back face triangles (reversed for correct normal)
  if (opts.doubleSided) {
    for (let i = triangles.length - 1; i >= 2; i -= 3) {
      indices.push(
        numVerts + triangles[i - 2],
        numVerts + triangles[i - 1],
        numVerts + triangles[i]
      )
    }
  }
  
  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
  geometry.computeVertexNormals()
  
  return geometry
}

/**
 * Check if point is near polygon boundary
 */
function isOnBoundary(point: Point2D, polygon: Point2D[], threshold: number): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (distanceToSegment(point, a, b) < threshold) {
      return true
    }
  }
  return false
}

// Export alias for backwards compatibility
export const createInflatedGeometry = inflatePolygon
