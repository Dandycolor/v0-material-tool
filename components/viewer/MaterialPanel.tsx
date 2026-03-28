"use client"

import { useViewerStore } from "@/lib/store"
import type { GradientConfig, PBRConfig } from "@/lib/types"
import { cn } from "@/lib/utils"

// ── Slider row ─────────────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="field-label w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="field-value w-10 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

// ── Color row ──────────────────────────────────────────────────────────────────
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="field-label w-28 shrink-0">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="field-value font-mono text-[11px]">{value}</span>
    </div>
  )
}

// ── Gradient config panel ──────────────────────────────────────────────────────
function GradientPanel({ cfg }: { cfg: GradientConfig }) {
  const { setGradientOverride, gradientOverride } = useViewerStore()
  const current = { ...cfg, ...gradientOverride } as GradientConfig

  const update = (patch: Partial<GradientConfig>) =>
    setGradientOverride({ ...gradientOverride, ...patch })

  return (
    <div className="px-3 py-2 space-y-0.5">
      {/* Type toggle */}
      <div className="flex items-center gap-2 py-1 mb-1">
        <span className="field-label w-28 shrink-0">Type</span>
        <div className="flex gap-1">
          {(["radial", "linear"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ type: t })}
              className={cn(
                "btn",
                current.type === t && "btn-accent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ColorRow label="Color 1" value={current.color1} onChange={(v) => update({ color1: v })} />
      <ColorRow label="Color 2" value={current.color2} onChange={(v) => update({ color2: v })} />

      {/* 3-color toggle */}
      <div className="flex items-center gap-2 py-1">
        <span className="field-label w-28 shrink-0">3 Colors</span>
        <input
          type="checkbox"
          checked={current.use3Colors}
          onChange={(e) => update({ use3Colors: e.target.checked })}
        />
      </div>

      {current.use3Colors && (
        <ColorRow label="Color 3" value={current.color3} onChange={(v) => update({ color3: v })} />
      )}

      <div className="divider my-2" />

      <SliderRow label="Intensity" value={current.intensity} min={0} max={3} onChange={(v) => update({ intensity: v })} />
      <SliderRow label="Distortion" value={current.distortion} min={0} max={1} onChange={(v) => update({ distortion: v })} />
      <SliderRow label="Noise" value={current.noise ?? 0} min={0} max={1} onChange={(v) => update({ noise: v })} />

      {current.type === "linear" && (
        <SliderRow label="Angle" value={current.angle ?? 0} min={0} max={6.28} step={0.01} onChange={(v) => update({ angle: v })} />
      )}
    </div>
  )
}

// ── PBR config panel ───────────────────────────────────────────────────────────
function PBRPanel({ cfg }: { cfg: PBRConfig }) {
  const { setPBROverride, pbrOverride } = useViewerStore()
  const current = { ...cfg, ...pbrOverride } as PBRConfig

  const update = (patch: Partial<PBRConfig>) =>
    setPBROverride({ ...pbrOverride, ...patch })

  return (
    <div className="px-3 py-2 space-y-0.5">
      <ColorRow label="Color" value={current.colorTint} onChange={(v) => update({ colorTint: v })} />
      <div className="divider my-2" />
      <SliderRow label="Roughness" value={current.roughness} onChange={(v) => update({ roughness: v })} />
      <SliderRow label="Metalness" value={current.metalness} onChange={(v) => update({ metalness: v })} />
      <SliderRow label="Normal Scale" value={current.normalScale} min={0} max={5} onChange={(v) => update({ normalScale: v })} />
      <div className="divider my-2" />
      <SliderRow label="Transmission" value={current.transmission} onChange={(v) => update({ transmission: v })} />
      <SliderRow label="IOR" value={current.ior} min={1} max={2.5} onChange={(v) => update({ ior: v })} />
      <SliderRow label="Thickness" value={current.thickness} min={0} max={5} onChange={(v) => update({ thickness: v })} />
      <div className="divider my-2" />
      <SliderRow label="Clearcoat" value={current.clearcoat} onChange={(v) => update({ clearcoat: v })} />
      <SliderRow label="CC Roughness" value={current.clearcoatRoughness} onChange={(v) => update({ clearcoatRoughness: v })} />
      <div className="divider my-2" />
      <SliderRow label="Iridescence" value={current.iridescence} onChange={(v) => update({ iridescence: v })} />
      <SliderRow label="Irid. IOR" value={current.iridescenceIOR} min={1} max={3} onChange={(v) => update({ iridescenceIOR: v })} />
      <div className="divider my-2" />
      <SliderRow label="Env Intensity" value={current.envMapIntensity} min={0} max={5} onChange={(v) => update({ envMapIntensity: v })} />
    </div>
  )
}

// ── Main Material Panel ────────────────────────────────────────────────────────
export function MaterialPanel() {
  const { activeMaterialId, materials } = useViewerStore()
  const material = materials.find((m) => m.id === activeMaterialId)

  if (!material) {
    return (
      <div className="px-3 py-4 text-center" style={{ color: "var(--color-muted)" }}>
        No material selected
      </div>
    )
  }

  return (
    <div>
      <div className="panel-header">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: "var(--color-accent)" }}
        />
        {material.name}
        <span className="badge badge-default ml-auto">{material.type}</span>
      </div>

      {material.type === "gradient" && (
        <GradientPanel cfg={material.config as GradientConfig} />
      )}
      {material.type === "pbr" && (
        <PBRPanel cfg={material.config as PBRConfig} />
      )}
      {material.type === "wireframe" && (
        <div className="px-3 py-3 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Wireframe — no config
        </div>
      )}
    </div>
  )
}
