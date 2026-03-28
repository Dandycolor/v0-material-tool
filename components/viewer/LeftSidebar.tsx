"use client"

import { useViewerStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const TYPE_COLORS: Record<string, string> = {
  pbr:           "#60a5fa",
  gradient:      "#a78bfa",
  matcap:        "#34d399",
  wireframe:     "#f59e0b",
  toon:          "#f472b6",
  custom_shader: "#fb923c",
}

export function LeftSidebar() {
  const { materials, activeMaterialId, setActiveMaterial } = useViewerStore()

  const enabled = materials.filter((m) => m.enabled)

  return (
    <aside
      className="panel flex flex-col"
      style={{ width: 200, minWidth: 200, height: "100%" }}
    >
      {/* Header */}
      <div className="panel-header">Materials</div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {enabled.length === 0 && (
          <div
            className="px-3 py-4 text-center text-[11px]"
            style={{ color: "var(--color-muted)" }}
          >
            No materials
          </div>
        )}
        {enabled.map((mat) => (
          <button
            key={mat.id}
            onClick={() => setActiveMaterial(mat.id)}
            className={cn(
              "w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors",
              "hover:bg-white/5",
              activeMaterialId === mat.id && "bg-white/8"
            )}
            style={{
              background:
                activeMaterialId === mat.id
                  ? "rgba(139,124,248,0.1)"
                  : undefined,
              borderLeft:
                activeMaterialId === mat.id
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
            }}
          >
            {/* Type dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: TYPE_COLORS[mat.type] ?? "#888" }}
            />
            {/* Name */}
            <span
              className="text-[12px] truncate"
              style={{
                color:
                  activeMaterialId === mat.id
                    ? "var(--color-text)"
                    : "var(--color-muted)",
              }}
            >
              {mat.name}
            </span>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div
        className="panel-header text-[10px] border-t border-b-0 mt-auto"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span>{enabled.length} active</span>
        <a
          href="/admin/materials"
          className="ml-auto text-[10px] hover:underline"
          style={{ color: "var(--color-accent)" }}
        >
          manage →
        </a>
      </div>
    </aside>
  )
}
