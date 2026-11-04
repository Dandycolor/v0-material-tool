/* Generative normal map: a random seamless (tileable) height field turned into a tangent-space
   normal map on a canvas. Returned as a data URL, so it plugs into every place that takes a
   normal-map URL (Custom PBR, Matcap) with the same texture loading and caching. */

const N = 512

function rng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/* tileable value noise on a lattice of period p */
function valueLayer(rand: () => number, p: number) {
  const g = new Float32Array(p * p)
  for (let i = 0; i < g.length; i++) g[i] = rand() * 2 - 1
  return (x: number, y: number) => {
    // x, y in 0…1
    const fx = x * p, fy = y * p
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = fx - x0, ty = fy - y0
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const i0 = ((x0 % p) + p) % p, j0 = ((y0 % p) + p) % p
    const i1 = (i0 + 1) % p, j1 = (j0 + 1) % p
    const a = g[j0 * p + i0], b = g[j0 * p + i1], c = g[j1 * p + i0], d = g[j1 * p + i1]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

function fbm(rand: () => number, base: number, oct: number, ridged = false) {
  const layers = Array.from({ length: oct }, (_, o) => valueLayer(rand, base << o))
  return (x: number, y: number) => {
    let s = 0, a = 1, n = 0
    for (let o = 0; o < oct; o++) {
      let v = layers[o](x, y)
      if (ridged) v = 1 - Math.abs(v) * 2
      s += v * a
      n += a
      a *= 0.5
    }
    return s / n
  }
}

/* tileable Worley cells: distance to the nearest feature point (wraps at the edges) */
function cells(rand: () => number, count: number) {
  const pts: [number, number][] = Array.from({ length: count }, () => [rand(), rand()])
  return (x: number, y: number) => {
    let d1 = 9, d2 = 9
    for (const [px, py] of pts) {
      let dx = Math.abs(x - px), dy = Math.abs(y - py)
      if (dx > 0.5) dx = 1 - dx
      if (dy > 0.5) dy = 1 - dy
      const d = dx * dx + dy * dy
      if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
    }
    return [Math.sqrt(d1), Math.sqrt(d2)]
  }
}

type Style = "noise" | "ridges" | "hammered" | "cells" | "waves" | "bumps"
const STYLES: Style[] = ["noise", "ridges", "hammered", "cells", "waves", "bumps"]

export function generateNormalMap(seed = Math.floor(Math.random() * 1e9)): string {
  const rand = rng(seed)
  const style = STYLES[Math.floor(rand() * STYLES.length)]
  const h = new Float32Array(N * N)

  let f: (x: number, y: number) => number
  switch (style) {
    case "ridges": {
      const r = fbm(rand, 2 + Math.floor(rand() * 4), 5, true)
      const w = fbm(rand, 2, 3)
      f = (x, y) => r(x + w(x, y) * 0.08, y + w(y, x) * 0.08)
      break
    }
    case "hammered": {
      const c = cells(rand, 40 + Math.floor(rand() * 80))
      const k = 0.03 + rand() * 0.04
      f = (x, y) => Math.min(c(x, y)[0] / k, 1) ** 2 // round dents
      break
    }
    case "cells": {
      const c = cells(rand, 12 + Math.floor(rand() * 40))
      f = (x, y) => {
        const [a, b] = c(x, y)
        return Math.min((b - a) * 14, 1) // flat plates, grooves along the borders
      }
      break
    }
    case "waves": {
      // integer frequencies keep it seamless
      const comps = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
        fx: Math.floor(rand() * 9) - 4, fy: 2 + Math.floor(rand() * 10), ph: rand() * 6.283, a: 0.4 + rand(),
      }))
      const w = fbm(rand, 3, 3)
      f = (x, y) => {
        let s = 0
        const wx = w(x, y) * 0.6
        for (const c of comps) s += c.a * Math.sin(6.283 * (c.fx * x + c.fy * y) + c.ph + wx * 6.283)
        return s * 0.3
      }
      break
    }
    case "bumps": {
      const n = fbm(rand, 4 + Math.floor(rand() * 6), 2)
      f = (x, y) => Math.max(0, n(x, y) * 1.6) ** 0.6
      break
    }
    case "noise":
    default: {
      const n = fbm(rand, 3 + Math.floor(rand() * 5), 6)
      f = (x, y) => n(x, y)
    }
  }

  let lo = Infinity, hi = -Infinity
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const v = f(i / N, j / N)
      h[j * N + i] = v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  const span = hi - lo || 1
  const strength = 3 + rand() * 4

  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = N
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(N, N)
  const at = (i: number, j: number) => (h[((j + N) % N) * N + ((i + N) % N)] - lo) / span
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * strength
      const dy = (at(i, j + 1) - at(i, j - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const o = (j * N + i) * 4
      img.data[o] = ((-dx / l) * 0.5 + 0.5) * 255
      img.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255 // OpenGL convention (+Y up), canvas rows go down
      img.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL("image/jpeg", 0.92)
}
