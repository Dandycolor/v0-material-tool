"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { Material, Model, GradientConfig, PBRConfig, LightingSettings } from "@/lib/types"

interface ViewerStore {
  // ── Active selections ──
  activeMaterialId: string | null
  activeModelId: string | null
  renderMode: "pbr" | "matcap" | "gradient" | "wireframe" | "toon"

  // ── UI state ──
  showGrid: boolean
  showWireframeOverlay: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  activeRightTab: "material" | "lighting" | "model"

  // ── Live material config overrides (editor state) ──
  pbrOverride: Partial<PBRConfig> | null
  gradientOverride: Partial<GradientConfig> | null

  // ── Lighting ──
  lighting: LightingSettings

  // ── Data (loaded at runtime) ──
  materials: Material[]
  models: Model[]

  // ── Actions ──
  setMaterials: (materials: Material[]) => void
  setModels: (models: Model[]) => void
  setActiveMaterial: (id: string | null) => void
  setActiveModel: (id: string | null) => void
  setRenderMode: (mode: ViewerStore["renderMode"]) => void
  toggleGrid: () => void
  toggleWireframeOverlay: () => void
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setActiveRightTab: (tab: ViewerStore["activeRightTab"]) => void
  updateLighting: (patch: Partial<LightingSettings>) => void
  setPBROverride: (patch: Partial<PBRConfig> | null) => void
  setGradientOverride: (patch: Partial<GradientConfig> | null) => void
}

const DEFAULT_LIGHTING: LightingSettings = {
  envMap: "city",
  envIntensity: 1.0,
  envRotation: 0,
  directionalIntensity: 1.0,
  ambientIntensity: 0.3,
  exposure: 1.0,
}

export const useViewerStore = create<ViewerStore>()(
  immer((set) => ({
    activeMaterialId: "mat-gradient-aurora",
    activeModelId: "model-damaged-helmet",
    renderMode: "gradient",
    showGrid: true,
    showWireframeOverlay: false,
    leftPanelOpen: true,
    rightPanelOpen: true,
    activeRightTab: "material",
    pbrOverride: null,
    gradientOverride: null,
    lighting: DEFAULT_LIGHTING,
    materials: [],
    models: [],

    setMaterials: (materials) => set((s) => { s.materials = materials }),
    setModels: (models) => set((s) => { s.models = models }),

    setActiveMaterial: (id) =>
      set((s) => {
        s.activeMaterialId = id
        s.pbrOverride = null
        s.gradientOverride = null
        // Sync render mode from selected material
        const mat = s.materials.find((m) => m.id === id)
        if (mat) s.renderMode = mat.type as ViewerStore["renderMode"]
      }),

    setActiveModel: (id) => set((s) => { s.activeModelId = id }),

    setRenderMode: (mode) => set((s) => { s.renderMode = mode }),

    toggleGrid: () => set((s) => { s.showGrid = !s.showGrid }),

    toggleWireframeOverlay: () =>
      set((s) => { s.showWireframeOverlay = !s.showWireframeOverlay }),

    setLeftPanelOpen: (open) => set((s) => { s.leftPanelOpen = open }),
    setRightPanelOpen: (open) => set((s) => { s.rightPanelOpen = open }),
    setActiveRightTab: (tab) => set((s) => { s.activeRightTab = tab }),

    updateLighting: (patch) =>
      set((s) => { s.lighting = { ...s.lighting, ...patch } }),

    setPBROverride: (patch) => set((s) => { s.pbrOverride = patch }),
    setGradientOverride: (patch) => set((s) => { s.gradientOverride = patch }),
  }))
)
