'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Plus, Eye, EyeOff, Upload } from 'lucide-react'
import { MATCAP_PRESETS } from '@/lib/resources'

interface Matcap {
  id: string
  name: string
  matcap: string
  active: boolean
}

export function MatcapsManager() {
  const [matcaps, setMatcaps] = useState<Matcap[]>(
    Object.entries(MATCAP_PRESETS).map(([key, preset]) => ({
      id: key,
      name: preset.name,
      matcap: preset.matcap,
      active: true,
    }))
  )

  const [showForm, setShowForm] = useState(false)
  const [newMatcap, setNewMatcap] = useState<Matcap>({
    id: `matcap_${Date.now()}`,
    name: '',
    matcap: '',
    active: true,
  })

  const handleAddMatcap = () => {
    if (newMatcap.name.trim() && newMatcap.matcap.trim()) {
      setMatcaps([...matcaps, { ...newMatcap, id: `matcap_${Date.now()}` }])
      setNewMatcap({
        id: `matcap_${Date.now()}`,
        name: '',
        matcap: '',
        active: true,
      })
      setShowForm(false)
    }
  }

  const handleDeleteMatcap = (id: string) => {
    setMatcaps(matcaps.filter(m => m.id !== id))
  }

  const handleToggleActive = (id: string) => {
    setMatcaps(matcaps.map(m => m.id === id ? { ...m, active: !m.active } : m))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setNewMatcap({ ...newMatcap, matcap: url, name: newMatcap.name || file.name.replace(/\.[^/.]+$/, "") })
    }
  }

  return (
    <div className="space-y-6">
      {!showForm && (
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Matcap
        </Button>
      )}

      {showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardHeader>
            <CardTitle className="text-white">Add New Matcap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-300">Matcap Name</Label>
              <Input
                value={newMatcap.name}
                onChange={(e) => setNewMatcap({ ...newMatcap, name: e.target.value })}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="e.g., Clay Render"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Upload Matcap Image</Label>
              <div className="mt-2 flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] border border-[#404040] border-dashed rounded-lg cursor-pointer hover:bg-[#252525] transition-colors">
                  <Upload className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-400 text-sm">Choose file or drag here</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {newMatcap.matcap && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#404040]">
                    <img src={newMatcap.matcap} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-zinc-300">Or paste URL</Label>
              <Input
                value={newMatcap.matcap}
                onChange={(e) => setNewMatcap({ ...newMatcap, matcap: e.target.value })}
                className="bg-[#1a1a1a] border-[#404040] text-white mt-1"
                placeholder="https://example.com/matcap.jpg"
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
                onClick={handleAddMatcap}
                disabled={!newMatcap.name || !newMatcap.matcap}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                Add Matcap
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matcaps Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {matcaps.map((matcap) => (
          <Card key={matcap.id} className={`bg-[#2a2a2a] border-[#404040] overflow-hidden group ${!matcap.active ? 'opacity-50' : ''}`}>
            <div className="relative w-full aspect-square bg-[#1a1a1a]">
              <img
                src={matcap.matcap}
                alt={matcap.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder.png'
                }}
              />
              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleActive(matcap.id)}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title={matcap.active ? 'Deactivate' : 'Activate'}
                >
                  {matcap.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/20 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#2a2a2a] border-[#404040]">
                    <AlertDialogTitle className="text-white">Delete Matcap</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      Delete &quot;{matcap.name}&quot;? This cannot be undone.
                    </AlertDialogDescription>
                    <div className="flex gap-2">
                      <AlertDialogCancel className="border-[#404040]">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteMatcap(matcap.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <CardContent className="p-2">
              <p className="text-white text-xs font-medium truncate text-center">{matcap.name}</p>
              {!matcap.active && <p className="text-zinc-500 text-[10px] text-center">Inactive</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {matcaps.length === 0 && !showForm && (
        <Card className="bg-[#2a2a2a] border-[#404040]">
          <CardContent className="pt-6 text-center">
            <p className="text-zinc-500">No matcaps yet. Add one to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
