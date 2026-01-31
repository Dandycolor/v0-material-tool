'use client'

import * as THREE from 'three'

export function createBevelMaterial(
  matcapTexture: THREE.Texture,
  matcapNormalMap: THREE.Texture | null,
  bevelSettings: {
    bevelEnabled: boolean
    bevelStrength: number
    bevelSmoothing: number
    bevelContrast: number
    bevelOffset: number
  }
): THREE.Material {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewDir;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      vViewDir = normalize(cameraPosition - vPosition);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform sampler2D matcapTexture;
    uniform sampler2D matcapNormalMap;
    uniform float bevelStrength;
    uniform float bevelSmoothing;
    uniform float bevelContrast;
    uniform float bevelOffset;
    uniform bool bevelEnabled;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewDir;

    // Matcap UV calculation
    vec2 matcapUV(vec3 normal, vec3 viewDir) {
      vec3 normalizedNormal = normalize(normal);
      vec3 r = reflect(-viewDir, normalizedNormal);
      
      float m = 2.0 * sqrt(
        r.x * r.x + 
        r.y * r.y + 
        (r.z + 1.0) * (r.z + 1.0)
      );
      
      return r.xy / m + 0.5;
    }

    // Bevel normal calculation
    vec3 getBevelNormal(vec3 normal, vec3 viewDir) {
      if (!bevelEnabled) return normal;

      // Create edge detection
      vec3 ddx = dFdx(normal);
      vec3 ddy = dFdy(normal);
      float edgeDetection = length(ddx) + length(ddy);
      
      // Smooth edge detection
      float edgeMask = smoothstep(0.0, bevelSmoothing, edgeDetection);
      
      // Create bevel effect by modifying normal
      vec3 worldNormal = normalize(normal);
      vec3 bevelDir = normalize(cross(worldNormal, viewDir));
      
      // Add offset to bevel
      vec3 bevelNormal = normalize(
        worldNormal + 
        bevelDir * (bevelOffset * 0.1) +
        viewDir * 0.05
      );
      
      // Blend between normal and bevel normal
      return normalize(mix(normal, bevelNormal, edgeMask * bevelStrength));
    }

    // Generate bevel highlights
    float getBevelHighlight(vec3 normal, vec3 viewDir) {
      if (!bevelEnabled) return 0.0;

      // Edge detection
      vec3 ddx = dFdx(normal);
      vec3 ddy = dFdy(normal);
      float edgeDetection = length(ddx) + length(ddy);
      
      // Create edge mask
      float edgeMask = smoothstep(0.0, bevelSmoothing * 0.5, edgeDetection);
      
      // Calculate highlight intensity
      float highlight = edgeMask * bevelStrength;
      
      // Apply contrast
      highlight = pow(highlight, 1.0 / bevelContrast);
      
      return highlight;
    }

    void main() {
      vec3 finalNormal = vNormal;
      
      // Apply bevel effect to normal
      finalNormal = getBevelNormal(finalNormal, vViewDir);
      
      // Apply matcap normal map if available
      if (matcapNormalMap != null) {
        vec3 normalMapTex = texture2D(matcapNormalMap, vUv).rgb;
        vec3 sampledNormal = normalize(normalMapTex * 2.0 - 1.0);
        finalNormal = normalize(finalNormal + sampledNormal * 0.5);
      }
      
      // Calculate matcap UV
      vec2 matcapCoord = matcapUV(finalNormal, vViewDir);
      
      // Sample matcap texture
      vec4 matcapColor = texture2D(matcapTexture, matcapCoord);
      
      // Get bevel highlight
      float bevelHighlight = getBevelHighlight(vNormal, vViewDir);
      
      // Apply bevel effect
      vec3 finalColor = matcapColor.rgb;
      if (bevelEnabled) {
        // Add highlight on top edges
        finalColor = mix(
          finalColor,
          finalColor + vec3(0.3),
          bevelHighlight * 0.5
        );
        
        // Add shadow on bottom edges
        float shadowMask = 1.0 - bevelHighlight;
        finalColor = mix(
          finalColor,
          finalColor * 0.7,
          shadowMask * bevelHighlight * 0.3
        );
      }
      
      gl_FragColor = vec4(finalColor, matcapColor.a);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms: {
      matcapTexture: { value: matcapTexture },
      matcapNormalMap: { value: matcapNormalMap },
      bevelStrength: { value: bevelSettings.bevelStrength },
      bevelSmoothing: { value: bevelSettings.bevelSmoothing },
      bevelContrast: { value: bevelSettings.bevelContrast },
      bevelOffset: { value: bevelSettings.bevelOffset },
      bevelEnabled: { value: bevelSettings.bevelEnabled },
    },
    vertexShader,
    fragmentShader,
  })

  return material
}
