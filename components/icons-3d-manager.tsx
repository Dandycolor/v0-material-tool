"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Upload, Trash2, FileIcon, FolderOpen } from "lucide-react"

interface Icon3D {
  id: number
  name: string
  category: string
  fileName: string
  fileSize: number
  uploadedAt: string
  status: "pending" | "processing" | "ready" | "error"
}

export function Icons3DManager() {
  const [icons, setIcons] = useState<Icon3D[]>([
    { id: 1, name: "Star", category: "3d-icons", fileName: "star.fbx", fileSize: 245000, uploadedAt: "2024-03-28", status: "ready" },
    { id: 2, name: "Heart", category: "3d-icons", fileName: "heart.fbx", fileSize: 189000, uploadedAt: "2024-03-28", status: "ready" },
  ])

  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (files: FileList) => {
    if (!files) return

    setIsUploading(true)
    let uploadedCount = 0

    Array.from(files).forEach((file, index) => {
      // Simulate upload progress
      setTimeout(() => {
        uploadedCount++
        const newIcon: Icon3D = {
          id: Math.max(...icons.map(i => i.id), 0) + index + 1,
          name: file.name.replace(/\.[^/.]+$/, "").replace(/-/g, " ").replace(/_/g, " "),
          category: "3d-icons",
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString().split('T')[0],
          status: index % 3 === 0 ? "ready" : "processing",
        }

        setIcons(prev => [...prev, newIcon])
        setUploadProgress(Math.round((uploadedCount / files.length) * 100))

        if (uploadedCount === files.length) {
          setIsUploading(false)
          setUploadProgress(0)
        }
      }, (index + 1) * 500)
    })
  }

  const handleDeleteIcon = (id: number) => {
    setIcons(icons.filter(i => i.id !== id))
  }

  const handleBrowseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleBrowseFolder = () => {
    folderInputRef.current?.click()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-900/30 text-green-400 border-green-800"
      case "processing":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-800"
      case "error":
        return "bg-red-900/30 text-red-400 border-red-800"
      default:
        return "bg-slate-900/30 text-slate-400 border-slate-800"
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className="bg-slate-800 border-slate-700 border-2 border-dashed">
        <CardContent className="pt-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center gap-4 mb-4">
              <Upload className="w-8 h-8 text-cyan-400" />
              <FolderOpen className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-white font-semibold">Upload 3D Icons</h3>
            <p className="text-slate-400 text-sm">Supported formats: FBX, GLB, GLTF</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleBrowseFiles}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                disabled={isUploading}
              >
                <FileIcon className="w-4 h-4 mr-2" />
                Select Files
              </Button>
              <Button
                onClick={handleBrowseFolder}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700"
                disabled={isUploading}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Select Folder
              </Button>
            </div>

            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-cyan-400 font-medium">{uploadProgress}% Complete</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".fbx,.glb,.gltf"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              webkitdirectory=""
              accept=".fbx,.glb,.gltf"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Icons Grid */}
      <div className="space-y-2">
        <h3 className="text-white font-semibold">Uploaded Icons ({icons.length})</h3>
        <div className="grid gap-3">
          {icons.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-slate-400">No icons uploaded yet. Start by uploading FBX files from your archive.</p>
              </CardContent>
            </Card>
          ) : (
            icons.map((icon) => (
              <Card key={icon.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileIcon className="w-5 h-5 text-cyan-400" />
                        <h4 className="text-white font-medium">{icon.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(icon.status)}`}>
                          {icon.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs text-slate-400 ml-8">
                        <div>
                          <p className="text-slate-500">File</p>
                          <p className="text-white">{icon.fileName}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Size</p>
                          <p className="text-white">{formatFileSize(icon.fileSize)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Uploaded</p>
                          <p className="text-white">{icon.uploadedAt}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950 ml-4"
                      onClick={() => handleDeleteIcon(icon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Import Stats */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Archive Import Status</CardTitle>
          <CardDescription>Importing from 3dicons-fbx-1.0.0.zip (287MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <p className="text-2xl font-bold text-cyan-400">240+</p>
              <p className="text-slate-400 text-sm mt-1">Icons in archive</p>
            </div>
            <div className="p-3 bg-slate-700 rounded-lg">
              <p className="text-2xl font-bold text-cyan-400">{icons.length}</p>
              <p className="text-slate-400 text-sm mt-1">Imported</p>
            </div>
            <div className="p-3 bg-slate-700 rounded-lg">
              <p className="text-2xl font-bold text-yellow-400">{240 - icons.length}</p>
              <p className="text-slate-400 text-sm mt-1">Remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
