"use client"

import { Suspense, useEffect, useRef } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, useGLTF, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { useViewerStore } from "@/lib/store"
import { createGradientMaterial } from "./gradient-material"
import type { GradientConfig, PBRConfig } from "@/lib/types"

// ── Grid ──────────────────────────────────────────────────────────────────────
function Grid({ visible }: { visible: boolean }) {
  if (!visible) return null
  const grid = new THREE.GridHelper(20, 20, "#2a2a2a", "#1e1e1e")
  grid.position.y = -1.2
  return <primitive object={grid} />
}

// ── Material builder ───────────────────────────────────────────────────────────
function buildPBRMaterial(cfg: PBRConfig): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.colorTint),
    roughness: cfg.roughness,
    metalness: cfg.metalness,
    transmission: cfg.transmission,
    ior: cfg.ior,
    thickness: cfg.thickness,
    clearcoat: cfg.clearcoat,
    clearcoatRoughness: cfg.clearcoatRoughness,
    iridescence: cfg.iridescence,
    iridescenceIOR: cfg.iridescenceIOR,
    envMapIntensity: cfg.envMapIntensity,
  })
  mat.normalScale.set(cfg.normalScale, cfg.normalScale)
  mat.displacementScale = cfg.displacementScale
  return mat
}

// ── GLTF Model ────────────────────────────────────────────────────────────────
function GLTFModel({ url, material }: { url: string; material: THREE.Material | null }) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    if (!material) return
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        ;(child as THREE.Mesh).material = material
      }
    })
  }, [scene, material])

  return <primitive object={scene} dispose={null} />
}

// ── Default sphere fallback ───────────────────────────────────────────────────
function DefaultSphere({ material }: { material: THREE.Material | null }) {
  if (!material) return null
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// ── Scene content ─────────────────────────────────────────────────────────────
function SceneContent() {
  const {
    activeMaterialId,
    activeModelId,
    renderMode,
    showGrid,
    showWireframeOverlay,
    materials,
    models,
    lighting,
    pbrOverride,
    gradientOverride,
  } = useViewerStore()

  const activeMaterial = materials.find((m) => m.id === activeMaterialId) ?? null
  const activeModel    = models.find((m) => m.id === activeModelId) ?? null

  // Build Three.js material
  let threeMat: THREE.Material | null = null

  if (activeMaterial) {
    if (activeMaterial.type === "gradient") {
      const cfg = { ...activeMaterial.config, ...gradientOverride } as GradientConfig
      threeMat = createGradientMaterial(cfg)
    } else if (activeMaterial.type === "pbr") {
      const cfg = { ...activeMaterial.config, ...pbrOverride } as PBRConfig
      threeMat = buildPBRMaterial(cfg)
    } else if (activeMaterial.type === "wireframe") {
      const wCfg = activeMaterial.config as { color: string; opacity: number }
      threeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(wCfg.color),
        wireframe: true,
        transparent: wCfg.opacity < 1,
        opacity: wCfg.opacity,
      })
    }
  }

  // Wireframe overlay
  const wireframeMat = showWireframeOverlay
    ? new THREE.MeshBasicMaterial({ color: "#444", wireframe: true })
    : null

  return (
    <>
      <Environment preset={lighting.envMap as any} backgroundIntensity={0} />

      <ambientLight intensity={lighting.ambientIntensity} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={lighting.directionalIntensity}
        castShadow
      />

      <Grid visible={showGrid} />

      <Suspense fallback={null}>
        {activeModel ? (
          <GLTFModel url={activeModel.glb_url} material={threeMat} />
        ) : (
          <DefaultSphere material={threeMat} />
        )}
        {wireframeMat && activeModel ? (
          <GLTFModel url={activeModel.glb_url} material={wireframeMat} />
        ) : wireframeMat ? (
          <DefaultSphere material={wireframeMat} />
        ) : null}
      </Suspense>

      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />

      <OrbitControls
        makeDefault
        minDistance={1.5}
        maxDistance={20}
        enablePan={true}
      />
    </>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────
export function ViewerScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ background: "#0b0b0b" }}
    >
      <SceneContent />
    </Canvas>
  )
}
