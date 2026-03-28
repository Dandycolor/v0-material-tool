"use client"

import { useViewerStore } from "@/lib/store"
import { MaterialPanel } from "./MaterialPanel"
import { LightingPanel } from "./LightingPanel"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "material", label: "Material" },
  { id: "lighting", label: "Lighting" },
  { id: "model",    label: "Model"    },
] as const

export function RightSidebar() {
  const {
    activeRightTab,
    setActiveRightTab,
    models,
    activeModelId,
    setActiveModel,
    showGrid,
    toggleGrid,
    showWireframeOverlay,
    toggleWireframeOverlay,
  } = useViewerStore()

  return (
    <aside
      className="panel flex flex-col"
      style={{ width: 240, minWidth: 240, height: "100%" }}
    >
      {/* Tabs */}
      <div
        className="flex border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveRightTab(tab.id)}
            className={cn(
              "flex-1 py-2 text-[11px] font-medium transition-colors",
              activeRightTab === tab.id
                ? "text-[var(--color-text)] border-b-2"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            )}
            style={{
              borderBottomColor:
                activeRightTab === tab.id
                  ? "var(--color-accent)"
                  : "transparent",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeRightTab === "material" && <MaterialPanel />}

        {activeRightTab === "lighting" && <LightingPanel />}

        {activeRightTab === "model" && (
          <div>
            <div className="panel-header">Models</div>
            <div className="py-1">
              {/* Sphere (no model) */}
              <button
                onClick={() => setActiveModel(null)}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-white/5 text-[12px]",
                  activeModelId === null
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-muted)]"
                )}
                style={{
                  borderLeft:
                    activeModelId === null
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                }}
              >
                Sphere (default)
              </button>
              {models
                .filter((m) => m.enabled)
                .map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setActiveModel(model.id)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-white/5 text-[12px]",
                      activeModelId === model.id
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-muted)]"
                    )}
                    style={{
                      borderLeft:
                        activeModelId === model.id
                          ? "2px solid var(--color-accent)"
                          : "2px solid transparent",
                    }}
                  >
                    {model.name}
                  </button>
                ))}
            </div>

            {/* View options */}
            <div
              className="px-3 py-2 mt-2 border-t"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="panel-header -mx-3 mb-2">View</div>
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={toggleGrid}
                />
                <span className="field-label">Show Grid</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWireframeOverlay}
                  onChange={toggleWireframeOverlay}
                />
                <span className="field-label">Wireframe Overlay</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
