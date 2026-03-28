'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Edit2, Plus, Eye, EyeOff, X, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { MATERIAL_PRESETS, CUSTOM_TEXTURES } from '@/lib/resources'

interface Material {
  id: string
  name: string
  metalness: number
  roughness: number
  ior?: number
  transmission?: number
  active: boolean
  baseColor?: string | null
  normalMap?: string | null
  roughnessMap?: string | null
  metalnessMap?: string | null
  defaultTint?: string
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
      baseColor: preset.baseColor,
      normalMap: preset.normalMap,
      roughnessMap: preset.roughnessMap,
      metalnessMap: (preset as any).metalnessMap,
      defaultTint: preset.defaultTint,
    }))
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [texturePickerFor, setTexturePickerFor] = useState<{ materialId: string, mapType: 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'baseColor' } | null>(null)
  
  const [newMaterial, setNewMaterial] = useState<Material>({
    id: `material_${Date.now()}`,
    name: '',
    metalness: 0.5,
    roughness: 0.5,
    active: true,
  })

  const handleAddMaterial = () => {
    if (newMaterial.name.trim()) {
      setMaterials([...materials, { ...newMaterial, id: `material_${Date.now()}` }])
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
    if (editingId === id) setEditingId(null)
    if (expandedId === id) setExpandedId(null)
  }

  const handleToggleActive = (id: string) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, active: !m.active } : m))
  }

  const handleSelectTexture = (textureUrl: string) => {
    if (texturePickerFor) {
      handleUpdateMaterial(texturePickerFor.materialId, { [texturePickerFor.mapType]: textureUrl })
      setTexturePickerFor(null)
    }
  }

  const handleClearTexture = (materialId: string, mapType: string) => {
    handleUpdateMaterial(materialId, { [mapType]: null })
  }

  const editingMaterial = editingId ? materials.find(m => m.id === editingId) : null

  // Get available textures for picker
  const getTexturesForType = (mapType: string) => {
    if (mapType === 'normalMap') return CUSTOM_TEXTURES.normal
    if (mapType === 'roughnessMap') return CUSTOM_TEXTURES.roughness
    if (mapType === 'metalnessMap') return CUSTOM_TEXTURES.metalness
    return []
  }

  return (
    <div className="space-y-6">
      {/* Texture Picker Modal */}
      {texturePickerFor && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <Card className="bg-[#2a2a2a] border-[#404040] max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">
                Select {texturePickerFor.mapType.replace('Map', ' Map').replace(/([A-Z])/g, ' $1').trim()}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setTexturePickerFor(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {getTexturesForType(texturePickerFor.mapType).map((tex) => (
                  <button
                    key={tex.id}
                    onClick={() => handleSelectTexture(tex.url)}
                    className="aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border-2 border-transparent hover:border-cyan-500 transition-colors"
                  >
                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#404040]">
                <Label className="text-zinc-300 text-sm">Or upload custom texture:</Label>
                <label className="mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] border border-[#404040] border-dashed rounded-lg cursor-pointer hover:bg-[#252525]">
                  <Upload className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-400 text-sm">Choose file</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const url = URL.createObjectURL(file)
                        handleSelectTexture(url)
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Add Form */}
      {showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardHeader>
            <CardTitle className="text-white">Add New Material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-300">Material Name</Label>
              <Input
                value={newMaterial.name}
                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="e.g., Brushed Steel"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Metalness: {newMaterial.metalness.toFixed(2)}</Label>
                <Slider
                  value={[newMaterial.metalness]}
                  onValueChange={(val) => setNewMaterial({ ...newMaterial, metalness: val[0] })}
                  min={0} max={1} step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Roughness: {newMaterial.roughness.toFixed(2)}</Label>
                <Slider
                  value={[newMaterial.roughness]}
                  onValueChange={(val) => setNewMaterial({ ...newMaterial, roughness: val[0] })}
                  min={0} max={1} step={0.01}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1 border-[#404040]">
                Cancel
              </Button>
              <Button onClick={handleAddMaterial} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white">
                Add Material
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      <div className="space-y-3">
        {materials.map((material) => (
          <Card key={material.id} className={`bg-[#2a2a2a] border-[#404040] ${!material.active ? 'opacity-50' : ''}`}>
            <CardContent className="pt-4">
              {/* Header Row */}
              <div className="flex items-center gap-4">
                {/* Preview Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040] flex-shrink-0">
                  {material.baseColor ? (
                    <img src={material.baseColor} alt={material.name} className="w-full h-full object-cover" />
                  ) : material.normalMap ? (
                    <img src={material.normalMap} alt={material.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">No preview</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{material.name}</h3>
                  <p className="text-zinc-500 text-sm">
                    M: {material.metalness.toFixed(2)} | R: {material.roughness.toFixed(2)}
                    {material.transmission ? ` | Trans: ${material.transmission.toFixed(2)}` : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                    className="text-zinc-400 hover:text-white"
                  >
                    {expandedId === material.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(material.id)}
                    className="text-zinc-400 hover:text-white"
                  >
                    {material.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#2a2a2a] border-[#404040]">
                      <AlertDialogTitle className="text-white">Delete Material</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Delete &quot;{material.name}&quot;? This cannot be undone.
                      </AlertDialogDescription>
                      <div className="flex gap-2">
                        <AlertDialogCancel className="border-[#404040]">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteMaterial(material.id)} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Expanded Content - Texture Maps */}
              {expandedId === material.id && (
                <div className="mt-4 pt-4 border-t border-[#404040]">
                  {/* Sliders */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <Label className="text-zinc-400 text-xs">Metalness: {material.metalness.toFixed(2)}</Label>
                      <Slider
                        value={[material.metalness]}
                        onValueChange={(val) => handleUpdateMaterial(material.id, { metalness: val[0] })}
                        min={0} max={1} step={0.01}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Roughness: {material.roughness.toFixed(2)}</Label>
                      <Slider
                        value={[material.roughness]}
                        onValueChange={(val) => handleUpdateMaterial(material.id, { roughness: val[0] })}
                        min={0} max={1} step={0.01}
                        className="mt-1"
                      />
                    </div>
                    {material.ior !== undefined && (
                      <div>
                        <Label className="text-zinc-400 text-xs">IOR: {material.ior?.toFixed(2)}</Label>
                        <Slider
                          value={[material.ior ?? 1.5]}
                          onValueChange={(val) => handleUpdateMaterial(material.id, { ior: val[0] })}
                          min={1} max={2.5} step={0.01}
                          className="mt-1"
                        />
                      </div>
                    )}
                    {material.transmission !== undefined && (
                      <div>
                        <Label className="text-zinc-400 text-xs">Transmission: {material.transmission?.toFixed(2)}</Label>
                        <Slider
                          value={[material.transmission ?? 0]}
                          onValueChange={(val) => handleUpdateMaterial(material.id, { transmission: val[0] })}
                          min={0} max={1} step={0.01}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Texture Maps */}
                  <Label className="text-zinc-300 text-sm mb-3 block">Texture Maps</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {/* Base Color */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 text-xs">Base Color</p>
                      <button
                        onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'baseColor' })}
                        className="w-full aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040] hover:border-cyan-500 transition-colors relative group"
                      >
                        {material.baseColor ? (
                          <>
                            <img src={material.baseColor} alt="Base Color" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClearTexture(material.id, 'baseColor') }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Normal Map */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 text-xs">Normal Map</p>
                      <button
                        onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'normalMap' })}
                        className="w-full aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040] hover:border-cyan-500 transition-colors relative group"
                      >
                        {material.normalMap ? (
                          <>
                            <img src={material.normalMap} alt="Normal Map" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClearTexture(material.id, 'normalMap') }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Roughness Map */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 text-xs">Roughness Map</p>
                      <button
                        onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'roughnessMap' })}
                        className="w-full aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040] hover:border-cyan-500 transition-colors relative group"
                      >
                        {material.roughnessMap ? (
                          <>
                            <img src={material.roughnessMap} alt="Roughness Map" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClearTexture(material.id, 'roughnessMap') }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Metalness Map */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 text-xs">Metalness Map</p>
                      <button
                        onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'metalnessMap' })}
                        className="w-full aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040] hover:border-cyan-500 transition-colors relative group"
                      >
                        {material.metalnessMap ? (
                          <>
                            <img src={material.metalnessMap} alt="Metalness Map" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClearTexture(material.id, 'metalnessMap') }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
