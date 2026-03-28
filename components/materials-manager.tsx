"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Material {
  id: number
  name: string
  type: "pbr" | "matcap"
  metalness?: number
  roughness?: number
  ior?: number
  transmission?: number
  matcapUrl?: string
}

export function MaterialsManager() {
  const [materials, setMaterials] = useState<Material[]>([
    { id: 1, name: "Glossy Red", type: "pbr", metalness: 0.1, roughness: 0.2 },
    { id: 2, name: "Brushed Steel", type: "pbr", metalness: 0.8, roughness: 0.6 },
    { id: 3, name: "Glass", type: "pbr", metalness: 0, roughness: 0.1, ior: 1.5, transmission: 0.95 },
  ])

  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    name: "",
    type: "pbr",
    metalness: 0.5,
    roughness: 0.5,
  })

  const handleAddMaterial = () => {
    if (!newMaterial.name) return

    const material: Material = {
      id: Math.max(...materials.map(m => m.id), 0) + 1,
      name: newMaterial.name,
      type: newMaterial.type || "pbr",
      metalness: newMaterial.metalness || 0.5,
      roughness: newMaterial.roughness || 0.5,
      ior: newMaterial.ior || 1.5,
      transmission: newMaterial.transmission || 0,
    }

    setMaterials([...materials, material])
    setNewMaterial({ name: "", type: "pbr", metalness: 0.5, roughness: 0.5 })
  }

  const handleDeleteMaterial = (id: number) => {
    setMaterials(materials.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {materials.map((material) => (
          <Card key={material.id} className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{material.name}</h3>
                  <p className="text-slate-400 text-sm capitalize">{material.type} Material</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-950"
                  onClick={() => handleDeleteMaterial(material.id)}
                >
                  Delete
                </Button>
              </div>

              {material.type === "pbr" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-300">Metalness: {material.metalness}</Label>
                    <Slider
                      value={[material.metalness || 0.5]}
                      min={0}
                      max={1}
                      step={0.01}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Roughness: {material.roughness}</Label>
                    <Slider
                      value={[material.roughness || 0.5]}
                      min={0}
                      max={1}
                      step={0.01}
                      className="mt-1"
                    />
                  </div>
                  {material.transmission !== undefined && material.transmission > 0 && (
                    <>
                      <div>
                        <Label className="text-xs text-slate-300">IOR: {material.ior}</Label>
                        <Slider
                          value={[material.ior || 1.5]}
                          min={1}
                          max={2.5}
                          step={0.01}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Transmission: {material.transmission}</Label>
                        <Slider
                          value={[material.transmission || 0]}
                          min={0}
                          max={1}
                          step={0.01}
                          className="mt-1"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">Add New Material</Button>
        </DialogTrigger>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Material</DialogTitle>
            <DialogDescription>Create a new PBR or Matcap material</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Material Name</Label>
              <Input
                placeholder="e.g. Polished Gold"
                value={newMaterial.name || ""}
                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Type</Label>
              <Select value={newMaterial.type || "pbr"} onValueChange={(type) => setNewMaterial({ ...newMaterial, type: type as "pbr" | "matcap" })}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="pbr">PBR Material</SelectItem>
                  <SelectItem value="matcap">Matcap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newMaterial.type === "pbr" && (
              <>
                <div>
                  <Label className="text-slate-300">Metalness: {(newMaterial.metalness || 0.5).toFixed(2)}</Label>
                  <Slider
                    value={[newMaterial.metalness || 0.5]}
                    onValueChange={([v]) => setNewMaterial({ ...newMaterial, metalness: v })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Roughness: {(newMaterial.roughness || 0.5).toFixed(2)}</Label>
                  <Slider
                    value={[newMaterial.roughness || 0.5]}
                    onValueChange={([v]) => setNewMaterial({ ...newMaterial, roughness: v })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleAddMaterial}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              disabled={!newMaterial.name}
            >
              Create Material
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
