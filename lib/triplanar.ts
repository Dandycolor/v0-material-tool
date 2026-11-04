/* Triplanar texturing for the PBR materials.
   Colour, normal, roughness and metalness maps are projected onto the mesh from the three object
   axes and blended by the surface normal, instead of being read through the mesh UVs. No UV seams,
   no stretched islands — works the same on primitives, extrusions, blobs and any imported model.
   Normal maps use the whiteout blend (Ben Golus, "Normal Mapping for a Triplanar Shader").
   Patch once with setTriplanar(material, …); later calls only update the uniforms. */

import * as THREE from "three"
import { setMaterialHue } from "@/lib/hue-shift"

const VERT_HEAD = /* glsl */ `
uniform float kkTpScale;
varying vec3 vKkTpPos;
varying vec3 vKkTpN;
varying mat3 vKkTpM;
`
const VERT_BODY = /* glsl */ `
vKkTpPos = position * kkTpScale;
vKkTpN = normal;
vKkTpM = normalMatrix;
`

const FRAG_HEAD = /* glsl */ `
uniform float kkTpRepeat;
varying vec3 vKkTpPos;
varying vec3 vKkTpN;
varying mat3 vKkTpM;
vec3 kkTpW() {
  vec3 w = pow(abs(normalize(vKkTpN)), vec3(4.0));
  return w / (w.x + w.y + w.z);
}
// p * 0.5: a 2-unit Pólya shape spans about one tile at texture scale 1
vec4 kkTri(sampler2D t) {
  vec3 p = vKkTpPos * 0.5 * kkTpRepeat;
  vec3 w = kkTpW();
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
vec3 kkTriNormal(sampler2D t, vec2 s) {
  vec3 p = vKkTpPos * 0.5 * kkTpRepeat;
  vec3 n = normalize(vKkTpN);
  vec3 w = kkTpW();
  vec3 tx = texture2D(t, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(t, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(t, p.xy).xyz * 2.0 - 1.0;
  tx.xy *= s; ty.xy *= s; tz.xy *= s;
  // whiteout blend in each projection's own frame, then swizzle back to object space
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
`

const sample = (s: string, tex: string, uv: string) => s.split(`texture2D( ${tex}, ${uv} )`).join(`kkTri( ${tex} )`)

export function setTriplanar(material: THREE.Material, opts: { scale?: number; repeat?: number } = {}) {
  const m = material as THREE.Material & { userData: any }
  if (!(m as any).isMeshStandardMaterial) return
  if (!m.userData.kkTp) {
    // the hue patch must sit underneath (it rewrites map_fragment, which this patch then expands)
    if (!m.userData.kkHue) setMaterialHue(m, 0)
    const u = { kkTpScale: { value: 1 }, kkTpRepeat: { value: 1 } }
    m.userData.kkTp = u
    const prev = m.onBeforeCompile
    m.onBeforeCompile = (shader, renderer) => {
      prev?.call(m, shader, renderer) // the hue patch (if any) rewrites map_fragment first
      Object.assign(shader.uniforms, u)
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\n" + VERT_HEAD)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERT_BODY)
      let f = shader.fragmentShader
      for (const k of ["map_fragment", "roughnessmap_fragment", "metalnessmap_fragment"]) f = f.replace(`#include <${k}>`, THREE.ShaderChunk[k as keyof typeof THREE.ShaderChunk] as string)
      f = sample(f, "map", "vMapUv")
      f = sample(f, "roughnessMap", "vRoughnessMapUv")
      f = sample(f, "metalnessMap", "vMetalnessMapUv")
      f = f
        .replace("#include <common>", "#include <common>\n" + FRAG_HEAD)
        .replace(
          "#include <normal_fragment_maps>",
          /* glsl */ `
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_NORMALMAP_OBJECTSPACE )
  normal = normalize(vKkTpM * kkTriNormal(normalMap, normalScale));
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
#else
  #include <normal_fragment_maps>
#endif
`,
        )
      shader.fragmentShader = f
    }
    const prevKey = m.customProgramCacheKey?.bind(m)
    m.customProgramCacheKey = () => (prevKey ? prevKey() : "") + "|kkTri"
    m.needsUpdate = true
  }
  const u = m.userData.kkTp
  if (opts.scale !== undefined) u.kkTpScale.value = opts.scale
  if (opts.repeat !== undefined) u.kkTpRepeat.value = opts.repeat
}

/* The same projection for the matcap ShaderMaterials (their normal map used the raw UVs). */
const MATCAP_NORMAL_OLD = `vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        mapN.xy *= normalIntensity;
        float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection);`

export function triplanarMatcapShaders(vs: string, fs: string) {
  if (!fs.includes(MATCAP_NORMAL_OLD)) throw new Error("triplanar: matcap shader changed")
  return {
    vertexShader: vs.replace("void main() {", VERT_HEAD + "\nvoid main() {\n" + VERT_BODY),
    fragmentShader: fs
      .replace("void main() {", FRAG_HEAD + "\nvoid main() {")
      .replace(
        MATCAP_NORMAL_OLD,
        `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        normal = normalize(vKkTpM * kkTriNormal(normalMap, vec2(normalIntensity))) * faceDirection;`,
      ),
  }
}

/** kkTpRepeat follows the normal map's own repeat (set by the Repeat slider). */
export function triplanarMatcapUniforms(uniforms: Record<string, THREE.IUniform>, scale = 1) {
  uniforms.kkTpScale = { value: scale }
  uniforms.kkTpRepeat = {
    get value() {
      const t = uniforms.normalMap?.value as THREE.Texture | null
      return t?.repeat?.x || 1
    },
    set value(_v: number) {},
  } as THREE.IUniform
  return uniforms
}
