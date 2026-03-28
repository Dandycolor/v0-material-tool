import { getModels } from "@/lib/data"
import { Plus, ExternalLink, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import type { Model } from "@/lib/types"

function ModelCard({ model }: { model: Model }) {
  return (
    <div className="panel flex flex-col overflow-hidden group">
      {/* Thumbnail */}
      <div
        className="relative w-full"
        style={{ aspectRatio: "4/3", background: "var(--color-surface)" }}
      >
        {model.thumbnail_url ? (
          <Image
            src={model.thumbnail_url}
            alt={model.name}
            fill
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-[11px]"
            style={{ color: "var(--color-subtle)" }}
          >
            No preview
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 gap-1"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <button
            className="btn"
            title={model.enabled ? "Disable" : "Enable"}
          >
            {model.enabled ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <a
            href={model.glb_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            title="Open GLB"
          >
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div
          className="text-[12px] font-medium mb-0.5 truncate"
          style={{ color: "var(--color-text)" }}
        >
          {model.name}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {model.categories.map((c) => (
            <span key={c} className="badge badge-default">{c}</span>
          ))}
          <span className={`badge ml-auto ${model.enabled ? "badge-green" : "badge-default"}`}>
            {model.enabled ? "on" : "off"}
          </span>
        </div>
        {model.author && (
          <div className="text-[10px] mt-1" style={{ color: "var(--color-subtle)" }}>
            by {model.author}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ModelsAdmin() {
  const models = getModels()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[18px] font-semibold mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Models
          </h1>
          <p className="text-[12px]" style={{ color: "var(--color-muted)" }}>
            {models.length} models · {models.filter((m) => m.enabled).length} enabled
          </p>
        </div>
        <button className="btn btn-accent gap-1.5">
          <Plus size={12} />
          Upload Model
        </button>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
      >
        {models.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </div>
  )
}
