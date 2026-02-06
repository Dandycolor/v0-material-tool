'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

const POTTERY_SHAPES = [
  { name: 'Union 1', path: '/pottery-shapes/union-1.svg' },
  { name: 'Union 2', path: '/pottery-shapes/union-2.svg' },
  { name: 'Union 3', path: '/pottery-shapes/union-3.svg' },
  { name: 'Union 4', path: '/pottery-shapes/union-4.svg' },
  { name: 'Union', path: '/pottery-shapes/union.svg' },
]

interface PotteryWheelProps {
  svgPath: string
  shapeName: string
  rotationSpeed: number
  onRotationSpeedChange?: (speed: number) => void
}

// Parse SVG path and extract points
function parseSVGPath(pathData: string): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  if (!pathData) return points

  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []
  let currentX = 0
  let currentY = 0

  commands.forEach((command) => {
    const type = command[0]
    const numbers = command
      .slice(1)
      .match(/-?[\d.]+/g)
      ?.map(Number) || []

    switch (type) {
      case 'M':
      case 'm': {
        const x = type === 'M' ? numbers[0] : currentX + numbers[0]
        const y = type === 'M' ? numbers[1] : currentY + numbers[1]
        currentX = x
        currentY = y
        points.push(new THREE.Vector3(x / 100, -y / 100, 0))
        break
      }
      case 'L':
      case 'l': {
        const x = type === 'L' ? numbers[0] : currentX + numbers[0]
        const y = type === 'L' ? numbers[1] : currentY + numbers[1]
        currentX = x
        currentY = y
        points.push(new THREE.Vector3(x / 100, -y / 100, 0))
        break
      }
      case 'H':
      case 'h': {
        const x = type === 'H' ? numbers[0] : currentX + numbers[0]
        currentX = x
        points.push(new THREE.Vector3(x / 100, -currentY / 100, 0))
        break
      }
      case 'V':
      case 'v': {
        const y = type === 'V' ? numbers[0] : currentY + numbers[0]
        currentY = y
        points.push(new THREE.Vector3(currentX / 100, -y / 100, 0))
        break
      }
      case 'Z':
      case 'z':
        break
    }
  })

  return points.length > 0 ? points : [new THREE.Vector3(0, 0, 0)]
}

function PotteryGeometry({
  svgPath,
  rotationSpeed,
}: {
  svgPath: string
  rotationSpeed: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    const loadSVG = async () => {
      try {
        const response = await fetch(svgPath)
        const svgText = await response.text()

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
        const pathElements = svgDoc.querySelectorAll('path')

        let allPoints: THREE.Vector3[] = []

        pathElements.forEach((pathElement) => {
          const d = pathElement.getAttribute('d')
          if (d) {
            const points = parseSVGPath(d)
            allPoints = allPoints.concat(points)
          }
        })

        if (allPoints.length < 2) {
          console.warn('[v0] No valid path points found')
          return
        }

        // Remove duplicate consecutive points
        allPoints = allPoints.filter((point, index) => {
          if (index === 0) return true
          const prev = allPoints[index - 1]
          return !point.equals(prev)
        })

        const latheGeometry = new THREE.LatheGeometry(allPoints, 64, 0, Math.PI * 2)
        latheGeometry.center()
        setGeometry(latheGeometry)
      } catch (error) {
        console.error('[v0] Error loading SVG:', error)
      }
    }

    loadSVG()
  }, [svgPath])

  useFrame(() => {
    if (meshRef.current && rotationSpeed > 0) {
      meshRef.current.rotation.y += rotationSpeed * 0.01
    }
  })

  if (!geometry) {
    return null
  }

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial
        color="#a0826d"
        emissive="#5a4a3a"
        shininess={25}
        wireframe={false}
      />
    </mesh>
  )
}

export function PotteryWheel({
  svgPath,
  shapeName,
  rotationSpeed,
  onRotationSpeedChange,
}: PotteryWheelProps) {
  const [speed, setSpeed] = useState(rotationSpeed)
  const [selectedShape, setSelectedShape] = useState(svgPath)

  const handleSpeedChange = (value: number[]) => {
    setSpeed(value[0])
    onRotationSpeedChange?.(value[0])
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm text-zinc-400 mb-3 block">Скорость вращения</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[speed]}
            onValueChange={handleSpeedChange}
            min={0}
            max={3}
            step={0.1}
            className="flex-1"
          />
          <span className="text-sm text-zinc-500 min-w-fit font-mono">{speed.toFixed(1)}</span>
        </div>
      </div>

      <div>
        <Label className="text-sm text-zinc-400 mb-3 block">Форма профиля</Label>
        <div className="grid grid-cols-2 gap-2">
          {POTTERY_SHAPES.map((shape) => (
            <button
              key={shape.path}
              onClick={() => setSelectedShape(shape.path)}
              className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                selectedShape === shape.path
                  ? 'border-amber-600 bg-amber-600/20 text-amber-300'
                  : 'border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {shape.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-96 rounded-lg border border-zinc-700 bg-zinc-900/50 overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[5, 5, 8]} intensity={1} />
          <pointLight position={[-5, -5, 5]} intensity={0.5} />
          <pointLight position={[0, 10, -10]} intensity={0.6} />

          <PotteryGeometry svgPath={selectedShape} rotationSpeed={speed} />

          <OrbitControls
            enableZoom
            enablePan
            enableRotate
            autoRotate={false}
          />
        </Canvas>
      </div>

      <div className="text-xs text-zinc-500 space-y-1 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800">
        <p>💡 Вращайте профиль мышью для изучения формы</p>
        <p>🎯 Текущая форма: {POTTERY_SHAPES.find((s) => s.path === selectedShape)?.name}</p>
      </div>
    </div>
  )
}
