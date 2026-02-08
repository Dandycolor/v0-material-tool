"use client"

import React from "react"

import { useThree, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useRef, useEffect, useState } from "react"

interface PaintModeProps {
  enabled: boolean
  brushSize: number
  brushStrength: number
  activeLayer: string // "pbr" | "custom" | "gradient"
  meshRef: React.RefObject<THREE.Mesh>
  onMaskUpdate: (layer: string, maskTexture: THREE.Texture) => void
}

export function PaintMode({ 
  enabled, 
  brushSize, 
  brushStrength, 
  activeLayer, 
  meshRef,
  onMaskUpdate 
}: PaintModeProps) {
  const { camera, raycaster, gl, scene } = useThree()
  const [isPainting, setIsPainting] = useState(false)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskTextureRef = useRef<THREE.CanvasTexture | null>(null)

  // Create mask canvas and texture for the active layer
  useEffect(() => {
    if (!enabled) return

    // Create offscreen canvas for mask
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Initialize with white (fully opaque)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    maskCanvasRef.current = canvas
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    maskTextureRef.current = texture

    onMaskUpdate(activeLayer, texture)

    return () => {
      texture.dispose()
    }
  }, [enabled, activeLayer, onMaskUpdate])

  // Handle mouse events
  useEffect(() => {
    if (!enabled || !meshRef.current) return

    const handlePointerDown = (event: PointerEvent) => {
      setIsPainting(true)
      paintAtPointer(event)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (isPainting) {
        paintAtPointer(event)
      }
    }

    const handlePointerUp = () => {
      setIsPainting(false)
    }

    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [enabled, isPainting, meshRef, gl.domElement])

  const paintAtPointer = (event: PointerEvent) => {
    if (!meshRef.current || !maskCanvasRef.current || !maskTextureRef.current) return

    const canvas = gl.domElement
    const rect = canvas.getBoundingClientRect()
    
    // Convert mouse position to normalized device coordinates
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    // Raycast to find intersection with mesh
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(meshRef.current, false)

    if (intersects.length > 0) {
      const intersect = intersects[0]
      const uv = intersect.uv

      if (uv) {
        // Paint on mask canvas
        const ctx = maskCanvasRef.current.getContext('2d')
        if (ctx) {
          const x = uv.x * maskCanvasRef.current.width
          const y = (1 - uv.y) * maskCanvasRef.current.height

          // Create gradient brush for smooth edges
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize)
          gradient.addColorStop(0, `rgba(0, 0, 0, ${brushStrength})`)
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

          ctx.fillStyle = gradient
          ctx.fillRect(
            x - brushSize, 
            y - brushSize, 
            brushSize * 2, 
            brushSize * 2
          )

          // Update texture
          maskTextureRef.current.needsUpdate = true
          onMaskUpdate(activeLayer, maskTextureRef.current)
        }
      }
    }
  }

  return null
}
