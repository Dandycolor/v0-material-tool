'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Edit2, Plus, Eye, EyeOff } from 'lucide-react'
import { MATERIAL_PRESETS } from '@/lib/resources'

interface Material {
  id: string
  name: string
  metalness: number
  roughness: number
  ior?: number
  transmission?: number
  active: boolean
  colorMap?: string
  normalMap?: string
  roughnessMap?: string
  metalnessMap?: string
}

export function PBRMaterialsManager() {
  const [materials, setMaterials] = useState<Material[]>(
    Object.entries(MATERIAL_PRESETS).map(([key, preset]) => ({
      id: key,
      name: preset.name,
      metalness: preset.metalness,
      roughness: preset.roughness,
      ior: preset.ior,
      transmission: preset.transmission,
      active: true,
      colorMap: preset.colorMap,
      normalMap: preset.normalMap,
      roughnessMap: preset.roughnessMap,
      metalnessMap: preset.metalnessMap,
    }))
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newMaterial, setNewMaterial] = useState<Material>({
    id: `material_${Date.now()}`,
    name: '',
    metalness: 0.5,
    roughness: 0.5,
    active: true,
  })

  const handleAddMaterial = () => {
    if (newMaterial.name.trim()) {
      setMaterials([...materials, newMaterial])
      setNewMaterial({
        id: `material_${Date.now()}`,
        name: '',
        metalness: 0.5,
        roughness: 0.5,
        active: true,
      })
      setShowForm(false)
    }
  }

  const handleUpdateMaterial = (id: string, updates: Partial<Material>) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  const handleDeleteMaterial = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id))
  }

  const handleToggleActive = (id: string) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, active: !m.active } : m))
  }

  const editingMaterial = editingId ? materials.find(m => m.id === editingId) : null

  return (
    <div className="space-y-6">
      {/* Add New Material Button */}
      {!showForm && !editingId && (
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New PBR Material
        </Button>
      )}

      {/* Add/Edit Form */}
      {(showForm || editingId) && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardHeader>
            <CardTitle className="text-white">{editingId ? 'Edit Material' : 'Add New Material'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-300">Material Name</Label>
              <Input
                value={editingId ? editingMaterial?.name : newMaterial.name}
                onChange={(e) => {
                  if (editingId && editingMaterial) {
                    handleUpdateMaterial(editingId, { name: e.target.value })
                  } else {
                    setNewMaterial({ ...newMaterial, name: e.target.value })
                  }
                }}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="e.g., Brushed Steel"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Metalness: {editingId ? editingMaterial?.metalness.toFixed(2) : newMaterial.metalness.toFixed(2)}</Label>
              <Slider
                value={[editingId ? editingMaterial?.metalness ?? 0.5 : newMaterial.metalness]}
                onValueChange={(val) => {
                  if (editingId) {
                    handleUpdateMaterial(editingId, { metalness: val[0] })
                  } else {
                    setNewMaterial({ ...newMaterial, metalness: val[0] })
                  }
                }}
                min={0}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Roughness: {editingId ? editingMaterial?.roughness.toFixed(2) : newMaterial.roughness.toFixed(2)}</Label>
              <Slider
                value={[editingId ? editingMaterial?.roughness ?? 0.5 : newMaterial.roughness]}
                onValueChange={(val) => {
                  if (editingId) {
                    handleUpdateMaterial(editingId, { roughness: val[0] })
                  } else {
                    setNewMaterial({ ...newMaterial, roughness: val[0] })
                  }
                }}
                min={0}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-zinc-300">IOR (Optional): {editingId ? editingMaterial?.ior?.toFixed(2) : newMaterial.ior?.toFixed(2)}</Label>
              <Slider
                value={[editingId ? editingMaterial?.ior ?? 1.5 : newMaterial.ior ?? 1.5]}
                onValueChange={(val) => {
                  if (editingId) {
                    handleUpdateMaterial(editingId, { ior: val[0] })
                  } else {
                    setNewMaterial({ ...newMaterial, ior: val[0] })
                  }
                }}
                min={1}
                max={2.5}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Transmission (Optional): {editingId ? editingMaterial?.transmission?.toFixed(2) : newMaterial.transmission?.toFixed(2)}</Label>
              <Slider
                value={[editingId ? editingMaterial?.transmission ?? 0 : newMaterial.transmission ?? 0]}
                onValueChange={(val) => {
                  if (editingId) {
                    handleUpdateMaterial(editingId, { transmission: val[0] })
                  } else {
                    setNewMaterial({ ...newMaterial, transmission: val[0] })
                  }
                }}
                min={0}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={editingId ? () => setEditingId(null) : () => setShowForm(false)}
                variant="outline"
                className="flex-1 border-[#404040]"
              >
                Cancel
              </Button>
              <Button
                onClick={editingId ? () => setEditingId(null) : handleAddMaterial}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {editingId ? 'Save Changes' : 'Add Material'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials Grid */}
      <div className="grid gap-4">
        {materials.map((material) => (
          <Card key={material.id} className={`bg-[#2a2a2a] border-[#404040] ${!material.active ? 'opacity-50' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{material.name}</h3>
                  <p className="text-zinc-500 text-sm">
                    M: {material.metalness.toFixed(2)} | R: {material.roughness.toFixed(2)}
                    {material.ior && ` | IOR: ${material.ior.toFixed(2)}`}
                    {material.transmission ? ` | Trans: ${material.transmission.toFixed(2)}` : ''}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(material.id)}
                    className="text-zinc-400 hover:text-white"
                    title={material.active ? 'Deactivate' : 'Activate'}
                  >
                    {material.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(material.id)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#2a2a2a] border-[#404040]">
                      <AlertDialogTitle className="text-white">Delete Material</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Are you sure you want to delete "{material.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                      <div className="flex gap-2">
                        <AlertDialogCancel className="border-[#404040]">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && !showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardContent className="pt-6 text-center">
            <p className="text-zinc-500">No PBR materials yet. Create one to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
