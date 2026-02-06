'use client'

import React, { useMemo, useState } from 'react'
import * as THREE from 'three'

interface ProceduralShapeParams {
  baseRadius: number
  height: number
  segments: number
  twistAmount: number
  bulgeFactor: number
  indentFactor: number
  bulgeFrequency: number // Количество волн выпуклостей по высоте (0 = нет волн, 10 = много волн)
  topSharpness: number // 0 = плоская, 1 = острая вершина
  bottomSharpness: number // 0 = плоское дно, 1 = острый низ
  noiseScale: number
  randomSeed: number
}

/**
 * Generate a procedural pottery-like shape using lathe geometry with twist and bulge deformations
 */
export function createProceduralShape(params: ProceduralShapeParams): THREE.BufferGeometry {
  const {
    baseRadius,
    height,
    segments,
    twistAmount,
    bulgeFactor,
    indentFactor,
    bulgeFrequency,
    topSharpness,
    bottomSharpness,
    noiseScale,
    randomSeed,
  } = params

  // Generate points for a lathe profile that will be twisted and deformed
  const points: THREE.Vector2[] = []

  // Use seeded random for reproducibility
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  // Create the profile curve with bulges and indents (больше сегментов = более гладкая форма)
  const profileSegments = Math.max(64, Math.floor(height * 32))
  for (let i = 0; i <= profileSegments; i++) {
    const t = i / profileSegments // 0 to 1
    const y = (t - 0.5) * height

    // Add organic variation to the radius using seeded noise
    let radiusVar = 1
    const noiseVal1 = seededRandom(randomSeed + i * 0.1) * 2 - 1
    const noiseVal2 = seededRandom(randomSeed + i * 0.2 + 100) * 2 - 1

    // Базовая форма - синусоида для плавного булжа в центре
    const bulgeSin = Math.sin(t * Math.PI) // Peak at center, 0 at edges
    
    // Волны частоты работают ВСЮ высоту, не затухая
    const waveAmount = Math.sin(t * Math.PI * bulgeFrequency)
    const indentAmount = waveAmount * indentFactor
    
    // Булж комбинируется с основной формой
    const bulgeAmount = bulgeSin * bulgeFactor
    
    // Основные деформации: булж и волны
    radiusVar += (bulgeAmount - indentAmount) * 0.5
    radiusVar += noiseVal1 * noiseScale * 0.1
    radiusVar += noiseVal2 * noiseScale * 0.05

    // Теперь применяем шейпнесс более мягко - расширяем волны к верхушке/дну вместо их подавления
    // При t=0 или t=1, радиус минимален (закрыто) но волны добавляют "пузырьки"
    // Этот эффект трансформирует волны в округлые выпуклости на верхушке/дне
    
    if (t < 0.2) {
      // К низу: позволяем волнам создать округлые выпуклости
      const bottomTaper = t / 0.2 // 0 to 1
      // Используем bottomSharpness: 0 = мягкое округлое дно, 1 = острое заострение
      // Вместо того чтобы убивать волны, мы их усиливаем в выпуклости
      const bottomCurve = Math.pow(bottomTaper, 2 - bottomSharpness * 1.5)
      radiusVar *= bottomCurve
    } else if (t > 0.8) {
      // К верхушке: позволяем волнам создать округлые выпуклости
      const topTaper = (1 - t) / 0.2 // 0 to 1
      // Используем topSharpness: 0 = мягкое округлое верхушка, 1 = острое заострение
      const topCurve = Math.pow(topTaper, 2 - topSharpness * 1.5)
      radiusVar *= topCurve
    }

    const radius = baseRadius * Math.max(0.001, radiusVar) // Минимальный радиус для закрытия
    points.push(new THREE.Vector2(radius, y))
  }

  // Create lathe geometry from the profile (openEnded: false закрывает верх и низ)
  const latheGeometry = new THREE.LatheGeometry(points, segments, 0, Math.PI * 2)

  // Apply twist deformation
  if (twistAmount !== 0) {
    const positions = latheGeometry.attributes.position
    const positionArray = positions.array as Float32Array

    for (let i = 0; i < positionArray.length; i += 3) {
      const x = positionArray[i]
      const y = positionArray[i + 1]
      const z = positionArray[i + 2]

      // Calculate angle in XZ plane
      const angle = Math.atan2(z, x)
      // Normalize y to 0-1 range
      const normalizedY = (y + height / 2) / height

      // Apply twist: increase rotation based on y position
      const twistAngle = normalizedY * twistAmount
      const cos = Math.cos(twistAngle)
      const sin = Math.sin(twistAngle)

      // Rotate the XZ coordinates
      const distance = Math.sqrt(x * x + z * z)
      const newAngle = angle + twistAngle

      positionArray[i] = distance * Math.cos(newAngle)
      positionArray[i + 2] = distance * Math.sin(newAngle)
    }

    positions.needsUpdate = true
  }

  // Recalculate normals after deformation
  latheGeometry.computeVertexNormals()
  latheGeometry.computeBoundingBox()
  latheGeometry.computeBoundingSphere()

  return latheGeometry
}

export type { ProceduralShapeParams }
