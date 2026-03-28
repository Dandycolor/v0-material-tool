import * as THREE from "three"
import type { GradientConfig } from "@/lib/types"

export function createGradientMaterial(cfg: GradientConfig): THREE.ShaderMaterial {
  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vViewPosition = normalize(position - cameraPosition);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = /* glsl */ `
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    uniform float intensity;
    uniform float distortion;
    uniform int gradientType;
    uniform bool useThreeColors;
    uniform float angle;
    uniform float noise;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    float simpleNoise(vec3 p) {
      return sin(p.x * 12.9898 + p.y * 78.233 + p.z * 45.164) * 43758.5453;
    }

    vec3 rgb2hsl(vec3 c) {
      float maxc = max(max(c.r, c.g), c.b);
      float minc = min(min(c.r, c.g), c.b);
      float l = (maxc + minc) / 2.0;
      float h = 0.0; float s = 0.0;
      if (maxc != minc) {
        float d = maxc - minc;
        s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
        if (maxc == c.r) h = mod((c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0), 6.0) / 6.0;
        else if (maxc == c.g) h = ((c.b - c.r) / d + 2.0) / 6.0;
        else h = ((c.r - c.g) / d + 4.0) / 6.0;
      }
      return vec3(h, s, l);
    }

    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }

    vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
    vec3 toSRGB(vec3 c)   { return pow(c, vec3(1.0 / 2.2)); }

    void main() {
      float gradient = 0.0;

      if (gradientType == 0) {
        vec3 np = normalize(vPosition);
        gradient = length(np) * 0.5;
        gradient += sin(vNormal.x * 3.14159 + distortion * 5.0) * distortion * 0.4;
        gradient += cos(vNormal.y * 2.5   + distortion * 3.0) * distortion * 0.2;
      } else {
        float ca = cos(angle); float sa = sin(angle);
        float rx = vPosition.x * ca - vPosition.y * sa;
        float ry = vPosition.x * sa + vPosition.y * ca;
        gradient = (ry + 1.0) * 0.5;
        gradient += sin(vNormal.z * 3.14159 + distortion * 5.0) * distortion * 0.15;
        gradient += cos(vNormal.x * 2.5    + distortion * 3.0) * distortion * 0.1;
      }

      gradient = clamp(gradient, 0.0, 1.0);
      float t = gradient * gradient * (3.0 - 2.0 * gradient);

      vec3 col;
      if (useThreeColors) {
        col = t < 0.5
          ? mix(color1, color2, t * 2.0)
          : mix(color2, color3, (t - 0.5) * 2.0);
      } else {
        col = mix(color1, color2, t);
      }

      vec3 hsl = rgb2hsl(col);
      hsl.y = clamp(hsl.y * 1.3, 0.0, 1.0);
      hsl.z = clamp(hsl.z * 1.1, 0.0, 1.0);
      col = hsl2rgb(hsl);

      vec3 normal = normalize(vNormal);
      float fresnel = pow(1.0 - abs(dot(normal, vViewPosition)), 2.5);
      col += vec3(fresnel * distortion * 0.7);

      col = toSRGB(toLinear(col) * intensity);

      if (noise > 0.0) {
        float n1 = fract(simpleNoise(vPosition * 5.0))  - 0.5;
        float n2 = fract(simpleNoise(vPosition * 10.0 + vec3(5.0)))  - 0.5;
        float n3 = fract(simpleNoise(vPosition * 20.0 + vec3(10.0))) - 0.5;
        col += vec3(n1 * 0.5 + n2 * 0.3 + n3 * 0.2) * noise * 0.15;
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `

  const c1 = new THREE.Color(cfg.color1)
  const c2 = new THREE.Color(cfg.color2)
  const c3 = new THREE.Color(cfg.color3 || cfg.color1)

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      color1:         { value: c1 },
      color2:         { value: c2 },
      color3:         { value: c3 },
      intensity:      { value: cfg.intensity },
      distortion:     { value: cfg.distortion },
      gradientType:   { value: cfg.type === "radial" ? 0 : 1 },
      useThreeColors: { value: cfg.use3Colors },
      angle:          { value: cfg.angle ?? 0 },
      noise:          { value: cfg.noise ?? 0 },
    },
    side: THREE.FrontSide,
  })
}
