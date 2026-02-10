"use client"

import { Canvas, useLoader, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, TransformControls } from "@react-three/drei"
import * as THREE from "three"
import { SVGLoader } from "three/addons/loaders/SVGLoader.js"
import { Suspense, useMemo, useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils"
import { ModelMesh } from "./model-mesh"
import { createGradientMaterial } from "./gradient-shader"

// Grid component with fade effect at edges
function GridHelper({ visible = true }: { visible?: boolean }) {
  const { scene } = useThree()
  const gridRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    if (!visible) {
      if (gridRef.current) {
        scene.remove(gridRef.current)
      }
      return
    }

    const group = new THREE.Group()
    const size = 10
    const divisions = 20
    const step = size / divisions
    const gridY = -0.5 // Position grid just below objects so they appear to rest on it
    
    // Create lines with gradient opacity
    const linesMaterial = new THREE.LineBasicMaterial({ 
      color: 0x444444,
      transparent: true,
      depthWrite: false
    })
    
    // Vertical and horizontal lines
    for (let i = -divisions; i <= divisions; i++) {
      const pos = i * step
      
      // Horizontal lines (along X axis)
      const hGeom = new THREE.BufferGeometry()
      hGeom.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([
          -size, gridY, pos,
          size, gridY, pos
        ]), 3
      ))
      
      // Create gradient opacity based on distance from center
      const hOpacity = new Float32Array(2)
      hOpacity[0] = Math.max(0, 1 - Math.abs(i) / divisions)
      hOpacity[1] = hOpacity[0]
      hGeom.setAttribute('opacityAttr', new THREE.BufferAttribute(hOpacity, 1))
      
      const hLines = new THREE.Line(hGeom, linesMaterial)
      group.add(hLines)
      
      // Vertical lines (along Z axis)
      const vGeom = new THREE.BufferGeometry()
      vGeom.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([
          pos, gridY, -size,
          pos, gridY, size
        ]), 3
      ))
      
      const vOpacity = new Float32Array(2)
      vOpacity[0] = Math.max(0, 1 - Math.abs(i) / divisions)
      vOpacity[1] = vOpacity[0]
      vGeom.setAttribute('opacityAttr', new THREE.BufferAttribute(vOpacity, 1))
      
      const vLines = new THREE.Line(vGeom, linesMaterial)
      group.add(vLines)
    }
    
    gridRef.current = group
    scene.add(group)

    return () => {
      if (gridRef.current) {
        scene.remove(gridRef.current)
        gridRef.current = null
      }
    }
  }, [visible, scene])

  return null
}

// Helper component to render different primitive geometries
function PrimitiveGeometry({ primitiveType }: { primitiveType: string }) {
  const segments = 256
  
  switch (primitiveType) {
    case "cone":
      return <coneGeometry args={[1, 2, segments]} />
    case "torus":
      return <torusGeometry args={[0.7, 0.3, segments, segments]} />
    case "torusKnot":
      return <torusKnotGeometry args={[0.6, 0.2, 128, 32]} />
    case "capsule":
      return <cylinderGeometry args={[0.6, 0.6, 1.5, segments, segments]} />
    case "sphere":
    default:
      return <sphereGeometry args={[1, segments, segments]} />
  }
}

// Custom Matcap Material with Normal Map and Rim Light support
function MatcapMaterialWithEffects({
  matcap,
  normalMap,
  normalIntensity = 1,
  rimIntensity = 0,
  rimPower = 3,
  rimColor = "#ffffff",
}: {
  matcap: THREE.Texture | null
  normalMap: THREE.Texture | null
  normalIntensity?: number
  rimIntensity?: number
  rimPower?: number
  rimColor?: string
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      matcap: { value: matcap },
      normalMap: { value: normalMap },
      normalIntensity: { value: normalIntensity },
      rimIntensity: { value: rimIntensity },
      rimPower: { value: rimPower },
      rimColor: { value: new THREE.Color(rimColor) },
      hasNormalMap: { value: !!normalMap },
    }),
    []
  )

  // Update uniforms when values change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.matcap.value = matcap
      materialRef.current.uniforms.normalMap.value = normalMap
      materialRef.current.uniforms.normalIntensity.value = normalIntensity
      materialRef.current.uniforms.rimIntensity.value = rimIntensity
      materialRef.current.uniforms.rimPower.value = rimPower
      materialRef.current.uniforms.rimColor.value = new THREE.Color(rimColor)
      materialRef.current.uniforms.hasNormalMap.value = !!normalMap
      materialRef.current.needsUpdate = true
    }
  }, [matcap, normalMap, normalIntensity, rimIntensity, rimPower, rimColor])

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    uniform sampler2D matcap;
    uniform sampler2D normalMap;
    uniform float normalIntensity;
    uniform float rimIntensity;
    uniform float rimPower;
    uniform vec3 rimColor;
    uniform bool hasNormalMap;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    vec3 perturbNormal2Arb(vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection) {
      vec3 q0 = dFdx(eye_pos.xyz);
      vec3 q1 = dFdy(eye_pos.xyz);
      vec2 st0 = dFdx(vUv.st);
      vec2 st1 = dFdy(vUv.st);

      vec3 N = surf_norm;
      vec3 q1perp = cross(q1, N);
      vec3 q0perp = cross(N, q0);

      vec3 T = q1perp * st0.x + q0perp * st1.x;
      vec3 B = q1perp * st0.y + q0perp * st1.y;

      float det = max(dot(T, T), dot(B, B));
      float scale = (det == 0.0) ? 0.0 : faceDirection * inversesqrt(det);

      return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
    }

    void main() {
      vec3 normal = normalize(vNormal);

      // Apply normal map if available
      if (hasNormalMap && normalIntensity > 0.0) {
        vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        mapN.xy *= normalIntensity;
        float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection);
      }

      // Calculate matcap UV from perturbed normal
      vec3 viewDir = normalize(vViewPosition);
      vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
      vec3 y = cross(viewDir, x);
      vec2 matcapUv = vec2(dot(x, normal), dot(y, normal)) * 0.495 + 0.5;

      vec4 matcapColor = texture2D(matcap, matcapUv);

      // Apply rim lighting with color
      float rim = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
      rim = pow(rim, rimPower);
      vec3 rimLight = rimColor * rimIntensity * rim;

      gl_FragColor = vec4(matcapColor.rgb + rimLight, matcapColor.a);
    }
  `

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      extensions={{ derivatives: true }}
    />
  )
}

interface GeometrySettings {
  type: "sphere" | "extruded" | "model"
  primitiveType?: "sphere" | "cone" | "torus" | "torusKnot" | "capsule"
  svgPath: string
  thickness: number
  bevelSize: number
  bevelSegments: number
  bevelQuality: number
  textureScale: number
  modelUrl: string | null
  modelName: string | null
  inflationAmount: number
  inflateSphereEnabled: boolean
  inflateSpherePosition: [number, number, number]
  inflateSphereRadius: number
  flatBase?: boolean
  deformEnabled?: boolean
}

export interface MaterialSettings {
  colorMap: string | null
  normalMap: string | null
  roughnessMap: string | null
  metalnessMap: string | null
  displacementMap: string | null
  normalScale: number
  roughness: number
  metalness: number
  displacementScale: number
  colorTint: string
  hueShift: number
  useHueShift: boolean
  transmission: number
  ior: number
  thickness: number
  attenuationDistance: number
  attenuationColor: string
  opacityMap: string | null
  useOpacityMap: boolean
  clearcoat: number
  clearcoatRoughness: number
  clearcoatNormalScale: number
  glassColor: string
  glassColorIntensity: number
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessMin: number
  iridescenceThicknessMax: number
  reflectivity: number
  envMapIntensity: number
  normalRepeat: number
  textureScale: number
}

interface LightingSettings {
  envMap: string
  envIntensity: number
  envRotation: number
  directionalIntensity: number
  ambientIntensity: number
  exposure: number
}

interface PBRViewerProps {
  geometrySettings: GeometrySettings
  materialSettings: MaterialSettings
  lightingSettings: LightingSettings
  renderMode?: "pbr" | "matcap"
  matcapTexture?: string
  matcapHueShift?: number
  showGrid?: boolean
  showRotateControls?: boolean
  onModelLoadError?: (error: string) => void
  onGeometrySettingsChange?: (settings: Partial<GeometrySettings>) => void
}

function parseSVGContent(svgContent: string): THREE.Shape[] {
  try {
    // Preprocess SVG for better compatibility with Iconify icons
    let processedSVG = svgContent

    // Replace currentColor with black for proper parsing
    processedSVG = processedSVG.replace(/currentColor/gi, "#000000")

    // Replace none fill with black (some icons use none for strokes)
    processedSVG = processedSVG.replace(/fill\s*=\s*["']none["']/gi, 'fill="#000000"')

    // Ensure SVG has proper namespace
    if (!processedSVG.includes("xmlns")) {
      processedSVG = processedSVG.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
    }

    // Remove any style tags that might interfere
    processedSVG = processedSVG.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")

    // Remove clip-path references that can cause issues
    processedSVG = processedSVG.replace(/clip-path\s*=\s*["'][^"']*["']/gi, "")

    // Remove mask references
    processedSVG = processedSVG.replace(/mask\s*=\s*["'][^"']*["']/gi, "")

    const loader = new SVGLoader()
    const svgData = loader.parse(processedSVG)

    const allShapes: THREE.Shape[] = []

    for (const path of svgData.paths) {
      try {
        const shapes = SVGLoader.createShapes(path)
        for (const shape of shapes) {
          // Validate shape has enough points
          try {
            const points = shape.getPoints(12) // Use more divisions for curves
            if (points && points.length >= 3) {
              // Check shape isn't degenerate (all points same)
              let hasVariation = false
              const firstPoint = points[0]
              for (let i = 1; i < points.length; i++) {
                if (Math.abs(points[i].x - firstPoint.x) > 0.01 || Math.abs(points[i].y - firstPoint.y) > 0.01) {
                  hasVariation = true
                  break
                }
              }
              if (hasVariation) {
                allShapes.push(shape)
              }
            }
          } catch (e) {
            // Skip invalid shapes silently
          }
        }
      } catch (e) {
        console.warn("[v0] Error creating shapes from path:", e)
      }
    }

    console.log("[v0] SVGLoader parsed", allShapes.length, "valid shapes")

    // If we have multiple shapes, try to detect holes
    if (allShapes.length > 1) {
      return processShapesWithHoles(allShapes)
    }

    return allShapes
  } catch (error) {
    console.error("[v0] SVGLoader error, falling back to manual parser:", error)
    // Try fallback to manual parser
    return parseSVGString(svgContent)
  }
}

function fallbackParseSVG(svgContent: string): THREE.Shape[] {
  console.log("[v0] Using fallback SVG parser")
  const shapes: THREE.Shape[] = []

  try {
    // Extract all path d attributes
    const pathMatches = svgContent.matchAll(/d="([^"]+)"/g)
    for (const match of pathMatches) {
      const d = match[1]
      if (d) {
        const pathShapes = parseSVGPath(d)
        shapes.push(...pathShapes)
      }
    }

    // Also try to extract rect, circle, ellipse
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, "image/svg+xml")
    const svgElement = doc.querySelector("svg")

    if (svgElement) {
      // Handle circles
      svgElement.querySelectorAll("circle").forEach((circle) => {
        const cx = Number.parseFloat(circle.getAttribute("cx") || "0")
        const cy = Number.parseFloat(circle.getAttribute("cy") || "0")
        const r = Number.parseFloat(circle.getAttribute("r") || "0")
        if (r > 0) {
          const shape = new THREE.Shape()
          shape.absarc(cx, cy, r, 0, Math.PI * 2, false)
          shapes.push(shape)
        }
      })

      // Handle rects
      svgElement.querySelectorAll("rect").forEach((rect) => {
        const x = Number.parseFloat(rect.getAttribute("x") || "0")
        const y = Number.parseFloat(rect.getAttribute("y") || "0")
        const width = Number.parseFloat(rect.getAttribute("width") || "0")
        const height = Number.parseFloat(rect.getAttribute("height") || "0")
        if (width > 0 && height > 0) {
          const shape = new THREE.Shape()
          shape.moveTo(x, y)
          shape.lineTo(x + width, y)
          shape.lineTo(x + width, y + height)
          shape.lineTo(x, y + height)
          shape.closePath()
          shapes.push(shape)
        }
      })
    }

    console.log("[v0] Fallback parser found", shapes.length, "shapes")
  } catch (e) {
    console.error("[v0] Fallback parser error:", e)
  }

  return shapes
}

function parseSVGPath(d: string): THREE.Shape[] {
  const shapes: THREE.Shape[] = []
  let currentShape: THREE.Shape | null = null
  let currentPath: THREE.Path | null = null
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  let lastControlX = 0
  let lastControlY = 0
  let lastCommand = ""

  // Tokenize the path
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []

  for (const cmd of commands) {
    const type = cmd[0]
    const args = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number.parseFloat)
      .filter((n) => !isNaN(n))

    const isRelative = type === type.toLowerCase()
    const cmdUpper = type.toUpperCase()

    let i = 0
    while (i <= args.length) {
      switch (cmdUpper) {
        case "M": {
          // MoveTo
          if (i + 1 < args.length) {
            const x = isRelative ? currentX + args[i] : args[i]
            const y = isRelative ? currentY + args[i + 1] : args[i + 1]

            if (currentShape && currentPath) {
              // Check if current path has points before adding
              shapes.push(currentShape)
            }
            currentShape = new THREE.Shape()
            currentPath = currentShape
            currentShape.moveTo(x, y)

            currentX = x
            currentY = y
            startX = x
            startY = y
            i += 2
          } else {
            i = args.length + 1
          }
          break
        }

        case "L": {
          // LineTo
          if (i + 1 < args.length && currentPath) {
            const x = isRelative ? currentX + args[i] : args[i]
            const y = isRelative ? currentY + args[i + 1] : args[i + 1]
            currentPath.lineTo(x, y)
            currentX = x
            currentY = y
            i += 2
          } else {
            i = args.length + 1
          }
          break
        }

        case "H": {
          // Horizontal LineTo
          if (i < args.length && currentPath) {
            const x = isRelative ? currentX + args[i] : args[i]
            currentPath.lineTo(x, currentY)
            currentX = x
            i += 1
          } else {
            i = args.length + 1
          }
          break
        }

        case "V": {
          // Vertical LineTo
          if (i < args.length && currentPath) {
            const y = isRelative ? currentY + args[i] : args[i]
            currentPath.lineTo(currentX, y)
            currentY = y
            i += 1
          } else {
            i = args.length + 1
          }
          break
        }

        case "C": {
          // Cubic Bezier
          if (i + 5 < args.length && currentPath) {
            const x1 = isRelative ? currentX + args[i] : args[i]
            const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
            const x2 = isRelative ? currentX + args[i + 2] : args[i + 2]
            const y2 = isRelative ? currentY + args[i + 3] : args[i + 3]
            const x = isRelative ? currentX + args[i + 4] : args[i + 4]
            const y = isRelative ? currentY + args[i + 5] : args[i + 5]
            currentPath.bezierCurveTo(x1, y1, x2, y2, x, y)
            lastControlX = x2
            lastControlY = y2
            currentX = x
            currentY = y
            i += 6
          } else {
            i = args.length + 1
          }
          break
        }

        case "S": {
          // Smooth Cubic Bezier
          if (i + 3 < args.length && currentPath) {
            // Reflect the previous control point
            let x1 = currentX
            let y1 = currentY
            if (lastCommand === "C" || lastCommand === "S" || lastCommand === "c" || lastCommand === "s") {
              x1 = 2 * currentX - lastControlX
              y1 = 2 * currentY - lastControlY
            }
            const x2 = isRelative ? currentX + args[i] : args[i]
            const y2 = isRelative ? currentY + args[i + 1] : args[i + 1]
            const x = isRelative ? currentX + args[i + 2] : args[i + 2]
            const y = isRelative ? currentY + args[i + 3] : args[i + 3]
            currentPath.bezierCurveTo(x1, y1, x2, y2, x, y)
            lastControlX = x2
            lastControlY = y2
            currentX = x
            currentY = y
            i += 4
          } else {
            i = args.length + 1
          }
          break
        }

        case "Q": {
          // Quadratic Bezier
          if (i + 3 < args.length && currentPath) {
            const x1 = isRelative ? currentX + args[i] : args[i]
            const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
            const x = isRelative ? currentX + args[i + 2] : args[i + 2]
            const y = isRelative ? currentY + args[i + 3] : args[i + 3]
            currentPath.quadraticCurveTo(x1, y1, x, y)
            lastControlX = x1
            lastControlY = y1
            currentX = x
            currentY = y
            i += 4
          } else {
            i = args.length + 1
          }
          break
        }

        case "T": {
          // Smooth Quadratic Bezier
          if (i + 1 < args.length && currentPath) {
            let x1 = currentX
            let y1 = currentY
            if (lastCommand === "Q" || lastCommand === "T" || lastCommand === "q" || lastCommand === "t") {
              x1 = 2 * currentX - lastControlX
              y1 = 2 * currentY - lastControlY
            }
            const x = isRelative ? currentX + args[i] : args[i]
            const y = isRelative ? currentY + args[i + 1] : args[i + 1]
            currentPath.quadraticCurveTo(x1, y1, x, y)
            lastControlX = x1
            lastControlY = y1
            currentX = x
            currentY = y
            i += 2
          } else {
            i = args.length + 1
          }
          break
        }

        case "A": {
          // Arc - convert to bezier curves
          if (i + 6 < args.length && currentPath) {
            const rx = Math.abs(args[i])
            const ry = Math.abs(args[i + 1])
            const xAxisRotation = (args[i + 2] * Math.PI) / 180
            const largeArcFlag = args[i + 3] !== 0
            const sweepFlag = args[i + 4] !== 0
            const x = isRelative ? currentX + args[i + 5] : args[i + 5]
            const y = isRelative ? currentY + args[i + 6] : args[i + 6]

            // Simplified arc to line for complex cases
            if (rx === 0 || ry === 0) {
              currentPath.lineTo(x, y)
            } else {
              // Use ellipse approximation with bezier curves
              arcToBezier(currentPath, currentX, currentY, x, y, rx, ry, xAxisRotation, largeArcFlag, sweepFlag)
            }

            currentX = x
            currentY = y
            i += 7
          } else {
            i = args.length + 1
          }
          break
        }

        case "Z": {
          // ClosePath
          if (currentPath) {
            currentPath.closePath()
          }
          currentX = startX
          currentY = startY
          i = args.length + 1
          break
        }

        default:
          i = args.length + 1
          break
      }
    }

    lastCommand = type
  }

  // Add the last shape
  if (currentShape) {
    shapes.push(currentShape)
  }

  return shapes.filter((shape) => {
    // Filter out empty shapes
    const points = shape.getPoints()
    return points.length > 2
  })
}

function arcToBezier(
  path: THREE.Path,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
) {
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)

  const x1p = (cosPhi * (x1 - x2)) / 2 + (sinPhi * (y1 - y2)) / 2
  const y1p = (-sinPhi * (x1 - x2)) / 2 + (cosPhi * (y1 - y2)) / 2

  let rxSq = rx * rx
  let rySq = ry * ry
  const x1pSq = x1p * x1p
  const y1pSq = y1p * y1p

  // Correct radii
  const lambda = x1pSq / rxSq + y1pSq / rySq
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda)
    rx *= sqrtLambda
    ry *= sqrtLambda
    rxSq = rx * rx
    rySq = ry * ry
  }

  const sign = largeArc !== sweep ? 1 : -1
  const sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq))
  const coef = sign * Math.sqrt(sq)

  const cxp = coef * ((rx * y1p) / ry)
  const cyp = coef * ((-ry * x1p) / rx)

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2

  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
  let dtheta = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1

  if (sweep && dtheta < 0) {
    dtheta += 2 * Math.PI
  } else if (!sweep && dtheta > 0) {
    dtheta -= 2 * Math.PI
  }

  // Draw arc using line segments (simplified but effective)
  const segments = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 4)))
  const delta = dtheta / segments

  for (let i = 1; i <= segments; i++) {
    const angle = theta1 + delta * i
    const px = cx + rx * Math.cos(angle) * cosPhi - ry * Math.sin(angle) * sinPhi
    const py = cy + rx * Math.cos(angle) * sinPhi + ry * Math.sin(angle) * cosPhi
    path.lineTo(px, py)
  }
}

function parseSVGString(svgString: string): THREE.Shape[] {
  const parser = new DOMParser()

  // Try HTML parser first (more forgiving)
  const htmlDoc = parser.parseFromString(svgString, "text/html")
  let svgElement = htmlDoc.querySelector("svg")

  if (svgElement) {
    return parseSVGFromElement(svgElement)
  }

  // Fallback: try wrapping in HTML if SVG element not found directly
  const wrappedDoc = parser.parseFromString(`<html><body>${svgString}</body></html>`, "text/html")
  svgElement = wrappedDoc.querySelector("svg")

  if (svgElement) {
    return parseSVGFromElement(svgElement)
  }

  console.error("[v0] No SVG element found in document")
  return []
}

function parseSVGFromElement(svgElement: Element): THREE.Shape[] {
  const allShapes: THREE.Shape[] = []

  // Get viewBox for coordinate normalization
  const viewBox = svgElement.getAttribute("viewBox")
  let viewBoxX = 0,
    viewBoxY = 0,
    viewBoxW = 24,
    viewBoxH = 24
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length >= 4) {
      viewBoxX = parts[0]
      viewBoxY = parts[1]
      viewBoxW = parts[2]
      viewBoxH = parts[3]
    }
  }

  // Recursively collect all path-like elements, applying transforms
  function collectPaths(element: Element, parentTransform: DOMMatrix | null = null): void {
    // Get current element's transform
    let currentTransform = parentTransform ? new DOMMatrix(parentTransform.toString()) : new DOMMatrix()
    const transformAttr = element.getAttribute("transform")
    if (transformAttr) {
      const localMatrix = parseTransform(transformAttr)
      currentTransform = currentTransform.multiply(localMatrix)
    }

    // Process path elements
    if (element.tagName.toLowerCase() === "path") {
      const d = element.getAttribute("d")
      if (d) {
        const shapes = parseSVGPath(d)
        shapes.forEach((shape) => {
          if (!currentTransform.isIdentity) {
            applyTransformToShape(shape, currentTransform)
          }
          allShapes.push(shape)
        })
      }
    }

    // Process circle elements
    if (element.tagName.toLowerCase() === "circle") {
      const cx = Number.parseFloat(element.getAttribute("cx") || "0")
      const cy = Number.parseFloat(element.getAttribute("cy") || "0")
      const r = Number.parseFloat(element.getAttribute("r") || "0")
      if (r > 0) {
        const shape = new THREE.Shape()
        shape.absarc(cx, cy, r, 0, Math.PI * 2, false)
        if (!currentTransform.isIdentity) {
          applyTransformToShape(shape, currentTransform)
        }
        allShapes.push(shape)
      }
    }

    // Process ellipse elements
    if (element.tagName.toLowerCase() === "ellipse") {
      const cx = Number.parseFloat(element.getAttribute("cx") || "0")
      const cy = Number.parseFloat(element.getAttribute("cy") || "0")
      const rx = Number.parseFloat(element.getAttribute("rx") || "0")
      const ry = Number.parseFloat(element.getAttribute("ry") || rx.toString())
      if (rx > 0 && ry > 0) {
        const shape = new THREE.Shape()
        shape.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0)
        if (!currentTransform.isIdentity) {
          applyTransformToShape(shape, currentTransform)
        }
        allShapes.push(shape)
      }
    }

    // Process rect elements
    if (element.tagName.toLowerCase() === "rect") {
      const x = Number.parseFloat(element.getAttribute("x") || "0")
      const y = Number.parseFloat(element.getAttribute("y") || "0")
      const width = Number.parseFloat(element.getAttribute("width") || "0")
      const height = Number.parseFloat(element.getAttribute("height") || "0")
      const rx = Number.parseFloat(element.getAttribute("rx") || "0")
      const ry = Number.parseFloat(element.getAttribute("ry") || rx.toString())
      if (width > 0 && height > 0) {
        const shape = new THREE.Shape()
        if (rx > 0 || ry > 0) {
          const r = Math.min(rx, ry, width / 2, height / 2)
          shape.moveTo(x + r, y)
          shape.lineTo(x + width - r, y)
          shape.quadraticCurveTo(x + width, y, x + width, y + r)
          shape.lineTo(x + width, y + height - r)
          shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
          shape.lineTo(x + r, y + height)
          shape.quadraticCurveTo(x, y + height, x, y + height - r)
          shape.lineTo(x, y + r)
          shape.quadraticCurveTo(x, y, x + r, y)
        } else {
          shape.moveTo(x, y)
          shape.lineTo(x + width, y)
          shape.lineTo(x + width, y + height)
          shape.lineTo(x, y + height)
          shape.closePath()
        }
        if (!currentTransform.isIdentity) {
          applyTransformToShape(shape, currentTransform)
        }
        allShapes.push(shape)
      }
    }

    // Process polygon elements
    if (element.tagName.toLowerCase() === "polygon") {
      const points = element.getAttribute("points")
      if (points) {
        const coords = points
          .trim()
          .split(/[\s,]+/)
          .map(Number.parseFloat)
        if (coords.length >= 4) {
          const shape = new THREE.Shape()
          shape.moveTo(coords[0], coords[1])
          for (let i = 2; i < coords.length; i += 2) {
            shape.lineTo(coords[i], coords[i + 1])
          }
          shape.closePath()
          if (!currentTransform.isIdentity) {
            applyTransformToShape(shape, currentTransform)
          }
          allShapes.push(shape)
        }
      }
    }

    // Process polyline elements
    if (element.tagName.toLowerCase() === "polyline") {
      const points = element.getAttribute("points")
      if (points) {
        const coords = points
          .trim()
          .split(/[\s,]+/)
          .map(Number.parseFloat)
        if (coords.length >= 4) {
          const shape = new THREE.Shape()
          shape.moveTo(coords[0], coords[1])
          for (let i = 2; i < coords.length; i += 2) {
            shape.lineTo(coords[i], coords[i + 1])
          }
          if (!currentTransform.isIdentity) {
            applyTransformToShape(shape, currentTransform)
          }
          allShapes.push(shape)
        }
      }
    }

    // Process line elements (convert to thin rect or path)
    if (element.tagName.toLowerCase() === "line") {
      const x1 = Number.parseFloat(element.getAttribute("x1") || "0")
      const y1 = Number.parseFloat(element.getAttribute("y1") || "0")
      const x2 = Number.parseFloat(element.getAttribute("x2") || "0")
      const y2 = Number.parseFloat(element.getAttribute("y2") || "0")
      const strokeWidth = Number.parseFloat(element.getAttribute("stroke-width") || "1")

      // Create a thin rectangle along the line
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        const nx = ((-dy / len) * strokeWidth) / 2
        const ny = ((dx / len) * strokeWidth) / 2

        const shape = new THREE.Shape()
        shape.moveTo(x1 + nx, y1 + ny)
        shape.lineTo(x2 + nx, y2 + ny)
        shape.lineTo(x2 - nx, y2 - ny)
        shape.lineTo(x1 - nx, y1 - ny)
        shape.closePath()
        if (!currentTransform.isIdentity) {
          applyTransformToShape(shape, currentTransform)
        }
        allShapes.push(shape)
      }
    }

    // Recurse into child elements (g, svg, symbol, etc.)
    for (const child of Array.from(element.children)) {
      collectPaths(child, currentTransform)
    }
  }

  // Start recursive collection
  collectPaths(svgElement)

  console.log("[v0] Parsed", allShapes.length, "shapes from SVG")

  if (allShapes.length > 1) {
    return processShapesWithHoles(allShapes)
  }

  return allShapes.filter((shape) => {
    try {
      const points = shape.getPoints()
      return points.length > 2
    } catch {
      return false
    }
  })
}

function parseTransform(transformStr: string): DOMMatrix {
  const matrix = new DOMMatrix()

  const transforms = transformStr.match(/\w+$$[^)]+$$/g) || []

  for (const transform of transforms) {
    const match = transform.match(/(\w+)$$([^)]+)$$/)
    if (!match) continue

    const type = match[1]
    const values = match[2].split(/[\s,]+/).map(Number)

    switch (type) {
      case "translate":
        matrix.translateSelf(values[0] || 0, values[1] || 0)
        break
      case "scale":
        matrix.scaleSelf(values[0] || 1, values[1] ?? values[0] ?? 1)
        break
      case "rotate":
        if (values.length === 3) {
          matrix.translateSelf(values[1], values[2])
          matrix.rotateSelf(values[0])
          matrix.translateSelf(-values[1], -values[2])
        } else {
          matrix.rotateSelf(values[0] || 0)
        }
        break
      case "skewX":
        matrix.skewXSelf(values[0] || 0)
        break
      case "skewY":
        matrix.skewYSelf(values[0] || 0)
        break
      case "matrix":
        if (values.length >= 6) {
          const m = new DOMMatrix([values[0], values[1], values[2], values[3], values[4], values[5]])
          matrix.multiplySelf(m)
        }
        break
    }
  }

  return matrix
}

function applyTransformToShape(shape: THREE.Shape, matrix: DOMMatrix): void {
  // Transform the main curve points
  const curves = shape.curves
  for (const curve of curves) {
    if ("v0" in curve && "v1" in curve) {
      // LineCurve
      const lc = curve as THREE.LineCurve
      transformPoint(lc.v1, matrix)
      transformPoint(lc.v2, matrix)
    } else if ("v0" in curve && "v1" in curve && "v2" in curve) {
      // QuadraticBezierCurve
      const qc = curve as THREE.QuadraticBezierCurve
      transformPoint(qc.v0, matrix)
      transformPoint(qc.v1, matrix)
      transformPoint(qc.v2, matrix)
    } else if ("v0" in curve && "v1" in curve && "v2" in curve && "v3" in curve) {
      // CubicBezierCurve
      const cc = curve as THREE.CubicBezierCurve
      transformPoint(cc.v0, matrix)
      transformPoint(cc.v1, matrix)
      transformPoint(cc.v2, matrix)
      transformPoint(cc.v3, matrix)
    }
  }

  // Also transform currentPoint
  if (shape.currentPoint) {
    transformPoint(shape.currentPoint, matrix)
  }
}

function transformPoint(point: THREE.Vector2, matrix: DOMMatrix): void {
  const x = point.x * matrix.a + point.y * matrix.c + matrix.e
  const y = point.x * matrix.b + point.y * matrix.d + matrix.f
  point.x = x
  point.y = y
}

function processShapesWithHoles(shapes: THREE.Shape[]): THREE.Shape[] {
  // Calculate bounding box and area for each shape
  const shapeData = shapes
    .map((shape, index) => {
      try {
        const points = shape.getPoints(12)
        if (!points || points.length < 3) return null

        let minX = Number.POSITIVE_INFINITY,
          minY = Number.POSITIVE_INFINITY,
          maxX = Number.NEGATIVE_INFINITY,
          maxY = Number.NEGATIVE_INFINITY
        let area = 0

        for (let i = 0; i < points.length; i++) {
          const p = points[i]
          if (!p) continue
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)

          // Calculate signed area using shoelace formula
          const j = (i + 1) % points.length
          if (points[j]) {
            area += points[i].x * points[j].y
            area -= points[j].x * points[i].y
          }
        }
        area = Math.abs(area / 2)

        // Skip shapes with invalid bounds
        if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
          return null
        }

        return {
          shape,
          index,
          bounds: { minX, minY, maxX, maxY },
          area,
          points,
        }
      } catch (e) {
        return null
      }
    })
    .filter(Boolean) as Array<{
    shape: THREE.Shape
    index: number
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    area: number
    points: THREE.Vector2[]
  }>

  // Sort by area descending (largest first)
  shapeData.sort((a, b) => b.area - a.area)

  const usedAsHole = new Set<number>()
  const resultShapes: THREE.Shape[] = []

  for (let i = 0; i < shapeData.length; i++) {
    const outer = shapeData[i]
    if (usedAsHole.has(outer.index)) continue

    const newShape = outer.shape.clone()

    // Check if any smaller shapes are inside this one
    for (let j = i + 1; j < shapeData.length; j++) {
      const inner = shapeData[j]
      if (usedAsHole.has(inner.index)) continue

      // Check if inner is completely inside outer bounds with margin
      const margin = 0.1
      if (
        inner.bounds.minX >= outer.bounds.minX - margin &&
        inner.bounds.maxX <= outer.bounds.maxX + margin &&
        inner.bounds.minY >= outer.bounds.minY - margin &&
        inner.bounds.maxY <= outer.bounds.maxY + margin
      ) {
        // Check if center point of inner is inside outer shape
        const centerX = (inner.bounds.minX + inner.bounds.maxX) / 2
        const centerY = (inner.bounds.minY + inner.bounds.maxY) / 2

        if (isPointInShape(centerX, centerY, outer.points)) {
          // Create hole from inner shape
          try {
            const holePath = new THREE.Path()
            const innerPoints = inner.points

            if (innerPoints && innerPoints.length > 2) {
              holePath.moveTo(innerPoints[0].x, innerPoints[0].y)
              for (let k = 1; k < innerPoints.length; k++) {
                if (innerPoints[k]) {
                  holePath.lineTo(innerPoints[k].x, innerPoints[k].y)
                }
              }
              holePath.closePath()

              newShape.holes.push(holePath)
              usedAsHole.add(inner.index)
              console.log("[v0] Added hole to shape")
            }
          } catch (e) {
            console.warn("[v0] Failed to create hole:", e)
          }
        }
      }
    }

    resultShapes.push(newShape)
  }

  console.log("[v0] Processed shapes with holes:", resultShapes.length, "shapes")
  return resultShapes
}

function isPointInShape(x: number, y: number, points: THREE.Vector2[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y
    const xj = points[j].x,
      yj = points[j].y

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function createLatheGeometry(
  svgString: string,
  segments: number,
  axis: 'center' | 'left' | 'right' | 'top' | 'bottom' = 'center',
): THREE.BufferGeometry | null {
  if (!svgString) return null

  try {
    const shapes = parseSVGContent(svgString)
    if (shapes.length === 0) {
      console.warn("[v0] No valid shapes found in SVG for lathe")
      return null
    }

    const shape = shapes[0]
    const allPoints = shape.getPoints(40)

    if (allPoints.length < 2) {
      console.warn("[v0] Not enough points for lathe geometry")
      return null
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    
    allPoints.forEach(p => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    })
    
    // Calculate rotation axis position based on user selection
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const width = maxX - minX
    const height = maxY - minY
    
    // Use larger offset to ensure clean geometry
    const offset = 0.01
    
    let axisX: number
    switch (axis) {
      case 'right':
        axisX = maxX + width * offset
        break
      case 'bottom':
        axisX = maxY + height * offset
        break
      case 'center':
      default:
        axisX = centerX
        break
    }
    
    const lathePoints: THREE.Vector2[] = allPoints.map(p => {
      let radius: number
      let height: number
      
      if (axis === 'bottom') {
        // For bottom, use Y as radius axis
        radius = Math.abs(p.y - axisX)
        height = p.x - centerX
      } else {
        // For right/center, use X as radius axis
        radius = Math.abs(p.x - axisX)
        height = -(p.y - centerY)
      }
      
      // Ensure minimum radius to avoid degenerate triangles
      radius = Math.max(radius, 0.01)
      
      return new THREE.Vector2(radius, height)
    })

    // Create lathe geometry with exact segments (no extra segment needed)
    const geometry = new THREE.LatheGeometry(lathePoints, segments, 0, Math.PI * 2)

    // For top/bottom axes, rotate geometry 90 degrees since LatheGeometry always rotates around Y-axis
    if (axis === 'bottom') {
      geometry.rotateZ(Math.PI / 2)
    }

    geometry.center()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return null

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

    if (maxDim > 0) {
      const scale = 2 / maxDim
      geometry.scale(scale, scale, scale)
    }

    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!
    const heightRange = Math.max(bbox.max.y - bbox.min.y, 0.001)
    
    const positionArray = geometry.attributes.position.array as Float32Array
    const uvCount = positionArray.length / 3
    const newUVs = new Float32Array(uvCount * 2)
    
    for (let i = 0; i < uvCount; i++) {
      const x = positionArray[i * 3]
      const y = positionArray[i * 3 + 1]
      const z = positionArray[i * 3 + 2]
      
      const angle = Math.atan2(z, x)
      const u = (angle / (Math.PI * 2) + 0.5) % 1.0
      const v = (y - bbox.min.y) / heightRange
      
      newUVs[i * 2] = u
      newUVs[i * 2 + 1] = v
    }
    
    geometry.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2))
    
    // Smooth normals across the seam to avoid artifacts
    const positions = geometry.attributes.position
    const posArray = positions.array as Float32Array
    const normals = geometry.attributes.normal
    const normArray = normals.array as Float32Array
    
    // Find vertices at the seam (first and last segments should have same position, different angle)
    const posCount = posArray.length / 3
    const profilePointCount = lathePoints.length
    
    // Smooth normals between corresponding seam vertices
    for (let i = 0; i < profilePointCount; i++) {
      const firstSeamIdx = i
      const lastSeamIdx = segments * profilePointCount + i
      
      if (lastSeamIdx < posCount) {
        // Average the normals at the seam
        const nx0 = normArray[firstSeamIdx * 3]
        const ny0 = normArray[firstSeamIdx * 3 + 1]
        const nz0 = normArray[firstSeamIdx * 3 + 2]
        
        const nx1 = normArray[lastSeamIdx * 3]
        const ny1 = normArray[lastSeamIdx * 3 + 1]
        const nz1 = normArray[lastSeamIdx * 3 + 2]
        
        const avgNx = (nx0 + nx1) / 2
        const avgNy = (ny0 + ny1) / 2
        const avgNz = (nz0 + nz1) / 2
        
        const len = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz)
        if (len > 0) {
          const invLen = 1 / len
          normArray[firstSeamIdx * 3] = avgNx * invLen
          normArray[firstSeamIdx * 3 + 1] = avgNy * invLen
          normArray[firstSeamIdx * 3 + 2] = avgNz * invLen
          
          normArray[lastSeamIdx * 3] = avgNx * invLen
          normArray[lastSeamIdx * 3 + 1] = avgNy * invLen
          normArray[lastSeamIdx * 3 + 2] = avgNz * invLen
        }
      }
    }
    
    normals.needsUpdate = true

    return geometry
  } catch (error) {
    console.error("[v0] Error creating lathe geometry:", error)
    return null
  }
}

function createExtrudedGeometry(
  svgString: string,
  thickness: number,
  bevelSize: number,
  bevelSegments: number,
  curveSegments: number,
): THREE.BufferGeometry | null {
  if (!svgString) return null

  try {
    const shapes = parseSVGContent(svgString)

    if (shapes.length === 0) {
      console.warn("[v0] No valid shapes found in SVG")
      return null
    }

    const geometries: THREE.BufferGeometry[] = []

    for (const shape of shapes) {
      try {
        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          depth: thickness,
          bevelEnabled: bevelSize > 0,
          bevelThickness: bevelSize * 0.5,
          bevelSize: bevelSize * 0.5,
          bevelSegments: Math.max(1, bevelSegments),
          curveSegments: Math.max(3, curveSegments),
        }

        const geo = new THREE.ExtrudeGeometry([shape], extrudeSettings)
        if (geo.attributes.position && geo.attributes.position.count > 0) {
          geometries.push(geo)
        }
      } catch (e) {
        console.warn("[v0] Failed to extrude shape, skipping:", e)
      }
    }

    if (geometries.length === 0) {
      console.warn("[v0] No geometries could be created")
      return null
    }

    // Merge all geometries
    let geometry: THREE.BufferGeometry
    if (geometries.length === 1) {
      geometry = geometries[0]
    } else {
      geometry = mergeGeometries(geometries)
    }

    // Center the geometry
    geometry.center()

    // Flip Y axis (SVG Y is inverted)
    geometry.rotateX(Math.PI)

    // Scale to reasonable size
    geometry.computeBoundingBox()
    // FIX: 'box' variable was undeclared. Use the bounding box of the geometry instead.
    const box = geometry.boundingBox
    if (!box) {
      console.error("[v0] Could not compute bounding box for geometry.")
      return null
    }
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

    if (maxDim > 0) {
      const scale = 2 / maxDim
      geometry.scale(scale, scale, scale)
    }

    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!
    const bboxSize = new THREE.Vector3()
    bbox.getSize(bboxSize)

    const positionAttribute = geometry.getAttribute("position")
    const uvArray = new Float32Array(positionAttribute.count * 2)

    // Get normals for determining face orientation
    geometry.computeVertexNormals()
    const normalAttribute = geometry.getAttribute("normal")

    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i)
      const y = positionAttribute.getY(i)
      const z = positionAttribute.getZ(i)

      // Get normal for this vertex
      const nx = normalAttribute.getX(i)
      const ny = normalAttribute.getY(i)
      const nz = Math.abs(normalAttribute.getZ(i))

      // Normalize positions to 0-1 range
      const normX = (x - bbox.min.x) / bboxSize.x
      const normY = (y - bbox.min.y) / bboxSize.y
      const normZ = (z - bbox.min.z) / bboxSize.z

      let u: number, v: number

      // Triplanar mapping based on normal direction
      // If normal points mostly in Z direction (front/back faces), use X-Y projection
      // If normal points mostly in X or Y (side/edge faces), use appropriate projection
      if (nz > 0.7) {
        // Front/back faces - use X-Y projection
        u = normX
        v = normY
      } else {
        // Side/edge faces - use projection based on dominant normal
        const absNx = Math.abs(nx)
        const absNy = Math.abs(ny)

        if (absNx > absNy) {
          // Side faces facing X direction - use Z-Y projection
          u = normZ
          v = normY
        } else {
          // Side faces facing Y direction - use X-Z projection
          u = normX
          v = normZ
        }
      }

      uvArray[i * 2] = u
      uvArray[i * 2 + 1] = v
    }

    geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2))

    console.log("[v0] Created extruded geometry with triplanar UV mapping")

    return geometry
  } catch (error) {
    console.error("[v0] Error creating extruded geometry:", error)
    return null
  }
}

function ExtrudedSVGMesh({
  geometrySettings,
  materialSettings,
  tintColor,
  colorMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  normalScaleVector,
  envIntensity,
  hueShiftedColorMap,
  matcapTexture,
  useMatcap,
  gradientSettings,
  matcapNormalMap,
  matcapSettings,
}: {
  geometrySettings: GeometrySettings
  materialSettings: MaterialSettings
  tintColor: THREE.Color
  colorMap: THREE.Texture | null
  normalMap: THREE.Texture | null
  roughnessMap: THREE.Texture | null
  metalnessMap: THREE.Texture | null
  normalScaleVector: THREE.Vector2 | null
  envIntensity: number
  hueShiftedColorMap: THREE.Texture | null
  matcapTexture?: THREE.Texture | null
  useMatcap?: boolean
  gradientSettings?: {
    enabled: boolean
    type: "radial" | "linear"
    color1: string
    color2: string
    color3: string
    useThreeColors: boolean
    intensity: number
    distortion: number
  }
  matcapNormalMap?: THREE.Texture | null
  matcapSettings?: {
    normalMap: string
    normalIntensity: number
    normalRepeat: number
    rimIntensity: number
    rimPower: number
    rimColor: string
  }
}) {
  const finalColorMap = hueShiftedColorMap || colorMap
  const finalColor = materialSettings.useHueShift ? new THREE.Color("#ffffff") : tintColor

  const materialProps: any = {
    color: finalColor,
    map: finalColorMap,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    metalnessMap: metalnessMap,
    metalness: materialSettings.metalness,
    roughness: materialSettings.roughness,
    envMapIntensity: envIntensity,
  }

  if (normalMap && normalScaleVector) {
    materialProps.normalScale = normalScaleVector
  }

  const geometry = useMemo(() => {
    if (!geometrySettings.svgPath) return null
    
    if (geometrySettings.usePotteryMode) {
      return createLatheGeometry(
        geometrySettings.svgPath,
        geometrySettings.latheSegments || 64,
        geometrySettings.latheAxis || 'center',
      )
    }
    
    const baseGeometry = createExtrudedGeometry(
      geometrySettings.svgPath,
      geometrySettings.thickness,
      geometrySettings.bevelSize,
      geometrySettings.bevelSegments,
      geometrySettings.bevelQuality,
    )
    
    return baseGeometry
  }, [
    geometrySettings.svgPath,
    geometrySettings.thickness,
    geometrySettings.bevelSize,
    geometrySettings.bevelSegments,
    geometrySettings.bevelQuality,
    geometrySettings.usePotteryMode,
    geometrySettings.latheSegments,
    geometrySettings.latheAxis,
  ])

  const meshRef = useRef<THREE.Mesh>(null)

  // Apply gradient material if enabled
  useEffect(() => {
    if (!meshRef.current) return
    
    if (gradientSettings?.enabled) {
      const gradientMaterial = createGradientMaterial(gradientSettings)
      if (gradientMaterial) {
        meshRef.current.material = gradientMaterial
      }
    }
  }, [gradientSettings])

  // Cleanup geometry on unmount or when dependencies change
  useEffect(() => {
    return () => {
      if (geometry) {
        geometry.dispose()
      }
    }
  }, [geometry])

  if (geometry) {
    return (
      <mesh ref={meshRef} geometry={geometry}>
        {!gradientSettings?.enabled && (
          useMatcap && matcapTexture ? (
            <MatcapMaterialWithEffects 
              matcap={matcapTexture}
              normalMap={matcapNormalMap || null}
              normalIntensity={matcapSettings?.normalIntensity || 1}
              rimIntensity={matcapSettings?.rimIntensity || 0}
              rimPower={matcapSettings?.rimPower || 3}
              rimColor={matcapSettings?.rimColor || "#ffffff"}
            />
          ) : (
            <Material materialSettings={materialSettings} shapeType="extruded" />
          )
        )}
      </mesh>
    )
  }

  return null
}


function PBRMesh({
  geometrySettings,
  materialSettings,
  lightingSettings,
  onModelLoadError,
  onGeometrySettingsChange,
  gradientSettings,
  renderMode,
  matcapTexture,
  matcapNormalMap,
  matcapSettings,
}: {
  geometrySettings: GeometrySettings
  materialSettings: MaterialSettings
  lightingSettings: LightingSettings
  onModelLoadError?: (error: string) => void
  onGeometrySettingsChange?: (settings: Partial<GeometrySettings>) => void
  gradientSettings?: {
    enabled: boolean
    type: "radial" | "linear"
    color1: string
    color2: string
    color3: string
    useThreeColors: boolean
    intensity: number
    distortion: number
    angle?: number
    noise?: number
  }
  renderMode?: "pbr" | "matcap"
  matcapTexture?: THREE.Texture | null
  matcapNormalMap?: THREE.Texture | null
  matcapSettings?: {
    normalMap: string
    normalIntensity: number
    normalRepeat: number
    rimIntensity: number
    rimPower: number
    rimColor: string
  }
}) {
  const texturesToLoad = useMemo(() => {
    const paths: string[] = []
    if (materialSettings.colorMap) paths.push(materialSettings.colorMap)
    if (materialSettings.normalMap) paths.push(materialSettings.normalMap)
    if (materialSettings.roughnessMap) paths.push(materialSettings.roughnessMap)
    if (materialSettings.displacementMap) paths.push(materialSettings.displacementMap)
    if (materialSettings.metalnessMap) paths.push(materialSettings.metalnessMap)
    if (materialSettings.opacityMap) paths.push(materialSettings.opacityMap)
    return paths.length > 0 ? paths : ["/placeholder.svg?height=1&width=1"]
  }, [
    materialSettings.colorMap,
    materialSettings.normalMap,
    materialSettings.roughnessMap,
    materialSettings.displacementMap,
    materialSettings.metalnessMap,
    materialSettings.opacityMap,
  ])

  const loadedTextures = useLoader(THREE.TextureLoader, texturesToLoad)

  const { colorMap, normalMap, roughnessMap, displacementMap, metalnessMap, opacityMap } = useMemo(() => {
    const textureArray = Array.isArray(loadedTextures) ? loadedTextures : [loadedTextures]
    let index = 0

    const result = {
      colorMap: null as THREE.Texture | null,
      normalMap: null as THREE.Texture | null,
      roughnessMap: null as THREE.Texture | null,
      displacementMap: null as THREE.Texture | null,
      metalnessMap: null as THREE.Texture | null,
      opacityMap: null as THREE.Texture | null,
    }

    if (materialSettings.colorMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(materialSettings.textureScale, materialSettings.textureScale)
      result.colorMap = tex
    }
    if (materialSettings.normalMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      const normalRepeatValue = materialSettings.normalRepeat || materialSettings.textureScale
      tex.repeat.set(normalRepeatValue, normalRepeatValue)
      result.normalMap = tex
    }
    if (materialSettings.roughnessMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(materialSettings.textureScale, materialSettings.textureScale)
      result.roughnessMap = tex
    }
    if (materialSettings.displacementMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(materialSettings.textureScale, materialSettings.textureScale)
      result.displacementMap = tex
    }
    if (materialSettings.metalnessMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(materialSettings.textureScale, materialSettings.textureScale)
      result.metalnessMap = tex
    }
    if (materialSettings.opacityMap && textureArray[index]) {
      const tex = textureArray[index++]
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(materialSettings.textureScale, materialSettings.textureScale)
      result.opacityMap = tex
    }

    return result
  }, [loadedTextures, materialSettings])

  const hueShiftedColorMap = useHueShiftedTexture(colorMap, materialSettings.hueShift, materialSettings.useHueShift)

  const finalColorMap = materialSettings.useHueShift ? hueShiftedColorMap : colorMap

  const tintColor = new THREE.Color(materialSettings.colorTint)
  const normalScaleVector = new THREE.Vector2(materialSettings.normalScale, materialSettings.normalScale)

  const sphereMeshRef = useRef<THREE.Mesh>(null)
  
  // Apply gradient material if enabled
  useEffect(() => {
    if (!sphereMeshRef.current) return
    
    if (gradientSettings?.enabled) {
      const gradientMaterial = createGradientMaterial(gradientSettings)
      if (gradientMaterial) {
        sphereMeshRef.current.material = gradientMaterial
      }
    }
  }, [gradientSettings])

  const sphereMaterialProps = useMemo(() => {
    const finalTintColor = materialSettings.useHueShift ? new THREE.Color("#ffffff") : tintColor

    const props: any = {
      color: finalTintColor,
      map: finalColorMap,
      normalMap: normalMap,
      roughnessMap: roughnessMap,
      metalnessMap: metalnessMap,
      displacementMap: displacementMap,
      displacementScale: materialSettings.displacementScale,
      metalness: materialSettings.metalness,
      roughness: materialSettings.roughness,
      envMapIntensity: lightingSettings.envIntensity,
    }
    // Only set normalScale when normalMap exists
    if (normalMap) {
      props.normalScale = normalScaleVector
    }
    return props
  }, [
    tintColor,
    finalColorMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    displacementMap,
    materialSettings,
    lightingSettings.envIntensity,
    normalScaleVector,
  ])

  const textureKey = texturesToLoad.join("-")
  const fullTextureKey = `${textureKey}-hue${materialSettings.hueShift}-${materialSettings.useHueShift}`
  
  // Center geometry when it updates
  useEffect(() => {
    if (sphereMeshRef.current?.geometry) {
      sphereMeshRef.current.geometry.center()
    }
  }, [geometrySettings.primitiveType])

  return (
    <>
      <ambientLight intensity={lightingSettings.ambientIntensity} />
      <directionalLight position={[5, 5, 5]} intensity={lightingSettings.directionalIntensity} />

      {geometrySettings.type === "sphere" ? (
        <mesh key={fullTextureKey} ref={sphereMeshRef}>
          <PrimitiveGeometry primitiveType={geometrySettings.primitiveType || "sphere"} />
          <Material materialSettings={materialSettings} />
        </mesh>
      ) : geometrySettings.type === "model" ? (
        geometrySettings.modelUrl && (
          <ModelMesh
            key={`${fullTextureKey}-${geometrySettings.modelUrl}`}
            modelUrl={geometrySettings.modelUrl}
            materialSettings={materialSettings}
            onError={onModelLoadError}
            renderMode={renderMode}
            colorMap={colorMap}
            normalMap={normalMap}
            roughnessMap={roughnessMap}
            metalnessMap={metalnessMap}
            hueShiftedColorMap={hueShiftedColorMap}
            normalScaleVector={normalMap ? normalScaleVector : null}
            envIntensity={lightingSettings.envIntensity}
            tintColor={tintColor}
            textureScale={materialSettings.textureScale}
            matcapTexture={renderMode === "matcap" ? matcapTexture : null}
            matcapNormalMap={renderMode === "matcap" ? matcapNormalMap : null}
            matcapSettings={matcapSettings}
            gradientSettings={gradientSettings}
            inflationAmount={geometrySettings.inflationAmount || 0}
            inflateSphereEnabled={geometrySettings.inflateSphereEnabled || true}
            inflateSpherePosition={geometrySettings.inflateSpherePosition || [0, 0, 0]}
            inflateSphereRadius={geometrySettings.inflateSphereRadius || 1.0}
            flatBase={geometrySettings.flatBase || false}
            usePotteryMode={geometrySettings.usePotteryMode || false}
            onInflateSphereMove={(pos) => onGeometrySettingsChange?.({ inflateSpherePosition: pos })}
          />
        )
      ) : (
        <ExtrudedSVGMesh
          key={fullTextureKey}
          geometrySettings={geometrySettings}
          materialSettings={materialSettings}
          tintColor={tintColor}
          colorMap={colorMap}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          metalnessMap={metalnessMap}
          normalScaleVector={normalMap ? normalScaleVector : null}
          envIntensity={lightingSettings.envIntensity}
          hueShiftedColorMap={hueShiftedColorMap}
          gradientSettings={gradientSettings}
        />
      )}
    </>
  )
}

function useHueShiftedTexture(
  originalTexture: THREE.Texture | null,
  hueShift: number,
  enabled: boolean,
): THREE.Texture | null {
  const [shiftedTexture, setShiftedTexture] = useState<THREE.Texture | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!originalTexture || !enabled || hueShift === 0) {
      setShiftedTexture(null)
      setIsProcessing(false)
      return
    }

    const image = originalTexture.image
    const isImageReady = image && (image instanceof ImageBitmap || image.complete !== false)

    if (!isImageReady) {
      setShiftedTexture(null)
      setIsProcessing(false)
      return
    }

    setIsProcessing(true)

    // Create canvas to manipulate pixels
    const canvas = document.createElement("canvas")
    canvas.width = image.width || 512
    canvas.height = image.height || 512
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setShiftedTexture(null)
      setIsProcessing(false)
      return
    }

    // Draw original image
    try {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    } catch (e) {
      console.error("[v0] Failed to draw image for hue shift:", e)
      setShiftedTexture(null)
      setIsProcessing(false)
      return
    }
    // Get pixel data
    let imageData: ImageData
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch (e) {
      console.error("[v0] Failed to get image data for hue shift:", e)
      setShiftedTexture(null)
      setIsProcessing(false)
      return
    }
    const data = imageData.data

    // Apply hue shift to each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255

      // RGB to HSL
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0
      let s = 0
      const l = (max + min) / 2

      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6
            break
          case g:
            h = ((b - r) / d + 2) / 6
            break
          case b:
            h = ((r - g) / d + 4) / 6
            break
        }
      }

      // Apply hue shift (hueShift is 0-360 degrees)
      h = (h + hueShift / 360) % 1
      if (h < 0) h += 1

      // HSL to RGB
      let newR, newG, newB
      if (s === 0) {
        newR = newG = newB = l
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1
          if (t > 1) t -= 1
          if (t < 1 / 6) return p + (q - p) * 6 * t
          if (t < 1 / 2) return q
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
          return p
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        newR = hue2rgb(p, q, h + 1 / 3)
        newG = hue2rgb(p, q, h)
        newB = hue2rgb(p, q, h - 1 / 3)
      }

      data[i] = Math.round(newR * 255)
      data[i + 1] = Math.round(newG * 255)
      data[i + 2] = Math.round(newB * 255)
    }

    ctx.putImageData(imageData, 0, 0)

    // Create new texture from canvas
    const newTexture = new THREE.CanvasTexture(canvas)
    newTexture.colorSpace = THREE.SRGBColorSpace
    newTexture.wrapS = originalTexture.wrapS
    newTexture.wrapT = originalTexture.wrapT
    newTexture.needsUpdate = true

    setShiftedTexture(newTexture)
    setIsProcessing(false)

    return () => {
      newTexture.dispose()
    }
  }, [originalTexture, hueShift, enabled])

  // This prevents the white flash while hue shift is being computed
  if (!enabled || hueShift === 0) {
    return originalTexture
  }

  // Return shifted if ready, otherwise return original as fallback
  return shiftedTexture || originalTexture
}

function Material({
  materialSettings,
  shapeType = "sphere",
}: { materialSettings: MaterialSettings; shapeType?: "sphere" | "extruded" }) {
  const isExtruded = shapeType === "extruded"

  const textures = useLoader(
    THREE.TextureLoader,
    [
      materialSettings.colorMap ? materialSettings.colorMap : null,
      materialSettings.normalMap ? materialSettings.normalMap : null,
      materialSettings.roughnessMap ? materialSettings.roughnessMap : null,
      !isExtruded && materialSettings.displacementMap ? materialSettings.displacementMap : null,
      materialSettings.metalnessMap ? materialSettings.metalnessMap : null,
      materialSettings.opacityMap ? materialSettings.opacityMap : null,
    ].filter(Boolean) as string[],
  )

  const [colorMap, normalMap, roughnessMap, displacementMap, metalnessMap, opacityMap] = useMemo(() => {
    const maps: (THREE.Texture | null)[] = []
    let index = 0

    if (materialSettings.colorMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    if (materialSettings.normalMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    if (materialSettings.roughnessMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    if (!isExtruded && materialSettings.displacementMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    if (materialSettings.metalnessMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    if (materialSettings.opacityMap) {
      maps.push(textures[index++])
    } else {
      maps.push(null)
    }

    return maps
  }, [textures, materialSettings, isExtruded])

  const textureScale = materialSettings.textureScale || 1

  useMemo(() => {
    ;[colorMap, normalMap, roughnessMap, displacementMap, metalnessMap, opacityMap].forEach((tex) => {
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(textureScale, textureScale)
        tex.colorSpace = tex === colorMap ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
        tex.needsUpdate = true
      }
    })
  }, [colorMap, normalMap, roughnessMap, displacementMap, metalnessMap, opacityMap, textureScale])

  const hueShiftedColorMap = useHueShiftedTexture(colorMap, materialSettings.hueShift, materialSettings.useHueShift)

  const finalColorMap = materialSettings.useHueShift ? hueShiftedColorMap : colorMap

  const tintColor = materialSettings.useHueShift
    ? new THREE.Color("#ffffff")
    : new THREE.Color(materialSettings.colorTint)

  const isGlass = materialSettings.transmission > 0

  const materialProps = useMemo(() => {
    const effectiveDisplacementScale = isExtruded ? 0 : materialSettings.displacementScale
    const effectiveDisplacementMap = isExtruded ? null : displacementMap

    const baseProps = {
      color: tintColor,
      map: finalColorMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(materialSettings.normalScale, materialSettings.normalScale),
      roughnessMap: roughnessMap,
      roughness: materialSettings.roughness,
      metalnessMap: metalnessMap,
      metalness: materialSettings.metalness,
      displacementMap: effectiveDisplacementMap,
      displacementScale: effectiveDisplacementScale,
    }

    if (isGlass) {
      return {
        ...baseProps,
        map: null,
        color:
          materialSettings.glassColorIntensity > 0
            ? new THREE.Color(materialSettings.glassColor)
            : new THREE.Color(0xffffff),
        transmission: materialSettings.transmission,
        ior: materialSettings.ior,
        thickness: materialSettings.thickness,
        attenuationDistance: materialSettings.attenuationDistance,
        attenuationColor: new THREE.Color(materialSettings.attenuationColor),
        transparent: true,
        opacity: 1,
        alphaMap: opacityMap,
        side: THREE.DoubleSide,
        envMapIntensity: materialSettings.envMapIntensity || 1.5,
        clearcoat: materialSettings.clearcoat,
        clearcoatRoughness: materialSettings.clearcoatRoughness,
        clearcoatNormalScale: new THREE.Vector2(materialSettings.clearcoatNormalScale, materialSettings.clearcoatNormalScale),
        reflectivity: materialSettings.reflectivity,
        specularIntensity: 1,
        specularColor: new THREE.Color(0xffffff),
        iridescence: materialSettings.iridescence,
        iridescenceIOR: materialSettings.iridescenceIOR,
        iridescenceThicknessRange: [materialSettings.iridescenceThicknessMin, materialSettings.iridescenceThicknessMax],
      }
    }

    return baseProps
  }, [
    finalColorMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    displacementMap,
    opacityMap,
    materialSettings,
    isGlass,
    tintColor,
    isExtruded,
  ])

  return isGlass ? <meshPhysicalMaterial {...materialProps} /> : <meshStandardMaterial {...materialProps} />
}

interface SceneContentProps {
  geometrySettings: GeometrySettings
  materialSettings: MaterialSettings
  lightingSettings: LightingSettings
  onExportReady: (exportFn: () => void) => void
  renderMode?: "pbr" | "matcap"
  matcapTexture?: string
  matcapHueShift?: number
  matcapSettings?: {
    normalMap: string
    normalIntensity: number
    normalRepeat: number
    rimIntensity: number
    rimPower: number
    rimColor: string
  }
  showGrid?: boolean
  showRotateControls?: boolean
  gradientSettings?: {
    enabled: boolean
    type: "radial" | "linear"
    color1: string
    color2: string
    color3: string
    useThreeColors: boolean
    intensity: number
    distortion: number
  }
  customMaterial?: {
    baseColor: string
    normal: string
    roughness: string
    metalness: string
  }
  onModelLoadError?: (error: string) => void
  onGeometrySettingsChange?: (settings: Partial<GeometrySettings>) => void
}

function SceneContent({
  geometrySettings,
  materialSettings,
  lightingSettings,
  onExportReady,
  renderMode = "pbr",
  matcapTexture,
  matcapHueShift = 0,
  matcapSettings,
  showGrid = true,
  showRotateControls = false,
  gradientSettings,
  customMaterial,
  onModelLoadError,
  onGeometrySettingsChange,
  backgroundColor,
}: SceneContentProps & { onExportReady: (fn: () => void) => void, backgroundColor?: string }) {
  const { gl, scene, camera } = useThree()
  
  // Apply background color
  useEffect(() => {
    if (backgroundColor) {
      scene.background = new THREE.Color(backgroundColor)
    }
  }, [backgroundColor, scene])

  // Apply gradient material if enabled
  useEffect(() => {
    if (!gradientSettings?.enabled) return
    
    const gradientMaterial = createGradientMaterial(
      gradientSettings?.color1 || "#ff0080",
      gradientSettings
    )
    
    if (!gradientMaterial) return
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object !== camera) {
        // Store original material
        (object as any).originalMaterial = object.material
        object.material = gradientMaterial
      }
    })

    return () => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && (object as any).originalMaterial) {
          object.material = (object as any).originalMaterial
        }
      })
    }
  }, [gradientSettings, scene, camera])

  useEffect(() => {
    const exportPNG = () => {
      const currentBackground = scene.background
      const isGlassMaterial = materialSettings.transmission > 0
      
      // Hide grid during export
      let gridGroup: THREE.Group | null = null
      let gridWasVisible = false
      scene.traverse((child) => {
        if (child instanceof THREE.Group && child.children.some(c => c instanceof THREE.Line)) {
          // This is likely our grid
          gridGroup = child
          gridWasVisible = child.visible
          child.visible = false
        }
      })

      if (!isGlassMaterial) {
        // Non-glass: simple transparent export
        scene.background = null
        for (let i = 0; i < 3; i++) {
          gl.render(scene, camera)
        }
        requestAnimationFrame(() => {
          const dataURL = gl.domElement.toDataURL("image/png")
          scene.background = currentBackground
          // Restore grid visibility
          if (gridGroup) {
            gridGroup.visible = gridWasVisible
          }
          const link = document.createElement("a")
          link.download = `material-export-${Date.now()}.png`
          link.href = dataURL
          link.click()
        })
      } else {
        // Glass: render with background, then mask with shape
        // Step 1: Render with background for transmission effects
        for (let i = 0; i < 3; i++) {
          gl.render(scene, camera)
        }
        
        requestAnimationFrame(() => {
          const width = gl.domElement.width
          const height = gl.domElement.height
          
          // Capture render with background
          const imageWithBackground = new Image()
          imageWithBackground.onload = () => {
            // Step 2: Render black silhouette for alpha mask
            scene.background = new THREE.Color(0x000000)
            
            // Store original materials and replace with black emissive
            const materialBackups: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> = []
            scene.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                materialBackups.push({ mesh: object, material: object.material })
                object.material = new THREE.MeshBasicMaterial({ color: 0xffffff })
              }
            })
            
            gl.render(scene, camera)
            
            requestAnimationFrame(() => {
              const maskCanvas = document.createElement("canvas")
              maskCanvas.width = width
              maskCanvas.height = height
              const maskCtx = maskCanvas.getContext("2d")!
              maskCtx.drawImage(gl.domElement, 0, 0)
              
              // Restore materials
              for (const backup of materialBackups) {
                backup.mesh.material = backup.material
              }
              scene.background = currentBackground
              // Restore grid visibility
              if (gridGroup) {
                gridGroup.visible = gridWasVisible
              }
              
              // Step 3: Combine images with mask
              const outputCanvas = document.createElement("canvas")
              outputCanvas.width = width
              outputCanvas.height = height
              const ctx = outputCanvas.getContext("2d")!
              
              // Draw the glass render
              ctx.drawImage(imageWithBackground, 0, 0)
              
              // Apply alpha mask from silhouette
              const imageData = ctx.getImageData(0, 0, width, height)
              const maskData = maskCtx.getImageData(0, 0, width, height)
              
              for (let i = 0; i < imageData.data.length; i += 4) {
                // Use white mask as alpha (white = opaque, black = transparent)
                const maskValue = maskData.data[i] // R channel
                imageData.data[i + 3] = maskValue // Set alpha
              }
              
              ctx.putImageData(imageData, 0, 0)
              
              // Export final image
              const dataURL = outputCanvas.toDataURL("image/png")
              const link = document.createElement("a")
              link.download = `material-export-${Date.now()}.png`
              link.href = dataURL
              link.click()
            })
          }
          imageWithBackground.src = gl.domElement.toDataURL("image/png")
        })
      }
    }

    onExportReady(exportPNG)
  }, [gl, scene, camera, onExportReady])

  const showMatcap = renderMode === "matcap" && matcapTexture

  const matcapTextureLoaded = useMemo(() => {
    if (!showMatcap || !matcapTexture) return null

    const loader = new THREE.TextureLoader()
    const texture = new THREE.Texture()
    texture.colorSpace = THREE.SRGBColorSpace

    loader.load(matcapTexture, (loadedTexture) => {
      console.log("[v0] Matcap texture loaded, applying hue shift:", matcapHueShift)

      if (matcapHueShift === 0) {
        // No hue shift, use original texture
        texture.image = loadedTexture.image
        texture.needsUpdate = true
        return
      }

      // Apply hue shift
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const image = loadedTexture.image

      if (!ctx || !image) return

      canvas.width = image.width
      canvas.height = image.height

      // Draw original image
      ctx.drawImage(image, 0, 0)

      // Get image data and apply hue shift
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        // Convert RGB to HSL
        const r = data[i] / 255
        const g = data[i + 1] / 255
        const b = data[i + 2] / 255

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        let h = 0
        let s = 0
        const l = (max + min) / 2

        if (max !== min) {
          const d = max - min
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

          switch (max) {
            case r:
              h = ((g - b) / d + (g < b ? 6 : 0)) / 6
              break
            case g:
              h = ((b - r) / d + 2) / 6
              break
            case b:
              h = ((r - g) / d + 4) / 6
              break
          }
        }

        // Apply hue shift
        h = (h + matcapHueShift / 360) % 1

        // Convert back to RGB
        let r2, g2, b2
        if (s === 0) {
          r2 = g2 = b2 = l
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1 / 6) return p + (q - p) * 6 * t
            if (t < 1 / 2) return q
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
            return p
          }

          const q = l < 0.5 ? l * (1 + s) : l + s - l * s
          const p = 2 * l - q
          r2 = hue2rgb(p, q, h + 1 / 3)
          g2 = hue2rgb(p, q, h)
          b2 = hue2rgb(p, q, h - 1 / 3)
        }

        data[i] = Math.round(r2 * 255)
        data[i + 1] = Math.round(g2 * 255)
        data[i + 2] = Math.round(b2 * 255)
      }

      ctx.putImageData(imageData, 0, 0)
      texture.image = canvas
      texture.needsUpdate = true

      console.log("[v0] Hue shift applied successfully")
    })

    return texture
  }, [matcapTexture, showMatcap, matcapHueShift])

  // Load normal map texture for matcap
  const matcapNormalMap = useMemo(() => {
    if (!matcapSettings?.normalMap) return null
    const loader = new THREE.TextureLoader()
    const texture = loader.load(matcapSettings.normalMap)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(matcapSettings.normalRepeat || 1, matcapSettings.normalRepeat || 1)
    return texture
  }, [matcapSettings?.normalMap, matcapSettings?.normalRepeat])

  // Update normal map repeat when it changes
  useEffect(() => {
    if (matcapNormalMap && matcapSettings?.normalRepeat) {
      matcapNormalMap.repeat.set(matcapSettings.normalRepeat, matcapSettings.normalRepeat)
      matcapNormalMap.needsUpdate = true
    }
  }, [matcapNormalMap, matcapSettings?.normalRepeat])

  return (
    <>
      <group>
        <TransformControls 
          mode="rotate" 
          enabled={showRotateControls}
          showX={showRotateControls}
          showY={showRotateControls}
          showZ={showRotateControls}
        >
      {showMatcap ? (
        <>
      {geometrySettings.type === "sphere" ? (
        <mesh>
          <PrimitiveGeometry primitiveType={geometrySettings.primitiveType || "sphere"} />
          <MatcapMaterialWithEffects 
            matcap={matcapTextureLoaded}
            normalMap={matcapNormalMap}
            normalIntensity={matcapSettings?.normalIntensity || 1}
            rimIntensity={matcapSettings?.rimIntensity || 0}
            rimPower={matcapSettings?.rimPower || 3}
            rimColor={matcapSettings?.rimColor || "#ffffff"}
          />
        </mesh>
      ) : geometrySettings.type === "model" ? (
            geometrySettings.modelUrl && (
            <ModelMesh
              modelUrl={geometrySettings.modelUrl}
              materialSettings={materialSettings}
              onError={onModelLoadError}
              renderMode={renderMode}
              matcapTexture={matcapTextureLoaded}
              matcapNormalMap={matcapNormalMap}
              matcapSettings={matcapSettings}
              gradientSettings={gradientSettings}
              inflationAmount={geometrySettings.inflationAmount || 0}
              inflateSphereEnabled={geometrySettings.inflateSphereEnabled || true}
              inflateSpherePosition={geometrySettings.inflateSpherePosition || [0, 0, 0]}
              inflateSphereRadius={geometrySettings.inflateSphereRadius || 1.0}
              flatBase={geometrySettings.flatBase || false}
              usePotteryMode={geometrySettings.usePotteryMode || false}
            />
            )
          ) : (
            <ExtrudedSVGMesh
              geometrySettings={geometrySettings}
              materialSettings={materialSettings}
              tintColor={new THREE.Color(materialSettings.colorTint)}
              colorMap={null}
              normalMap={null}
              roughnessMap={null}
              metalnessMap={null}
              normalScaleVector={new THREE.Vector2(0, 0)}
              envIntensity={0}
              hueShiftedColorMap={null}
              matcapTexture={matcapTextureLoaded}
              useMatcap={true}
              gradientSettings={gradientSettings}
              matcapNormalMap={matcapNormalMap}
              matcapSettings={matcapSettings}
            />
          )}
        </>
      ) : (
        <>
          <PBRMesh
            geometrySettings={geometrySettings}
            materialSettings={materialSettings}
            lightingSettings={lightingSettings}
            onModelLoadError={onModelLoadError}
            onGeometrySettingsChange={onGeometrySettingsChange}
            gradientSettings={gradientSettings}
          />
          <Environment
            preset={lightingSettings.envMap as any}
            environmentRotation={[0, lightingSettings.envRotation, 0]}
          />
        </>
      )}
      </TransformControls>
      </group>
      <GridHelper visible={showGrid} />
      <axesHelper args={[0.5]} position={[0, -1.2, 0]} visible={showRotateControls} />
    </>
  )
}

export interface PBRViewerRef {
  exportPNG: () => void
}

export const PBRViewer = forwardRef<
  PBRViewerRef,
  {
  geometrySettings: GeometrySettings
  materialSettings: MaterialSettings
  lightingSettings: LightingSettings
  renderMode?: "pbr" | "matcap"
  matcapTexture?: string
  matcapHueShift?: number // Added from updates
  matcapSettings?: {
    normalMap: string
    normalIntensity: number
    normalRepeat: number
    rimIntensity: number
    rimPower: number
    rimColor: string
  }
  backgroundColor?: string
  showGrid?: boolean
  showRotateControls?: boolean
  gradientSettings?: {
    enabled: boolean
    type: "radial" | "linear"
    color1: string
    color2: string
    color3: string
    useThreeColors: boolean
    intensity: number
    distortion: number
  }
  customMaterial?: {
    baseColor: string
    normal: string
    roughness: string
    metalness: string
  }
  onModelLoadError?: (error: string) => void
  onGeometrySettingsChange?: (settings: Partial<GeometrySettings>) => void
  }
>(function PBRViewer(
  { geometrySettings, materialSettings, lightingSettings, renderMode, matcapTexture, matcapHueShift, matcapSettings, backgroundColor, showGrid, showRotateControls, gradientSettings, customMaterial, onModelLoadError, onGeometrySettingsChange },
  ref,
  ) {
  const exportFnRef = useRef<(() => void) | null>(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      if (exportFnRef.current) {
        exportFnRef.current()
      }
    },
  }))

  const handleExportReady = (fn: () => void) => {
    exportFnRef.current = fn
  }

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: lightingSettings.exposure,
          preserveDrawingBuffer: true, // Required for toDataURL
          alpha: true, // Enable alpha channel
        }}
      >
        <color attach="background" args={["#18181b"]} />
        <Suspense fallback={null}>
          <SceneContent
            geometrySettings={geometrySettings}
            materialSettings={materialSettings}
            lightingSettings={lightingSettings}
            onExportReady={handleExportReady}
            renderMode={renderMode}
            matcapTexture={matcapTexture}
            matcapHueShift={matcapHueShift}
            matcapSettings={matcapSettings}
            showGrid={showGrid}
            showRotateControls={showRotateControls}
            backgroundColor={backgroundColor}
            gradientSettings={gradientSettings}
            customMaterial={customMaterial}
            onModelLoadError={onModelLoadError}
            onGeometrySettingsChange={onGeometrySettingsChange}
          />
        </Suspense>
        <OrbitControls 
          enabled={!showRotateControls}
          enableDamping 
          dampingFactor={0.05} 
        />
      </Canvas>
    </div>
  )
})
