/* Sketch inflate mesher.
   Strokes are drawn on the shape's XY plane. Closed strokes become filled regions (even-odd, so a
   loop inside a loop is a hole); open strokes (and closed ones when Fill is off) become bands of the
   brush width with tapered ends. The union is rasterised on a fine 2D grid, turned into a signed
   distance field (exact Euclidean distance transform, both sides), and the height above the plane is a
   profile of the distance to the edge:
     sharp → a constant-angle roof whose crease runs along the medial axis (spiky ends and junctions)
     round → a dome
   The solid { |z| ≤ H(x,y) } (or 0 ≤ z ≤ H with a flat back) is polygonised with Surface Nets. */

import { surfaceNets, type BrushMeshResult } from "../brush/core"

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
  const SS = 3
  const res3 = Math.max(48, Math.min(260, prm.res))
  const h3 = span / res3 // 3D cell
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
  const edge = 1.2 * h3
  const Hf = new Float32Array(sd.length)
  let hMax = 0
  for (let i = 0; i < sd.length; i++) {
    const d = sd[i]
    let hgt: number
    // the rim keeps a thin vertical wall (edge) so the silhouette follows the smooth 2D outline
    // instead of a knife edge thinner than a voxel (which aliases into stairs)
    if (d <= 0) hgt = edge + d * 3
    else {
      hgt = vol * ref * Math.pow(d / ref, pw)
      if (hgt > cap) hgt = cap + (hgt - cap) * 0.04
      hgt += edge
    }
    Hf[i] = hgt
    if (hgt > hMax) hMax = hgt
  }

  // 3D field: F = |z| - H  (or max(-z, z - H) for a flat back)
  const zPad = 3 * h3
  const zLo = prm.doubleSided ? -(hMax + zPad) : -zPad
  const nz = Math.ceil((hMax + zPad - zLo) / h3) + 1
  const N = nx * ny * nz
  if (N > 1.6e7) return null
  const F = new Float32Array(N)
  const sxy = nx * ny
  for (let k = 0; k < nz; k++) {
    const z = zLo + k * h3
    const az = Math.abs(z)
    for (let c = 0; c < sxy; c++) {
      const hh = Hf[c]
      F[k * sxy + c] = prm.doubleSided ? az - hh : Math.max(-z, z - hh)
    }
  }
  // grid origin: cell centres of the 2D raster blocks
  const gx = ox + (SS / 2) * h2
  const gy = oy + (SS / 2) * h2
  const r = surfaceNets(F, nx, ny, nz, h3, gx, gy, zLo)
  if (r) relax(r, 2)
  return r
}

/* Taubin smoothing (shrink-free): irons out the voxel stair on rims and walls. */
function relax(r: BrushMeshResult, iters: number) {
  const P = r.position, I = r.index
  const n = P.length / 3
  const deg = new Uint32Array(n)
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) deg[I[t + e]] += 2
  const off = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) off[i + 1] = off[i] + deg[i]
  const adj = new Uint32Array(off[n])
  const fill = off.slice(0, n)
  for (let t = 0; t < I.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = I[t + e], b = I[t + ((e + 1) % 3)], c = I[t + ((e + 2) % 3)]
      adj[fill[a]++] = b
      adj[fill[a]++] = c
    }
  const tmp = new Float32Array(P.length)
  const step = (lam: number) => {
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, sz = 0
      const k0 = off[i], k1 = off[i + 1]
      if (k1 === k0) {
        tmp[i * 3] = P[i * 3]; tmp[i * 3 + 1] = P[i * 3 + 1]; tmp[i * 3 + 2] = P[i * 3 + 2]
        continue
      }
      for (let k = k0; k < k1; k++) {
        const j = adj[k]
        sx += P[j * 3]; sy += P[j * 3 + 1]; sz += P[j * 3 + 2]
      }
      const m = 1 / (k1 - k0)
      tmp[i * 3] = P[i * 3] + lam * (sx * m - P[i * 3])
      tmp[i * 3 + 1] = P[i * 3 + 1] + lam * (sy * m - P[i * 3 + 1])
      tmp[i * 3 + 2] = P[i * 3 + 2] + lam * (sz * m - P[i * 3 + 2])
    }
    P.set(tmp)
  }
  for (let it = 0; it < iters; it++) {
    step(0.5)
    step(-0.53)
  }
}
