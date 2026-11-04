/* Tortoiseshell acetate ("Havana"): a procedural PBR material.
   - pattern: domain-warped fractal noise in object space (no UVs needed, no seams) mapped onto a
     4-stop palette: dark spots → chocolate → amber → honey
   - translucency: the light parts transmit light (MeshPhysical transmission scaled per pixel by the
     pattern), the dark spots stay dense — so the spots seem to float inside the material
   - polished acetate: clearcoat on top
   - hue: rotates the whole palette (same HSL rotation as the texture hue shift) */

import * as THREE from "three"
import { HUE_GLSL } from "@/lib/hue-shift"

export interface TortoiseSettings {
  enabled: boolean
  c0: string // darkest spots
  c1: string // chocolate
  c2: string // amber
  c3: string // honey / clear
  hue: number // 0…360
  scale: number // pattern size
  warp: number // swirl of the streaks 0…2
  stretch: number // elongation of the spots 1…4
  contrast: number // 0…1
  spots: number // amount of dark 0…1
  translucency: number // 0…1 (transmission of the light parts)
  depth: number // thickness for refraction / absorption
  roughness: number
  gloss: number // clearcoat 0…1
  seed: number
}

export const TORTOISE_PRESETS: { name: string; c: [string, string, string, string]; spots: number; translucency: number }[] = [
  { name: "Havana", c: ["#120804", "#3b1a08", "#8a4510", "#d99a3c"], spots: 0.5, translucency: 0.55 },
  { name: "Blonde", c: ["#4a2a0e", "#9a6224", "#d8a24e", "#f3d58f"], spots: 0.32, translucency: 0.75 },
  { name: "Dark", c: ["#050302", "#1c0e06", "#4a240c", "#8a4c1c"], spots: 0.68, translucency: 0.35 },
  { name: "Honey", c: ["#2b1306", "#7a3c0e", "#c97a1e", "#f6c35a"], spots: 0.4, translucency: 0.7 },
  { name: "Green", c: ["#06100a", "#173a24", "#3f7a4a", "#a9cf8e"], spots: 0.48, translucency: 0.6 },
  { name: "Rose", c: ["#2a0a12", "#7a2c3c", "#d0707c", "#f6c1c4"], spots: 0.4, translucency: 0.7 },
  { name: "Grey", c: ["#0b0b0c", "#3a3a3e", "#7d7d84", "#cfcfd4"], spots: 0.45, translucency: 0.6 },
  { name: "Blue", c: ["#060a18", "#14275a", "#3e66b8", "#a8c6f2"], spots: 0.45, translucency: 0.65 },
  { name: "Tokyo", c: ["#1a0614", "#5a1846", "#d24a6a", "#ffb36b"], spots: 0.42, translucency: 0.65 },
]

export const TORTOISE_DEFAULT: TortoiseSettings = {
  enabled: false,
  c0: TORTOISE_PRESETS[0].c[0],
  c1: TORTOISE_PRESETS[0].c[1],
  c2: TORTOISE_PRESETS[0].c[2],
  c3: TORTOISE_PRESETS[0].c[3],
  hue: 0,
  scale: 1,
  warp: 1,
  stretch: 1.8,
  contrast: 0.6,
  spots: 0.5,
  translucency: 0.55,
  depth: 0.6,
  roughness: 0.12,
  gloss: 1,
  seed: 7,
}

const NOISE = /* glsl */ `
vec3 tsMod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 tsMod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 tsPermute(vec4 x){return tsMod289(((x*34.0)+1.0)*x);}
vec4 tsTaylor(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float tsNoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=tsMod289(i);
  vec4 p=tsPermute(tsPermute(tsPermute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=tsTaylor(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float tsFbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*tsNoise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=0.45; } return s; }
`

const UNIFORMS = /* glsl */ `
uniform vec3 tsC0; uniform vec3 tsC1; uniform vec3 tsC2; uniform vec3 tsC3;
uniform float tsScale; uniform float tsWarp; uniform float tsStretch; uniform float tsContrast;
uniform float tsSpots; uniform float tsSeed;
varying vec3 vTsObj;
float tsLight;
`

export function createTortoiseMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    name: "kk-tortoise",
    color: 0xffffff,
    roughness: TORTOISE_DEFAULT.roughness,
    metalness: 0,
    transmission: TORTOISE_DEFAULT.translucency,
    thickness: TORTOISE_DEFAULT.depth,
    ior: 1.49, // cellulose acetate
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    side: THREE.DoubleSide,
  })
  const u = {
    tsC0: { value: new THREE.Color() },
    tsC1: { value: new THREE.Color() },
    tsC2: { value: new THREE.Color() },
    tsC3: { value: new THREE.Color() },
    tsScale: { value: 1 },
    tsWarp: { value: 1 },
    tsStretch: { value: 1.8 },
    tsContrast: { value: 0.6 },
    tsSpots: { value: 0.5 },
    tsSeed: { value: 0 },
    uHueShift: { value: 0 },
  }
  m.userData.ts = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTsObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTsObj = position;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + UNIFORMS + NOISE + HUE_GLSL)
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
  {
  // streaks run along X; stretch squeezes the other axes so spots elongate like poured acetate
  vec3 q = vTsObj * vec3(1.0, tsStretch, tsStretch) * (0.75 * tsScale) + vec3(tsSeed);
  vec3 w1 = vec3(tsFbm(q), tsFbm(q + vec3(5.2,1.3,2.8)), tsFbm(q + vec3(1.7,9.2,4.4)));
  vec3 w2 = vec3(tsFbm(q + tsWarp*1.3*w1 + vec3(8.3,2.8,1.1)), tsFbm(q + tsWarp*1.3*w1 + vec3(2.1,7.4,6.3)), 0.0);
  float n = tsFbm(q + tsWarp*1.6*vec3(w2.xy, w1.z));
  // n ~ -0.6…0.6 → 0…1, shifted by the spot amount, sharpened by contrast
  float t = clamp(n*0.95 + 0.5 + (0.5 - tsSpots)*0.7, 0.0, 1.0);
  float k = mix(1.0, 3.2, tsContrast);
  t = clamp((t - 0.5)*k + 0.5, 0.0, 1.0);
  vec3 col = mix(tsC0, tsC1, smoothstep(0.0, 0.33, t));
  col = mix(col, tsC2, smoothstep(0.30, 0.66, t));
  col = mix(col, tsC3, smoothstep(0.62, 1.0, t));
  if (uHueShift != 0.0) col = kkHueShift(col, uHueShift);
  diffuseColor.rgb *= col;
  // light parts let light through, dark spots stay dense
  tsLight = smoothstep(0.35, 0.9, t);
  }
`,
      )
      .replace("material.transmission = transmission;", "material.transmission = transmission * tsLight;")
  }
  m.customProgramCacheKey = () => "kk-tortoise-3"
  return m
}

export function updateTortoiseMaterial(m: THREE.MeshPhysicalMaterial, s: TortoiseSettings) {
  const u = m.userData.ts
  u.tsC0.value.set(s.c0)
  u.tsC1.value.set(s.c1)
  u.tsC2.value.set(s.c2)
  u.tsC3.value.set(s.c3)
  u.tsScale.value = s.scale
  u.tsWarp.value = s.warp
  u.tsStretch.value = s.stretch
  u.tsContrast.value = s.contrast
  u.tsSpots.value = s.spots
  u.tsSeed.value = (s.seed % 1000) * 3.17
  u.uHueShift.value = s.hue
  m.transmission = s.translucency
  m.thickness = s.depth
  m.roughness = s.roughness
  m.clearcoat = s.gloss
  // light travelling through the acetate picks up the amber tone
  m.attenuationColor.set(s.c2).offsetHSL(s.hue / 360, 0, 0)
  m.attenuationDistance = 0.35 + s.depth
}
