/* "Layered" material (after Sava's Blob Forge): a 3-colour gradient on top, and underneath it a matcap
   that shows through noise "holes". One ShaderMaterial shared by every mesh; settings are uniforms,
   so sliders never rebuild the shader. Object space is ≈ −1…1 for all Pólya shapes (they are fitted to 2 units). */

import * as THREE from "three"

export type LayeredAxis = "x" | "y" | "z"
export type LayeredBlend = "replace" | "modulate"

export interface LayeredSettings {
  enabled: boolean
  colorA: string
  colorB: string
  colorC: string
  axis: LayeredAxis
  softness: number // gradient transition width 0…1
  matcap: string // url
  blend: LayeredBlend
  intensity: number // matcap intensity 0…2
  coverage: number // 0 = pure gradient … 1 = full matcap
  holeScale: number // patch size
  holeSoftness: number // edge falloff
  maskDetail: number // octaves 1…5
  maskBlur: number // extra falloff 0…1
  invert: boolean
  ambient: number // flat ↔ lit gradient 0…1
  grain: number // film grain 0…1
}

export const LAYERED_DEFAULT: LayeredSettings = {
  enabled: false,
  colorA: "#ac80ff",
  colorB: "#c815f9",
  colorC: "#bdbcf5",
  axis: "x",
  softness: 0.05,
  matcap: "/matcaps/metal.png",
  blend: "replace",
  intensity: 1,
  coverage: 0.45,
  holeScale: 0.8,
  holeSoftness: 0.07,
  maskDetail: 1,
  maskBlur: 0,
  invert: false,
  ambient: 0.82,
  grain: 0,
}

export const LAYERED_PALETTES: { name: string; colors: [string, string, string] }[] = [
  { name: "Violet haze", colors: ["#ac80ff", "#c815f9", "#bdbcf5"] },
  { name: "Lime → Violet", colors: ["#d4ff4f", "#b98cff", "#6a2cff"] },
  { name: "Green → Blue", colors: ["#33e0a1", "#2fa7ff", "#2433ff"] },
  { name: "Citrus", colors: ["#f4ff4a", "#9ad82b", "#2f8f22"] },
  { name: "Sunset", colors: ["#ffc04d", "#ff6a3d", "#d8325f"] },
  { name: "Mono noir", colors: ["#f2f2f2", "#8c8c8c", "#161616"] },
  { name: "Neon mint", colors: ["#7dffd8", "#27c9a6", "#5a2cff"] },
  { name: "Bubblegum", colors: ["#ffd1f2", "#ff5fc8", "#7a3cff"] },
  { name: "Ocean", colors: ["#b8f3ff", "#2fb4ff", "#0b2a8f"] },
]

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vView;
void main(){
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
uniform int uAxis; uniform float uSoft;
uniform sampler2D uMatcap; uniform float uHasMatcap;
uniform int uBlend; uniform float uIntensity;
uniform float uCoverage; uniform float uHoleScale; uniform float uHoleSoft; uniform int uDetail; uniform float uBlur; uniform float uInvert;
uniform float uAmbient; uniform float uGrain; uniform float uSeed;
varying vec3 vObj; varying vec3 vN; varying vec3 vView;

// Ashima 3D simplex noise
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float s=0.0, a=0.5, n=0.0;
  for(int o=0;o<5;o++){ if(o>=uDetail) break; s+=a*snoise(p); n+=a; p*=2.03; a*=0.5; }
  return s/max(n,1e-4);
}
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;

  // layer 1: three-colour gradient along an object axis, lit softly
  float t = uAxis==0 ? vObj.x : (uAxis==1 ? vObj.y : vObj.z);
  t = clamp(t*0.5+0.5, 0.0, 1.0);
  float w = mix(0.04, 0.5, clamp(uSoft,0.0,1.0));
  vec3 grad = mix(uA, uB, smoothstep(0.33-w, 0.33+w, t));
  grad = mix(grad, uC, smoothstep(0.66-w, 0.66+w, t));
  float ndl = max(dot(n, normalize(vec3(0.35,0.6,0.7))), 0.0);
  grad *= mix(ndl*0.85+0.15, 1.0, uAmbient);

  // layer 2: matcap
  vec3 vd = normalize(vView);
  vec3 xx = normalize(vec3(vd.z,0.0,-vd.x)); vec3 yy = cross(vd,xx);
  vec2 muv = vec2(dot(xx,n), dot(yy,n))*0.495+0.5;
  vec3 mc = uHasMatcap > 0.5 ? texture2D(uMatcap, muv).rgb * uIntensity : vec3(ndl);

  // holes: where the noise rises above the coverage threshold, the matcap shows through
  float nz = fbm(vObj * (0.35 + uHoleScale*0.95) + vec3(uSeed)) * 0.5 + 0.5;
  float th = 1.0 - uCoverage;
  float sw = max(uHoleSoft + uBlur*0.35, 0.002);
  float mask = smoothstep(th - sw, th + sw, nz);
  if (uCoverage <= 0.0) mask = 0.0;
  if (uCoverage >= 1.0) mask = 1.0;
  mask = mix(mask, 1.0 - mask, uInvert);

  vec3 col;
  if (uBlend == 0) col = mix(grad, mc, mask);
  else { float l = dot(mc, vec3(0.299,0.587,0.114)); col = mix(grad, grad * (0.25 + l*1.5), mask); }

  // film grain
  col += (hash(gl_FragCoord.xy + fract(uSeed)) - 0.5) * uGrain * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`

const hex = (c: string) => new THREE.Color(c)

export function createLayeredMaterial() {
  const m = new THREE.ShaderMaterial({
    name: "kk-layered",
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uA: { value: hex(LAYERED_DEFAULT.colorA) },
      uB: { value: hex(LAYERED_DEFAULT.colorB) },
      uC: { value: hex(LAYERED_DEFAULT.colorC) },
      uAxis: { value: 0 },
      uSoft: { value: 0.05 },
      uMatcap: { value: null },
      uHasMatcap: { value: 0 },
      uBlend: { value: 0 },
      uIntensity: { value: 1 },
      uCoverage: { value: 0.45 },
      uHoleScale: { value: 0.8 },
      uHoleSoft: { value: 0.07 },
      uDetail: { value: 1 },
      uBlur: { value: 0 },
      uInvert: { value: 0 },
      uAmbient: { value: 0.82 },
      uGrain: { value: 0 },
      uSeed: { value: 0 },
    },
  })
  return m
}

const MATCAPS = new Map<string, THREE.Texture>()
export function updateLayeredMaterial(m: THREE.ShaderMaterial, s: LayeredSettings, seed = 0) {
  const u = m.uniforms
  // colours are authored in sRGB; the shader writes straight to the screen
  u.uA.value.set(s.colorA).convertLinearToSRGB()
  u.uB.value.set(s.colorB).convertLinearToSRGB()
  u.uC.value.set(s.colorC).convertLinearToSRGB()
  u.uAxis.value = s.axis === "x" ? 0 : s.axis === "y" ? 1 : 2
  u.uSoft.value = s.softness
  u.uBlend.value = s.blend === "replace" ? 0 : 1
  u.uIntensity.value = s.intensity
  u.uCoverage.value = s.coverage
  u.uHoleScale.value = s.holeScale
  u.uHoleSoft.value = s.holeSoftness
  u.uDetail.value = Math.max(1, Math.min(5, Math.round(s.maskDetail)))
  u.uBlur.value = s.maskBlur
  u.uInvert.value = s.invert ? 1 : 0
  u.uAmbient.value = s.ambient
  u.uGrain.value = s.grain
  u.uSeed.value = (seed % 997) * 0.137
  if (s.matcap) {
    let tex = MATCAPS.get(s.matcap)
    if (!tex) {
      tex = new THREE.TextureLoader().load(s.matcap)
      MATCAPS.set(s.matcap, tex)
    }
    u.uMatcap.value = tex
    u.uHasMatcap.value = 1
  } else u.uHasMatcap.value = 0
}
