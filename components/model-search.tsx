"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Download, Loader2 } from "lucide-react"

interface Model {
  id: string
  name: string
  author?: string
  thumbnail?: string
  glbUrl?: string
  gltfUrl?: string
  categories?: string[]
  tags?: string[]
  downloadCount?: number
}

interface ModelSearchProps {
  onSelect: (model: Model) => void
  onClose: () => void
}

export function ModelSearch({ onSelect, onClose }: ModelSearchProps) {
  const [query, setQuery] = useState("")
  const [models, setModels] = useState<Model[]>([])
  const [searching, setSearching] = useState(false)
  const [uploadTab, setUploadTab] = useState<"search" | "upload" | "threedscans">("search")
  const [downloading, setDownloading] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [threeScansModels, setThreeScansModels] = useState<Model[]>([])
  const [threeScansLoading, setThreeScansLoading] = useState(false)

  // Загружаем популярные модели при открытии
  useEffect(() => {
    loadInitialModels()
  }, [])

  // Поиск с дебаунсом
  useEffect(() => {
    const timer = setTimeout(() => {
      searchModels(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const loadInitialModels = async () => {
    setInitialLoading(true)
    try {
      const response = await fetch("/api/models/search?q=&limit=24")
      const data = await response.json()
      setModels(data.models || [])
    } catch (error) {
      console.error("Error loading models:", error)
    } finally {
      setInitialLoading(false)
    }
  }

  const loadThreeScansModels = async (searchQuery: string = "") => {
    setThreeScansLoading(true)
    try {
      // Use our own API route to avoid CORS issues
      const params = new URLSearchParams()
      if (searchQuery) {
        params.append("q", searchQuery)
      }
      params.append("limit", "24")
      
      const response = await fetch(`/api/threedscans/search?${params.toString()}`)
      const data = await response.json()
      
      // Transform the API response to match our Model interface
      const transformedModels = (data.results || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.title,
        author: item.author,
        thumbnail: item.thumbnail || item.preview,
        glbUrl: item.downloads?.find((d: any) => d.format === "glb")?.url || item.model_url,
        categories: item.categories,
        tags: item.tags,
      }))
      
      setThreeScansModels(transformedModels)
    } catch (error) {
      console.error("Error loading threedscans models:", error)
      setThreeScansModels([])
    } finally {
      setThreeScansLoading(false)
    }
  }

  const searchModels = async (searchQuery: string) => {
    setSearching(true)
    try {
      const response = await fetch(`/api/models/search?q=${encodeURIComponent(searchQuery)}&limit=24`)
      const data = await response.json()
      setModels(data.models || [])
    } catch (error) {
      console.error("Error searching models:", error)
      setModels([])
    } finally {
      setSearching(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (fileExtension !== 'glb' && fileExtension !== 'gltf') {
      alert('Please upload a .glb or .gltf file')
      return
    }

    const modelUrl = URL.createObjectURL(file)
    onSelect({
      id: `local-${Date.now()}`,
      name: file.name,
      glbUrl: fileExtension === 'glb' ? modelUrl : undefined,
      gltfUrl: fileExtension === 'gltf' ? modelUrl : undefined,
    })
    onClose()
  }

  const handleSelectModel = async (model: Model) => {
    if (!model.glbUrl) {
      alert("This model has no downloadable file")
      return
    }
    
    setDownloading(model.id)
    
    try {
      // Загружаем GLB файл напрямую (GitHub raw не имеет CORS ограничений)
      const response = await fetch(model.glbUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`)
      }
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      onSelect({
        ...model,
        glbUrl: blobUrl,
      })
      onClose()
    } catch (error) {
      console.error("Error downloading model:", error)
      alert("Failed to download model. Please try using 'Upload File' tab.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">3D Models</h2>
              {uploadTab === "search" && (
                <span className="text-xs text-zinc-500 bg-[#2d2d2d] px-2 py-1 rounded">
                  Built-in Models - CC0
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors text-xl leading-none"
            >
              x
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setUploadTab("search")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadTab === "search"
                  ? "bg-blue-600 text-white"
                  : "bg-[#2d2d2d] text-zinc-400 hover:text-white"
              }`}
            >
              Browse Models
            </button>
            <button
              onClick={() => setUploadTab("threedscans")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadTab === "threedscans"
                  ? "bg-blue-600 text-white"
                  : "bg-[#2d2d2d] text-zinc-400 hover:text-white"
              }`}
            >
              3D Scans
            </button>
            <button
              onClick={() => setUploadTab("upload")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadTab === "upload"
                  ? "bg-blue-600 text-white"
                  : "bg-[#2d2d2d] text-zinc-400 hover:text-white"
              }`}
            >
              Upload File
            </button>
          </div>

          {uploadTab === "search" && (
            <Input
              placeholder="Search models (duck, helmet, cube...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-[#2d2d2d] border-[#3a3a3a] text-white placeholder-zinc-500"
              autoFocus
            />
          )}

          {uploadTab === "threedscans" && (
            <Input
              placeholder="Search 3D scans (head, face, hand...)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (e.target.value.trim()) {
                  loadThreeScansModels(e.target.value)
                } else {
                  loadThreeScansModels()
                }
              }}
              className="bg-[#2d2d2d] border-[#3a3a3a] text-white placeholder-zinc-500"
              autoFocus
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {uploadTab === "upload" && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="border-2 border-dashed border-[#3a3a3a] rounded-lg p-8 w-full max-w-md text-center hover:border-blue-600 transition-colors">
                <input
                  type="file"
                  id="model-upload"
                  accept=".glb,.gltf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="model-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Click to upload</p>
                    <p className="text-sm text-zinc-400">Supports .glb and .gltf formats</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {uploadTab === "search" && (initialLoading || searching) && models.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          )}

          {uploadTab === "search" && !initialLoading && !searching && models.length === 0 && query && (
            <div className="flex items-center justify-center h-32">
              <div className="text-zinc-400">No models found for "{query}"</div>
            </div>
          )}

          {uploadTab === "threedscans" && threeScansLoading && threeScansModels.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          )}

          {uploadTab === "threedscans" && !threeScansLoading && threeScansModels.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-zinc-400 text-center">
                {query ? `No 3D scans found for "${query}"` : "Search for 3D scans to get started"}
              </div>
            </div>
          )}

          {uploadTab === "search" && models.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  disabled={downloading === model.id}
                  className="group relative bg-[#2a2a2a] rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all text-left disabled:opacity-50"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-[#1a1a1a]">
                    {model.thumbnail && (
                      <Image
                        src={model.thumbnail || "/placeholder.svg"}
                        alt={model.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {downloading === model.id ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Download className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-white line-clamp-1">
                      {model.name}
                    </h3>
                    {model.author && (
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                        by {model.author}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {uploadTab === "threedscans" && threeScansModels.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {threeScansModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  disabled={downloading === model.id}
                  className="group relative bg-[#2a2a2a] rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all text-left disabled:opacity-50"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-[#1a1a1a]">
                    {model.thumbnail && (
                      <Image
                        src={model.thumbnail || "/placeholder.svg"}
                        alt={model.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {downloading === model.id ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Download className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-white line-clamp-1">
                      {model.name}
                    </h3>
                    {model.author && (
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                        by {model.author}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {uploadTab === "search" && (
          <div className="p-3 border-t border-[#2a2a2a]">
            <p className="text-xs text-zinc-500 text-center">
              Built-in models from Sava glTF Samples (CC0 license). Click to load.
            </p>
          </div>
        )}

        {uploadTab === "threedscans" && (
          <div className="p-3 border-t border-[#2a2a2a]">
            <p className="text-xs text-zinc-500 text-center">
              3D Scans powered by threedscans.com. Click to download and load.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
