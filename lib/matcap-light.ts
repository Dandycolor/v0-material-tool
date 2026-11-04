/* "Matcap light": a matcap has its lighting painted into the sphere image, so moving the light
   means rotating the normals we look the image up with. One shared rotation (and brightness)
   uniform is referenced by every matcap shader, so the Light panel moves the highlight on all of
   them at once, with no shader rebuilds.
   spin  — turns the painted light around the view axis (drag the sun)
   tiltX / tiltY — swings it up/down, left/right across the sphere */

import * as THREE from "three"

export interface MatcapLight {
  spin: number // radians, 0 = as painted, clockwise (same convention as the sun gizmo)
  tiltX: number // radians, -π/3…π/3
  tiltY: number // radians, -π/3…π/3
  gain: number // brightness 0…2
}

export const MATCAP_LIGHT_DEFAULT: MatcapLight = { spin: 0, tiltX: 0, tiltY: 0, gain: 1 }

export const matcapRotUniform = { value: new THREE.Matrix3() }
export const matcapGainUniform = { value: 1 }

const m4 = new THREE.Matrix4()
const e = new THREE.Euler()
export function setMatcapLight(l: MatcapLight) {
  // screen-clockwise spin = negative rotation about the view axis
  e.set(l.tiltX, l.tiltY, -l.spin, "ZXY")
  m4.makeRotationFromEuler(e)
  matcapRotUniform.value.setFromMatrix4(m4)
  matcapGainUniform.value = l.gain
}

/** GLSL: declare once, then `vec3 mn = kkMatcapN(normal);` */
export const MATCAP_LIGHT_GLSL = /* glsl */ `
uniform mat3 uMatcapRot;
uniform float uMatcapGain;
vec3 kkMatcapN(vec3 n) { return normalize(uMatcapRot * n); }
`
