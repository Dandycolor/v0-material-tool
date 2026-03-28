import { getMaterials } from "@/lib/data"
import { Plus, Eye, EyeOff, Edit3 } from "lucide-react"
import type { Material } from "@/lib/types"

const TYPE_COLOR: Record<string, string> = {
  pbr:           "#60a5fa",
  gradient:      "#a78bfa",
  matcap:        "#34d399",
  wireframe:     "#f59e0b",
  toon:          "#f472b6",
  custom_shader: "#fb923c",
}

function MaterialRow({ mat }: { mat: Material }) {
  return (
    <tr
      className="border-b group"
      style={{ borderColor: "var(--color-border)" }}
    >
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: TYPE_COLOR[mat.type] ?? "#888" }}
          />
          <span className="text-[12px]" style={{ color: "var(--color-text)" }}>
            {mat.name}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-4">
        <span className="badge badge-default">{mat.type}</span>
      </td>
      <td className="py-2.5 px-4">
        <div className="flex gap-1 flex-wrap">
          {mat.tags.map((tag) => (
            <span key={tag} className="badge badge-default">{tag}</span>
          ))}
        </div>
      </td>
      <td className="py-2.5 px-4">
        <span
          className={`badge ${mat.enabled ? "badge-green" : "badge-default"}`}
        >
          {mat.enabled ? "enabled" : "disabled"}
        </span>
      </td>
      <td className="py-2.5 px-4">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="btn btn-ghost"
            title={mat.enabled ? "Disable" : "Enable"}
          >
            {mat.enabled ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button className="btn btn-ghost" title="Edit">
            <Edit3 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function MaterialsAdmin() {
  const materials = getMaterials()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[18px] font-semibold mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Materials
          </h1>
          <p className="text-[12px]" style={{ color: "var(--color-muted)" }}>
            {materials.length} materials · {materials.filter((m) => m.enabled).length} enabled
          </p>
        </div>
        <button className="btn btn-accent gap-1.5">
          <Plus size={12} />
          New Material
        </button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              {["Name", "Type", "Tags", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="panel-header text-left py-2 px-4 font-medium"
                  style={{ borderBottom: "none" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((mat) => (
              <MaterialRow key={mat.id} mat={mat} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Config preview (read-only for now) */}
      <div className="panel mt-4">
        <div className="panel-header">JSON Preview — select a row to edit (coming soon)</div>
        <pre
          className="p-4 text-[11px] overflow-x-auto font-mono"
          style={{ color: "var(--color-muted)" }}
        >
          {JSON.stringify(materials[0]?.config ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  )
}
