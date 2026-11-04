/* Sketch inflate mesher.
   Strokes are drawn on the shape's XY plane. Closed strokes become filled regions (even-odd, so a
   loop inside a loop is a hole); open strokes (and closed ones when Fill is off) become bands of the
   brush width with tapered ends. The union is rasterised on a fine 2D grid, turned into a signed
   distance field (exact Euclidean distance transform, both sides), and the height above the plane is a
   profile of the distance to the edge:
     sharp → a constant-angle roof whose crease runs along the medial axis (spiky ends and junctions)
     round → a dome
   The solid { |z| ≤ H(x,y) } (or 0 ≤ z ≤ H with a flat back) is polygonised with Surface Nets. */

import type { BrushMeshResult } from "../brush/core"

export interface SketchStroke {
  /** x, y pairs in the shape's local XY plane */
  p: number[]
  closed: boolean
  /** band width (diameter) */
  w: number
}

export interface SketchParams {
  fill: boolean // closed strokes are filled
  volume: number // height scale 0.1…2
  sharp: number // 0 = round dome … 1 = sharp crease
  plateau: number // 0 = off … 1: flattens the tops (fraction of the max height kept)
  taper: number // 0…1 thinner ends on open strokes
  doubleSided: boolean
  smooth: number // 0…1 softens the outline
  res: number // 2D cells along the longest side
}

/* 1D squared distance transform (Felzenszwalb & Huttenlocher) */
function dt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}
/** Euclidean distance (in cells) from every cell to the nearest cell where src = 1 */
function edt(src: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e20
  const n = Math.max(W, H)
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1)
  const v = new Int32Array(n)
  const g = new Float64Array(W * H)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = src[y * W + x] ? 0 : INF
    dt1(f, H, d, v, z)
    for (let y = 0; y < H; y++) g[y * W + x] = d[y]
  }
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x]
    dt1(f, W, d, v, z)
    for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(d[x])
  }
  return out
}

export function meshSketch(strokes: SketchStroke[], prm: SketchParams): BrushMeshResult | null {
  const list = strokes.filter((s) => s.p.length >= 2)
  if (!list.length) return null

  // bounds (+ band half widths)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, wMax = 0
  for (const s of list) {
    for (let i = 0; i < s.p.length; i += 2) {
      x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i])
      y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1])
    }
    wMax = Math.max(wMax, s.w)
  }
  const span = Math.max(x1 - x0, y1 - y0) + wMax
  // fine 2D raster (supersampled vs. the 3D grid, keeps the outline smooth)
  const SS = 2
  const res3 = Math.max(64, Math.min(720, prm.res))
  const h3 = span / res3 // mesh grid cell
  const h2 = h3 / SS // 2D cell
  const pad = wMax + 4 * h3
  const ox = x0 - pad, oy = y0 - pad
  const W = Math.ceil((x1 - x0 + 2 * pad) / h2) + 1
  const H = Math.ceil((y1 - y0 + 2 * pad) / h2) + 1
  const mask = new Uint8Array(W * H)

  // filled regions: even-odd scanline over all closed strokes
  if (prm.fill) {
    const polys = list.filter((s) => s.closed && s.p.length >= 6)
    if (polys.length) {
      const xs: number[] = []
      for (let j = 0; j < H; j++) {
        const y = oy + (j + 0.5) * h2
        xs.length = 0
        for (const s of polys) {
          const p = s.p, n = p.length / 2
          for (let i = 0; i < n; i++) {
            const ax = p[i * 2], ay = p[i * 2 + 1]
            const k = (i + 1) % n
            const bx = p[k * 2], by = p[k * 2 + 1]
            if (ay <= y !== by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
          }
        }
        if (xs.length < 2) continue
        xs.sort((a, b) => a - b)
        for (let q = 0; q + 1 < xs.length; q += 2) {
          const i0 = Math.max(0, Math.ceil((xs[q] - ox) / h2 - 0.5))
          const i1 = Math.min(W - 1, Math.floor((xs[q + 1] - ox) / h2 - 0.5))
          if (i1 >= i0) mask.fill(1, j * W + i0, j * W + i1 + 1)
        }
      }
    }
  }

  // bands: open strokes (and closed outlines when not filled / to round off the filled edge)
  for (const s of list) {
    const p = s.p
    const n = p.length / 2
    const closed = s.closed && n >= 3
    if (closed && prm.fill) continue
    const segs = closed ? n : n - 1
    // arc length for the taper
    const arc = new Float64Array(n + 1)
    for (let i = 1; i <= n; i++) {
      const k = i % n
      arc[i] = arc[i - 1] + Math.hypot(p[k * 2] - p[(i - 1) * 2], p[k * 2 + 1] - p[(i - 1) * 2 + 1])
    }
    const L = closed ? arc[n] : arc[n - 1]
    const rad = (s0: number) => {
      const r = s.w / 2
      if (closed || prm.taper <= 0) return r
      const len = Math.min(L * 0.5, s.w * 4)
      const e = Math.min(s0, L - s0)
      const f = len > 0 ? Math.min(1, e / len) : 1
      return r * (1 - prm.taper * 0.9 * (1 - Math.sqrt(f)))
    }
    for (let i = 0; i < Math.max(1, segs); i++) {
      const k = closed ? (i + 1) % n : Math.min(n - 1, i + 1)
      const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[k * 2], by = p[k * 2 + 1]
      const ra = rad(arc[i]), rb = rad(closed && k === 0 ? arc[n] : arc[k])
      const rm = Math.max(ra, rb)
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - rm - ox) / h2)), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + rm - ox) / h2))
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - rm - oy) / h2)), j1 = Math.min(H - 1, Math.ceil((Math.max(ay, by) + rm - oy) / h2))
      const dx = bx - ax, dy = by - ay, dd = dx * dx + dy * dy
      for (let j = j0; j <= j1; j++) {
        const y = oy + (j + 0.5) * h2
        for (let ii = i0; ii <= i1; ii++) {
          const x = ox + (ii + 0.5) * h2
          let t = dd > 0 ? ((x - ax) * dx + (y - ay) * dy) / dd : 0
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const ex = x - ax - dx * t, ey = y - ay - dy * t
          if (ex * ex + ey * ey <= (ra + (rb - ra) * t) ** 2) mask[j * W + ii] = 1
        }
      }
    }
  }

  // signed distance (inside > 0), in local units
  const inv = new Uint8Array(W * H)
  let any = 0
  for (let i = 0; i < W * H; i++) {
    inv[i] = mask[i] ? 0 : 1
    any |= mask[i]
  }
  if (!any) return null
  const dIn = edt(inv, W, H) // inside: distance to the nearest outside cell
  const dOut = edt(mask, W, H) // outside: distance to the nearest inside cell
  const sd2 = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) sd2[i] = (mask[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5)) * h2

  // down-sample to the 3D grid (box filter over SS×SS) + optional blur
  const nx = Math.floor((W - 1) / SS) + 1
  const ny = Math.floor((H - 1) / SS) + 1
  let sd = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let s = 0, c = 0
      for (let b = 0; b < SS; b++)
        for (let a = 0; a < SS; a++) {
          const X = i * SS + a, Y = j * SS + b
          if (X < W && Y < H) {
            s += sd2[Y * W + X]
            c++
          }
        }
      sd[j * nx + i] = s / c
    }
  const blurs = Math.round(prm.smooth * 4)
  for (let it = 0; it < blurs; it++) {
    const o = new Float32Array(sd.length)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let s = 0, c = 0
        for (let b = -1; b <= 1; b++)
          for (let a = -1; a <= 1; a++) {
            const X = i + a, Y = j + b
            if (X >= 0 && Y >= 0 && X < nx && Y < ny) {
              const wgt = a === 0 && b === 0 ? 4 : a === 0 || b === 0 ? 2 : 1
              s += sd[Y * nx + X] * wgt
              c += wgt
            }
          }
        o[j * nx + i] = s / c
      }
    sd = o
  }

  // height profile
  let sdMax = 0
  for (let i = 0; i < sd.length; i++) sdMax = Math.max(sdMax, sd[i])
  if (sdMax <= 0) return null
  const ref = Math.max(wMax / 2, h3 * 2) // typical half-width: profile scale
  const pw = 1 - (1 - prm.sharp) * 0.6 // 1 = straight roof, 0.4 = dome
  const vol = prm.volume
  const cap = prm.plateau > 0 ? (1 - prm.plateau * 0.85) * vol * ref * Math.pow(sdMax / ref, pw) : Infinity
  const Hf = new Float32Array(sd.length)
  for (let i = 0; i < sd.length; i++) {
    const d = sd[i]
    if (d <= 0) continue
    let hgt = vol * ref * Math.pow(d / ref, pw)
    if (hgt > cap) hgt = cap + (hgt - cap) * 0.04
    Hf[i] = hgt
  }
  // grid origin: cell centres of the 2D raster blocks
  const gx = ox + (SS / 2) * h2
  const gy = oy + (SS / 2) * h2
  return heightMesh(sd, Hf, nx, ny, h3, gx, gy, prm.doubleSided)
}

/* 2.5D mesh straight from the 2D fields: top = H(x,y), bottom = -H (or a flat back), joined at
   the outline. The outline is the zero crossing of the signed distance found per grid edge
   (marching squares), so the silhouette is as smooth as the 2D field — no voxel stairs — and the
   rim closes into a clean knife edge. Normals come from the height gradient (crisp creases). */
function heightMesh(sd: Float32Array, Hf: Float32Array, nx: number, ny: number, h: number, gx: number, gy: number, doubleSided: boolean): BrushMeshResult | null {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const node = new Int32Array(nx * ny).fill(-1) // top vertex per inside node
  const nodeB = new Int32Array(nx * ny).fill(-1) // bottom vertex
  const ex = new Int32Array(nx * ny).fill(-1) // crossing on edge (i,j)-(i+1,j)
  const ey = new Int32Array(nx * ny).fill(-1) // crossing on edge (i,j)-(i,j+1)
  const at = (i: number, j: number) => sd[j * nx + i]
  // normals read a lightly blurred copy of the height: hides the distance-transform's direction
  // quantisation (fine radial streaks) without moving any vertex
  const Hn = new Float32Array(Hf.length)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (Hf[k] <= 0) continue
      let sum = 0, c = 0
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const X = i + a, Y = j + b
          if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue
          const v = Hf[Y * nx + X]
          if (v <= 0 && (a || b)) continue
          const w = a === 0 && b === 0 ? 4 : a === 0 || b === 0 ? 2 : 1
          sum += v * w
          c += w
        }
      Hn[k] = sum / c
    }
  const H = (i: number, j: number) => Hn[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]
  const S = (i: number, j: number) => sd[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]

  const nodeV = (i: number, j: number, bottom: boolean) => {
    const arr = bottom ? nodeB : node
    const k = j * nx + i
    if (arr[k] >= 0) return arr[k]
    const hh = Hf[k]
    const z = bottom ? (doubleSided ? -hh : 0) : hh
    arr[k] = pos.length / 3
    pos.push(gx + i * h, gy + j * h, z)
    if (bottom && !doubleSided) nor.push(0, 0, -1)
    else {
      // height gradient (one-sided at the rim so the knife edge stays sharp)
      const dx = (H(i + 1, j) - H(i - 1, j)) / (2 * h)
      const dy = (H(i, j + 1) - H(i, j - 1)) / (2 * h)
      const s = bottom ? -1 : 1
      const l = Math.hypot(dx, dy, 1)
      nor.push((-dx / l) * s * (bottom ? -1 : 1), (-dy / l) * s * (bottom ? -1 : 1), (1 / l) * s)
    }
    return arr[k]
  }
  const edgeV = (i0: number, j0: number, i1: number, j1: number) => {
    const horiz = j0 === j1
    const k = j0 * nx + i0
    const arr = horiz ? ex : ey
    if (arr[k] >= 0) return arr[k]
    const a = at(i0, j0), b = at(i1, j1)
    const t = a / (a - b)
    arr[k] = pos.length / 3
    const x = gx + (i0 + (i1 - i0) * t) * h, y = gy + (j0 + (j1 - j0) * t) * h
    pos.push(x, y, 0)
    // rim normal: outward in the plane (minus the sd gradient)
    const fi = i0 + (i1 - i0) * t, fj = j0 + (j1 - j0) * t
    const ii = Math.round(fi), jj = Math.round(fj)
    let gxs = S(ii + 1, jj) - S(ii - 1, jj), gys = S(ii, jj + 1) - S(ii, jj - 1)
    const gl = Math.hypot(gxs, gys) || 1
    if (doubleSided) nor.push(-gxs / gl, -gys / gl, 0)
    else nor.push((-gxs / gl) * 0.7, (-gys / gl) * 0.7, 0.7)
    return arr[k]
  }

  const poly: number[] = []
  const polyB: number[] = []
  const C = [[0, 0], [1, 0], [1, 1], [0, 1]]
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
      const ins = v.map((x) => x > 0)
      if (!ins[0] && !ins[1] && !ins[2] && !ins[3]) continue
      poly.length = 0
      polyB.length = 0
      for (let c = 0; c < 4; c++) {
        const [ci, cj] = C[c]
        const [di, dj] = C[(c + 1) % 4]
        if (ins[c]) {
          poly.push(nodeV(i + ci, j + cj, false))
          polyB.push(nodeV(i + ci, j + cj, true))
        }
        if (ins[c] !== ins[(c + 1) % 4]) {
          // canonical edge direction (low → high index) so both cells share the vertex
          const a0 = [i + ci, j + cj], a1 = [i + di, j + dj]
          const [p0, p1] = a0[0] + a0[1] * nx <= a1[0] + a1[1] * nx ? [a0, a1] : [a1, a0]
          const e = edgeV(p0[0], p0[1], p1[0], p1[1])
          poly.push(e)
          polyB.push(e)
        }
      }
      // fan: top counter-clockwise (+z), bottom reversed
      for (let k = 1; k + 1 < poly.length; k++) {
        idx.push(poly[0], poly[k], poly[k + 1])
        idx.push(polyB[0], polyB[k + 1], polyB[k])
      }
    }
  if (!idx.length) return null
  return { position: new Float32Array(pos), normal: new Float32Array(nor), index: new Uint32Array(idx) }
}
