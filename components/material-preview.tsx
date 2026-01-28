"use client"

import Image from "next/image"

interface MaterialPreviewProps {
  baseColorUrl: string
  isSelected: boolean
  onClick: () => void
  name: string
}

export function MaterialPreview({ baseColorUrl, isSelected, onClick, name }: MaterialPreviewProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative aspect-square rounded-lg overflow-hidden transition-all bg-[#2a2a2a]
        ${isSelected ? "ring-2 ring-[#00b8c4] ring-offset-2 ring-offset-[#1c1c1c]" : "hover:ring-1 hover:ring-[#3a3a3a]"}
      `}
      title={name}
    >
      <div className="w-full h-full flex items-center justify-center p-2">
        <div className="relative w-full h-full rounded-full overflow-hidden shadow-lg">
          {/* Display base color texture as circular preview */}
          <Image src={baseColorUrl || "/placeholder.svg"} alt={name} fill className="object-cover" unoptimized />
        </div>
      </div>
    </button>
  )
}
