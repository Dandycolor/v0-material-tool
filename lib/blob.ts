/* Blob primitive (after Sava's "Blob Forge"): a base shape displaced along its normals by seeded
   fractal simplex noise. Built on the CPU as a regular indexed BufferGeometry, so every Pólya material
   mode (PBR, custom, gradient, matcap, glass), the rotate rig and the mesh exports work on it. */

import * as THREE from "three"
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"

export type BlobBase = "ico" | "sphere" | "torus" | "knot" | "box"

export interface BlobSettings {
  seed: number
  base: BlobBase
  amplitude: number // 0…1
  frequency: number // waves
  octaves: number // 1…6
  animate: boolean
  speed: number // 0…2
}

export const BLOB_DEFAULT: BlobSettings = { seed: 42424, base: "ico", amplitude: 0.22, frequency: 0.7, octaves: 1, animate: false, speed: 0.3 }

/* ---------- seeded 3D simplex noise ---------- */
const G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]
function makeNoise(seed: number) {
  let s = (seed >>> 0) || 1
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  const perm = new Uint8Array(512)
  const pm12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    pm12[i] = perm[i] % 12
  }
  const F3 = 1 / 3, G = 1 / 6
  return (x: number, y: number, z: number) => {
    const sk = (x + y + z) * F3
    const i = Math.floor(x + sk), j = Math.floor(y + sk), k = Math.floor(z + sk)
    const t = (i + j + k) * G
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t)
    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    }
    const x1 = x0 - i1 + G, y1 = y0 - j1 + G, z1 = z0 - k1 + G
    const x2 = x0 - i2 + 2 * G, y2 = y0 - j2 + 2 * G, z2 = z0 - k2 + 2 * G
    const x3 = x0 - 1 + 3 * G, y3 = y0 - 1 + 3 * G, z3 = z0 - 1 + 3 * G
    const ii = i & 255, jj = j & 255, kk = k & 255
    let n = 0
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
    if (t0 > 0) { const g = pm12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0) }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
    if (t1 > 0) { const g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n += t1 * t1 * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1) }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
    if (t2 > 0) { const g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n += t2 * t2 * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2) }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
    if (t3 > 0) { const g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n += t3 * t3 * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3) }
    return 32 * n // ≈ -1…1
  }
}

/* ---------- base shapes (merged by position so displacement never cracks seams) ---------- */
function baseGeometry(base: BlobBase): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  switch (base) {
    case "sphere": g = new THREE.SphereGeometry(1, 160, 120); break
    case "torus": g = new THREE.TorusGeometry(0.72, 0.32, 96, 220); break
    case "knot": g = new THREE.TorusKnotGeometry(0.62, 0.22, 360, 56); break
    case "box": {
      g = new THREE.BoxGeometry(1.5, 1.5, 1.5, 56, 56, 56)
      // round the cube a bit so the noise reads as soft clay
      const p = g.attributes.position as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i)
        const sph = v.clone().normalize().multiplyScalar(1.05)
        v.lerp(sph, 0.35)
        p.setXYZ(i, v.x, v.y, v.z)
      }
      break
    }
    case "ico":
    default: g = new THREE.IcosahedronGeometry(1, 48)
  }
  g.deleteAttribute("normal")
  g.deleteAttribute("uv")
  const m = mergeVertices(g, 1e-5)
  g.dispose()
  m.computeVertexNormals()
  return m
}

const BASE_CACHE = new Map<BlobBase, THREE.BufferGeometry>()

export interface BlobMesh {
  geometry: THREE.BufferGeometry
  /** re-displace in place (for animation) */
  update: (time: number) => void
}

export function createBlob(s: BlobSettings): BlobMesh {
  let base = BASE_CACHE.get(s.base)
  if (!base) {
    base = baseGeometry(s.base)
    BASE_CACHE.set(s.base, base)
  }
  const bp = base.attributes.position.array as Float32Array
  const bn = base.attributes.normal.array as Float32Array
  const count = bp.length / 3
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(bp.length)
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geo.setIndex(base.index!.clone())

  // spherical UVs (texture presets and the sphere-only displacement map still have coordinates)
  const uv = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const x = bp[i * 3], y = bp[i * 3 + 1], z = bp[i * 3 + 2]
    const r = Math.hypot(x, y, z) || 1
    uv[i * 2] = 0.5 + Math.atan2(z, x) / (2 * Math.PI)
    uv[i * 2 + 1] = 0.5 + Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2))

  const noise = makeNoise(s.seed)
  // the seed also picks a random offset in noise space, so nearby seeds look unrelated
  const so = makeNoise(s.seed ^ 0x9e3779b9)
  const ox = so(1.3, 2.1, 3.7) * 100, oy = so(4.2, 5.9, 0.4) * 100, oz = so(7.7, 0.2, 6.1) * 100
  const freq = s.frequency * 1.6
  const oct = Math.max(1, Math.min(6, Math.round(s.octaves)))

  const update = (time: number) => {
    const tz = time * s.speed
    for (let i = 0; i < count; i++) {
      const x = bp[i * 3], y = bp[i * 3 + 1], z = bp[i * 3 + 2]
      let f = freq, a = 1, sum = 0, norm = 0
      for (let o = 0; o < oct; o++) {
        sum += a * noise(x * f + ox, y * f + oy, z * f + oz + tz)
        norm += a
        f *= 2
        a *= 0.5
      }
      const d = (sum / norm) * s.amplitude
      pos[i * 3] = x + bn[i * 3] * d
      pos[i * 3 + 1] = y + bn[i * 3 + 1] * d
      pos[i * 3 + 2] = z + bn[i * 3 + 2] * d
    }
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  }
  update(0)
  return { geometry: geo, update }
}
