'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

interface VectorExtrudeProps {
  svgPath: string
  shapeName: string
  depth?: number
  onDepthChange?: (depth: number) => void
}

export function VectorExtrude({
  svgPath,
  shapeName,
  depth = 10,
  onDepthChange,
}: VectorExtrudeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const [currentDepth, setCurrentDepth] = useState(depth)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 100

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    )
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lighting
    const light1 = new THREE.DirectionalLight(0xffffff, 0.8)
    light1.position.set(100, 100, 100)
    scene.add(light1)

    const light2 = new THREE.DirectionalLight(0x0066cc, 0.4)
    light2.position.set(-100, -100, 50)
    scene.add(light2)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)

    // Group for 3D object
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // Load and extrude SVG
    const svgLoader = new SVGLoader()
    svgLoader.load(svgPath, (data) => {
      group.clear()

      const paths = data.paths
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity

      // Calculate bounds
      paths.forEach((path) => {
        const points = path.getPoints()
        points.forEach((point) => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })

      const width = maxX - minX
      const height = maxY - minY
      const scale = Math.min(50 / width, 50 / height)

      // Create extruded geometry for each path
      paths.forEach((path) => {
        const shapes = path.toShapes(true)

        shapes.forEach((shape) => {
          const extrudeSettings = {
            depth: currentDepth,
            bevelEnabled: true,
            bevelThickness: 2,
            bevelSize: 1.5,
            bevelSegments: 3,
          }

          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
          geometry.scale(scale, scale, scale)
          geometry.center()

          const material = new THREE.MeshPhongMaterial({
            color: 0x0066cc,
            shininess: 100,
            side: THREE.DoubleSide,
          })

          const mesh = new THREE.Mesh(geometry, material)
          group.add(mesh)
        })
      })

      // Auto rotate
      group.rotation.x = -0.3
      group.rotation.y = 0.3
    })

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      if (groupRef.current) {
        groupRef.current.rotation.x += 0.002
        groupRef.current.rotation.y += 0.003
      }

      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !renderer) return

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      if (containerRef.current && renderer.domElement.parentNode) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [svgPath])

  // Update depth
  useEffect(() => {
    if (groupRef.current && sceneRef.current && rendererRef.current) {
      // Re-render with new depth
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.z = 100

      rendererRef.current.render(sceneRef.current, camera)
    }
    onDepthChange?.(currentDepth)
  }, [currentDepth, onDepthChange])

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-zinc-300">
        3D Выдавливание: {shapeName}
      </div>

      <div className="rounded-lg overflow-hidden border border-[#3a3a3a] bg-[#1a1a1a]">
        <div
          ref={containerRef}
          className="w-full h-80"
          style={{ minHeight: '320px' }}
        />
      </div>

      <div className="space-y-3 p-3 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a]">
        <Label className="text-zinc-300">Глубина выдавливания: {currentDepth}</Label>
        <Slider
          value={[currentDepth]}
          onValueChange={(val) => setCurrentDepth(val[0])}
          min={1}
          max={50}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  )
}
