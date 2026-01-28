"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"

interface LightRotationControlProps {
  value: number // rotation in radians
  onChange: (value: number) => void
}

export function LightRotationControl({ value, onChange }: LightRotationControlProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const angleDegrees = Math.round((value * 180) / Math.PI)

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    updateAngle(e)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return
    updateAngle(e)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const updateAngle = (e: PointerEvent | React.PointerEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = e.clientX - centerX
    const dy = e.clientY - centerY

    // Calculate angle in radians (0 = top, clockwise)
    let angle = Math.atan2(dy, dx) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2

    onChange(angle)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)

      return () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }
    }
  }, [isDragging])

  // Calculate sun icon position on the circle border
  const iconAngle = value - Math.PI / 2 // Offset for top position
  const radius = 78 // Position on circle border
  const iconX = Math.cos(iconAngle) * radius + 80
  const iconY = Math.sin(iconAngle) * radius + 80

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="relative w-40 h-40 cursor-pointer" onPointerDown={handlePointerDown}>
        {/* Outer circle border - white */}
        <div className="absolute inset-0 rounded-full border-2 border-white" />

        {/* Inner circle (center) */}
        <div className="absolute inset-8 rounded-full bg-[#2a2a2a]" />

        {/* Sun icon positioned on circle line */}
        <div
          className="absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center"
          style={{
            left: `${iconX}px`,
            top: `${iconY}px`,
          }}
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
