/* Terrazzo: a procedural PBR material.
   - chips: shrunken 3D Voronoi cells in object space, so every chip is an angular shard and the
     pattern runs straight through any shape with no UVs or seams; two sizes (chips + fines)
   - binder: base colour with soft mottling and tiny specks
   - each chip takes one of four colours, with its own brightness and a little inner cloud
   - polished: chips slightly glossier than the binder, clearcoat on top
   - hue rotates the whole palette (same HSL rotation as elsewhere) */

import * as THREE from "three"
import { HUE_GLSL } from "@/lib/hue-shift"

export interface TerrazzoSettings {
  enabled: boolean
  base: string // binder
  c1: string
  c2: string
  c3: string
  c4: string
  hue: number // 0…360
  size: number // chip size
  amount: number // share of cells that are chips 0…1
  fines: number // amount of small chips 0…1
  gap: number // binder between neighbouring chips 0…1
  variation: number // brightness variation between chips 0…1
  specks: number // tiny dots in the binder 0…1
  roughness: number
  gloss: number // clearcoat 0…1
  seed: number
}

export const TERRAZZO_PRESETS: { name: string; base: string; c: [string, string, string, string] }[] = [
  { name: "Classic", base: "#efebe4", c: ["#c9786a", "#5f6b70", "#1d1d1f", "#d9c7a5"] },
  { name: "Venetian", base: "#ead9c0", c: ["#b5522f", "#6f7d4f", "#f4efe4", "#3a2a22"] },
  { name: "Blush", base: "#f2d6d0", c: ["#e0897a", "#ffffff", "#9b4c4c", "#e8b25a"] },
  { name: "Night", base: "#26272b", c: ["#f1efe9", "#c9a25a", "#7d8790", "#b46a55"] },
  { name: "Mint", base: "#d6ebe1", c: ["#2f7d62", "#ffffff", "#f0a25e", "#16302a"] },
  { name: "Ocean", base: "#e8eef5", c: ["#2f5fb8", "#9cc7ef", "#14213d", "#f2c14e"] },
  { name: "Sorbet", base: "#fff2df", c: ["#ff7b54", "#ffd25a", "#7cc6a4", "#c995e8"] },
  { name: "Slate", base: "#8d9196", c: ["#e9e6df", "#2c2d30", "#c27b5b", "#b8bec4"] },
  { name: "Rosso", base: "#9b2f2a", c: ["#f1e6d8", "#2a1110", "#e0a46b", "#5c1714"] },
]

export const TERRAZZO_DEFAULT: TerrazzoSettings = {
  enabled: false,
  base: TERRAZZO_PRESETS[0].base,
  c1: TERRAZZO_PRESETS[0].c[0],
  c2: TERRAZZO_PRESETS[0].c[1],
  c3: TERRAZZO_PRESETS[0].c[2],
  c4: TERRAZZO_PRESETS[0].c[3],
  hue: 0,
  size: 0.7,
  amount: 0.55,
  fines: 0.6,
  gap: 0.35,
  variation: 0.35,
  specks: 0.4,
  roughness: 0.35,
  gloss: 0.6,
  seed: 11,
}

const GLSL = /* glsl */ `
uniform vec3 tzBase; uniform vec3 tzC1; uniform vec3 tzC2; uniform vec3 tzC3; uniform vec3 tzC4;
uniform float tzSize; uniform float tzAmount; uniform float tzFines; uniform float tzGap;
uniform float tzVar; uniform float tzSpecks; uniform float tzSeed;
varying vec3 vTzObj;
float tzChipMask;

vec3 tzHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p + tzSeed) * 43758.5453123);
}
float tzVnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = tzHash3(i).x, b = tzHash3(i + vec3(1,0,0)).x, c = tzHash3(i + vec3(0,1,0)).x, d = tzHash3(i + vec3(1,1,0)).x;
  float e = tzHash3(i + vec3(0,0,1)).x, g = tzHash3(i + vec3(1,0,1)).x, h = tzHash3(i + vec3(0,1,1)).x, k = tzHash3(i + vec3(1,1,1)).x;
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
// Voronoi: x = distance to the cell border (F2-F1 style), yzw = the nearest cell's random id
vec4 tzVoronoi(vec3 p) {
  vec3 ip = floor(p), fp = fract(p);
  float d1 = 9.0, d2 = 9.0; vec3 id = vec3(0.0), mr = vec3(0.0), mc = vec3(0.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = tzHash3(ip + g);
    vec3 r = g + 0.15 + h * 0.7 - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h; mr = r; mc = ip + g; }
    else if (d < d2) d2 = d;
  }
  // exact distance to the border of the nearest cell (second pass, Inigo Quilez)
  float bd = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = mc - ip + vec3(float(x), float(y), float(z));
    vec3 h = tzHash3(ip + g);
    vec3 r = g + 0.15 + h * 0.7 - fp;
    vec3 dr = r - mr;
    if (dot(dr, dr) > 1e-5) bd = min(bd, dot(0.5 * (mr + r), normalize(dr)));
  }
  return vec4(bd, id);
}
vec3 tzPick(float r) {
  return r < 0.25 ? tzC1 : r < 0.5 ? tzC2 : r < 0.75 ? tzC3 : tzC4;
}
// one layer of chips: returns colour in rgb, coverage in a
vec4 tzLayer(vec3 p, float amount, float gap) {
  vec4 v = tzVoronoi(p);
  float aa = fwidth(v.x) * 1.5 + 1e-4;
  float isChip = step(v.y, amount);
  float m = isChip * smoothstep(gap, gap + aa, v.x);
  vec3 col = tzPick(v.z);
  col *= 1.0 + (v.w - 0.5) * 1.2 * tzVar;
  // a little cloud inside each stone
  col *= 0.92 + 0.16 * tzVnoise(p * 3.0 + v.yzw * 17.0);
  return vec4(col, m);
}
`

export function createTerrazzoMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    name: "kk-terrazzo",
    color: 0xffffff,
    roughness: TERRAZZO_DEFAULT.roughness,
    metalness: 0,
    clearcoat: TERRAZZO_DEFAULT.gloss,
    clearcoatRoughness: 0.08,
  })
  const u = {
    tzBase: { value: new THREE.Color() },
    tzC1: { value: new THREE.Color() },
    tzC2: { value: new THREE.Color() },
    tzC3: { value: new THREE.Color() },
    tzC4: { value: new THREE.Color() },
    tzSize: { value: 1 },
    tzAmount: { value: 0.55 },
    tzFines: { value: 0.6 },
    tzGap: { value: 0.35 },
    tzVar: { value: 0.35 },
    tzSpecks: { value: 0.4 },
    tzSeed: { value: 0 },
    uHueShift: { value: 0 },
  }
  m.userData.tz = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTzObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTzObj = position;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLSL + HUE_GLSL)
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
  {
  vec3 tzP = vTzObj * (2.6 / tzSize) + vec3(tzSeed * 0.37);
  // binder: soft mottling + specks
  vec3 tzCol = tzBase * (0.95 + 0.08 * tzVnoise(tzP * 2.3));
  vec4 tzS = tzVoronoi(tzP * 9.0 + 31.0);
  float tzSpeck = step(tzS.y, tzSpecks * 0.5) * smoothstep(0.12, 0.16, tzS.x);
  tzCol = mix(tzCol, tzPick(tzS.z) * 0.9, tzSpeck * 0.85);
  // fines first, big chips on top
  vec4 tzF = tzLayer(tzP * 3.1 + 7.0, tzFines * 0.75, 0.06 + tzGap * 0.22);
  tzCol = mix(tzCol, tzF.rgb, tzF.a);
  vec4 tzB = tzLayer(tzP, tzAmount, 0.02 + tzGap * 0.22);
  tzCol = mix(tzCol, tzB.rgb, tzB.a);
  tzChipMask = max(tzF.a, tzB.a);
  if (uHueShift != 0.0) tzCol = kkHueShift(tzCol, uHueShift);
  diffuseColor.rgb *= tzCol;
  }
`,
      )
      // stones polish a touch glossier than the cement binder
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.0, 0.7, tzChipMask);")
  }
  m.customProgramCacheKey = () => "kk-terrazzo-1"
  return m
}

export function updateTerrazzoMaterial(m: THREE.MeshPhysicalMaterial, s: TerrazzoSettings) {
  const u = m.userData.tz
  u.tzBase.value.set(s.base)
  u.tzC1.value.set(s.c1)
  u.tzC2.value.set(s.c2)
  u.tzC3.value.set(s.c3)
  u.tzC4.value.set(s.c4)
  u.tzSize.value = s.size
  u.tzAmount.value = s.amount
  u.tzFines.value = s.fines
  u.tzGap.value = s.gap
  u.tzVar.value = s.variation
  u.tzSpecks.value = s.specks
  u.tzSeed.value = (s.seed % 1000) * 1.618
  u.uHueShift.value = s.hue
  m.roughness = s.roughness
  m.clearcoat = s.gloss
}
