/* 3D brush mesher ("puffy paint").
   Each stroke is a chain of round-cone capsules (radius per point), squashed along the normal of the
   plane it was drawn on so it reads as paint squeezed from a tube rather than a pipe. Inside a stroke
   segments join with a plain min; strokes join each other with a smooth min, so they melt together
   where they touch. The signed distance field is splatted onto a grid (only around each stroke) and
   polygonised with Surface Nets; normals come from the field gradient. Pure functions: runs in the
   worker and, as a fallback, on the main thread. */

export interface BrushStroke {
  /** x, y, z, radius per point, in the shape's local space */
  p: number[]
  /** normal of the drawing plane (local space) */
  n: [number, number, number]
}

export interface BrushMeshParams {
  puff: number // 0.25…1: thickness across the drawing plane relative to the width
  blend: number // smooth-union radius between strokes (local units)
  res: number // grid cells along the longest side
}

export interface BrushMeshResult {
  position: Float32Array
  normal: Float32Array
  index: Uint32Array
}

const BIG = 1e3

export function meshStrokes(strokes: BrushStroke[], prm: BrushMeshParams): BrushMeshResult | null {
  const list = strokes.filter((s) => s.p.length >= 4)
  if (!list.length) return null
  const puff = Math.max(0.15, Math.min(1, prm.puff))
  const blend = Math.max(0, prm.blend)

  // bounds
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, rMax = 0, rMin = Infinity
  for (const s of list)
    for (let i = 0; i < s.p.length; i += 4) {
      const r = s.p[i + 3]
      x0 = Math.min(x0, s.p[i] - r); x1 = Math.max(x1, s.p[i] + r)
      y0 = Math.min(y0, s.p[i + 1] - r); y1 = Math.max(y1, s.p[i + 1] + r)
      z0 = Math.min(z0, s.p[i + 2] - r); z1 = Math.max(z1, s.p[i + 2] + r)
      rMax = Math.max(rMax, r); rMin = Math.min(rMin, r)
    }
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0)
  // voxel: the longest side gets `res` cells, but thin strokes still get ≥ ~3 cells across the radius
  let h = Math.min(span / Math.max(24, prm.res), Math.max(rMin * puff, 0.004) / 1.6)
  const pad = blend + 3 * h
  const maxCells = 9e6
  const dims = () => [Math.ceil((x1 - x0 + 2 * pad) / h) + 1, Math.ceil((y1 - y0 + 2 * pad) / h) + 1, Math.ceil((z1 - z0 + 2 * pad) / h) + 1]
  let [nx, ny, nz] = dims()
  while (nx * ny * nz > maxCells) {
    h *= 1.15
    ;[nx, ny, nz] = dims()
  }
  const ox = x0 - pad, oy = y0 - pad, oz = z0 - pad
  const N = nx * ny * nz
  const F = new Float32Array(N).fill(BIG)
  const S = new Float32Array(N) // per-stroke scratch (only the stroke's window is used)
  const sxy = nx * ny

  for (const s of list) {
    const pts = s.p
    const cnt = pts.length / 4
    let [nnx, nny, nnz] = s.n
    const nl = Math.hypot(nnx, nny, nnz) || 1
    nnx /= nl; nny /= nl; nnz /= nl
    const k = 1 / puff // stretch across the plane → flat bead
    // stroke window
    let a0 = Infinity, b0 = Infinity, c0 = Infinity, a1 = -Infinity, b1 = -Infinity, c1 = -Infinity, sr = 0
    for (let i = 0; i < pts.length; i += 4) {
      a0 = Math.min(a0, pts[i]); a1 = Math.max(a1, pts[i])
      b0 = Math.min(b0, pts[i + 1]); b1 = Math.max(b1, pts[i + 1])
      c0 = Math.min(c0, pts[i + 2]); c1 = Math.max(c1, pts[i + 2])
      sr = Math.max(sr, pts[i + 3])
    }
    const m = sr + pad
    const wi0 = Math.max(0, Math.floor((a0 - m - ox) / h)), wi1 = Math.min(nx - 1, Math.ceil((a1 + m - ox) / h))
    const wj0 = Math.max(0, Math.floor((b0 - m - oy) / h)), wj1 = Math.min(ny - 1, Math.ceil((b1 + m - oy) / h))
    const wk0 = Math.max(0, Math.floor((c0 - m - oz) / h)), wk1 = Math.min(nz - 1, Math.ceil((c1 + m - oz) / h))
    for (let kk = wk0; kk <= wk1; kk++)
      for (let jj = wj0; jj <= wj1; jj++) {
        const row = kk * sxy + jj * nx
        S.fill(BIG, row + wi0, row + wi1 + 1)
      }
    // plane point for the squash
    const px = pts[0], py = pts[1], pz = pts[2]

    for (let i = 0; i < cnt; i++) {
      const j = Math.min(cnt - 1, i + 1)
      const ax = pts[i * 4], ay = pts[i * 4 + 1], az = pts[i * 4 + 2], ra = pts[i * 4 + 3]
      const bx = pts[j * 4], by = pts[j * 4 + 1], bz = pts[j * 4 + 2], rb = pts[j * 4 + 3]
      if (i === j && cnt > 1) break
      const mr = Math.max(ra, rb) + pad
      const ii0 = Math.max(wi0, Math.floor((Math.min(ax, bx) - mr - ox) / h)), ii1 = Math.min(wi1, Math.ceil((Math.max(ax, bx) + mr - ox) / h))
      const jj0 = Math.max(wj0, Math.floor((Math.min(ay, by) - mr - oy) / h)), jj1 = Math.min(wj1, Math.ceil((Math.max(ay, by) + mr - oy) / h))
      const kk0 = Math.max(wk0, Math.floor((Math.min(az, bz) - mr - oz) / h)), kk1 = Math.min(wk1, Math.ceil((Math.max(az, bz) + mr - oz) / h))
      const dx = bx - ax, dy = by - ay, dz = bz - az
      const dd = dx * dx + dy * dy + dz * dz
      for (let kk = kk0; kk <= kk1; kk++) {
        const z = oz + kk * h
        for (let jj = jj0; jj <= jj1; jj++) {
          const y = oy + jj * h
          const row = kk * sxy + jj * nx
          for (let ii = ii0; ii <= ii1; ii++) {
            const x = ox + ii * h
            // squash across the drawing plane
            const off = ((x - px) * nnx + (y - py) * nny + (z - pz) * nnz) * (k - 1)
            const qx = x + off * nnx, qy = y + off * nny, qz = z + off * nnz
            let t = dd > 0 ? ((qx - ax) * dx + (qy - ay) * dy + (qz - az) * dz) / dd : 0
            t = t < 0 ? 0 : t > 1 ? 1 : t
            const ex = qx - ax - dx * t, ey = qy - ay - dy * t, ez = qz - az - dz * t
            const d = Math.sqrt(ex * ex + ey * ey + ez * ez) - (ra + (rb - ra) * t)
            const id = row + ii
            if (d < S[id]) S[id] = d
          }
        }
      }
    }
    // merge the stroke into the field with a smooth union
    for (let kk = wk0; kk <= wk1; kk++)
      for (let jj = wj0; jj <= wj1; jj++) {
        const row = kk * sxy + jj * nx
        for (let ii = wi0; ii <= wi1; ii++) {
          const id = row + ii
          const a = F[id], b = S[id]
          if (blend > 0) {
            const hh = Math.max(blend - Math.abs(a - b), 0) / blend
            F[id] = Math.min(a, b) - hh * hh * blend * 0.25
          } else F[id] = Math.min(a, b)
        }
      }
  }

  return surfaceNets(F, nx, ny, nz, h, ox, oy, oz)
}

/* Surface Nets: one vertex per sign-changing cell (mean of its edge crossings), one quad per
   sign-changing grid edge. */
export function surfaceNets(F: Float32Array, nx: number, ny: number, nz: number, h: number, ox: number, oy: number, oz: number): BrushMeshResult | null {
  const cx = nx - 1, cy = ny - 1, cz = nz - 1
  const cellVert = new Int32Array(cx * cy * cz).fill(-1)
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const sxy = nx * ny
  const v = new Float32Array(8)
  // corner c: bit0 → +x, bit1 → +y, bit2 → +z
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        const g = k * sxy + j * nx + i
        v[0] = F[g]; v[1] = F[g + 1]; v[2] = F[g + nx]; v[3] = F[g + nx + 1]
        v[4] = F[g + sxy]; v[5] = F[g + sxy + 1]; v[6] = F[g + sxy + nx]; v[7] = F[g + sxy + nx + 1]
        let mask = 0
        for (let c = 0; c < 8; c++) if (v[c] < 0) mask |= 1 << c
        if (mask === 0 || mask === 255) continue
        let sx = 0, sy = 0, sz = 0, n = 0
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e], b = EDGES[e + 1]
          const va = v[a], vb = v[b]
          if (va < 0 === vb < 0) continue
          const t = va / (va - vb)
          sx += (a & 1) + (((b & 1) - (a & 1)) * t)
          sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t)
          sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t)
          n++
        }
        const c = (k * cy + j) * cx + i
        cellVert[c] = pos.length / 3
        pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h)
        // gradient from the 8 corners
        let gx = v[1] - v[0] + v[3] - v[2] + v[5] - v[4] + v[7] - v[6]
        let gy = v[2] - v[0] + v[3] - v[1] + v[6] - v[4] + v[7] - v[5]
        let gz = v[4] - v[0] + v[5] - v[1] + v[6] - v[2] + v[7] - v[3]
        const gl = Math.hypot(gx, gy, gz) || 1
        nor.push(gx / gl, gy / gl, gz / gl)

        // faces for the three edges leaving corner 0 of this cell
        const inside0 = v[0] < 0
        // x edge (corner 0 → 1): shared by cells (j,k), (j-1,k), (j-1,k-1), (j,k-1)
        if (inside0 !== v[1] < 0 && j > 0 && k > 0) quad(c, c - cx, c - cx - cx * cy, c - cx * cy, inside0)
        // y edge (0 → 2): cells (i,k), (i,k-1), (i-1,k-1), (i-1,k)
        if (inside0 !== v[2] < 0 && i > 0 && k > 0) quad(c, c - cx * cy, c - cx * cy - 1, c - 1, inside0)
        // z edge (0 → 4): cells (i,j), (i-1,j), (i-1,j-1), (i,j-1)
        if (inside0 !== v[4] < 0 && i > 0 && j > 0) quad(c, c - 1, c - 1 - cx, c - cx, inside0)
      }
  function quad(a: number, b: number, c: number, d: number, flip: boolean) {
    const va = cellVert[a], vb = cellVert[b], vc = cellVert[c], vd = cellVert[d]
    if (va < 0 || vb < 0 || vc < 0 || vd < 0) return
    if (flip) idx.push(va, vb, vc, va, vc, vd)
    else idx.push(va, vd, vc, va, vc, vb)
  }
  if (!idx.length) return null
  return { position: new Float32Array(pos), normal: new Float32Array(nor), index: new Uint32Array(idx) }
}
