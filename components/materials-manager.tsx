"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MATERIAL_PRESETS, CUSTOM_TEXTURES } from "@/lib/resources"

export function MaterialsManager() {
  const materials = Object.values(MATERIAL_PRESETS)
  const customTextures = CUSTOM_TEXTURES

  return (
    <div className="space-y-6">
      {/* PBR Materials */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="text-white">PBR Materials ({materials.length})</CardTitle>
          <CardDescription className="text-zinc-400">Textured materials with normal, roughness, and metalness maps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {materials.map((material) => (
              <div 
                key={material.id} 
                className="p-3 bg-[#252525] rounded-lg border border-[#333] hover:border-[#444] transition-colors group"
              >
                {/* Preview */}
                <div className="aspect-square rounded-md overflow-hidden mb-3 bg-[#1a1a1a]">
                  {material.baseColor ? (
                    <img 
                      src={material.baseColor} 
                      alt={material.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                      No texture
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="space-y-1">
                  <p className="text-white text-sm font-medium truncate">{material.name}</p>
                  <div className="flex gap-2 text-xs text-zinc-500">
                    <span>M: {material.metalness}</span>
                    <span>R: {material.roughness}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Textures */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="text-white">Custom PBR Textures</CardTitle>
          <CardDescription className="text-zinc-400">Individual texture maps for custom material creation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Normal Maps */}
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Normal Maps ({customTextures.normal.length})</h4>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {customTextures.normal.map((tex) => (
                <div key={tex.id} className="group relative">
                  <div className="aspect-square rounded-md overflow-hidden bg-[#252525] border border-[#333]">
                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate text-center">{tex.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Roughness Maps */}
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Roughness Maps ({customTextures.roughness.length})</h4>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {customTextures.roughness.map((tex) => (
                <div key={tex.id} className="group relative">
                  <div className="aspect-square rounded-md overflow-hidden bg-[#252525] border border-[#333]">
                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate text-center">{tex.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Metalness Maps */}
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Metalness Maps ({customTextures.metalness.length})</h4>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {customTextures.metalness.map((tex) => (
                <div key={tex.id} className="group relative">
                  <div className="aspect-square rounded-md overflow-hidden bg-[#252525] border border-[#333]">
                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate text-center">{tex.name}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
