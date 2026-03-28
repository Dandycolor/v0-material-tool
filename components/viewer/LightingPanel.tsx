"use client"

import { useViewerStore } from "@/lib/store"

const ENV_PRESETS = [
  "apartment", "city", "dawn", "forest",
  "lobby", "night", "park", "studio", "sunset", "warehouse",
] as const

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

export function LightingPanel() {
  const { lighting, updateLighting } = useViewerStore()

  return (
    <div>
      <div className="panel-header">
        <span>Lighting</span>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {/* Environment preset */}
        <div className="flex items-center gap-2 py-1">
          <span className="field-label w-28 shrink-0">Environment</span>
          <select
            value={lighting.envMap}
            onChange={(e) => updateLighting({ envMap: e.target.value })}
            className="select flex-1"
          >
            {ENV_PRESETS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <SliderRow
          label="Env Intensity"
          value={lighting.envIntensity}
          min={0}
          max={5}
          onChange={(v) => updateLighting({ envIntensity: v })}
        />
        <SliderRow
          label="Env Rotation"
          value={lighting.envRotation}
          min={0}
          max={6.28}
          step={0.01}
          onChange={(v) => updateLighting({ envRotation: v })}
        />

        <div className="divider my-2" />

        <SliderRow
          label="Directional"
          value={lighting.directionalIntensity}
          min={0}
          max={5}
          onChange={(v) => updateLighting({ directionalIntensity: v })}
        />
        <SliderRow
          label="Ambient"
          value={lighting.ambientIntensity}
          min={0}
          max={2}
          onChange={(v) => updateLighting({ ambientIntensity: v })}
        />
        <SliderRow
          label="Exposure"
          value={lighting.exposure}
          min={0.1}
          max={3}
          onChange={(v) => updateLighting({ exposure: v })}
        />
      </div>
    </div>
  )
}
