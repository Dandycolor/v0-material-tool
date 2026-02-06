'use client'

import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createProceduralShape, type ProceduralShapeParams } from './procedural-shape-generator'
import type { MaterialSettings } from './pbr-viewer'

interface ProceduralShapeMeshProps {
  params: ProceduralShapeParams
  materialSettings: MaterialSettings
  renderMode: 'pbr' | 'matcap'
  colorMap: THREE.Texture | null
  normalMap: THREE.Texture | null
  roughnessMap: THREE.Texture | null
  metalnessMap: THREE.Texture | null
  hueShiftedColorMap: THREE.Texture | null
  normalScaleVector: THREE.Vector2 | null
  envIntensity: number
  tintColor: THREE.Color
  textureScale: number
  matcapTexture: THREE.Texture | null
  matcapNormalMap: THREE.Texture | null
  matcapSettings: any
  gradientSettings: any
}

export function ProceduralShapeMesh({
  params,
  materialSettings,
  renderMode,
  colorMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  hueShiftedColorMap,
  normalScaleVector,
  envIntensity,
  tintColor,
  textureScale,
  matcapTexture,
  matcapNormalMap,
  matcapSettings,
  gradientSettings,
}: ProceduralShapeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)

  // Create procedural geometry
  const geometry = useMemo(() => {
    return createProceduralShape(params)
  }, [params])

  // Update rotation for visual effect
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002
    }
  })

  // Create material
  const material = useMemo(() => {
    if (renderMode === 'matcap' && matcapTexture) {
      return new THREE.MeshMatcapMaterial({
        matcap: matcapTexture,
        normalMap: matcapNormalMap || undefined,
        normalScale: normalScaleVector || new THREE.Vector2(1, 1),
        flatShading: false, // Smooth shading для мягких граней
      })
    }

    const mat = new THREE.MeshStandardMaterial({
      map: hueShiftedColorMap || colorMap,
      normalMap: normalMap || undefined,
      normalScale: normalScaleVector || new THREE.Vector2(1, 1),
      roughnessMap: roughnessMap || undefined,
      metalnessMap: metalnessMap || undefined,
      roughness: materialSettings.roughness ?? 0.5,
      metalness: materialSettings.metalness ?? 0,
      color: tintColor,
      side: THREE.FrontSide,
      flatShading: false, // Smooth shading для мягких граней
      transmission: materialSettings.transmission ?? 0,
      ior: materialSettings.ior ?? 1.5,
      thickness: materialSettings.thickness ?? 0.5,
      attenuationDistance: materialSettings.attenuationDistance ?? 2.0,
      attenuationColor: new THREE.Color(materialSettings.attenuationColor || '#ffffff'),
      clearcoat: materialSettings.clearcoat ?? 0,
      clearcoatRoughness: materialSettings.clearcoatRoughness ?? 0.1,
      clearcoatNormalMap: normalMap || undefined,
      clearcoatNormalScale: new THREE.Vector2(
        materialSettings.clearcoatNormalScale ?? 1.0,
        materialSettings.clearcoatNormalScale ?? 1.0
      ),
      iridescence: materialSettings.iridescence ?? 0,
      iridescenceIOR: materialSettings.iridescenceIOR ?? 1.3,
      iridescenceThicknessRange: [
        materialSettings.iridescenceThicknessMin ?? 100,
        materialSettings.iridescenceThicknessMax ?? 400,
      ],
    })

    return mat
  }, [
    renderMode,
    matcapTexture,
    matcapNormalMap,
    normalScaleVector,
    hueShiftedColorMap,
    colorMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    materialSettings,
    tintColor,
  ])

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} scale={[1.2, 1.2, 1.2]} />
  )
}
