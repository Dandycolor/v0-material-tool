'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Download, Copy, ChevronRight } from 'lucide-react'

const VECTOR_PRIMITIVES = [
  { id: 1, name: 'Shape 1', path: '/vector-primitives/shape-1.svg' },
  { id: 2, name: 'Shape 2', path: '/vector-primitives/shape-2.svg' },
  { id: 3, name: 'Shape 3', path: '/vector-primitives/shape-3.svg' },
  { id: 4, name: 'Shape 4', path: '/vector-primitives/shape-4.svg' },
  { id: 5, name: 'Shape 5', path: '/vector-primitives/shape-5.svg' },
  { id: 6, name: 'Shape 6', path: '/vector-primitives/shape-6.svg' },
  { id: 7, name: 'Shape 7', path: '/vector-primitives/shape-7.svg' },
  { id: 8, name: 'Shape 8', path: '/vector-primitives/shape-8.svg' },
  { id: 9, name: 'Shape 9', path: '/vector-primitives/shape-9.svg' },
  { id: 10, name: 'Shape 10', path: '/vector-primitives/shape-10.svg' },
]

interface VectorPrimitivePreviewProps {
  onSelect: (shape: (typeof VECTOR_PRIMITIVES)[0]) => void
  onExtrude: (shape: (typeof VECTOR_PRIMITIVES)[0]) => void
}

export function VectorPrimitivePreview({
  onSelect,
  onExtrude,
}: VectorPrimitivePreviewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const handleSelect = (shape: (typeof VECTOR_PRIMITIVES)[0]) => {
    setSelectedId(shape.id)
    onSelect(shape)
  }

  const handleExtrude = (shape: (typeof VECTOR_PRIMITIVES)[0]) => {
    onExtrude(shape)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-zinc-300">
        Выберите примитив и "выдавите" его в 3D
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {VECTOR_PRIMITIVES.map((shape) => (
          <div
            key={shape.id}
            className="group relative"
            onMouseEnter={() => setHoveredId(shape.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Preview Box */}
            <button
              onClick={() => handleSelect(shape)}
              className={`relative w-full aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                selectedId === shape.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[#3a3a3a] bg-[#2a2a2a] hover:border-blue-400'
              }`}
            >
              {/* SVG Preview */}
              <div className="absolute inset-0 flex items-center justify-center p-3">
                <img
                  src={shape.path || "/placeholder.svg"}
                  alt={shape.name}
                  className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Selection Indicator */}
              {selectedId === shape.id && (
                <div className="absolute inset-0 border-2 border-blue-500 rounded-lg" />
              )}
            </button>

            {/* Shape Name */}
            <div className="mt-2 text-xs text-zinc-400 text-center truncate">
              {shape.name}
            </div>

            {/* Action Buttons - Show on Hover */}
            {(hoveredId === shape.id || selectedId === shape.id) && (
              <div className="absolute -right-10 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Extrude Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExtrude(shape)
                  }}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors"
                  title="Выдавить в 3D"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Download Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const a = document.createElement('a')
                    a.href = shape.path
                    a.download = `${shape.name}.svg`
                    a.click()
                  }}
                  className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white shadow-lg transition-colors"
                  title="Скачать SVG"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Copy SVG Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fetch(shape.path)
                      .then((r) => r.text())
                      .then((svg) => {
                        navigator.clipboard.writeText(svg)
                        alert('SVG скопирован в буфер обмена')
                      })
                  }}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-colors"
                  title="Копировать SVG"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Shape Preview */}
      {selectedId && (
        <div className="mt-6 p-4 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a]">
          <div className="text-sm font-medium text-zinc-300 mb-3">
            Предпросмотр: {VECTOR_PRIMITIVES.find((s) => s.id === selectedId)?.name}
          </div>
          <div className="flex items-center justify-center h-48 bg-[#1a1a1a] rounded border border-[#3a3a3a]">
            <img
              src={
                VECTOR_PRIMITIVES.find((s) => s.id === selectedId)?.path || ''
              }
              alt="Selected shape"
              className="w-32 h-32 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
