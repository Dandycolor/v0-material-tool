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

    // Apply bulge/indent with sinusoidal variation
    const bulgeSin = Math.sin(t * Math.PI) // Peak in the middle
    const bulgeAmount = bulgeSin * bulgeFactor
    // Используем bulgeFrequency для контроля количества волн
    const indentAmount = Math.sin(t * Math.PI * bulgeFrequency) * indentFactor

    // Combine all radius variations
    radiusVar += (bulgeAmount - indentAmount) * 0.5
    radiusVar += noiseVal1 * noiseScale * 0.1
    radiusVar += noiseVal2 * noiseScale * 0.05

    const radius = baseRadius * Math.max(0.1, radiusVar)
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
