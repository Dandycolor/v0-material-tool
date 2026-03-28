"use client"

import { useViewerStore } from "@/lib/store"
import { PanelLeft, PanelRight, Grid3x3, Layers, Settings } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function Toolbar() {
  const {
    leftPanelOpen,
    setLeftPanelOpen,
    rightPanelOpen,
    setRightPanelOpen,
    showGrid,
    toggleGrid,
    showWireframeOverlay,
    toggleWireframeOverlay,
    activeMaterialId,
    materials,
  } = useViewerStore()

  const mat = materials.find((m) => m.id === activeMaterialId)

  return (
    <header
      className="flex items-center gap-2 px-3 border-b shrink-0"
      style={{
        height: 36,
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="font-mono text-[13px] font-semibold mr-2"
        style={{ color: "var(--color-accent)" }}
      >
        polya
      </Link>

      <div className="w-px h-4 shrink-0" style={{ background: "var(--color-border)" }} />

      {/* Panel toggles */}
      <button
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        className={cn("btn btn-ghost", leftPanelOpen && "text-[var(--color-text)]")}
        title="Toggle materials panel"
      >
        <PanelLeft size={13} />
      </button>
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className={cn("btn btn-ghost", rightPanelOpen && "text-[var(--color-text)]")}
        title="Toggle controls panel"
      >
        <PanelRight size={13} />
      </button>

      <div className="w-px h-4 shrink-0" style={{ background: "var(--color-border)" }} />

      {/* View toggles */}
      <button
        onClick={toggleGrid}
        className={cn("btn btn-ghost", showGrid && "text-[var(--color-text)]")}
        title="Toggle grid"
      >
        <Grid3x3 size={13} />
      </button>
      <button
        onClick={toggleWireframeOverlay}
        className={cn("btn btn-ghost", showWireframeOverlay && "text-[var(--color-text)]")}
        title="Wireframe overlay"
      >
        <Layers size={13} />
      </button>

      {/* Active material badge */}
      {mat && (
        <>
          <div className="w-px h-4 shrink-0" style={{ background: "var(--color-border)" }} />
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            {mat.name}
          </span>
          <span className="badge badge-accent">{mat.type}</span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Admin link */}
      <Link href="/admin" className="btn btn-ghost gap-1">
        <Settings size={12} />
        Admin
      </Link>
    </header>
  )
}
