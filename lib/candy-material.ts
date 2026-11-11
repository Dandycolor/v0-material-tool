/* Candy: frosted, translucent plastic filled with a colour gradient (gummy / "caramel" toys).
   - MeshPhysical transmission + roughness = frosted see-through body; the transmitted light is
     tinted by diffuseColor, so a per-pixel gradient on it colours the light *inside* the body
   - the gradient runs along an object axis (3 stops, soft), so it flows through any shape
   - a soft inner glow (emissive gradient, stronger facing the viewer) fakes light scattering in the
     filling; a milky rim (fresnel) and a satin clearcoat give the soft-touch plastic edge
   - hue rotates the palette */

import * as THREE from "three"
import { HUE_GLSL } from "@/lib/hue-shift"


export interface CandySettings {
  enabled: boolean
  c1: string
  c2: string
  c3: string
  hue: number
  angle: number // gradient direction on screen-facing plane, degrees (0 = left→right)
  tilt: number // tilt toward depth, degrees -80…80
  offset: number // -1…1 shifts the gradient
  spread: number // 0.2…2 gradient length
  softness: number // 0…1 transition width between the colours
  frost: number // roughness 0…1
  clarity: number // transmission 0…1
  depth: number // thickness
  glow: number // inner glow 0…1.5
  milk: number // milky fresnel rim 0…1
  rimTint: number // 0 = white rim … 1 = rim in the gradient colour (saturated edge glow)
  gloss: number // clearcoat 0…1
}

export const CANDY_PRESETS: { name: string; c: [string, string, string] }[] = [
  { name: "Grape", c: ["#ff5fd2", "#a46bff", "#5fa8ff"] },
  { name: "Peach", c: ["#ffd36b", "#ff8a6b", "#ff4f8b"] },
  { name: "Mint", c: ["#c6ff8a", "#3fe0b5", "#2f9bff"] },
  { name: "Berry", c: ["#ff3d6e", "#c42dff", "#4b2dff"] },
  { name: "Lemon", c: ["#fff27a", "#c8ff5a", "#5aff9b"] },
  { name: "Ice", c: ["#ffffff", "#bfe7ff", "#7fb0ff"] },
  { name: "Cola", c: ["#ffb86b", "#c0561f", "#4a1608"] },
  { name: "Sunset", c: ["#ffe36b", "#ff6b3d", "#8a2dff"] },
  { name: "Mono", c: ["#f4f4f6", "#b9bcc6", "#5d6170"] },
]

export const CANDY_DEFAULT: CandySettings = {
  enabled: false,
  c1: CANDY_PRESETS[0].c[0],
  c2: CANDY_PRESETS[0].c[1],
  c3: CANDY_PRESETS[0].c[2],
  hue: 0,
  angle: -40,
  tilt: 0,
  offset: 0,
  spread: 1,
  softness: 1,
  frost: 0.45,
  clarity: 0.85,
  depth: 0.8,
  glow: 0.55,
  milk: 0.45,
  rimTint: 0.3,
  gloss: 0.35,
}

const GLSL = /* glsl */ `
uniform vec3 cdC1; uniform vec3 cdC2; uniform vec3 cdC3;
uniform vec3 cdAxis; uniform float cdOffset; uniform float cdSpread;
uniform float cdGlow; uniform float cdMilk; uniform float cdSoft; uniform float cdRimTint;
varying vec3 vCdObj;
vec3 cdGrad;
`

export function createCandyMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    name: "kk-candy",
    color: 0xffffff,
    roughness: CANDY_DEFAULT.frost,
    metalness: 0,
    transmission: CANDY_DEFAULT.clarity,
    thickness: CANDY_DEFAULT.depth,
    ior: 1.45,
    clearcoat: CANDY_DEFAULT.gloss,
    clearcoatRoughness: 0.35,
    specularIntensity: 0.6,
    side: THREE.DoubleSide,
  })
  const u = {
    cdC1: { value: new THREE.Color() },
    cdC2: { value: new THREE.Color() },
    cdC3: { value: new THREE.Color() },
    cdAxis: { value: new THREE.Vector3(0, 1, 0) },
    cdOffset: { value: 0 },
    cdSpread: { value: 1 },
    cdGlow: { value: 0.5 },
    cdMilk: { value: 0.4 },
    cdSoft: { value: 0.8 },
    cdRimTint: { value: 0.5 },
    uHueShift: { value: 0 },
  }
  m.userData.cd = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCdObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCdObj = position;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLSL + HUE_GLSL)
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
  {
  float cdT = clamp(dot(vCdObj, cdAxis) / (1.6 * cdSpread) + 0.5 - cdOffset * 0.5, 0.0, 1.0);
  float cdW = 0.01 + cdSoft * 0.24;
  vec3 cdCol = mix(cdC1, cdC2, smoothstep(0.25 - cdW, 0.25 + cdW, cdT));
  cdCol = mix(cdCol, cdC3, smoothstep(0.75 - cdW, 0.75 + cdW, cdT));
  if (uHueShift != 0.0) cdCol = kkHueShift(cdCol, uHueShift);
  cdGrad = cdCol;
  diffuseColor.rgb *= cdCol;
  }
`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
  {
  // light scattered in the filling: brightest where we look straight in, fading to the rim
  float cdFacing = abs(dot(normalize(vViewPosition), normal));
  totalEmissiveRadiance += cdGrad * cdGlow * (0.25 + 0.75 * cdFacing);
  // milky soft-touch edge
  float cdFres = pow(1.0 - cdFacing, 2.5);
  vec3 cdRim = mix(vec3(1.0), cdGrad * 1.4, cdRimTint);
  totalEmissiveRadiance += cdRim * cdFres * cdMilk * 0.9;
  }
`,
      )
  }
  m.customProgramCacheKey = () => "kk-candy-3"
  return m
}

export function updateCandyMaterial(m: THREE.MeshPhysicalMaterial, s: CandySettings) {
  const u = m.userData.cd
  u.cdC1.value.set(s.c1)
  u.cdC2.value.set(s.c2)
  u.cdC3.value.set(s.c3)
  const a = (s.angle * Math.PI) / 180, t = (s.tilt * Math.PI) / 180
  u.cdAxis.value.set(Math.cos(a) * Math.cos(t), Math.sin(a) * Math.cos(t), Math.sin(t))
  u.cdSoft.value = s.softness
  u.cdRimTint.value = s.rimTint
  u.cdOffset.value = s.offset
  u.cdSpread.value = s.spread
  u.cdGlow.value = s.glow
  u.cdMilk.value = s.milk
  u.uHueShift.value = s.hue
  m.roughness = s.frost
  m.transmission = s.clarity
  m.thickness = s.depth
  m.clearcoat = s.gloss
  // light travelling through the filling picks up the middle colour
  m.attenuationColor.set(s.c2).offsetHSL(s.hue / 360, 0, 0.15)
  m.attenuationDistance = 0.6 + s.depth
}
