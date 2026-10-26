"use client"

import { useRef } from "react"
import { useEffect, useState } from "react"
import { useLoader } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import * as THREE from "three"
import { Mesh } from "three"
import { useThree } from "@react-three/fiber"
import { TransformControls } from "@react-three/drei"
import { createGradientMaterial } from "./gradient-shader"
import { setMaterialHue, HUE_GLSL } from "@/lib/hue-shift"

/* Parsed models are cached by URL: switching material presets, or coming back to a model,
   clones the cached scene instead of downloading and parsing the file again. */
const GLTF_CACHE = new Map<string, Promise<any>>()
function loadGltfCached(url: string) {
  let p = GLTF_CACHE.get(url)
  if (!p) {
    p = fetchGltf(url).catch((e) => {
      GLTF_CACHE.delete(url)
      throw e
    })
    GLTF_CACHE.set(url, p)
  }
  return p
}

async function fetchGltf(modelUrl: string): Promise<any> {
  const loader = new GLTFLoader()
  if (!modelUrl.startsWith("blob:")) {
    return new Promise((resolve, reject) =>
      loader.load(modelUrl, resolve, undefined, (err: any) => reject(new Error("Ошибка загрузки модели: " + (err?.message || "неизвестная ошибка")))),
    )
  }
  // blob URL: read the bytes and parse (GLB, or JSON GLTF with embedded data URIs)
  const arrayBuffer = await (await fetch(modelUrl)).arrayBuffer()
  const view = new Uint8Array(arrayBuffer)
  const isGLB = view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46
  if (isGLB) {
    return new Promise((resolve, reject) =>
      loader.parse(arrayBuffer, "", resolve, (err: any) => reject(new Error("Ошибка парсинга GLB: " + (err?.message || "неизвестная ошибка")))),
    )
  }
  const gltfJson = JSON.parse(new TextDecoder().decode(arrayBuffer))
  for (const buffer of gltfJson.buffers || []) {
    if (buffer.uri && buffer.uri.startsWith("data:")) {
      const bin = atob(buffer.uri.substring(buffer.uri.indexOf(",") + 1))
      const bytes = new Uint8Array(bin.length)
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j)
      buffer.uri = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }))
    }
  }
  return new Promise((resolve, reject) =>
    loader.parse(JSON.stringify(gltfJson), "", resolve, (err: any) => reject(new Error("Ошибка парсинга GLTF: " + (err?.message || "неизвестная ошибка")))),
  )
}

interface ModelMeshProps {
  modelUrl: string
  materialSettings: any
  onError?: (error: string) => void
  // PBR текстуры
  colorMap?: THREE.Texture | null
  normalMap?: THREE.Texture | null
  roughnessMap?: THREE.Texture | null
  metalnessMap?: THREE.Texture | null
  hueShiftedColorMap?: THREE.Texture | null
  normalScaleVector?: THREE.Vector2 | null
  envIntensity?: number
  tintColor?: THREE.Color
  textureScale?: number
  // Matcap
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
  // Gradient
  gradientSettings?: {
    enabled: boolean
    type: "radial" | "linear"
    color1: string
    color2: string
    color3?: string
    use3Colors: boolean
    intensity: number
    distortion: number
    noise: number
  }
  // Inflation
  inflationAmount?: number
  inflateSphereEnabled?: boolean
  inflateSpherePosition?: [number, number, number]
  inflateSphereRadius?: number
  flatBase?: boolean
  onInflateSphereMove?: (position: [number, number, number]) => void
  // Pottery wheel mode
  usePotteryMode?: boolean
}

export function ModelMesh({
  modelUrl,
  materialSettings,
  onError,
  colorMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  hueShiftedColorMap,
  normalScaleVector,
  envIntensity = 1,
  tintColor,
  textureScale = 1,
  renderMode = "pbr",
  matcapTexture,
  matcapNormalMap,
  matcapSettings,
  gradientSettings,
  inflationAmount = 0,
  inflateSphereEnabled = true,
  inflateSpherePosition = [0, 0, 0],
  inflateSphereRadius = 1.0,
  flatBase = false,
  onInflateSphereMove,
  usePotteryMode = false,
}: ModelMeshProps) {
  const [scene, setScene] = useState<THREE.Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { controls } = useThree()
  const inflateControlRef = useRef<THREE.Group>(null)
  const [modelSize, setModelSize] = useState<number>(1)

  useEffect(() => {
    if (!modelUrl) {
      setLoading(false)
      return
    }
    setLoading(true)
    let isMounted = true
    // parsed once per URL; each mount works on its own clone (geometry/material edits stay local)
    loadGltfCached(modelUrl)
      .then((gltf) => {
        if (isMounted) processGltf({ scene: gltf.scene.clone(true) })
      })
      .catch((err) => {
        if (isMounted) {
          console.error("[v0] Load error:", err)
          handleError(String(err?.message || err || "Ошибка загрузки модели"))
        }
      })
    return () => {
      isMounted = false
    }
  }, [modelUrl])

  // Применяем inflation при изменении inflationAmount и параметров сферы
  useEffect(() => {
    if (!scene) return
    
    const sphereCenter = new THREE.Vector3(
      inflateSpherePosition[0],
      inflateSpherePosition[1],
      inflateSpherePosition[2]
    )
    
    scene.traverse((child) => {
      if (child instanceof Mesh && child.userData.originalGeometry) {
        const originalGeo = child.userData.originalGeometry as THREE.BufferGeometry
        
        // Ensure original has normals computed
        if (!originalGeo.attributes.normal) {
          originalGeo.computeVertexNormals()
        }
        
        // Clone geometry - this creates a new BufferGeometry
        const geometry = originalGeo.clone() as THREE.BufferGeometry
        
        // Применяем inflation/deflation если нужно
        if (inflationAmount !== 0) {
          const positions = geometry.attributes.position
          const originalPositions = originalGeo.attributes.position
          const originalNormals = originalGeo.attributes.normal
          
          if (positions && originalPositions && originalNormals && positions.count === originalPositions.count) {
            // Calculate geometry size for scaling
            geometry.computeBoundingBox()
            const bbox = geometry.boundingBox
            if (bbox) {
              const size = new THREE.Vector3()
              bbox.getSize(size)
              const avgSize = (size.x + size.y + size.z) / 3
              
              // Base displacement - только положительные значения (0-1)
              const maxDisplacement = inflationAmount * avgSize * 0.2
              
              // Радиус сферы влияния (масштабированный по размеру модели)
              const effectRadius = inflateSphereRadius * avgSize
              
              // Храним минимальный Y для flat base
              let minY = Number.POSITIVE_INFINITY
              if (flatBase) {
                for (let i = 0; i < originalPositions.count; i++) {
                  const y = originalPositions.getY(i)
                  if (y < minY) minY = y
                }
              }
              
              // Move each vertex along its ORIGINAL normal
              for (let i = 0; i < positions.count; i++) {
                const origX = originalPositions.getX(i)
                const origY = originalPositions.getY(i)
                const origZ = originalPositions.getZ(i)
                
                // Пропустить вертексы на низу модели если включен flat base
                if (flatBase && Math.abs(origY - minY) < 0.01 * avgSize) {
                  positions.setX(i, origX)
                  positions.setY(i, origY)
                  positions.setZ(i, origZ)
                  continue
                }
                
                // Рассчитываем расстояние от вертекса до центра сферы надувания
                let influence = 1.0
                if (inflateSphereEnabled) {
                  const dx = origX - sphereCenter.x
                  const dy = origY - sphereCenter.y
                  const dz = origZ - sphereCenter.z
                  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
                  
                  // Плавное затухание (smooth falloff) от центра к краю сферы
                  if (distance < effectRadius) {
                    // Используем cosine для smooth falloff
                    influence = Math.cos((distance / effectRadius) * (Math.PI / 2))
                  } else {
                    influence = 0
                  }
                }
                
                // Получаем нормаль
                const nx = originalNormals.getX(i)
                const ny = originalNormals.getY(i)
                const nz = originalNormals.getZ(i)
                
                // Применяем смещение с учетом влияния сферы
                const displacement = maxDisplacement * influence
                
                positions.setX(i, origX + nx * displacement)
                positions.setY(i, origY + ny * displacement)
                positions.setZ(i, origZ + nz * displacement)
              }
              
              positions.needsUpdate = true
              
              // Обновляем bounding volumes
              geometry.computeBoundingBox()
              geometry.computeBoundingSphere()
            }
          }
        }
        
        // Dispose old geometry
        if (child.geometry && child.geometry !== originalGeo) {
          child.geometry.dispose()
        }
        
        child.geometry = geometry
      }
    })
  }, [scene, inflationAmount, inflateSphereEnabled, inflateSpherePosition, inflateSphereRadius, flatBase])

  // Применяем материалы при изменении текстур или режима рендеринга
  useEffect(() => {
    if (!scene) return

    // Проверяем есть ли пользовательские текстуры
    const hasCustomTextures = !!(colorMap || normalMap || roughnessMap || metalnessMap || hueShiftedColorMap)
    

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        const hasOriginal = !!(child.userData.originalMaterial || child.userData.originalMaterials)
        
        let newMaterial: THREE.Material

        if (renderMode === "matcap" && matcapTexture) {
          newMaterial = createMatcapMaterial(matcapTexture, matcapNormalMap, matcapSettings)
        } else if (gradientSettings?.enabled) {
          newMaterial = createGradientMaterial(gradientSettings)
        } else if (hasCustomTextures) {
          newMaterial = createPBRMaterial(
            materialSettings,
            colorMap,
            normalMap,
            roughnessMap,
            metalnessMap,
            hueShiftedColorMap,
            normalScaleVector,
            envIntensity,
            tintColor,
            textureScale
          )
        } else if (hasOriginal) {
          const original = child.userData.originalMaterial || child.userData.originalMaterials
          
          if (Array.isArray(original)) {
            newMaterial = original[0].clone()
          } else {
            newMaterial = original.clone()
          }
          
          // Конвертируем в MeshPhysicalMaterial для поддержки transmission
          const isGlass = materialSettings.transmission > 0
          
          if (isGlass && newMaterial instanceof THREE.MeshStandardMaterial) {
            // Создаем новый MeshPhysicalMaterial с теми же текстурами
            const physicalMaterial = new THREE.MeshPhysicalMaterial({
              map: newMaterial.map,
              normalMap: newMaterial.normalMap,
              normalScale: newMaterial.normalScale,
              roughnessMap: null,
              metalnessMap: null,
              roughness: materialSettings.roughness ?? 0.5,
              metalness: materialSettings.metalness ?? 0,
              envMapIntensity: envIntensity,
              // Glass properties
              transmission: materialSettings.transmission ?? 0,
              ior: materialSettings.ior ?? 1.5,
              thickness: materialSettings.thickness ?? 0.5,
              attenuationDistance: materialSettings.attenuationDistance ?? 100,
              attenuationColor: materialSettings.attenuationColor ? new THREE.Color(materialSettings.attenuationColor) : new THREE.Color("#ffffff"),
              transparent: true,
              side: THREE.DoubleSide, // glass: back faces feed the transmission pass, so inner layers show through
              clearcoat: materialSettings.clearcoat ?? 0,
              clearcoatRoughness: materialSettings.clearcoatRoughness ?? 0,
              clearcoatNormalScale: new THREE.Vector2(materialSettings.clearcoatNormalScale ?? 1, materialSettings.clearcoatNormalScale ?? 1),
              reflectivity: materialSettings.reflectivity ?? 0.5,
              iridescence: materialSettings.iridescence ?? 0,
              iridescenceIOR: materialSettings.iridescenceIOR ?? 1.3,
              iridescenceThicknessRange: [materialSettings.iridescenceThicknessMin ?? 100, materialSettings.iridescenceThicknessMax ?? 400],
            })
            newMaterial.dispose()
            newMaterial = physicalMaterial
          } else if (newMaterial instanceof THREE.MeshStandardMaterial) {
            console.log("[v0] Original material maps:", {
              map: !!newMaterial.map,
              normalMap: !!newMaterial.normalMap,
              roughnessMap: !!newMaterial.roughnessMap,
              metalnessMap: !!newMaterial.metalnessMap,
            })
            
            // Применяем только параметры без перезаписи текстур
            if (materialSettings.roughness !== undefined) {
              newMaterial.roughness = materialSettings.roughness
            }
            if (materialSettings.metalness !== undefined) {
              newMaterial.metalness = materialSettings.metalness
            }
            newMaterial.envMapIntensity = envIntensity
          }
        } else {
          newMaterial = createPBRMaterial(
            materialSettings,
            colorMap,
            normalMap,
            roughnessMap,
            metalnessMap,
            hueShiftedColorMap,
            normalScaleVector,
            envIntensity,
            tintColor,
            textureScale
          )
        }

        // Освобождаем старый материал (кроме оригинального)
        if (child.material && !child.userData.isOriginalMaterial) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }

        child.material = newMaterial
        
        // Enable double-sided rendering for pottery wheel mode to avoid culled faces
        if (usePotteryMode && newMaterial instanceof THREE.Material) {
          newMaterial.side = THREE.DoubleSide
        }
        
        child.userData.isOriginalMaterial = hasOriginal && !hasCustomTextures && renderMode === "pbr"
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // structure only: a new material is built when the *kind* of material changes;
    // slider values are applied in place by the effect below (no new materials per tick)
    scene,
    renderMode,
    matcapTexture,
    matcapNormalMap,
    gradientSettings,
    colorMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    materialSettings.transmission > 0,
    usePotteryMode,
  ])

  // live parameters: update existing materials in place
  useEffect(() => {
    if (!scene) return
    const s = materialSettings
    const isGlass = s.transmission > 0
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const m = child.material as any
      if (!m) return
      if (m.isShaderMaterial && m.uniforms?.matcap) {
        m.uniforms.normalIntensity.value = matcapSettings?.normalIntensity || 1
        m.uniforms.rimIntensity.value = matcapSettings?.rimIntensity || 0
        m.uniforms.rimPower.value = matcapSettings?.rimPower || 3
        m.uniforms.rimColor.value.set(matcapSettings?.rimColor || "#ffffff")
        if (m.uniforms.uHueShift) m.uniforms.uHueShift.value = (matcapSettings as any)?.hueShift || 0
        return
      }
      if (!m.isMeshStandardMaterial) return
      m.roughness = s.roughness ?? 0.5
      m.metalness = s.metalness ?? 0
      m.envMapIntensity = envIntensity
      if (child.userData.isOriginalMaterial) return
      if (m.map) m.map.repeat.set(textureScale, textureScale)
      ;[m.normalMap, m.roughnessMap, m.metalnessMap].forEach((t: THREE.Texture | null) => t?.repeat.set(textureScale, textureScale))
      if (m.normalMap && normalScaleVector) m.normalScale.copy(normalScaleVector)
      if (isGlass) m.color.set(s.glassColorIntensity > 0 ? s.glassColor : "#ffffff")
      else m.color.set(s.useHueShift ? "#ffffff" : s.colorTint || "#ffffff")
      if (m.isMeshPhysicalMaterial) {
        m.transmission = s.transmission ?? 0
        m.ior = s.ior ?? 1.5
        m.thickness = isGlass ? (s.thickness ?? 0.5) * 0.5 : s.thickness ?? 0.5
        m.attenuationDistance = s.attenuationDistance ?? 2
        m.attenuationColor.set(s.attenuationColor || "#ffffff")
        m.clearcoat = s.clearcoat ?? 0
        m.clearcoatRoughness = s.clearcoatRoughness ?? 0
        m.reflectivity = s.reflectivity ?? 0.5
        m.iridescence = s.iridescence ?? 0
        m.iridescenceIOR = s.iridescenceIOR ?? 1.3
        m.iridescenceThicknessRange = [s.iridescenceThicknessMin ?? 100, s.iridescenceThicknessMax ?? 400]
      }
      setMaterialHue(m, s.useHueShift ? s.hueShift : 0)
    })
  }, [scene, materialSettings, envIntensity, textureScale, normalScaleVector, matcapSettings, renderMode, matcapTexture, gradientSettings, colorMap, normalMap, roughnessMap, metalnessMap, usePotteryMode])



  function processGltf(gltf: any) {
    try {
      const loadedScene = gltf.scene
      
      if (!loadedScene) {
        handleError("No scene found in model")
        return
      }
      
      // centre each mesh's geometry first, so the fit below measures the final layout
      // (previously the offset was computed before centring, which shifted models on first load)
      loadedScene.traverse((child: any) => {
        if (child instanceof Mesh && child.geometry && !child.geometry.userData.kkCentered) {
          child.geometry.center()
          child.geometry.userData.kkCentered = true
        }
      })

      // Scale model so it's visible
      const box = new THREE.Box3().setFromObject(loadedScene)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      
      if (maxDim === 0) {
        handleError("Model has no dimensions")
        return
      }
      
      const scale = 2 / maxDim
      loadedScene.scale.multiplyScalar(scale)
      
      // Center model
      box.setFromObject(loadedScene)
      const center = box.getCenter(new THREE.Vector3())
      loadedScene.position.copy(center.multiplyScalar(-1))
      
      // Сохраняем оригинальные материалы и геометрию модели в userData
      loadedScene.traverse((child) => {
        if (child instanceof Mesh) {
          
          // Клонируем оригинальный материал
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.userData.originalMaterials = child.material.map(m => m.clone())
            } else {
              child.userData.originalMaterial = child.material.clone()
            }
          }
          
          // Сохраняем оригинальную геометрию для inflation
          if (child.geometry) {
            child.userData.originalGeometry = child.geometry.clone()
          }
        }
      })
      
      setScene(loadedScene)
      setError(null)
      setLoading(false)
    } catch (err) {
      console.error("[v0] Error processing GLTF:", err)
      handleError("Error processing model")
    }
  }
  
  function handleError(message: string) {
    console.error("[v0]", message)
    setError(message)
    setScene(null)
    setLoading(false)
    if (onError) {
      onError(message)
    }
  }

  const handleSphereTransform = () => {
    if (inflateControlRef.current && onInflateSphereMove) {
      const pos = inflateControlRef.current.position
      onInflateSphereMove([pos.x, pos.y, pos.z])
    }
  }

  const handleTransformStart = () => {
    // Отключаем OrbitControls когда пользователь тащит стрелки
    if (controls) {
      controls.enabled = false
    }
  }

  const handleTransformEnd = () => {
    // Включаем OrbitControls обратно когда отпустили стрелки
    if (controls) {
      controls.enabled = true
    }
  }

  if (loading) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#888888" wireframe />
      </mesh>
    )
  }

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff0000" wireframe />
      </mesh>
    )
  }

  if (!scene) {
    return (
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    )
  }

  return <primitive object={scene} />
}

function createPBRMaterial(
  settings: any,
  colorMap: THREE.Texture | null | undefined,
  normalMap: THREE.Texture | null | undefined,
  roughnessMap: THREE.Texture | null | undefined,
  metalnessMap: THREE.Texture | null | undefined,
  hueShiftedColorMap: THREE.Texture | null | undefined,
  normalScaleVector: THREE.Vector2 | null | undefined,
  envIntensity: number,
  tintColor: THREE.Color | undefined,
  textureScale: number,
): THREE.MeshPhysicalMaterial {
  const finalColorMap = settings.useHueShift ? hueShiftedColorMap : colorMap
  const finalTintColor = settings.useHueShift 
    ? new THREE.Color("#ffffff") 
    : (tintColor || new THREE.Color(settings.colorTint || "#ffffff"))

  // Настраиваем текстуры с правильным масштабом
  const textures = [finalColorMap, normalMap, roughnessMap, metalnessMap]
  textures.forEach((tex, index) => {
    if (tex) {
      const cs = index === 0 ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
      if (tex.wrapS !== THREE.RepeatWrapping || tex.wrapT !== THREE.RepeatWrapping || tex.colorSpace !== cs) {
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = cs
        if (tex.image) tex.needsUpdate = true
      }
      tex.repeat.set(textureScale, textureScale)
      // upload only if wrap / colour space actually changed (handled by three on first use)
    }
  })

  // Проверяем является ли это стеклянным материалом
  const isGlass = settings.transmission > 0
  
  // Для стекла используем glassColor, для остальных - tintColor
  const materialColor = isGlass
    ? (settings.glassColorIntensity > 0
        ? new THREE.Color(settings.glassColor)
        : new THREE.Color(0xffffff))
    : finalTintColor

  const material = new THREE.MeshPhysicalMaterial({
    color: materialColor,
    map: isGlass ? null : (finalColorMap || null),
    normalMap: isGlass ? null : (normalMap || null),
    roughnessMap: isGlass ? null : (roughnessMap || null),
    metalnessMap: isGlass ? null : (metalnessMap || null),
    roughness: settings.roughness ?? 0.5,
    metalness: settings.metalness ?? 0,
    envMapIntensity: envIntensity,
    // Glass properties
    transmission: settings.transmission ?? 0,
    ior: settings.ior ?? 1.5,
    thickness: isGlass ? (settings.thickness ?? 0.5) * 0.5 : (settings.thickness ?? 0.5),
    attenuationDistance: settings.attenuationDistance ?? 2.0,
    attenuationColor: isGlass
      ? new THREE.Color(settings.attenuationColor || "#ffffff")
      : (settings.attenuationColor ? new THREE.Color(settings.attenuationColor) : new THREE.Color("#ffffff")),
    transparent: isGlass || false,
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide, // glass: see the far side / inner layers
    clearcoat: settings.clearcoat ?? 0,
    clearcoatRoughness: settings.clearcoatRoughness ?? 0,
    clearcoatNormalScale: new THREE.Vector2(settings.clearcoatNormalScale ?? 1, settings.clearcoatNormalScale ?? 1),
    reflectivity: settings.reflectivity ?? 0.5,
    iridescence: settings.iridescence ?? 0,
    iridescenceIOR: settings.iridescenceIOR ?? 1.3,
    iridescenceThicknessRange: [settings.iridescenceThicknessMin ?? 100, settings.iridescenceThicknessMax ?? 400],
  })

  if (normalMap && normalScaleVector) {
    material.normalScale = normalScaleVector
  }

  return material
}

function createMatcapMaterial(
  matcapTexture: THREE.Texture | null | undefined,
  matcapNormalMap?: THREE.Texture | null,
  matcapSettings?: {
    normalIntensity: number
    rimIntensity: number
    rimPower: number
    rimColor: string
  }
): THREE.ShaderMaterial {
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
    ${HUE_GLSL}

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
      if (uHueShift != 0.0) matcapColor.rgb = kkHueShift(matcapColor.rgb, uHueShift);

      // Apply rim lighting with color
      float rim = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
      rim = pow(rim, rimPower);
      vec3 rimLight = rimColor * rimIntensity * rim;

      gl_FragColor = vec4(matcapColor.rgb + rimLight, matcapColor.a);
    }
  `

  return new THREE.ShaderMaterial({
    uniforms: {
      matcap: { value: matcapTexture },
      normalMap: { value: matcapNormalMap || null },
      normalIntensity: { value: matcapSettings?.normalIntensity || 1 },
      rimIntensity: { value: matcapSettings?.rimIntensity || 0 },
      rimPower: { value: matcapSettings?.rimPower || 3 },
      rimColor: { value: new THREE.Color(matcapSettings?.rimColor || "#ffffff") },
      hasNormalMap: { value: !!matcapNormalMap },
      uHueShift: { value: (matcapSettings as any)?.hueShift || 0 },
    },
    vertexShader,
    fragmentShader,
    extensions: { derivatives: true },
    side: THREE.FrontSide,
  })
}
