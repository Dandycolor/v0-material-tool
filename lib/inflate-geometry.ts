/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Grid-based triangulation (stable approach)
 * - Signed Distance Field (SDF) for height displacement
 * - Smooth balloon profile for natural inflation
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
  steinerPoints: number
  smoothingIterations: number
  doubleSided: boolean
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  steinerPoints: 200,
  smoothingIterations: 5,
  doubleSided: true,
  gridResolution: 50,
}

// ============================================================================
// Geometry Utilities
// ============================================================================

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

// Smooth balloon profile: closer to center = higher
function smoothProfile(normalizedDist: number, maxDist: number): number {
  if (maxDist <= 0) return 0
  const t = Math.max(0, Math.min(1, normalizedDist / maxDist))
  // Smooth curve: higher in center, falls off towards edges
  return Math.pow(Math.max(0, 1 - t * t), 1.5)
}

// ============================================================================
// Grid-based Mesh Generation (stable approach)
// ============================================================================

interface GridResult {
  vertices: Point2D[]
  indices: number[]
  heights: Float32Array
  boundaryIndices: number[]
}

function createGridMesh(polygon: Point2D[], resolution: number, amount: number): GridResult | null {
  const bbox = getBBox(polygon)
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  
  if (width <= 0 || height <= 0) return null
  
  // Grid dimensions
  const gridSize = Math.max(6, Math.round(resolution))
  const stepX = width / gridSize
  const stepY = height / gridSize
  
  // Create grid of vertices
  const vertices: Point2D[] = []
  const vertexMap: Map<string, number> = new Map()
  const insideGrid: boolean[][] = []
  
  for (let iy = 0; iy <= gridSize; iy++) {
    insideGrid[iy] = []
    for (let ix = 0; ix <= gridSize; ix++) {
      const x = bbox.minX + ix * stepX
      const y = bbox.minY + iy * stepY
      const pt = { x, y }
      const inside = isPointInside(pt, polygon)
      insideGrid[iy][ix] = inside
      
      if (inside) {
        const key = `${ix},${iy}`
        vertexMap.set(key, vertices.length)
        vertices.push(pt)
      }
    }
  }
  
  if (vertices.length < 3) return null
  
  // Create triangles from grid
  const indices: number[] = []
  
  for (let iy = 0; iy < gridSize; iy++) {
    for (let ix = 0; ix < gridSize; ix++) {
      // Get 4 corners of this cell
      const k00 = `${ix},${iy}`
      const k10 = `${ix + 1},${iy}`
      const k01 = `${ix},${iy + 1}`
      const k11 = `${ix + 1},${iy + 1}`
      
      const v00 = vertexMap.get(k00)
      const v10 = vertexMap.get(k10)
      const v01 = vertexMap.get(k01)
      const v11 = vertexMap.get(k11)
      
      // Triangle 1: 00-10-11
      if (v00 !== undefined && v10 !== undefined && v11 !== undefined) {
        indices.push(v00, v10, v11)
      }
      
      // Triangle 2: 00-11-01
      if (v00 !== undefined && v11 !== undefined && v01 !== undefined) {
        indices.push(v00, v11, v01)
      }
    }
  }
  
  if (indices.length < 3) return null
  
  // Calculate heights based on SDF
  const maxDist = Math.min(width, height) * 0.5
  const scale = (amount / 100) * maxDist * 0.5
  const heights = new Float32Array(vertices.length)
  
  for (let i = 0; i < vertices.length; i++) {
    const dist = distToPolygon(vertices[i], polygon)
    const profile = smoothProfile(dist, maxDist)
    heights[i] = profile * scale
  }
  
  // Find boundary vertices (those on edge of inside region)
  const boundaryIndices: number[] = []
  for (let iy = 0; iy <= gridSize; iy++) {
    for (let ix = 0; ix <= gridSize; ix++) {
      if (!insideGrid[iy]?.[ix]) continue
      
      const key = `${ix},${iy}`
      const idx = vertexMap.get(key)
      if (idx === undefined) continue
      
      // Check if any neighbor is outside
      const neighbors = [
        [ix - 1, iy], [ix + 1, iy],
        [ix, iy - 1], [ix, iy + 1]
      ]
      
      let isBoundary = false
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx > gridSize || ny < 0 || ny > gridSize || !insideGrid[ny]?.[nx]) {
          isBoundary = true
          break
        }
      }
      
      if (isBoundary) {
        boundaryIndices.push(idx)
      }
    }
  }
  
  return { vertices, indices, heights, boundaryIndices }
}

// ============================================================================
// Main Export Function
// ============================================================================

export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (!contour || contour.length < 3) {
    return null
  }
  
  try {
    const polygon = ensureCCW(contour)
    const grid = createGridMesh(polygon, opts.gridResolution, opts.amount)
    
    if (!grid) return null
    
    const { vertices, indices, heights, boundaryIndices } = grid
    const numVerts = vertices.length
    
    if (opts.doubleSided) {
      // Create double-sided mesh with edge strip
      const edgeRings = 4
      const edgeVerts = boundaryIndices.length * edgeRings
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
        for (let i = 0; i < boundaryIndices.length; i++) {
          const vi = boundaryIndices[i]
          const h = heights[vi]
          const z = h * Math.cos(theta)
          const idx = (ringStart + r * boundaryIndices.length + i) * 3
          pos[idx] = vertices[vi].x
          pos[idx + 1] = vertices[vi].y
          pos[idx + 2] = z
        }
      }
      
      // Build index buffer
      const numFrontTris = indices.length
      const numBackTris = indices.length
      const numEdgeTris = boundaryIndices.length * (edgeRings + 1) * 2
      const totalIndices = numFrontTris + numBackTris + numEdgeTris * 3
      const indexArray = new Uint32Array(totalIndices)
      
      let idxPtr = 0
      
      // Front triangles
      for (let i = 0; i < indices.length; i++) {
        indexArray[idxPtr++] = indices[i]
      }
      
      // Back triangles (reversed winding)
      for (let i = 0; i < indices.length; i += 3) {
        indexArray[idxPtr++] = numVerts + indices[i]
        indexArray[idxPtr++] = numVerts + indices[i + 2]
        indexArray[idxPtr++] = numVerts + indices[i + 1]
      }
      
      // Edge strip triangles
      const numBoundary = boundaryIndices.length
      for (let i = 0; i < numBoundary; i++) {
        const nextI = (i + 1) % numBoundary
        const frontA = boundaryIndices[i]
        const frontB = boundaryIndices[nextI]
        
        // Connect front to first ring
        const ring0A = ringStart + i
        const ring0B = ringStart + nextI
        indexArray[idxPtr++] = frontA
        indexArray[idxPtr++] = ring0B
        indexArray[idxPtr++] = ring0A
        indexArray[idxPtr++] = frontA
        indexArray[idxPtr++] = frontB
        indexArray[idxPtr++] = ring0B
        
        // Connect rings
        for (let r = 0; r < edgeRings - 1; r++) {
          const rA = ringStart + r * numBoundary + i
          const rB = ringStart + r * numBoundary + nextI
          const rNextA = ringStart + (r + 1) * numBoundary + i
          const rNextB = ringStart + (r + 1) * numBoundary + nextI
          indexArray[idxPtr++] = rA
          indexArray[idxPtr++] = rNextB
          indexArray[idxPtr++] = rNextA
          indexArray[idxPtr++] = rA
          indexArray[idxPtr++] = rB
          indexArray[idxPtr++] = rNextB
        }
        
        // Connect last ring to back
        const lastR = edgeRings - 1
        const lastA = ringStart + lastR * numBoundary + i
        const lastB = ringStart + lastR * numBoundary + nextI
        const backA = numVerts + boundaryIndices[i]
        const backB = numVerts + boundaryIndices[nextI]
        indexArray[idxPtr++] = lastA
        indexArray[idxPtr++] = backB
        indexArray[idxPtr++] = backA
        indexArray[idxPtr++] = lastA
        indexArray[idxPtr++] = lastB
        indexArray[idxPtr++] = backB
      }
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geometry.setIndex(new THREE.BufferAttribute(indexArray.slice(0, idxPtr), 1))
      geometry.computeVertexNormals()
      
      return geometry
    } else {
      // Single-sided mesh
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
  } catch (error) {
    console.error('[v0] Error creating inflated geometry:', error)
    return null
  }
}

/**
 * Simplify a path by removing points that are too close together
 */
export function simplifyPath(points: Point2D[], tolerance: number = 2): Point2D[] {
  if (points.length < 3) return points
  
  const result: Point2D[] = [points[0]]
  
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1]
    const dx = points[i].x - last.x
    const dy = points[i].y - last.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist >= tolerance) {
      result.push(points[i])
    }
  }
  
  // Ensure polygon is closed
  if (result.length >= 3) {
    const first = result[0]
    const last = result[result.length - 1]
    const dx = first.x - last.x
    const dy = first.y - last.y
    if (Math.sqrt(dx * dx + dy * dy) < tolerance) {
      result.pop()
    }
  }
  
  return result.length >= 3 ? result : points
}
