/**
 * Inflate Geometry Library - Grid-Based Approach
 *
 * Creates inflated 3D meshes from 2D contours using:
 * - Grid-based triangulation with correct winding order
 * - SDF height field (distance from boundary → balloon profile)
 * - Boundary-edge stitching for watertight double-sided mesh
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
  gridResolution: 20,
}

// ============================================================================
// Helpers
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

// Balloon profile: 0 at edge → 1 at the peak, then back to 0
// t=0 → edge, t=1 → center
function balloonProfile(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return Math.pow(Math.sin(c * Math.PI), 0.6)
}

// Catmull-Rom interpolation for smooth curves
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  const v0 = (p2 - p0) * 0.5
  const v1 = (p3 - p1) * 0.5
  return (1 - t3) * p1 + t3 * p2 + t * ((1 - t2) * v0 + (t2 - 1) * v1) + t2 * (3 * (p1 - p2) + v0 + v1)
}

// ============================================================================
// Main
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
  const step = size / opts.gridResolution
  const cols = Math.ceil(w / step) + 2
  const rows = Math.ceil(h / step) + 2

  // ── Build vertex grid ──────────────────────────────────────────────────────
  // grid[row][col] = vertex index, or -1 if outside
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(-1))
  const vx: number[] = []
  const vy: number[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = bounds.minX + col * step
      const y = bounds.minY + row * step
      if (pointInPolygon(x, y, polygon)) {
        grid[row][col] = vx.length
        vx.push(x)
        vy.push(y)
      }
    }
  }

  const numVerts = vx.length
  if (numVerts < 3) return null

  // ── Triangulate ────────────────────────────────────────────────────────────
  // We output positions with Y-flipped (canvas→3D).
  // After Y-flip, a CW grid cell becomes CCW → front face normal points +Z.
  // So we use CW winding here so it becomes CCW after the flip.
  const triIdx: number[] = []

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const tl = grid[row][col]
      const tr = grid[row][col + 1]
      const bl = grid[row + 1][col]
      const br = grid[row + 1][col + 1]

      if (tl >= 0 && tr >= 0 && bl >= 0 && br >= 0) {
        // CW → becomes CCW after Y-flip
        triIdx.push(tl, bl, tr)
        triIdx.push(tr, bl, br)
      } else if (tl >= 0 && tr >= 0 && bl >= 0) {
        triIdx.push(tl, bl, tr)
      } else if (tr >= 0 && bl >= 0 && br >= 0) {
        triIdx.push(tr, bl, br)
      } else if (tl >= 0 && bl >= 0 && br >= 0) {
        triIdx.push(tl, bl, br)
      } else if (tl >= 0 && tr >= 0 && br >= 0) {
        triIdx.push(tl, br, tr)
      }
    }
  }

  if (triIdx.length < 3) return null

  // ── Height field (SDF balloon) ─────────────────────────────────────────────
  // maxDist = half the inscribed circle radius → better scaling
  const maxDist = Math.min(w, h) * 0.5
  const heights = new Float32Array(numVerts)

  for (let i = 0; i < numVerts; i++) {
    const d = distToEdge(vx[i], vy[i], polygon)
    const t = Math.min(1, d / maxDist) // 0 at edge, 1 at center
    heights[i] = balloonProfile(t) * opts.amount
  }

  // ── Laplacian smoothing ────────────────────────────────────────────────────
  for (let iter = 0; iter < opts.smoothingIterations; iter++) {
    const next = heights.slice()
    for (let row = 1; row < rows - 1; row++) {
      for (let col = 1; col < cols - 1; col++) {
        const idx = grid[row][col]
        if (idx < 0) continue
        const nbrs: number[] = []
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const ni = grid[row + dr][col + dc]
          if (ni >= 0) nbrs.push(ni)
        }
        if (nbrs.length > 0) {
          let sum = 0
          for (const n of nbrs) sum += heights[n]
          next[idx] = heights[idx] * 0.5 + (sum / nbrs.length) * 0.5
        }
      }
    }
    heights.set(next)
  }

  // ── Build BufferGeometry ───────────────────────────────────────────────────
  const scale = 2 / size
  const cx = bounds.minX + w * 0.5
  const cy = bounds.minY + h * 0.5

  const positions: number[] = []
  const indexArr: number[] = []

  // Front vertices: Y-flipped so +Z faces the camera
  for (let i = 0; i < numVerts; i++) {
    positions.push(
      (vx[i] - cx) * scale,
      -(vy[i] - cy) * scale,   // flip Y
      heights[i] * scale,
    )
  }

  // Front faces (CW in grid coords → CCW after Y-flip → normal +Z)
  for (let i = 0; i < triIdx.length; i += 3) {
    indexArr.push(triIdx[i], triIdx[i + 1], triIdx[i + 2])
  }

  if (opts.doubleSided) {
    // Back vertices: same XY, negated Z
    for (let i = 0; i < numVerts; i++) {
      positions.push(
        (vx[i] - cx) * scale,
        -(vy[i] - cy) * scale,
        -heights[i] * scale,
      )
    }

    // Back faces: reversed winding → normal -Z
    for (let i = 0; i < triIdx.length; i += 3) {
      indexArr.push(
        triIdx[i + 2] + numVerts,
        triIdx[i + 1] + numVerts,
        triIdx[i]     + numVerts,
      )
    }

    // ── Stitch boundary edges with smooth interpolation ──────────────────────
    // Count how many triangles share each edge. Boundary edges appear once.
    const edgeCount = new Map<string, { a: number; b: number; count: number }>()

    for (let i = 0; i < triIdx.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = triIdx[i + j]
        const b = triIdx[i + (j + 1) % 3]
        // Normalize key so a < b, but store original orientation
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        const existing = edgeCount.get(key)
        if (existing) {
          existing.count++
        } else {
          edgeCount.set(key, { a, b, count: 1 })
        }
      }
    }

    // Collect boundary edges in order for smooth interpolation
    const boundaryEdges: Array<{ a: number; b: number }> = []
    edgeCount.forEach(({ a, b, count }) => {
      if (count === 1) {
        boundaryEdges.push({ a, b })
      }
    })

    // Build boundary loop from edges
    const boundaryLoops: number[][] = []
    const used = new Set<string>()
    
    for (const edge of boundaryEdges) {
      const key = `${edge.a}:${edge.b}`
      if (used.has(key)) continue
      
      const loop: number[] = [edge.a, edge.b]
      used.add(key)
      let curr = edge.b
      let prev = edge.a
      
      while (curr !== edge.a) {
        const next = boundaryEdges.find(e => 
          (e.a === curr && e.b !== prev) || (e.b === curr && e.a !== prev)
        )
        if (!next) break
        
        const k = `${next.a}:${next.b}`
        if (used.has(k)) break
        used.add(k)
        
        prev = curr
        curr = next.a === curr ? next.b : next.a
        loop.push(curr)
      }
      
      if (loop.length > 2) boundaryLoops.push(loop)
    }

    // Add interpolated vertices for smooth boundary edges (2 intermediate per edge)
    const interpMultiplier = 2
    const interpVertStart = positions.length / 3
    const oldToNewIdx = new Map<number, number>()
    
    for (const loop of boundaryLoops) {
      const n = loop.length
      
      for (let i = 0; i < n; i++) {
        const vi = loop[i]
        const vPrev = loop[(i - 1 + n) % n]
        const vNext = loop[(i + 1) % n]
        const vNext2 = loop[(i + 2) % n]
        
        // Get positions and heights
        const p0 = { x: positions[vPrev * 3], y: positions[vPrev * 3 + 1], z: heights[vPrev] }
        const p1 = { x: positions[vi * 3], y: positions[vi * 3 + 1], z: heights[vi] }
        const p2 = { x: positions[vNext * 3], y: positions[vNext * 3 + 1], z: heights[vNext] }
        const p3 = { x: positions[vNext2 * 3], y: positions[vNext2 * 3 + 1], z: heights[vNext2] }
        
        // Add interpolated vertices along edge vi → vNext
        for (let j = 1; j <= interpMultiplier; j++) {
          const t = j / (interpMultiplier + 1)
          const x = catmullRom(p1.x, p2.x, p2.x, p3.x, t) // simple lerp for now
          const y = catmullRom(p1.y, p2.y, p2.y, p3.y, t)
          const z = catmullRom(p1.z, p2.z, p2.z, p3.z, t)
          
          positions.push(x, y, z)
          
          if (opts.doubleSided) {
            positions.push(x, y, -z)
          }
        }
      }
    }

    // Build side quads with interpolated vertices
    for (const { a, b } of boundaryEdges) {
      if (a >= b) continue // Already handled or skip duplicates
      
      const fa = a, fb = b
      const ba = a + numVerts, bb = b + numVerts
      
      // Add interpolated intermediate vertices
      const interpStart = interpVertStart + a * interpMultiplier * (opts.doubleSided ? 2 : 1)
      
      // Connect fa to first interpolated vertex
      const fi0 = interpStart
      indexArr.push(fa, bb, fi0)
      indexArr.push(fa, ba, bb)
      
      // Connect interpolated vertices to each other
      for (let j = 0; j < interpMultiplier - 1; j++) {
        const fij = interpStart + j
        const fij1 = interpStart + j + 1
        indexArr.push(fij, fij1 + numVerts, fij1)
        indexArr.push(fij, fij, fij1 + numVerts)
      }
      
      // Connect last interpolated to fb
      const fim1 = interpStart + interpMultiplier - 1
      indexArr.push(fim1, fb + numVerts, fb)
      indexArr.push(fim1, fim1 + numVerts, fb + numVerts)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indexArr)
  geo.computeVertexNormals()

  return geo
}

export const createInflatedGeometry = inflatePolygon
