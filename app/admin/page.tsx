"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MaterialsManager } from "@/components/materials-manager"
import { Icons3DManager } from "@/components/icons-3d-manager"
import Link from "next/link"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("materials")

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 mt-2">Manage materials, textures, and 3D resources</p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Editor</Button>
          </Link>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="materials" className="text-xs sm:text-sm">Materials</TabsTrigger>
            <TabsTrigger value="matcaps" className="text-xs sm:text-sm">Matcaps</TabsTrigger>
            <TabsTrigger value="icons" className="text-xs sm:text-sm">3D Icons</TabsTrigger>
            <TabsTrigger value="textures" className="text-xs sm:text-sm">Textures</TabsTrigger>
          </TabsList>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-4 mt-6">
            <MaterialsManager />
          </TabsContent>

          {/* Matcaps Tab */}
          <TabsContent value="matcaps" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Matcap Textures</CardTitle>
                <CardDescription>Manage matcap lighting environments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm">Matcap management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3D Icons Tab */}
          <TabsContent value="icons" className="space-y-4 mt-6">
            <Icons3DManager />
          </TabsContent>

          {/* Textures Tab */}
          <TabsContent value="textures" className="space-y-4 mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Texture Maps</CardTitle>
                <CardDescription>Manage color, normal, roughness, and metalness maps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {["Color Maps", "Normal Maps", "Roughness Maps", "Metalness Maps"].map((type) => (
                    <div key={type} className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                      <p className="text-white font-medium mb-3">{type}</p>
                      <Button size="sm" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
                        Upload {type}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">12</p>
              <p className="text-slate-400 text-sm">Materials</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">8</p>
              <p className="text-slate-400 text-sm">Matcaps</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">240</p>
              <p className="text-slate-400 text-sm">3D Icons</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-400">45</p>
              <p className="text-slate-400 text-sm">Textures</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
