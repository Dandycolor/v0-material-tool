/**
 * Data access layer — currently reads from local JSON.
 * Designed to be swapped for Supabase with minimal changes.
 *
 * Supabase migration path:
 *   import { createClient } from '@/lib/supabase/server'
 *   const { data } = await supabase.from('materials').select('*').eq('enabled', true)
 */

import type { Material, Model } from "@/lib/types"
import rawMaterials from "@/data/materials.json"
import rawModels from "@/data/models.json"

export function getMaterials(): Material[] {
  return rawMaterials as Material[]
}

export function getEnabledMaterials(): Material[] {
  return (rawMaterials as Material[]).filter((m) => m.enabled)
}

export function getMaterialById(id: string): Material | undefined {
  return (rawMaterials as Material[]).find((m) => m.id === id)
}

export function getMaterialBySlug(slug: string): Material | undefined {
  return (rawMaterials as Material[]).find((m) => m.slug === slug)
}

export function getModels(): Model[] {
  return rawModels as Model[]
}

export function getEnabledModels(): Model[] {
  return (rawModels as Model[]).filter((m) => m.enabled)
}

export function getModelById(id: string): Model | undefined {
  return (rawModels as Model[]).find((m) => m.id === id)
}
