/**
 * Inflate Geometry Library - Grid-Based Approach
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Efficient grid-based triangulation 
 * - Point-in-polygon testing for mesh generation
 * - Signed Distance Field for smooth height profiles
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

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
  
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  
  const closest = { x: a.x + t * dx, y: a.y + t * dy }
  return Math.sqrt((p.x - closest.x) ** 2 + (p.y - closest.y) ** 2)
}

function distanceToPolygonEdge(point: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    minDist = Math.min(minDist, distanceToSegment(point, a, b))
  }
  return minDist
}

// Smooth balloon profile (from reference: WM function)
function smoothProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return Math.pow(Math.max(0, 1 - Math.pow(c, 2.47)), 0.43)
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
  if (w < 1 || h < 1) return null
  
  const size = Math.max(w, h)
  const step = size / opts.gridResolution
  const cols = Math.ceil(w / step) + 1
  const rows = Math.ceil(h / step) + 1
  
  // Create grid of vertices with index mapping
  // grid[row][col] = vertex index or -1 if outside polygon
  const grid: number[][] = []
  const vertices: Point2D[] = []
  
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      const x = bounds.minX + col * step
      const y = bounds.minY + row * step
      const p = { x, y }
      
      if (pointInPolygon(p, polygon)) {
        grid[row][col] = vertices.length
        vertices.push(p)
      } else {
        grid[row][col] = -1
      }
    }
  }
  
  if (vertices.length < 3) return null
  
  // Generate triangles from grid cells
  const triangles: number[] = []
  
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const tl = grid[row][col]         // top-left
      const tr = grid[row][col + 1]     // top-right
      const bl = grid[row + 1][col]     // bottom-left
      const br = grid[row + 1][col + 1] // bottom-right
      
      // If all 4 corners are inside, create 2 triangles
      if (tl >= 0 && tr >= 0 && bl >= 0 && br >= 0) {
        triangles.push(tl, bl, tr)
        triangles.push(tr, bl, br)
      } 
      // Partial cells - create triangle if 3 corners are inside
      else if (tl >= 0 && tr >= 0 && bl >= 0) {
        triangles.push(tl, bl, tr)
      } else if (tl >= 0 && tr >= 0 && br >= 0) {
        triangles.push(tl, br, tr)
      } else if (tl >= 0 && bl >= 0 && br >= 0) {
        triangles.push(tl, bl, br)
      } else if (tr >= 0 && bl >= 0 && br >= 0) {
        triangles.push(tr, bl, br)
      }
    }
  }
  
  if (triangles.length < 3) return null
  
  // Calculate heights using distance to boundary
  const maxDist = size * 0.5
  const heights = new Float32Array(vertices.length)
  
  for (let i = 0; i < vertices.length; i++) {
    const dist = distanceToPolygonEdge(vertices[i], polygon)
    const normalized = 1 - Math.min(1, dist / maxDist) // 1 at boundary, 0 at center
    heights[i] = smoothProfile(normalized) * opts.amount
  }
  
  // Apply smoothing
  for (let iter = 0; iter < opts.smoothingIterations; iter++) {
    const newHeights = new Float32Array(heights)
    for (let row = 1; row < rows - 1; row++) {
      for (let col = 1; col < cols - 1; col++) {
        const idx = grid[row][col]
        if (idx < 0) continue
        
        const neighbors: number[] = []
        const checkNeighbor = (r: number, c: number) => {
          if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] >= 0) {
            neighbors.push(grid[r][c])
          }
        }
        checkNeighbor(row - 1, col)
        checkNeighbor(row + 1, col)
        checkNeighbor(row, col - 1)
        checkNeighbor(row, col + 1)
        
        if (neighbors.length > 0) {
          let sum = 0
          for (const n of neighbors) sum += heights[n]
          newHeights[idx] = (heights[idx] + sum / neighbors.length) * 0.5
        }
      }
    }
    heights.set(newHeights)
  }
  
  // Build geometry
  const numVerts = vertices.length
  const positions: number[] = []
  const indices: number[] = []
  
  // Front face (+Z)
  for (let i = 0; i < numVerts; i++) {
    positions.push(vertices[i].x, vertices[i].y, heights[i])
  }
  
  // Front triangles
  for (let i = 0; i < triangles.length; i += 3) {
    indices.push(triangles[i], triangles[i + 1], triangles[i + 2])
  }
  
  if (opts.doubleSided) {
    // Back face (-Z)
    for (let i = 0; i < numVerts; i++) {
      positions.push(vertices[i].x, vertices[i].y, -heights[i])
    }
    
    // Back triangles (reversed winding)
    for (let i = 0; i < triangles.length; i += 3) {
      indices.push(
        triangles[i] + numVerts,
        triangles[i + 2] + numVerts,
        triangles[i + 1] + numVerts
      )
    }
  }
  
  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  
  // Center geometry
  geometry.computeBoundingBox()
  const center = new THREE.Vector3()
  geometry.boundingBox!.getCenter(center)
  geometry.translate(-center.x, -center.y, -center.z)
  
  return geometry
}

// Alias for backwards compatibility
export const createInflatedGeometry = inflatePolygon
