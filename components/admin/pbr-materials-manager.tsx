'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Plus, Eye, EyeOff, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useResources } from '@/lib/resources-context'
import { CUSTOM_TEXTURES } from '@/lib/resources'

export function PBRMaterialsManager() {
  const { materials, updateMaterial, deleteMaterial, addMaterial } = useResources()
  
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [texturePickerFor, setTexturePickerFor] = useState<{ materialId: string, mapType: 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'baseColor' } | null>(null)
  
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    metalness: 0.5,
    roughness: 0.5,
    ior: 1.5,
    transmission: 0,
  })

  const materialsList = Object.values(materials)

  const handleAddMaterial = () => {
    if (newMaterial.name.trim()) {
      const id = `material_${Date.now()}`
      addMaterial({
        id,
        name: newMaterial.name,
        metalness: newMaterial.metalness,
        roughness: newMaterial.roughness,
        ior: newMaterial.ior,
        transmission: newMaterial.transmission,
        active: true,
      })
      setNewMaterial({
        name: '',
        metalness: 0.5,
        roughness: 0.5,
        ior: 1.5,
        transmission: 0,
      })
      setShowForm(false)
    }
  }

  const handleToggleActive = (id: string) => {
    const material = materials[id]
    if (material) {
      updateMaterial(id, { active: !material.active })
    }
  }

  const handleUpdateMaterial = (id: string, updates: Record<string, any>) => {
    updateMaterial(id, updates)
  }

  const handleSetTexture = (url: string) => {
    if (texturePickerFor) {
      updateMaterial(texturePickerFor.materialId, { [texturePickerFor.mapType]: url })
      setTexturePickerFor(null)
    }
  }

  const handleRemoveTexture = (materialId: string, mapType: string) => {
    updateMaterial(materialId, { [mapType]: null })
  }

  // Get available textures for picker based on map type
  const getTexturesForType = (mapType: string) => {
    switch (mapType) {
      case 'normalMap':
        return CUSTOM_TEXTURES.normal
      case 'roughnessMap':
        return CUSTOM_TEXTURES.roughness
      case 'metalnessMap':
        return CUSTOM_TEXTURES.metalness
      default:
        return []
    }
  }

  return (
    <div className="space-y-4">
      {/* Add New Material Button */}
      <Button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add New PBR Material
      </Button>

      {/* New Material Form */}
      {showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-medium text-white">New Material</h3>
            
            <div>
              <Label className="text-zinc-400">Material Name</Label>
              <Input
                value={newMaterial.name}
                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                placeholder="Enter material name"
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400">Metalness: {newMaterial.metalness.toFixed(2)}</Label>
                <Slider
                  value={[newMaterial.metalness]}
                  onValueChange={([v]) => setNewMaterial({ ...newMaterial, metalness: v })}
                  min={0}
                  max={1}
                  step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Roughness: {newMaterial.roughness.toFixed(2)}</Label>
                <Slider
                  value={[newMaterial.roughness]}
                  onValueChange={([v]) => setNewMaterial({ ...newMaterial, roughness: v })}
                  min={0}
                  max={1}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddMaterial} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                Add Material
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1 border-[#404040]">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      <div className="space-y-3">
        {materialsList.map((material) => (
          <Card 
            key={material.id} 
            className={`bg-[#2a2a2a] border-[#404040] ${!material.active ? 'opacity-50' : ''}`}
          >
            <CardContent className="p-4">
              {/* Material Header */}
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                  {material.baseColor ? (
                    <img src={material.baseColor} alt={material.name} className="w-full h-full object-cover" />
                  ) : material.normalMap ? (
                    <img src={material.normalMap} alt={material.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-800" />
                  )}
                </div>

                {/* Name & Info */}
                <div className="flex-1">
                  <h4 className="text-white font-medium">{material.name}</h4>
                  <p className="text-sm text-zinc-500">
                    M: {material.metalness.toFixed(2)} | R: {material.roughness.toFixed(2)}
                    {material.ior && ` | IOR: ${material.ior}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                    className="text-zinc-400 hover:text-white"
                  >
                    {expandedId === material.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleToggleActive(material.id)}
                    className={material.active ? "text-cyan-400 hover:text-cyan-300" : "text-zinc-600 hover:text-zinc-400"}
                  >
                    {material.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#2a2a2a] border-[#404040]">
                      <AlertDialogTitle className="text-white">Delete Material?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will permanently delete &quot;{material.name}&quot;. This action cannot be undone.
                      </AlertDialogDescription>
                      <div className="flex gap-2 justify-end mt-4">
                        <AlertDialogCancel className="bg-[#1a1a1a] border-[#404040] text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteMaterial(material.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === material.id && (
                <div className="mt-4 pt-4 border-t border-[#404040] space-y-4">
                  {/* Sliders */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-zinc-400">Metalness: {material.metalness.toFixed(2)}</Label>
                      <Slider
                        value={[material.metalness]}
                        onValueChange={([v]) => handleUpdateMaterial(material.id, { metalness: v })}
                        min={0}
                        max={1}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400">Roughness: {material.roughness.toFixed(2)}</Label>
                      <Slider
                        value={[material.roughness]}
                        onValueChange={([v]) => handleUpdateMaterial(material.id, { roughness: v })}
                        min={0}
                        max={1}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Texture Maps */}
                  <div>
                    <Label className="text-zinc-400 mb-3 block">Texture Maps</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {/* Base Color */}
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Base Color</p>
                        <div 
                          className="aspect-square bg-[#1a1a1a] rounded-lg border border-[#404040] relative overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors"
                          onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'baseColor' })}
                        >
                          {material.baseColor ? (
                            <>
                              <img src={material.baseColor} alt="Base Color" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTexture(material.id, 'baseColor'); }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Plus className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Normal Map */}
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Normal Map</p>
                        <div 
                          className="aspect-square bg-[#1a1a1a] rounded-lg border border-[#404040] relative overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors"
                          onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'normalMap' })}
                        >
                          {material.normalMap ? (
                            <>
                              <img src={material.normalMap} alt="Normal" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTexture(material.id, 'normalMap'); }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Plus className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Roughness Map */}
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Roughness Map</p>
                        <div 
                          className="aspect-square bg-[#1a1a1a] rounded-lg border border-[#404040] relative overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors"
                          onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'roughnessMap' })}
                        >
                          {material.roughnessMap ? (
                            <>
                              <img src={material.roughnessMap} alt="Roughness" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTexture(material.id, 'roughnessMap'); }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Plus className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metalness Map */}
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Metalness Map</p>
                        <div 
                          className="aspect-square bg-[#1a1a1a] rounded-lg border border-[#404040] relative overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors"
                          onClick={() => setTexturePickerFor({ materialId: material.id, mapType: 'metalnessMap' })}
                        >
                          {material.metalnessMap ? (
                            <>
                              <img src={material.metalnessMap} alt="Metalness" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTexture(material.id, 'metalnessMap'); }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Plus className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Texture Picker Modal */}
      {texturePickerFor && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setTexturePickerFor(null)}>
          <div className="bg-[#2a2a2a] rounded-lg border border-[#404040] max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                Select {texturePickerFor.mapType.replace('Map', '')} Texture
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setTexturePickerFor(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-5 gap-3">
              {getTexturesForType(texturePickerFor.mapType).map((tex) => (
                <div
                  key={tex.id}
                  className="aspect-square bg-[#1a1a1a] rounded-lg border border-[#404040] overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors"
                  onClick={() => handleSetTexture(tex.url)}
                >
                  <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
