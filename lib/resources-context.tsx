'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { MATERIAL_PRESETS, MATCAP_PRESETS, CUSTOM_TEXTURES } from './resources'

interface Material {
  id: string
  name: string
  metalness: number
  roughness: number
  ior?: number
  transmission?: number
  normalMap?: string
  roughnessMap?: string
  metalnessMap?: string
  active: boolean
}

interface Matcap {
  id: string
  name: string
  matcap: string
  active: boolean
}

interface ResourcesContextType {
  materials: Record<string, Material>
  matcaps: Record<string, Matcap>
  customTextures: typeof CUSTOM_TEXTURES
  updateMaterial: (id: string, material: Partial<Material>) => void
  deleteMaterial: (id: string) => void
  addMaterial: (material: Material) => void
  updateMatcap: (id: string, matcap: Partial<Matcap>) => void
  deleteMatcap: (id: string) => void
  addMatcap: (matcap: Matcap) => void
  getActiveMaterials: () => Material[]
  getActiveMatcaps: () => Matcap[]
}

const ResourcesContext = createContext<ResourcesContextType | undefined>(undefined)

export function ResourcesProvider({ children }: { children: React.ReactNode }) {
  const [materials, setMaterials] = useState<Record<string, Material>>({})
  const [matcaps, setMatcaps] = useState<Record<string, Matcap>>({})
  const [customTextures, setCustomTextures] = useState(CUSTOM_TEXTURES)

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedMaterials = localStorage.getItem('app-materials')
    const savedMatcaps = localStorage.getItem('app-matcaps')

    if (savedMaterials) {
      try {
        setMaterials(JSON.parse(savedMaterials))
      } catch (e) {
        console.error('Failed to load materials:', e)
        initializeMaterials()
      }
    } else {
      initializeMaterials()
    }

    if (savedMatcaps) {
      try {
        setMatcaps(JSON.parse(savedMatcaps))
      } catch (e) {
        console.error('Failed to load matcaps:', e)
        initializeMatcaps()
      }
    } else {
      initializeMatcaps()
    }
  }, [])

  // Convert MATERIAL_PRESETS to Material objects with active status
  const initializeMaterials = () => {
    const converted: Record<string, Material> = {}
    Object.entries(MATERIAL_PRESETS).forEach(([key, preset]) => {
      converted[key] = {
        id: key,
        name: preset.name,
        metalness: preset.metalness ?? 0,
        roughness: preset.roughness ?? 0.5,
        ior: preset.ior,
        transmission: preset.transmission,
        normalMap: preset.normalMap,
        roughnessMap: preset.roughnessMap,
        metalnessMap: preset.metalnessMap,
        active: true,
      }
    })
    setMaterials(converted)
    localStorage.setItem('app-materials', JSON.stringify(converted))
  }

  const initializeMatcaps = () => {
    const converted: Record<string, Matcap> = {}
    Object.entries(MATCAP_PRESETS).forEach(([key, preset]) => {
      converted[key] = {
        id: key,
        name: preset.name,
        matcap: preset.matcap,
        active: true,
      }
    })
    setMatcaps(converted)
    localStorage.setItem('app-matcaps', JSON.stringify(converted))
  }

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    setMaterials((prev) => {
      const updated = {
        ...prev,
        [id]: { ...prev[id], ...updates },
      }
      localStorage.setItem('app-materials', JSON.stringify(updated))
      return updated
    })
  }

  const deleteMaterial = (id: string) => {
    setMaterials((prev) => {
      const { [id]: _, ...rest } = prev
      localStorage.setItem('app-materials', JSON.stringify(rest))
      return rest
    })
  }

  const addMaterial = (material: Material) => {
    setMaterials((prev) => {
      const updated = { ...prev, [material.id]: material }
      localStorage.setItem('app-materials', JSON.stringify(updated))
      return updated
    })
  }

  const updateMatcap = (id: string, updates: Partial<Matcap>) => {
    setMatcaps((prev) => {
      const updated = {
        ...prev,
        [id]: { ...prev[id], ...updates },
      }
      localStorage.setItem('app-matcaps', JSON.stringify(updated))
      return updated
    })
  }

  const deleteMatcap = (id: string) => {
    setMatcaps((prev) => {
      const { [id]: _, ...rest } = prev
      localStorage.setItem('app-matcaps', JSON.stringify(rest))
      return rest
    })
  }

  const addMatcap = (matcap: Matcap) => {
    setMatcaps((prev) => {
      const updated = { ...prev, [matcap.id]: matcap }
      localStorage.setItem('app-matcaps', JSON.stringify(updated))
      return updated
    })
  }

  const getActiveMaterials = () => {
    return Object.values(materials).filter((m) => m.active)
  }

  const getActiveMatcaps = () => {
    return Object.values(matcaps).filter((m) => m.active)
  }

  return (
    <ResourcesContext.Provider
      value={{
        materials,
        matcaps,
        customTextures,
        updateMaterial,
        deleteMaterial,
        addMaterial,
        updateMatcap,
        deleteMatcap,
        addMatcap,
        getActiveMaterials,
        getActiveMatcaps,
      }}
    >
      {children}
    </ResourcesContext.Provider>
  )
}

export function useResources() {
  const context = useContext(ResourcesContext)
  if (!context) {
    throw new Error('useResources must be used within ResourcesProvider')
  }
  return context
}
