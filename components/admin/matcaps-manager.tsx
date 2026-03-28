'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { MATCAP_PRESETS } from '@/lib/resources'
import Image from 'next/image'

interface Matcap {
  id: string
  name: string
  url: string
  preview?: string
  active: boolean
}

export function MatcapsManager() {
  const [matcaps, setMatcaps] = useState<Matcap[]>(
    Object.entries(MATCAP_PRESETS).map(([key, preset]) => ({
      id: key,
      name: preset.name,
      url: preset.url,
      preview: preset.preview,
      active: true,
    }))
  )

  const [showForm, setShowForm] = useState(false)
  const [newMatcap, setNewMatcap] = useState<Matcap>({
    id: `matcap_${Date.now()}`,
    name: '',
    url: '',
    active: true,
  })

  const handleAddMatcap = () => {
    if (newMatcap.name.trim() && newMatcap.url.trim()) {
      setMatcaps([...matcaps, newMatcap])
      setNewMatcap({
        id: `matcap_${Date.now()}`,
        name: '',
        url: '',
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
              <Label className="text-zinc-300">Matcap URL</Label>
              <Input
                value={newMatcap.url}
                onChange={(e) => setNewMatcap({ ...newMatcap, url: e.target.value })}
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
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                Add Matcap
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matcaps Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {matcaps.map((matcap) => (
          <Card key={matcap.id} className={`bg-[#2a2a2a] border-[#404040] overflow-hidden ${!matcap.active ? 'opacity-50' : ''}`}>
            <div className="relative w-full aspect-square bg-[#1a1a1a]">
              {matcap.preview && (
                <img
                  src={matcap.preview}
                  alt={matcap.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              )}
            </div>
            <CardContent className="pt-3 pb-2">
              <p className="text-white text-xs font-medium truncate">{matcap.name}</p>
              
              <div className="flex gap-1 mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleActive(matcap.id)}
                  className="flex-1 text-zinc-400 hover:text-white h-7"
                  title={matcap.active ? 'Deactivate' : 'Activate'}
                >
                  {matcap.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
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
                    <AlertDialogTitle className="text-white">Delete Matcap</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      Delete "{matcap.name}"? This cannot be undone.
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
