"use client"

import { useRef } from "react"
import { useEffect, useState } from "react"
import { useLoader } from "@react-three/fiber"
import * as THREE from "three"
import { Mesh } from "three"
import { useThree } from "@react-three/fiber"
import { TransformControls } from "@react-three/drei"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { createGradientMaterial } from "./gradient-shader"

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

  // Load model when modelUrl changes
  useEffect(() => {
    if (!modelUrl) {
      setLoading(false)
      return
    }

    setLoading(true)
    let isMounted = true
    
    const loader = new GLTFLoader()
    
    loader.load(
      modelUrl,
      (gltf) => {
        if (!isMounted) return
        
        try {
          const loadedScene = gltf.scene
          
          // Center and scale the model
          const box = new THREE.Box3().setFromObject(loadedScene)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          
          loadedScene.position.sub(center)
          loadedScene.scale.setScalar(scale)
          setModelSize(maxDim * scale)
          
          // Store original geometry for inflation
          loadedScene.traverse((child) => {
            if (child instanceof Mesh) {
              child.userData.originalGeometry = child.geometry.clone()
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          
          setScene(loadedScene)
          setLoading(false)
        } catch (err) {
          handleError("Error processing model")
          setLoading(false)
        }
      },
      undefined,
      (error) => {
        if (isMounted) {
          console.error("[v0] GLTF load error:", error)
          handleError("Failed to load model. Please check the file format.")
          setLoading(false)
        }
      }
    )
    
    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    console.log("[v0] Applying materials - hasCustomTextures:", hasCustomTextures, "renderMode:", renderMode)

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
          console.log("[v0] Using original GLB material")
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
              color: new THREE.Color(0xffffff),
              map: null,
              normalMap: null,
              roughnessMap: null,
              metalnessMap: null,
              roughness: materialSettings.roughness ?? 0.05,
              metalness: materialSettings.metalness ?? 0,
              envMapIntensity: 1.5,
              // Glass properties
              transmission: materialSettings.transmission ?? 0,
              ior: materialSettings.ior ?? 1.5,
              thickness: materialSettings.thickness ?? 0.5,
              attenuationDistance: materialSettings.attenuationDistance ?? 100,
              attenuationColor: materialSettings.attenuationColor ? new THREE.Color(materialSettings.attenuationColor) : new THREE.Color("#ffffff"),
              transparent: true,
              opacity: 1,
              side: THREE.DoubleSide,
              depthWrite: false,
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
          console.log("[v0] Creating base PBR material")
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
  }, [
    scene,
    renderMode,
    matcapTexture,
    matcapNormalMap,
    matcapSettings,
    materialSettings,
    colorMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    hueShiftedColorMap,
    normalScaleVector,
    envIntensity,
    tintColor,
    textureScale,
    usePotteryMode,
  ])



  function processGltf(gltf: any) {
    try {
      const loadedScene = gltf.scene
      
      if (!loadedScene) {
        handleError("No scene found in model")
        return
      }
      
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
          // Center geometry
          if (child.geometry) {
            child.geometry.center()
          }
          
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
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(textureScale, textureScale)
      // colorMap должен использовать sRGB, остальные - Linear
      tex.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
      // Only mark for update if texture has image data
      if (tex.image) {
        tex.needsUpdate = true
      }
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
    envMapIntensity: isGlass ? 1.5 : envIntensity,
    // Glass properties
    transmission: settings.transmission ?? 0,
    ior: settings.ior ?? 1.5,
    thickness: settings.thickness ?? 0.5,
    attenuationDistance: settings.attenuationDistance ?? 2.0,
    attenuationColor: isGlass
      ? new THREE.Color(settings.attenuationColor || "#ffffff")
      : (settings.attenuationColor ? new THREE.Color(settings.attenuationColor) : new THREE.Color("#ffffff")),
    transparent: true,
    opacity: isGlass ? 1 : 1,
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: !isGlass,
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

  return new THREE.ShaderMaterial({
    uniforms: {
      matcap: { value: matcapTexture },
      normalMap: { value: matcapNormalMap || null },
      normalIntensity: { value: matcapSettings?.normalIntensity || 1 },
      rimIntensity: { value: matcapSettings?.rimIntensity || 0 },
      rimPower: { value: matcapSettings?.rimPower || 3 },
      rimColor: { value: new THREE.Color(matcapSettings?.rimColor || "#ffffff") },
      hasNormalMap: { value: !!matcapNormalMap },
    },
    vertexShader,
    fragmentShader,
    extensions: { derivatives: true },
    side: THREE.FrontSide,
  })
}
