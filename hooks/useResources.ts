import useSWR from "swr"

interface Material {
  id: number
  name: string
  type: "pbr" | "matcap"
  metalness?: number
  roughness?: number
  ior?: number
  transmission?: number
}

interface Matcap {
  id: number
  name: string
  url: string
  category: string
}

interface Texture {
  id: number
  name: string
  url: string
  type: string
  category: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useMaterials() {
  const { data, error, isLoading } = useSWR<Material[]>("/api/resources/materials", fetcher)
  return { materials: data || [], error, isLoading }
}

export function useMatcaps() {
  const { data, error, isLoading } = useSWR<Matcap[]>("/api/resources/matcaps", fetcher)
  return { matcaps: data || [], error, isLoading }
}

export function useTextures() {
  const { data, error, isLoading } = useSWR<Texture[]>("/api/resources/textures", fetcher)
  return { textures: data || [], error, isLoading }
}

export function useIcons3D() {
  const { data, error, isLoading } = useSWR("/api/resources/icons", fetcher)
  return { icons: data || [], error, isLoading }
}
