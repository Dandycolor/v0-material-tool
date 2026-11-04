/* GPU hue shift for the colour map of any MeshStandard/MeshPhysical material.
   Replaces the old per-pixel CPU pass (≈1M pixels in JS on every slider tick) with a uniform:
   changing the hue is now a single uniform write, no texture re-upload and no shader rebuild.
   The math matches the old CPU version: HSL rotation in sRGB space. */

import * as THREE from "three"

export const HUE_GLSL = /* glsl */ `
uniform float uHueShift;
vec3 kkLinToSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 kkSrgbToLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 kkRgb2hsl(vec3 c){
  float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5, h = 0.0, s = 0.0;
  if (mx != mn) {
    float d = mx - mn;
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}
float kkHue2rgb(float p, float q, float t){
  t = fract(t);
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}
vec3 kkHsl2rgb(vec3 hsl){
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(kkHue2rgb(p, q, hsl.x + 1.0/3.0), kkHue2rgb(p, q, hsl.x), kkHue2rgb(p, q, hsl.x - 1.0/3.0));
}
vec3 kkHueShift(vec3 linearRgb, float deg){
  vec3 hsl = kkRgb2hsl(clamp(kkLinToSrgb(linearRgb), 0.0, 1.0));
  hsl.x = fract(hsl.x + deg / 360.0);
  return kkSrgbToLin(kkHsl2rgb(hsl));
}
`

/** Patch a material once so its colour map can be hue-shifted; then call again to change the angle. */
export function setMaterialHue(material: THREE.Material, degrees: number) {
  const m = material as THREE.Material & { userData: any }
  if (!m.userData.kkHue) {
    const uniform = { value: degrees }
    m.userData.kkHue = uniform
    const prev = m.onBeforeCompile
    m.onBeforeCompile = (shader, renderer) => {
      prev?.call(m, shader, renderer)
      shader.uniforms.uHueShift = uniform
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + HUE_GLSL)
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if (uHueShift != 0.0) sampledDiffuseColor.rgb = kkHueShift(sampledDiffuseColor.rgb, uHueShift);
  diffuseColor *= sampledDiffuseColor;
#endif`,
        )
    }
    const prevKey = m.customProgramCacheKey?.bind(m)
    m.customProgramCacheKey = () => (prevKey ? prevKey() : "") + "|kkHue"
    m.needsUpdate = true
  }
  m.userData.kkHue.value = degrees
}
