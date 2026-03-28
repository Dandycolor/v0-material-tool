"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PBRMaterialsManager } from "@/components/admin/pbr-materials-manager"
import { MatcapsManager } from "@/components/admin/matcaps-manager"
import { CustomTexturesManager } from "@/components/admin/custom-textures-manager"
import { Icons3DManager } from "@/components/icons-3d-manager"
import { MATERIAL_PRESETS, MATCAP_PRESETS, CUSTOM_TEXTURES } from "@/lib/resources"
import Link from "next/link"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("materials")
  
  const materialsCount = Object.keys(MATERIAL_PRESETS).length
  const matcapsCount = Object.keys(MATCAP_PRESETS).length
  const texturesCount = CUSTOM_TEXTURES.normal.length + CUSTOM_TEXTURES.roughness.length + CUSTOM_TEXTURES.metalness.length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#404040] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-zinc-500 text-sm">Manage materials, textures, and 3D resources</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="border-[#404040] text-zinc-300 hover:text-white">
              Back to Editor
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-[#2a2a2a] border border-[#404040]">
            <TabsTrigger value="materials" className="text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-[#1a1a1a]">
              Materials
            </TabsTrigger>
            <TabsTrigger value="matcaps" className="text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-[#1a1a1a]">
              Matcaps
            </TabsTrigger>
            <TabsTrigger value="textures" className="text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-[#1a1a1a]">
              Textures
            </TabsTrigger>
            <TabsTrigger value="icons" className="text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-[#1a1a1a]">
              3D Icons
            </TabsTrigger>
          </TabsList>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-4 mt-6">
            <Card className="bg-[#2a2a2a] border-[#404040]">
              <CardHeader>
                <CardTitle className="text-white">PBR Materials</CardTitle>
                <CardDescription>Add, edit, or delete PBR materials with metalness, roughness, and other parameters</CardDescription>
              </CardHeader>
            </Card>
            <PBRMaterialsManager />
          </TabsContent>

          {/* Matcaps Tab */}
          <TabsContent value="matcaps" className="space-y-4 mt-6">
            <Card className="bg-[#2a2a2a] border-[#404040]">
              <CardHeader>
                <CardTitle className="text-white">Matcap Textures</CardTitle>
                <CardDescription>Manage matcap lighting environments - add new ones or remove existing</CardDescription>
              </CardHeader>
            </Card>
            <MatcapsManager />
          </TabsContent>

          {/* Textures Tab */}
          <TabsContent value="textures" className="space-y-4 mt-6">
            <Card className="bg-[#2a2a2a] border-[#404040]">
              <CardHeader>
                <CardTitle className="text-white">Custom Textures</CardTitle>
                <CardDescription>Manage normal, roughness, and metalness texture maps</CardDescription>
              </CardHeader>
            </Card>
            <CustomTexturesManager />
          </TabsContent>

          {/* 3D Icons Tab */}
          <TabsContent value="icons" className="space-y-4 mt-6">
            <Card className="bg-[#2a2a2a] border-[#404040]">
              <CardHeader>
                <CardTitle className="text-white">3D Icons Library</CardTitle>
                <CardDescription>Upload and manage 3D icon models from your archive</CardDescription>
              </CardHeader>
            </Card>
            <Icons3DManager />
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-12">
          <Card className="bg-[#2a2a2a] border-[#404040]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">{materialsCount}</p>
              <p className="text-zinc-400 text-sm">PBR Materials</p>
            </CardContent>
          </Card>
          <Card className="bg-[#2a2a2a] border-[#404040]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">{matcapsCount}</p>
              <p className="text-zinc-400 text-sm">Matcaps</p>
            </CardContent>
          </Card>
          <Card className="bg-[#2a2a2a] border-[#404040]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-zinc-500">0</p>
              <p className="text-zinc-400 text-sm">3D Icons</p>
            </CardContent>
          </Card>
          <Card className="bg-[#2a2a2a] border-[#404040]">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">{texturesCount}</p>
              <p className="text-zinc-400 text-sm">Custom Textures</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
