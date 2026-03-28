"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MaterialsManager } from "@/components/materials-manager"
import { Icons3DManager } from "@/components/icons-3d-manager"
import { MATCAP_PRESETS, CUSTOM_TEXTURES } from "@/lib/resources"
import Link from "next/link"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("materials")
  
  const materialsCount = Object.keys(MATERIAL_PRESETS).length
  const matcapsCount = Object.keys(MATCAP_PRESETS).length
  const texturesCount = CUSTOM_TEXTURES.normal.length + CUSTOM_TEXTURES.roughness.length + CUSTOM_TEXTURES.metalness.length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-zinc-400 mt-2">Manage materials, textures, and 3D resources</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="border-[#333] bg-[#1a1a1a] text-white hover:bg-[#252525]">
              Back to Editor
            </Button>
          </Link>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-[#1a1a1a] border border-[#2a2a2a]">
            <TabsTrigger value="materials" className="text-xs sm:text-sm data-[state=active]:bg-[#2a2a2a]">Materials</TabsTrigger>
            <TabsTrigger value="matcaps" className="text-xs sm:text-sm data-[state=active]:bg-[#2a2a2a]">Matcaps</TabsTrigger>
            <TabsTrigger value="icons" className="text-xs sm:text-sm data-[state=active]:bg-[#2a2a2a]">3D Icons</TabsTrigger>
            <TabsTrigger value="textures" className="text-xs sm:text-sm data-[state=active]:bg-[#2a2a2a]">Textures</TabsTrigger>
          </TabsList>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-4 mt-6">
            <MaterialsManager />
          </TabsContent>

          {/* Matcaps Tab */}
          <TabsContent value="matcaps" className="space-y-4 mt-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-white">Matcap Textures ({Object.values(MATCAP_PRESETS).length})</CardTitle>
                <CardDescription className="text-zinc-400">Pre-baked lighting environments for stylized rendering</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {Object.values(MATCAP_PRESETS).map((matcap) => (
                    <div key={matcap.id} className="group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-[#252525] border border-[#333] hover:border-[#444] transition-colors">
                        <img 
                          src={matcap.matcap} 
                          alt={matcap.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1.5 truncate text-center">{matcap.name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3D Icons Tab */}
          <TabsContent value="icons" className="space-y-4 mt-6">
            <Icons3DManager />
          </TabsContent>

          {/* Textures Tab */}
          <TabsContent value="textures" className="space-y-4 mt-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-white">Texture Maps</CardTitle>
                <CardDescription className="text-zinc-400">Individual texture maps for custom material creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Normal Maps */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Normal Maps ({CUSTOM_TEXTURES.normal.length})</h4>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {CUSTOM_TEXTURES.normal.map((tex) => (
                      <div key={tex.id} className="group">
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
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Roughness Maps ({CUSTOM_TEXTURES.roughness.length})</h4>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {CUSTOM_TEXTURES.roughness.map((tex) => (
                      <div key={tex.id} className="group">
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
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Metalness Maps ({CUSTOM_TEXTURES.metalness.length})</h4>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {CUSTOM_TEXTURES.metalness.map((tex) => (
                      <div key={tex.id} className="group">
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
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-8">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-emerald-400">{materialsCount}</p>
              <p className="text-zinc-400 text-sm">PBR Materials</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-emerald-400">{matcapsCount}</p>
              <p className="text-zinc-400 text-sm">Matcaps</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-zinc-500">0</p>
              <p className="text-zinc-400 text-sm">3D Icons</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-emerald-400">{texturesCount}</p>
              <p className="text-zinc-400 text-sm">Custom Textures</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
