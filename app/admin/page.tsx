import { getMaterials, getModels } from "@/lib/data"
import Link from "next/link"
import { Layers, Box, Code2, ArrowRight } from "lucide-react"

export default function AdminDashboard() {
  const materials = getMaterials()
  const models    = getModels()

  const enabledMaterials = materials.filter((m) => m.enabled)
  const matByType = materials.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1
    return acc
  }, {})

  const cards = [
    {
      title:    "Materials",
      href:     "/admin/materials",
      icon:     Layers,
      count:    materials.length,
      enabled:  enabledMaterials.length,
      color:    "#a78bfa",
    },
    {
      title:   "Models",
      href:    "/admin/models",
      icon:    Box,
      count:   models.length,
      enabled: models.filter((m) => m.enabled).length,
      color:   "#60a5fa",
    },
    {
      title:   "Shaders",
      href:    "/admin/shaders",
      icon:    Code2,
      count:   materials.filter((m) => m.type === "custom_shader").length,
      enabled: materials.filter((m) => m.type === "custom_shader" && m.enabled).length,
      color:   "#fb923c",
    },
  ]

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1
          className="text-[18px] font-semibold mb-1"
          style={{ color: "var(--color-text)" }}
        >
          Dashboard
        </h1>
        <p className="text-[12px]" style={{ color: "var(--color-muted)" }}>
          Manage materials, models, and shaders
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {cards.map(({ title, href, icon: Icon, count, enabled, color }) => (
          <Link
            key={href}
            href={href}
            className="panel p-4 flex flex-col gap-3 hover:border-[var(--color-border-hi)] transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{ background: `${color}18` }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <ArrowRight
                size={12}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-muted)" }}
              />
            </div>
            <div>
              <div
                className="text-[22px] font-semibold font-mono"
                style={{ color: "var(--color-text)" }}
              >
                {count}
              </div>
              <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                {title} · {enabled} enabled
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Material breakdown */}
      <div className="panel">
        <div className="panel-header">Material Types</div>
        <div className="p-4 grid grid-cols-3 gap-2">
          {Object.entries(matByType).map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between py-1.5 px-3 rounded"
              style={{ background: "var(--color-surface)" }}
            >
              <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                {type}
              </span>
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--color-text)" }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Supabase migration notice */}
      <div
        className="panel mt-4 p-4 flex items-start gap-3"
        style={{ borderColor: "rgba(139,124,248,0.3)", background: "rgba(139,124,248,0.04)" }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
          style={{ background: "var(--color-accent)" }}
        />
        <div>
          <div className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--color-accent-hi)" }}>
            Supabase ready
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            Data is currently loaded from{" "}
            <code className="font-mono" style={{ color: "var(--color-text)" }}>
              /data/*.json
            </code>
            . Connect Supabase by adding{" "}
            <code className="font-mono" style={{ color: "var(--color-text)" }}>
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="font-mono" style={{ color: "var(--color-text)" }}>
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            to{" "}
            <code className="font-mono" style={{ color: "var(--color-text)" }}>
              .env.local
            </code>
            .
          </div>
        </div>
      </div>
    </div>
  )
}
