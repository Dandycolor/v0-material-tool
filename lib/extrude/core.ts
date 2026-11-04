/* Extrusion core shared by the worker and the main-thread fallback.
   Input shapes are already sampled into polylines (outer ring + holes, flat xy arrays). */

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

export interface FlatShape {
  outer: Float32Array
  holes: Float32Array[]
}
export interface ExtrudeParams {
  thickness: number
  bevelSize: number
  bevelSegments: number
}
export interface ExtrudeResult {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
}

const toVecs = (a: Float32Array) => {
  const out: THREE.Vector2[] = []
  for (let i = 0; i < a.length; i += 2) out.push(new THREE.Vector2(a[i], a[i + 1]))
  return out
}

export function extrudeFlatShapes(shapes: FlatShape[], p: ExtrudeParams): ExtrudeResult | null {
  const geometries: THREE.BufferGeometry[] = []
  for (const fs of shapes) {
    try {
      const shape = new THREE.Shape(toVecs(fs.outer))
      shape.holes = fs.holes.map((h) => new THREE.Path(toVecs(h)))
      const geo = new THREE.ExtrudeGeometry([shape], {
        depth: p.thickness,
        bevelEnabled: p.bevelSize > 0,
        bevelThickness: p.bevelSize,
        bevelSize: p.bevelSize,
        bevelSegments: Math.max(2, Math.min(p.bevelSegments, 64)),
        curveSegments: 1, // shapes arrive pre-sampled
        steps: 1,
      })
      if (geo.attributes.position && geo.attributes.position.count > 0) geometries.push(geo)
    } catch {
      /* skip a broken sub-shape, as before */
    }
  }
  if (!geometries.length) return null
  const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)
  if (!geometry) return null

  geometry.center()
  geometry.rotateX(Math.PI) // SVG Y is inverted
  geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  geometry.boundingBox!.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) geometry.scale(2 / maxDim, 2 / maxDim, 2 / maxDim)
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox!
  const bs = new THREE.Vector3()
  bbox.getSize(bs)
  geometry.computeVertexNormals()

  // triplanar UVs (same mapping as the original implementation)
  const pos = geometry.getAttribute("position").array as Float32Array
  const nrm = geometry.getAttribute("normal").array as Float32Array
  const count = pos.length / 3
  const uv = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const x = (pos[i * 3] - bbox.min.x) / bs.x
    const y = (pos[i * 3 + 1] - bbox.min.y) / bs.y
    const z = (pos[i * 3 + 2] - bbox.min.z) / bs.z
    const nx = Math.abs(nrm[i * 3]), ny = Math.abs(nrm[i * 3 + 1]), nz = Math.abs(nrm[i * 3 + 2])
    if (nz > 0.7) {
      uv[i * 2] = x
      uv[i * 2 + 1] = y
    } else if (nx > ny) {
      uv[i * 2] = z
      uv[i * 2 + 1] = y
    } else {
      uv[i * 2] = x
      uv[i * 2 + 1] = z
    }
  }
  return { position: pos, normal: nrm, uv }
}

export function resultToGeometry(r: ExtrudeResult) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(r.position, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(r.normal, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(r.uv, 2))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
