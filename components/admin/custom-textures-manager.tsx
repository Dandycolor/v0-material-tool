'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { CUSTOM_TEXTURES } from '@/lib/resources'

interface TextureMap {
  id: string
  name: string
  type: 'normal' | 'roughness' | 'metalness' | 'other'
  url: string
  preview?: string
  active: boolean
}

export function CustomTexturesManager() {
  const [textures, setTextures] = useState<TextureMap[]>(
    Object.entries(CUSTOM_TEXTURES).flatMap(([category, maps]) =>
      (maps as any[]).map((map, idx) => ({
        id: `${category}_${idx}`,
        name: map.name,
        type: category as any,
        url: map.url,
        preview: map.preview,
        active: true,
      }))
    )
  )

  const [showForm, setShowForm] = useState(false)
  const [newTexture, setNewTexture] = useState<TextureMap>({
    id: `texture_${Date.now()}`,
    name: '',
    type: 'normal',
    url: '',
    active: true,
  })

  const handleAddTexture = () => {
    if (newTexture.name.trim() && newTexture.url.trim()) {
      setTextures([...textures, newTexture])
      setNewTexture({
        id: `texture_${Date.now()}`,
        name: '',
        type: 'normal',
        url: '',
        active: true,
      })
      setShowForm(false)
    }
  }

  const handleDeleteTexture = (id: string) => {
    setTextures(textures.filter(t => t.id !== id))
  }

  const handleToggleActive = (id: string) => {
    setTextures(textures.map(t => t.id === id ? { ...t, active: !t.active } : t))
  }

  const groupedByType = textures.reduce((acc, texture) => {
    if (!acc[texture.type]) acc[texture.type] = []
    acc[texture.type].push(texture)
    return acc
  }, {} as Record<string, TextureMap[]>)

  return (
    <div className="space-y-6">
      {!showForm && (
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Texture
        </Button>
      )}

      {showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardHeader>
            <CardTitle className="text-white">Add New Texture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-300">Texture Name</Label>
              <Input
                value={newTexture.name}
                onChange={(e) => setNewTexture({ ...newTexture, name: e.target.value })}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="e.g., Fabric Normal Map"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Texture Type</Label>
              <select
                value={newTexture.type}
                onChange={(e) => setNewTexture({ ...newTexture, type: e.target.value as any })}
                className="w-full bg-[#1a1a1a] border border-[#404040] text-white rounded px-3 py-2 mt-1"
              >
                <option value="normal">Normal Map</option>
                <option value="roughness">Roughness Map</option>
                <option value="metalness">Metalness Map</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label className="text-zinc-300">Texture URL</Label>
              <Input
                value={newTexture.url}
                onChange={(e) => setNewTexture({ ...newTexture, url: e.target.value })}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="https://example.com/texture.jpg"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1 border-[#404040]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddTexture}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                Add Texture
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Textures by Type */}
      {Object.entries(groupedByType).map(([type, textureList]) => (
        <div key={type}>
          <h3 className="text-white font-medium mb-3 capitalize">{type} Maps ({textureList.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {textureList.map((texture) => (
              <Card key={texture.id} className={`bg-[#2a2a2a] border-[#404040] overflow-hidden ${!texture.active ? 'opacity-50' : ''}`}>
                <div className="relative w-full aspect-square bg-[#1a1a1a]">
                  {texture.preview && (
                    <img
                      src={texture.preview}
                      alt={texture.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                </div>
                <CardContent className="pt-3 pb-2">
                  <p className="text-white text-xs font-medium truncate">{texture.name}</p>
                  
                  <div className="flex gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(texture.id)}
                      className="flex-1 text-zinc-400 hover:text-white h-7"
                      title={texture.active ? 'Deactivate' : 'Activate'}
                    >
                      {texture.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-red-400 hover:text-red-300 h-7"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#2a2a2a] border-[#404040]">
                        <AlertDialogTitle className="text-white">Delete Texture</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Delete "{texture.name}"? This cannot be undone.
                        </AlertDialogDescription>
                        <div className="flex gap-2">
                          <AlertDialogCancel className="border-[#404040]">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTexture(texture.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {textures.length === 0 && !showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardContent className="pt-6 text-center">
            <p className="text-zinc-500">No custom textures yet. Add one to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
