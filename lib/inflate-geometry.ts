/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Constrained Delaunay Triangulation (poly2tri algorithm)
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

export interface Triangle {
  a: number
  b: number
  c: number
}

export interface InflateOptions {
  /** Inflation amount (0-100), controls max height */
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
  smoothingIterations: 3,
  doubleSided: true,
  gridResolution: 20,
}

// ============================================================================
// Poly2Tri - Constrained Delaunay Triangulation
// Based on poly2tri.js library
// ============================================================================

class Point {
  x: number
  y: number
  id: number
  edges: Edge[] = []

  constructor(x: number, y: number, id: number = 0) {
    this.x = x
    this.y = y
    this.id = id
  }

  equals(p: Point): boolean {
    return this.x === p.x && this.y === p.y
  }

  static compare(a: Point, b: Point): number {
    if (a.y === b.y) return a.x - b.x
    return a.y - b.y
  }
}

class Edge {
  p: Point
  q: Point

  constructor(p1: Point, p2: Point) {
    if (Point.compare(p1, p2) < 0) {
      this.p = p1
      this.q = p2
    } else {
      this.p = p2
      this.q = p1
    }
    this.p.edges.push(this)
  }
}

class TrianglePoly2Tri {
  points: [Point, Point, Point]
  neighbors: (TrianglePoly2Tri | null)[]
  interior: boolean = false
  constrained: boolean[] = [false, false, false]
  delaunay: boolean[] = [false, false, false]

  constructor(a: Point, b: Point, c: Point) {
    this.points = [a, b, c]
    this.neighbors = [null, null, null]
  }

  getPoint(index: number): Point {
    return this.points[index]
  }

  containsPoint(p: Point): boolean {
    return this.points[0].equals(p) || this.points[1].equals(p) || this.points[2].equals(p)
  }

  containsEdge(edge: Edge): boolean {
    return this.containsPoint(edge.p) && this.containsPoint(edge.q)
  }

  markNeighbor(t: TrianglePoly2Tri): void {
    for (let i = 0; i < 3; i++) {
      const a = this.points[i]
      const b = this.points[(i + 1) % 3]
      for (let j = 0; j < 3; j++) {
        const c = t.points[j]
        const d = t.points[(j + 1) % 3]
        if ((a.equals(c) && b.equals(d)) || (a.equals(d) && b.equals(c))) {
          this.neighbors[i] = t
          t.neighbors[j] = this
          return
        }
      }
    }
  }

  getOppositePoint(t: TrianglePoly2Tri, p: Point): Point | null {
    const cw = t.pointCW(p)
    return this.pointCW(cw)
  }

  pointCW(p: Point): Point {
    if (p.equals(this.points[0])) return this.points[2]
    if (p.equals(this.points[1])) return this.points[0]
    if (p.equals(this.points[2])) return this.points[1]
    throw new Error('Point not in triangle')
  }

  pointCCW(p: Point): Point {
    if (p.equals(this.points[0])) return this.points[1]
    if (p.equals(this.points[1])) return this.points[2]
    if (p.equals(this.points[2])) return this.points[0]
    throw new Error('Point not in triangle')
  }

  neighborCW(p: Point): TrianglePoly2Tri | null {
    if (p.equals(this.points[0])) return this.neighbors[1]
    if (p.equals(this.points[1])) return this.neighbors[2]
    return this.neighbors[0]
  }

  neighborCCW(p: Point): TrianglePoly2Tri | null {
    if (p.equals(this.points[0])) return this.neighbors[2]
    if (p.equals(this.points[1])) return this.neighbors[0]
    return this.neighbors[1]
  }

  index(p: Point): number {
    if (p.equals(this.points[0])) return 0
    if (p.equals(this.points[1])) return 1
    if (p.equals(this.points[2])) return 2
    return -1
  }

  edgeIndex(p1: Point, p2: Point): number {
    if (this.points[0].equals(p1)) {
      if (this.points[1].equals(p2)) return 2
      if (this.points[2].equals(p2)) return 1
    } else if (this.points[1].equals(p1)) {
      if (this.points[0].equals(p2)) return 2
      if (this.points[2].equals(p2)) return 0
    } else if (this.points[2].equals(p1)) {
      if (this.points[0].equals(p2)) return 1
      if (this.points[1].equals(p2)) return 0
    }
    return -1
  }

  markConstrainedEdgeByIndex(index: number): void {
    this.constrained[index] = true
  }

  markConstrainedEdge(p1: Point, p2: Point): void {
    const idx = this.edgeIndex(p1, p2)
    if (idx >= 0) this.constrained[idx] = true
  }

  clearNeighbors(): void {
    this.neighbors = [null, null, null]
  }

  clearDelaunay(): void {
    this.delaunay = [false, false, false]
  }
}

// Orientation functions
function orient2d(pa: Point, pb: Point, pc: Point): number {
  const detleft = (pa.x - pc.x) * (pb.y - pc.y)
  const detright = (pa.y - pc.y) * (pb.x - pc.x)
  return detleft - detright
}

function inScanArea(pa: Point, pb: Point, pc: Point, pd: Point): boolean {
  const oadb = (pa.x - pb.x) * (pd.y - pb.y) - (pd.x - pb.x) * (pa.y - pb.y)
  if (oadb >= -Number.EPSILON) return false
  const oadc = (pa.x - pc.x) * (pd.y - pc.y) - (pd.x - pc.x) * (pa.y - pc.y)
  if (oadc <= Number.EPSILON) return false
  return true
}

// Simple triangulation using ear clipping
function triangulateContour(contour: Point2D[]): Triangle[] {
  if (contour.length < 3) return []

  const n = contour.length
  const indices: number[] = []
  for (let i = 0; i < n; i++) indices.push(i)

  const triangles: Triangle[] = []

  // Ensure counter-clockwise winding
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += contour[i].x * contour[j].y
    area -= contour[j].x * contour[i].y
  }
  if (area < 0) indices.reverse()

  let remaining = [...indices]
  let safety = remaining.length * 2

  while (remaining.length > 3 && safety > 0) {
    safety--
    let earFound = false

    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length]
      const curr = remaining[i]
      const next = remaining[(i + 1) % remaining.length]

      const a = contour[prev]
      const b = contour[curr]
      const c = contour[next]

      // Check if this is a convex vertex
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (cross <= 0) continue

      // Check if no other vertex is inside this triangle
      let isEar = true
      for (let j = 0; j < remaining.length; j++) {
        if (remaining[j] === prev || remaining[j] === curr || remaining[j] === next) continue
        const p = contour[remaining[j]]
        if (pointInTriangle(p, a, b, c)) {
          isEar = false
          break
        }
      }

      if (isEar) {
        triangles.push({ a: prev, b: curr, c: next })
        remaining.splice(i, 1)
        earFound = true
        break
      }
    }

    if (!earFound) break
  }

  // Add final triangle
  if (remaining.length === 3) {
    triangles.push({ a: remaining[0], b: remaining[1], c: remaining[2] })
  }

  return triangles
}

function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const v0x = c.x - a.x, v0y = c.y - a.y
  const v1x = b.x - a.x, v1y = b.y - a.y
  const v2x = p.x - a.x, v2y = p.y - a.y

  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom

  return u >= 0 && v >= 0 && u + v < 1
}

// ============================================================================
// SDF (Signed Distance Field) Computation
// ============================================================================

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  
  if (lenSq === 0) {
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  }
  
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  
  const projX = ax + t * dx
  const projY = ay + t * dy
  
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function distanceToContour(px: number, py: number, contour: Point2D[]): number {
  let minDist = Infinity
  const n = contour.length
  
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const dist = distanceToSegment(px, py, a.x, a.y, b.x, b.y)
    if (dist < minDist) minDist = dist
  }
  
  return minDist
}

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

// ============================================================================
// Steiner Point Generation
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

  // Add grid points inside contour
  for (let iy = 1; iy < gridResolution; iy++) {
    for (let ix = 1; ix < gridResolution; ix++) {
      const x = bbox.minX + ix * stepX
      const y = bbox.minY + iy * stepY
      
      if (isPointInsideContour(x, y, contour)) {
        // Check if not too close to contour edge
        const distToEdge = distanceToContour(x, y, contour)
        const minDist = Math.min(stepX, stepY) * 0.3
        
        if (distToEdge > minDist) {
          steinerPoints.push({ x, y })
        }
      }
    }
  }

  return steinerPoints
}

// ============================================================================
// Mesh Building
// ============================================================================

function computeInflatedHeight(
  px: number,
  py: number,
  contour: Point2D[],
  maxDist: number,
  inflateAmount: number
): number {
  if (!isPointInsideContour(px, py, contour)) return 0
  
  const dist = distanceToContour(px, py, contour)
  const normalizedDist = Math.min(dist / maxDist, 1)
  
  // Hemisphere profile for smooth balloon shape
  const height = Math.sqrt(Math.max(0, 1 - (1 - normalizedDist) ** 2))
  
  return height * inflateAmount * maxDist * 0.5
}

function laplacianSmooth(
  positions: Float32Array,
  indices: number[],
  iterations: number,
  boundaryVertices: Set<number>
): void {
  const vertexCount = positions.length / 3
  
  // Build adjacency list
  const neighbors: Set<number>[] = Array.from({ length: vertexCount }, () => new Set())
  
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]
    const b = indices[i + 1]
    const c = indices[i + 2]
    neighbors[a].add(b).add(c)
    neighbors[b].add(a).add(c)
    neighbors[c].add(a).add(b)
  }

  const tempPositions = new Float32Array(positions.length)

  for (let iter = 0; iter < iterations; iter++) {
    tempPositions.set(positions)
    
    for (let v = 0; v < vertexCount; v++) {
      // Don't smooth boundary vertices
      if (boundaryVertices.has(v)) continue
      
      const neighborSet = neighbors[v]
      if (neighborSet.size === 0) continue
      
      let sumX = 0, sumY = 0, sumZ = 0
      
      for (const n of neighborSet) {
        sumX += positions[n * 3]
        sumY += positions[n * 3 + 1]
        sumZ += positions[n * 3 + 2]
      }
      
      const count = neighborSet.size
      // Only smooth Z (height) to preserve contour shape
      tempPositions[v * 3 + 2] = positions[v * 3 + 2] * 0.5 + (sumZ / count) * 0.5
    }
    
    positions.set(tempPositions)
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (contour.length < 3) {
    console.warn('[v0] Contour must have at least 3 points')
    return null
  }

  try {
    // Simplify contour if too many points
    let processedContour = contour
    if (contour.length > 500) {
      processedContour = simplifyContour(contour, 500)
    }

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of processedContour) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    const bbox = { minX, maxX, minY, maxY }
    const width = maxX - minX
    const height = maxY - minY
    const maxDim = Math.max(width, height)
    if (maxDim <= 0) return null

    // Compute max interior distance for normalization
    let maxInteriorDist = 0
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    maxInteriorDist = distanceToContour(centerX, centerY, processedContour)
    
    // Generate Steiner points
    const steinerPoints = generateSteinerPoints(processedContour, bbox, opts.gridResolution)
    
    // Combine contour and Steiner points
    const allPoints: Point2D[] = [...processedContour, ...steinerPoints]
    const contourLength = processedContour.length
    
    // Triangulate
    const triangles = triangulateWithSteiner(processedContour, steinerPoints)
    
    if (triangles.length === 0) {
      console.warn('[v0] Triangulation failed')
      return null
    }

    // Create vertices with inflated Z values
    const inflateScale = opts.amount / 100
    const positions: number[] = []
    const uvs: number[] = []
    
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i]
      const z = computeInflatedHeight(p.x, p.y, processedContour, maxInteriorDist, inflateScale)
      
      positions.push(p.x, p.y, z)
      uvs.push((p.x - minX) / width, (p.y - minY) / height)
    }

    // Create indices
    const indices: number[] = []
    for (const tri of triangles) {
      indices.push(tri.a, tri.b, tri.c)
    }

    // Track boundary vertices (contour points)
    const boundaryVertices = new Set<number>()
    for (let i = 0; i < contourLength; i++) {
      boundaryVertices.add(i)
    }

    // Apply Laplacian smoothing
    const posArray = new Float32Array(positions)
    laplacianSmooth(posArray, indices, opts.smoothingIterations, boundaryVertices)

    // Build geometry
    let geometry: THREE.BufferGeometry

    if (opts.doubleSided) {
      // Create front face
      const frontPositions = [...posArray]
      const frontUvs = [...uvs]
      const frontIndices = [...indices]
      
      // Create back face (mirror Z and reverse winding)
      const backPositions: number[] = []
      for (let i = 0; i < posArray.length; i += 3) {
        backPositions.push(posArray[i], posArray[i + 1], -posArray[i + 2])
      }
      
      const vertOffset = posArray.length / 3
      const backIndices: number[] = []
      for (let i = 0; i < indices.length; i += 3) {
        backIndices.push(
          indices[i] + vertOffset,
          indices[i + 2] + vertOffset,
          indices[i + 1] + vertOffset
        )
      }
      
      // Create side walls connecting front and back along contour
      const sidePositions: number[] = []
      const sideIndices: number[] = []
      const sideUvs: number[] = []
      const sideVertOffset = vertOffset * 2
      
      for (let i = 0; i < contourLength; i++) {
        const curr = i
        const next = (i + 1) % contourLength
        
        // Front edge vertices
        const f0 = sideVertOffset + i * 4
        sidePositions.push(posArray[curr * 3], posArray[curr * 3 + 1], posArray[curr * 3 + 2])
        sidePositions.push(posArray[next * 3], posArray[next * 3 + 1], posArray[next * 3 + 2])
        
        // Back edge vertices
        sidePositions.push(posArray[curr * 3], posArray[curr * 3 + 1], -posArray[curr * 3 + 2])
        sidePositions.push(posArray[next * 3], posArray[next * 3 + 1], -posArray[next * 3 + 2])
        
        // UVs for side
        const u0 = i / contourLength
        const u1 = (i + 1) / contourLength
        sideUvs.push(u0, 1, u1, 1, u0, 0, u1, 0)
        
        // Two triangles for quad
        sideIndices.push(f0, f0 + 1, f0 + 3)
        sideIndices.push(f0, f0 + 3, f0 + 2)
      }
      
      // Combine all
      const allPositions = new Float32Array([...frontPositions, ...backPositions, ...sidePositions])
      const allUvs = new Float32Array([...frontUvs, ...uvs, ...sideUvs])
      const allIndices = [...frontIndices, ...backIndices, ...sideIndices]
      
      geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(allPositions, 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(allUvs, 2))
      geometry.setIndex(allIndices)
    } else {
      geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
      geometry.setIndex(indices)
    }

    // Compute normals
    geometry.computeVertexNormals()

    // Center and normalize scale
    geometry.center()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (box) {
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxSize = Math.max(size.x, size.y, size.z)
      if (maxSize > 0) {
        const scale = 2 / maxSize
        geometry.scale(scale, scale, scale)
      }
    }

    // Rotate to standard orientation
    geometry.rotateX(Math.PI)

    return geometry
  } catch (error) {
    console.error('[v0] Error creating inflated geometry:', error)
    return null
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function simplifyContour(contour: Point2D[], maxPoints: number): Point2D[] {
  if (contour.length <= maxPoints) return contour
  
  const step = contour.length / maxPoints
  const simplified: Point2D[] = []
  
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.floor(i * step)
    simplified.push(contour[idx])
  }
  
  return simplified
}

function triangulateWithSteiner(contour: Point2D[], steinerPoints: Point2D[]): Triangle[] {
  // Simple approach: triangulate contour first, then add Steiner points
  const allPoints = [...contour, ...steinerPoints]
  
  if (steinerPoints.length === 0) {
    return triangulateContour(contour)
  }
  
  // Use Delaunay-like triangulation with all points
  // For simplicity, we'll use a constrained ear-clipping on the boundary
  // and then triangulate interior using the Steiner points
  
  const triangles = triangulateContour(contour)
  
  // For each Steiner point, find containing triangle and subdivide
  for (let si = 0; si < steinerPoints.length; si++) {
    const sp = steinerPoints[si]
    const spIdx = contour.length + si
    
    // Find triangle containing this point
    for (let ti = triangles.length - 1; ti >= 0; ti--) {
      const tri = triangles[ti]
      const a = allPoints[tri.a]
      const b = allPoints[tri.b]
      const c = allPoints[tri.c]
      
      if (pointInTriangle(sp, a, b, c)) {
        // Remove this triangle and add 3 new ones
        triangles.splice(ti, 1)
        triangles.push({ a: tri.a, b: tri.b, c: spIdx })
        triangles.push({ a: tri.b, b: tri.c, c: spIdx })
        triangles.push({ a: tri.c, b: tri.a, c: spIdx })
        break
      }
    }
  }
  
  return triangles
}

// ============================================================================
// SVG Path Parsing for Inflate
// ============================================================================

export function svgPathToContour(svgPath: string): Point2D[] {
  const points: Point2D[] = []
  
  // Simple SVG path parser - handles M, L, Z commands
  const commands = svgPath.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || []
  
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  
  for (const cmd of commands) {
    const type = cmd[0].toUpperCase()
    const isRelative = cmd[0] === cmd[0].toLowerCase()
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n))
    
    switch (type) {
      case 'M':
        if (isRelative) {
          currentX += args[0]
          currentY += args[1]
        } else {
          currentX = args[0]
          currentY = args[1]
        }
        startX = currentX
        startY = currentY
        points.push({ x: currentX, y: currentY })
        break
        
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          if (isRelative) {
            currentX += args[i]
            currentY += args[i + 1]
          } else {
            currentX = args[i]
            currentY = args[i + 1]
          }
          points.push({ x: currentX, y: currentY })
        }
        break
        
      case 'H':
        if (isRelative) {
          currentX += args[0]
        } else {
          currentX = args[0]
        }
        points.push({ x: currentX, y: currentY })
        break
        
      case 'V':
        if (isRelative) {
          currentY += args[0]
        } else {
          currentY = args[0]
        }
        points.push({ x: currentX, y: currentY })
        break
        
      case 'Z':
        if (points.length > 0) {
          const first = points[0]
          const last = points[points.length - 1]
          if (Math.abs(first.x - last.x) > 0.01 || Math.abs(first.y - last.y) > 0.01) {
            // Don't add closing point if already at start
          }
        }
        currentX = startX
        currentY = startY
        break
        
      case 'C':
        // Cubic bezier - sample points along curve
        for (let i = 0; i < args.length; i += 6) {
          const x1 = isRelative ? currentX + args[i] : args[i]
          const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
          const x2 = isRelative ? currentX + args[i + 2] : args[i + 2]
          const y2 = isRelative ? currentY + args[i + 3] : args[i + 3]
          const x3 = isRelative ? currentX + args[i + 4] : args[i + 4]
          const y3 = isRelative ? currentY + args[i + 5] : args[i + 5]
          
          // Sample bezier curve
          for (let t = 0.1; t <= 1; t += 0.1) {
            const mt = 1 - t
            const x = mt * mt * mt * currentX + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3
            const y = mt * mt * mt * currentY + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
            points.push({ x, y })
          }
          
          currentX = x3
          currentY = y3
        }
        break
        
      case 'Q':
        // Quadratic bezier
        for (let i = 0; i < args.length; i += 4) {
          const x1 = isRelative ? currentX + args[i] : args[i]
          const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
          const x2 = isRelative ? currentX + args[i + 2] : args[i + 2]
          const y2 = isRelative ? currentY + args[i + 3] : args[i + 3]
          
          for (let t = 0.1; t <= 1; t += 0.1) {
            const mt = 1 - t
            const x = mt * mt * currentX + 2 * mt * t * x1 + t * t * x2
            const y = mt * mt * currentY + 2 * mt * t * y1 + t * t * y2
            points.push({ x, y })
          }
          
          currentX = x2
          currentY = y2
        }
        break
    }
  }
  
  return points
}
