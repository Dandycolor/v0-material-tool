/**
 * Inflate Geometry Library
 * 
 * Creates inflated 3D meshes from 2D contours using:
 * - Grid-based triangulation inside contour (like original Inflation app)
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
  gridResolution: 50,  // Increased from 25 for smoother surfaces
}

// ============================================================================
// Geometry Utilities
// ============================================================================

/**
 * Check if point is inside contour using ray casting
 */
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

/**
 * Compute minimum distance from point to contour edge
 */
function distanceToContour(px: number, py: number, contour: Point2D[]): number {
  let minDist = Infinity
  const n = contour.length
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = contour[j].x, ay = contour[j].y
    const bx = contour[i].x, by = contour[i].y
    
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    
    let t = 0
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    }
    
    const projX = ax + t * dx
    const projY = ay + t * dy
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
    
    if (dist < minDist) minDist = dist
  }
  
  return minDist
}

/**
 * Get bounding box of contour
 */
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

/**
 * Simplify contour using Ramer-Douglas-Peucker algorithm
 */
function simplifyContour(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points
  
  // Find the point with the maximum distance
  let maxDist = 0
  let maxIndex = 0
  const start = points[0]
  const end = points[points.length - 1]
  
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end)
    if (d > maxDist) {
      maxDist = d
      maxIndex = i
    }
  }
  
  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyContour(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyContour(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  } else {
    return [start, end]
  }
}

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2)
}

// ============================================================================
// Grid-Based Mesh Generation (like original Inflation app)
// ============================================================================

interface GridVertex {
  x: number
  y: number
  z: number
  inside: boolean
  gridX: number
  gridY: number
}

/**
 * Create a grid of vertices and triangulate only the cells that are inside the contour
 * This creates uniform, well-shaped triangles for smooth surfaces
 */
function createGridMesh(
  contour: Point2D[],
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  gridResolution: number,
  inflateAmount: number
): { positions: number[]; indices: number[]; uvs: number[]; boundaryVertices: Set<number>; contourVertexStart: number } | null {
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  
  if (width <= 0 || height <= 0) return null
  
  // Much higher resolution for smoother edges
  const baseResolution = Math.max(gridResolution * 2, 80)
  const complexityFactor = Math.log(contour.length) / Math.log(10)
  const adaptiveResolution = Math.ceil(baseResolution * (0.5 + complexityFactor * 0.3))
  
  // Create grid
  const gridSizeX = adaptiveResolution
  const gridSizeY = Math.max(3, Math.ceil(adaptiveResolution * (height / width)))
  
  const stepX = width / (gridSizeX - 1)
  const stepY = height / (gridSizeY - 1)
  
  // Find max distance inside for normalization
  let maxDistInside = 0
  for (let iy = 0; iy < gridSizeY; iy++) {
    for (let ix = 0; ix < gridSizeX; ix++) {
      const x = bbox.minX + ix * stepX
      const y = bbox.minY + iy * stepY
      if (isPointInsideContour(x, y, contour)) {
        const dist = distanceToContour(x, y, contour)
        if (dist > maxDistInside) maxDistInside = dist
      }
    }
  }
  
  if (maxDistInside <= 0) maxDistInside = 1
  
  // Inflation scale
  const volumeScale = (inflateAmount / 100) * maxDistInside * 0.5
  
  // Create grid vertices (interior points)
  const vertices: GridVertex[] = []
  const vertexGrid: (number | null)[][] = []
  
  for (let iy = 0; iy < gridSizeY; iy++) {
    vertexGrid[iy] = []
    for (let ix = 0; ix < gridSizeX; ix++) {
      const x = bbox.minX + ix * stepX
      const y = bbox.minY + iy * stepY
      const inside = isPointInsideContour(x, y, contour)
      
      if (inside) {
        const dist = distanceToContour(x, y, contour)
        const normalizedDist = Math.min(dist / maxDistInside, 1)
        
        // Smooth height profile - sine^2 for balloon effect
        const r = normalizedDist
        const sine = Math.sin(r * Math.PI * 0.5)
        const z = volumeScale * sine * sine
        
        const vertIdx = vertices.length
        vertices.push({ x, y, z, inside, gridX: ix, gridY: iy })
        vertexGrid[iy][ix] = vertIdx
      } else {
        vertexGrid[iy][ix] = null
      }
    }
  }
  
  if (vertices.length < 3) return null
  
  // Create triangles for grid cells
  const indices: number[] = []
  const boundaryVertices = new Set<number>()
  
  for (let iy = 0; iy < gridSizeY - 1; iy++) {
    for (let ix = 0; ix < gridSizeX - 1; ix++) {
      const v00 = vertexGrid[iy][ix]
      const v10 = vertexGrid[iy][ix + 1]
      const v01 = vertexGrid[iy + 1][ix]
      const v11 = vertexGrid[iy + 1][ix + 1]
      
      if (v00 !== null && v10 !== null && v01 !== null && v11 !== null) {
        indices.push(v00, v10, v11)
        indices.push(v00, v11, v01)
      } else {
        if (v00 !== null) boundaryVertices.add(v00)
        if (v10 !== null) boundaryVertices.add(v10)
        if (v01 !== null) boundaryVertices.add(v01)
        if (v11 !== null) boundaryVertices.add(v11)
      }
    }
  }
  
  // Mark edge vertices as boundary
  for (let iy = 0; iy < gridSizeY; iy++) {
    if (vertexGrid[iy][0] !== null) boundaryVertices.add(vertexGrid[iy][0]!)
    if (vertexGrid[iy][gridSizeX - 1] !== null) boundaryVertices.add(vertexGrid[iy][gridSizeX - 1]!)
  }
  for (let ix = 0; ix < gridSizeX; ix++) {
    if (vertexGrid[0][ix] !== null) boundaryVertices.add(vertexGrid[0][ix]!)
    if (vertexGrid[gridSizeY - 1][ix] !== null) boundaryVertices.add(vertexGrid[gridSizeY - 1][ix]!)
  }
  
  if (indices.length === 0) return null
  
  // Convert to arrays
  const positions: number[] = []
  const uvs: number[] = []
  
  for (const v of vertices) {
    positions.push(v.x, v.y, v.z)
    uvs.push(
      (v.x - bbox.minX) / width,
      (v.y - bbox.minY) / height
    )
  }
  
  // Now add contour vertices at z=0 (boundary of the shape)
  const contourVertexStart = vertices.length
  
  // Sample contour at regular intervals for smooth edges
  const contourSampleStep = Math.max(1, Math.floor(contour.length / Math.min(contour.length, 500)))
  
  for (let i = 0; i < contour.length; i += contourSampleStep) {
    const p = contour[i]
    positions.push(p.x, p.y, 0) // z=0 at boundary
    uvs.push(
      (p.x - bbox.minX) / width,
      (p.y - bbox.minY) / height
    )
    boundaryVertices.add(contourVertexStart + Math.floor(i / contourSampleStep))
  }
  
  // Create triangles connecting grid boundary to contour using improved algorithm
  const gridBoundaryArray = Array.from(boundaryVertices).filter(v => v < contourVertexStart)
  const contourVertCount = Math.ceil(contour.length / contourSampleStep)
  
  // For each contour edge, create triangles to fill the gap to grid
  for (let ci = 0; ci < contourVertCount; ci++) {
    const contourIdx = contourVertexStart + ci
    const nextContourIdx = contourVertexStart + ((ci + 1) % contourVertCount)
    
    const cx1 = positions[contourIdx * 3]
    const cy1 = positions[contourIdx * 3 + 1]
    const cx2 = positions[nextContourIdx * 3]
    const cy2 = positions[nextContourIdx * 3 + 1]
    
    // Find all grid boundary vertices near this contour edge
    const edgeMidX = (cx1 + cx2) / 2
    const edgeMidY = (cy1 + cy2) / 2
    const searchRadius = Math.max(stepX, stepY) * 3
    
    // Find nearest grid vertex to this edge
    let nearestGridVert = -1
    let nearestDist = Infinity
    
    for (const gridVert of gridBoundaryArray) {
      const gx = positions[gridVert * 3]
      const gy = positions[gridVert * 3 + 1]
      const dist = (gx - edgeMidX) ** 2 + (gy - edgeMidY) ** 2
      if (dist < nearestDist && dist < searchRadius * searchRadius) {
        nearestDist = dist
        nearestGridVert = gridVert
      }
    }
    
    if (nearestGridVert !== -1) {
      // Create triangle: contour edge + nearest grid vertex
      indices.push(contourIdx, nextContourIdx, nearestGridVert)
    }
  }
  
  // Also create triangles from grid boundary to nearby contour vertices
  for (const gridVert of gridBoundaryArray) {
    const gx = positions[gridVert * 3]
    const gy = positions[gridVert * 3 + 1]
    
    // Find the two nearest contour vertices
    const contourDists: Array<{idx: number; dist: number}> = []
    
    for (let ci = 0; ci < contourVertCount; ci++) {
      const contourIdx = contourVertexStart + ci
      const cx = positions[contourIdx * 3]
      const cy = positions[contourIdx * 3 + 1]
      const dist = (gx - cx) ** 2 + (gy - cy) ** 2
      contourDists.push({ idx: contourIdx, dist })
    }
    
    contourDists.sort((a, b) => a.dist - b.dist)
    
    // Connect to two nearest contour vertices if they're close enough
    if (contourDists.length >= 2) {
      const maxDist = (stepX * stepX + stepY * stepY) * 6
      if (contourDists[0].dist < maxDist && contourDists[1].dist < maxDist) {
        indices.push(gridVert, contourDists[0].idx, contourDists[1].idx)
      }
    }
  }
  
  return { positions, indices, uvs, boundaryVertices, contourVertexStart }
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

  const tempZ = new Float32Array(vertexCount)

  for (let iter = 0; iter < iterations; iter++) {
    // Copy current Z values
    for (let v = 0; v < vertexCount; v++) {
      tempZ[v] = positions[v * 3 + 2]
    }
    
    for (let v = 0; v < vertexCount; v++) {
      // Don't smooth boundary vertices as much
      if (boundaryVertices.has(v)) continue
      
      const neighborSet = neighbors[v]
      if (neighborSet.size === 0) continue
      
      let sumZ = 0
      for (const n of neighborSet) {
        sumZ += positions[n * 3 + 2]
      }
      
      const avgZ = sumZ / neighborSet.size
      // Smooth Z only, preserve XY grid structure
      tempZ[v] = positions[v * 3 + 2] * 0.3 + avgZ * 0.7
    }
    
    // Apply smoothed Z values
    for (let v = 0; v < vertexCount; v++) {
      positions[v * 3 + 2] = tempZ[v]
    }
  }
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Create an inflated 3D geometry from a 2D contour
 * Uses grid-based triangulation for smooth, uniform triangles
 */
export function createInflatedGeometry(
  contour: Point2D[],
  options: Partial<InflateOptions> = {}
): THREE.BufferGeometry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (!contour || contour.length < 3) {
    console.warn('[v0] Contour must have at least 3 points')
    return null
  }
  
  try {
    // Simplify contour to remove noise but keep shape
    const bbox = getBoundingBox(contour)
    const diagonal = Math.sqrt((bbox.maxX - bbox.minX) ** 2 + (bbox.maxY - bbox.minY) ** 2)
    const tolerance = diagonal * 0.002 // Reduced from 0.005 to preserve more details
    
    let simplifiedContour = simplifyContour(contour, tolerance)
    
    // Ensure contour is closed
    const first = simplifiedContour[0]
    const last = simplifiedContour[simplifiedContour.length - 1]
    if (Math.abs(first.x - last.x) > 0.001 || Math.abs(first.y - last.y) > 0.001) {
      simplifiedContour.push({ x: first.x, y: first.y })
    }
    
    // Need at least 3 unique points
    if (simplifiedContour.length < 4) {
      console.warn('[v0] Contour too simple after simplification')
      return null
    }
    
    // Create grid mesh
    const meshData = createGridMesh(
      simplifiedContour,
      getBoundingBox(simplifiedContour),
      opts.gridResolution,
      opts.amount
    )
    
    if (!meshData) {
      console.warn('[v0] Failed to create grid mesh')
      return null
    }
    
    const { positions, indices, uvs, boundaryVertices, contourVertexStart } = meshData
    
    // Convert to Float32Array for smoothing
    const posArray = new Float32Array(positions)
    
    // Apply Laplacian smoothing
    if (opts.smoothingIterations > 0) {
      laplacianSmooth(posArray, indices, opts.smoothingIterations, boundaryVertices)
    }
    
    let finalPositions: number[]
    let finalIndices: number[]
    let finalUvs: number[]
    
    if (opts.doubleSided) {
      // Create back face (mirror Z)
      const frontVertCount = posArray.length / 3
      
      finalPositions = Array.from(posArray)
      finalUvs = [...uvs]
      finalIndices = [...indices]
      
      // Add back vertices (mirrored Z)
      for (let i = 0; i < posArray.length; i += 3) {
        finalPositions.push(posArray[i], posArray[i + 1], -posArray[i + 2])
      }
      for (const uv of uvs) {
        finalUvs.push(uv)
      }
      
      // Add back face indices (reversed winding)
      for (let i = 0; i < indices.length; i += 3) {
        finalIndices.push(
          indices[i] + frontVertCount,
          indices[i + 2] + frontVertCount,
          indices[i + 1] + frontVertCount
        )
      }
      
      // Add edge strip using contour vertices (they are at z=0, the edge of the balloon)
      // Contour vertices start at contourVertexStart index
      const contourVertCount = (positions.length / 3) - contourVertexStart
      
      // Connect contour vertices in order (they follow the original contour path)
      for (let i = 0; i < contourVertCount; i++) {
        const nextI = (i + 1) % contourVertCount
        
        const frontCurr = contourVertexStart + i
        const frontNext = contourVertexStart + nextI
        const backCurr = frontCurr + frontVertCount  // Back face offset
        const backNext = frontNext + frontVertCount
        
        // Two triangles per edge segment connecting front and back
        finalIndices.push(frontCurr, frontNext, backNext)
        finalIndices.push(frontCurr, backNext, backCurr)
      }
    } else {
      finalPositions = Array.from(posArray)
      finalIndices = indices
      finalUvs = uvs
    }
    
    // Create geometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2))
    geometry.setIndex(finalIndices)
    
    // Compute normals
    geometry.computeVertexNormals()
    
    // Center geometry
    geometry.center()
    
    // Scale to fit
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (box) {
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        const scale = 2 / maxDim
        geometry.scale(scale, scale, scale)
      }
    }
    
    // Flip Y axis (canvas Y is inverted)
    geometry.rotateX(Math.PI)
    
    return geometry
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
          
          const startX = currentX, startY = currentY
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*mt*startX + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3
            const y = mt*mt*mt*startY + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3
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
          
          const startX = currentX, startY = currentY
          for (let t = 0.25; t <= 1; t += 0.25) {
            const mt = 1 - t
            const x = mt*mt*startX + 2*mt*t*x1 + t*t*x2
            const y = mt*mt*startY + 2*mt*t*y1 + t*t*y2
            contour.push({ x, y })
          }
          
          currentX = x2
          currentY = y2
        }
        break
      case 'Z':
      case 'z':
        if (contour.length > 0) {
          currentX = startX
          currentY = startY
        }
        break
    }
  }
  
  return contour
}
