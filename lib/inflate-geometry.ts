/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Custom ear-clipping triangulation
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
  /** Number of Steiner points to add inside the contour */
  steinerPoints: number
  /** Smoothing iterations for softer result */
  smoothingIterations: number
  /** Whether to create both front and back faces */
  doubleSided: boolean
  /** Resolution of internal grid for Steiner points */
  gridResolution: number
}

const DEFAULT_OPTIONS: InflateOptions = {
  amount: 100,
  steinerPoints: 200,
  smoothingIterations: 5,
  doubleSided: true,
  gridResolution: 40,
}

// ============================================================================
// Geometry Utilities
// ============================================================================

function isPointInsideContour(px: number, py: number, contour: Point2D[]): boolean {
  let inside = false
  const n = contour.length
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = contour[i].x, yi = contour[i].y
    const xj = contour[j].x, yj = contour[j].y
    
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  
  return inside
}

function distanceToContour(px: number, py: number, contour: Point2D[]): number {
  let minDist = Infinity
  const n = contour.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dist = pointToSegmentDistance(px, py, contour[i].x, contour[i].y, contour[j].x, contour[j].y)
    if (dist < minDist) minDist = dist
  }
  
  return minDist
}

function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  
  if (lengthSq === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  }
  
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  
  const nearX = x1 + t * dx
  const nearY = y1 + t * dy
  
  return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2)
}

function getBoundingBox(contour: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  for (const p of contour) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  
  return { minX, maxX, minY, maxY }
}

// ============================================================================
// Triangulation - Custom Ear Clipping with Steiner Points
// ============================================================================

function triangulatePolygon(contour: Point2D[], steinerPoints: Point2D[]): number[] {
  // Combine all points: contour first, then steiner points
  const allPoints = [...contour, ...steinerPoints]
  const n = allPoints.length
  const contourLen = contour.length
  
  if (n < 3) return []
  
  // For triangulation with steiner points, use Delaunay-like approach
  // by creating triangles that connect boundary and interior points
  
  const indices: number[] = []
  
  // First, triangulate the boundary polygon using ear clipping
  const boundaryIndices = earClipTriangulate(contour)
  indices.push(...boundaryIndices)
  
  // Then, for each steiner point, find the triangle it falls into
  // and subdivide that triangle
  if (steinerPoints.length > 0) {
    // Build triangle list from current indices
    const triangles: Array<[number, number, number]> = []
    for (let i = 0; i < indices.length; i += 3) {
      triangles.push([indices[i], indices[i + 1], indices[i + 2]])
    }
    
    // Clear and rebuild with steiner point insertion
    indices.length = 0
    
    // For each steiner point, insert it into the mesh
    for (let si = 0; si < steinerPoints.length; si++) {
      const sp = steinerPoints[si]
      const spIdx = contourLen + si
      
      // Find containing triangle
      let containingTriIdx = -1
      for (let ti = 0; ti < triangles.length; ti++) {
        const [a, b, c] = triangles[ti]
        if (isPointInTriangle(sp, allPoints[a], allPoints[b], allPoints[c])) {
          containingTriIdx = ti
          break
        }
      }
      
      if (containingTriIdx !== -1) {
        // Replace triangle with 3 new triangles
        const [a, b, c] = triangles[containingTriIdx]
        triangles.splice(containingTriIdx, 1)
        triangles.push([a, b, spIdx])
        triangles.push([b, c, spIdx])
        triangles.push([c, a, spIdx])
      }
    }
    
    // Convert triangles back to indices
    for (const [a, b, c] of triangles) {
      indices.push(a, b, c)
    }
  }
  
  return indices
}

function isPointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const sign = (p1: Point2D, p2: Point2D, p3: Point2D) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  
  const d1 = sign(p, a, b)
  const d2 = sign(p, b, c)
  const d3 = sign(p, c, a)
  
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
  
  return !(hasNeg && hasPos)
}

function earClipTriangulate(polygon: Point2D[]): number[] {
  const n = polygon.length
  if (n < 3) return []
  if (n === 3) return [0, 1, 2]
  
  const indices: number[] = []
  
  // Create linked list of vertex indices
  const V: number[] = []
  
  // Ensure counter-clockwise winding
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  
  if (area > 0) {
    for (let i = 0; i < n; i++) V.push(i)
  } else {
    for (let i = 0; i < n; i++) V.push(n - 1 - i)
  }
  
  let nv = n
  let count = 2 * nv
  let v = nv - 1
  
  while (nv > 2) {
    if (count-- <= 0) break // Infinite loop protection
    
    // Get indices
    let u = v
    if (nv <= u) u = 0
    v = u + 1
    if (nv <= v) v = 0
    let w = v + 1
    if (nv <= w) w = 0
    
    if (isEar(polygon, V, u, v, w, nv)) {
      // Output triangle
      indices.push(V[u], V[v], V[w])
      
      // Remove v from polygon
      for (let s = v, t = v + 1; t < nv; s++, t++) {
        V[s] = V[t]
      }
      nv--
      count = 2 * nv
    }
  }
  
  return indices
}

function isEar(polygon: Point2D[], V: number[], u: number, v: number, w: number, n: number): boolean {
  const a = polygon[V[u]]
  const b = polygon[V[v]]
  const c = polygon[V[w]]
  
  // Check for valid triangle (non-degenerate and correct winding)
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (cross <= 0.0000001) return false // Not convex
  
  // Check that no other vertex is inside this triangle
  for (let p = 0; p < n; p++) {
    if (p === u || p === v || p === w) continue
    if (isPointInTriangle(polygon[V[p]], a, b, c)) return false
  }
  
  return true
}

function simplifyContour(contour: Point2D[], tolerance: number): Point2D[] {
  if (contour.length <= 4) return contour
  
  // Ramer-Douglas-Peucker algorithm
  function rdp(points: Point2D[], start: number, end: number, result: Point2D[]): void {
    if (end <= start + 1) return
    
    let maxDist = 0
    let maxIdx = start
    
    const x1 = points[start].x, y1 = points[start].y
    const x2 = points[end].x, y2 = points[end].y
    
    for (let i = start + 1; i < end; i++) {
      const dist = pointToSegmentDistance(points[i].x, points[i].y, x1, y1, x2, y2)
      if (dist > maxDist) {
        maxDist = dist
        maxIdx = i
      }
    }
    
    if (maxDist > tolerance) {
      rdp(points, start, maxIdx, result)
      result.push(points[maxIdx])
      rdp(points, maxIdx, end, result)
    }
  }
  
  const result: Point2D[] = [contour[0]]
  rdp(contour, 0, contour.length - 1, result)
  result.push(contour[contour.length - 1])
  
  return result.length >= 3 ? result : contour
}

// ============================================================================
// Steiner Points Generation
// ============================================================================

function generateSteinerPoints(
  contour: Point2D[],
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  gridResolution: number
): Point2D[] {
  const steinerPoints: Point2D[] = []
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  
  const stepX = width / gridResolution
  const stepY = height / gridResolution
  const minEdgeDist = Math.min(stepX, stepY) * 0.4
  
  for (let iy = 1; iy < gridResolution; iy++) {
    for (let ix = 1; ix < gridResolution; ix++) {
      const x = bbox.minX + ix * stepX
      const y = bbox.minY + iy * stepY
      
      if (isPointInsideContour(x, y, contour)) {
        const distToEdge = distanceToContour(x, y, contour)
        // Only add if far enough from edge to avoid degenerate triangles
        if (distToEdge > minEdgeDist) {
          steinerPoints.push({ x, y })
        }
      }
    }
  }
  
  return steinerPoints
}

// ============================================================================
// Laplacian Smoothing
// ============================================================================

function laplacianSmooth(
  positions: Float32Array,
  indices: number[],
  iterations: number,
  boundaryVertices: Set<number>
): void {
  const vertexCount = positions.length / 3
  
  // Build adjacency
  const neighbors: Set<number>[] = Array.from({ length: vertexCount }, () => new Set())
  
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2]
    neighbors[a].add(b).add(c)
    neighbors[b].add(a).add(c)
    neighbors[c].add(a).add(b)
  }

  const tempZ = new Float32Array(vertexCount)

  for (let iter = 0; iter < iterations; iter++) {
    // Copy current Z values
    for (let v = 0; v < vertexCount; v++) {
      tempZ[v] = positions[v * 3 + 2]
    }
    
    for (let v = 0; v < vertexCount; v++) {
      if (boundaryVertices.has(v)) continue
      
      const neighborSet = neighbors[v]
      if (neighborSet.size === 0) continue
      
      let sumZ = 0
      for (const n of neighborSet) {
        sumZ += tempZ[n]
      }
      
      const avgZ = sumZ / neighborSet.size
      // Blend current with average
      positions[v * 3 + 2] = positions[v * 3 + 2] * 0.3 + avgZ * 0.7
    }
  }
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
    // Simplify contour slightly to reduce noise
    const bbox = getBoundingBox(contour)
    const diagonal = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2)
    const tolerance = diagonal * 0.001
    
    let simplifiedContour = simplifyContour(contour, tolerance)
    if (simplifiedContour.length < 3) simplifiedContour = contour
    
    // Ensure minimum number of points
    const minPoints = 10
    if (simplifiedContour.length < minPoints && contour.length >= minPoints) {
      simplifiedContour = contour
    }
    
    // Generate Steiner points for interior detail
    const simpleBbox = getBoundingBox(simplifiedContour)
    const steinerPoints = generateSteinerPoints(simplifiedContour, simpleBbox, opts.gridResolution)
    
    // Combine contour + steiner points for triangulation
    const allPoints: Point2D[] = [...simplifiedContour, ...steinerPoints]
    
    // Triangulate using custom ear-clipping algorithm
    const triangleIndices = triangulatePolygon(simplifiedContour, steinerPoints)
    
    if (triangleIndices.length < 3) return null
    
    // Calculate max distance for normalization
    let maxDistInside = 0
    for (const p of allPoints) {
      if (isPointInsideContour(p.x, p.y, simplifiedContour)) {
        const dist = distanceToContour(p.x, p.y, simplifiedContour)
        if (dist > maxDistInside) maxDistInside = dist
      }
    }
    if (maxDistInside <= 0) maxDistInside = 1
    
    // Inflation scale
    const volumeScale = (opts.amount / 100) * maxDistInside * 0.5
    
    // Create positions with Z displacement
    const positions: number[] = []
    const uvs: number[] = []
    const width = simpleBbox.maxX - simpleBbox.minX
    const height = simpleBbox.maxY - simpleBbox.minY
    const boundaryVertices = new Set<number>()
    
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i]
      
      // Calculate height based on distance to boundary
      let z = 0
      if (isPointInsideContour(p.x, p.y, simplifiedContour)) {
        const dist = distanceToContour(p.x, p.y, simplifiedContour)
        const normalizedDist = Math.min(dist / maxDistInside, 1)
        // Smooth balloon profile: sin^2 curve
        const t = Math.sin(normalizedDist * Math.PI * 0.5)
        z = volumeScale * t * t
      }
      
      positions.push(p.x, p.y, z)
      uvs.push(
        (p.x - simpleBbox.minX) / width,
        (p.y - simpleBbox.minY) / height
      )
      
      // Mark contour vertices as boundary
      if (i < simplifiedContour.length) {
        boundaryVertices.add(i)
      }
    }
    
    // Apply Laplacian smoothing
    const posArray = new Float32Array(positions)
    laplacianSmooth(posArray, triangleIndices, opts.smoothingIterations, boundaryVertices)
    
    // Prepare final geometry arrays
    const finalPositions: number[] = []
    const finalUvs: number[] = []
    const finalIndices: number[] = []
    
    // Copy front face
    for (let i = 0; i < posArray.length; i++) {
      finalPositions.push(posArray[i])
    }
    for (const uv of uvs) {
      finalUvs.push(uv)
    }
    for (const idx of triangleIndices) {
      finalIndices.push(idx)
    }
    
    const frontVertCount = posArray.length / 3
    
    if (opts.doubleSided) {
      // Add back face (mirrored Z)
      for (let i = 0; i < posArray.length; i += 3) {
        finalPositions.push(posArray[i], posArray[i + 1], -posArray[i + 2])
      }
      for (const uv of uvs) {
        finalUvs.push(uv)
      }
      // Back face with reversed winding
      for (let i = 0; i < triangleIndices.length; i += 3) {
        finalIndices.push(
          triangleIndices[i] + frontVertCount,
          triangleIndices[i + 2] + frontVertCount,
          triangleIndices[i + 1] + frontVertCount
        )
      }
      
      // Edge strip connecting front and back along contour
      const contourLen = simplifiedContour.length
      for (let i = 0; i < contourLen; i++) {
        const nextI = (i + 1) % contourLen
        
        const frontCurr = i
        const frontNext = nextI
        const backCurr = i + frontVertCount
        const backNext = nextI + frontVertCount
        
        // Two triangles per edge segment
        finalIndices.push(frontCurr, frontNext, backNext)
        finalIndices.push(frontCurr, backNext, backCurr)
      }
    }
    
    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2))
    geometry.setIndex(finalIndices)
    geometry.computeVertexNormals()
    
    // Center the geometry
    geometry.center()
    
    return geometry
    
  } catch (error) {
    console.error('Error creating inflated geometry:', error)
    return null
  }
}

// ============================================================================
// Export Utilities
// ============================================================================

export function ensureClosedContour(points: Point2D[]): Point2D[] {
  if (points.length < 2) return points
  
  const first = points[0]
  const last = points[points.length - 1]
  const dist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2)
  
  if (dist > 0.001) {
    return [...points, { x: first.x, y: first.y }]
  }
  
  return points
}

export function normalizeContour(points: Point2D[], targetSize: number = 100): Point2D[] {
  if (points.length < 2) return points
  
  const bbox = getBoundingBox(points)
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  const maxDim = Math.max(width, height)
  
  if (maxDim === 0) return points
  
  const scale = targetSize / maxDim
  const centerX = (bbox.minX + bbox.maxX) / 2
  const centerY = (bbox.minY + bbox.maxY) / 2
  
  return points.map(p => ({
    x: (p.x - centerX) * scale,
    y: (p.y - centerY) * scale,
  }))
}
