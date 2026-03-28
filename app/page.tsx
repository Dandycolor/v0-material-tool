"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { useViewerStore } from "@/lib/store"
import { Toolbar } from "@/components/viewer/Toolbar"
import { LeftSidebar } from "@/components/viewer/LeftSidebar"
import { RightSidebar } from "@/components/viewer/RightSidebar"
import { getEnabledMaterials, getEnabledModels } from "@/lib/data"

// Three.js must be client-only
const ViewerScene = dynamic(
  () => import("@/components/viewer/ViewerScene").then((m) => m.ViewerScene),
  { ssr: false }
)

export default function Home() {
  const { setMaterials, setModels, leftPanelOpen, rightPanelOpen } =
    useViewerStore()

  // Load data into store on mount
  useEffect(() => {
    setMaterials(getEnabledMaterials())
    setModels(getEnabledModels())
  }, [setMaterials, setModels])

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* Toolbar */}
      <Toolbar />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {leftPanelOpen && <LeftSidebar />}

        {/* Canvas — fills remaining space */}
        <div className="flex-1 relative overflow-hidden">
          <ViewerScene />
        </div>

        {/* Right panel */}
        {rightPanelOpen && <RightSidebar />}
      </div>
    </div>
  )
}
