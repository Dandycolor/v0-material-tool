"use client"

/* Custom HDRI editor panel (KeyShot-style): equirect preview with draggable lights, presets,
   per-light settings, background gradient and global adjustments. */

import { useEffect, useRef, useState } from "react"
import { Icon, IconButton, Field, ColorField, Segmented, Caption, PanelHead } from "@/components/knopika/kk"
import { customEnv, rasterEnv, useCustomEnv, ENV_PRESETS, type EnvLightShape } from "@/lib/custom-env"

const PW = 256, PH = 128

function HdriMap() {
  const { env, selected } = useCustomEnv()
  const cv = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<string | null>(null)

  // preview: same rasteriser at low res, tone mapped
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const raf = requestAnimationFrame(() => {
      const d = rasterEnv(env, PW, PH)
      const ctx = c.getContext("2d")!
      const img = ctx.createImageData(PW, PH)
      for (let j = 0; j < PH; j++)
        for (let i = 0; i < PW; i++) {
          const s = ((PH - 1 - j) * PW + i) * 4 // flip: top of the canvas = up
          const o = (j * PW + i) * 4
          for (let k = 0; k < 3; k++) {
            const v = d[s + k]
            const t = v / (1 + v)
            img.data[o + k] = Math.round(255 * Math.pow(t, 1 / 2.2))
          }
          img.data[o + 3] = 255
        }
      ctx.putImageData(img, 0, 0)
    })
    return () => cancelAnimationFrame(raf)
  }, [env])

  const toLonLat = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect()
    const u = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    return { lon: Math.round((u - 0.5) * 360 * 10) / 10, lat: Math.round((0.5 - v) * 180 * 10) / 10 }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return
      customEnv.setLight(drag.current, toLonLat(e))
    }
    const up = () => (drag.current = null)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [])

  return (
    <div
      ref={wrap}
      className="hdri-map"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest(".hdri-pin")) return
        customEnv.addLight(toLonLat(e))
      }}
    >
      <canvas ref={cv} width={PW} height={PH} />
      {env.lights.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`hdri-pin ${selected === l.id ? "is-on" : ""} ${l.on ? "" : "is-off"}`}
          style={{ left: `${((l.lon + 180) / 360) * 100}%`, top: `${((90 - l.lat) / 180) * 100}%` }}
          title={l.name}
          aria-label={`Light ${l.name}`}
          onPointerDown={(e) => {
            e.preventDefault()
            customEnv.select(l.id)
            drag.current = l.id
          }}
        />
      ))}
    </div>
  )
}

export function HdriEditor({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { env, selected, picking } = useCustomEnv()
  const sel = env.lights.find((l) => l.id === selected) || null
  const [tab, setTab] = useState<"lights" | "world">("lights")
  useEffect(() => () => customEnv.setPicking(false), [])

  return (
    <>
      <PanelHead eyebrow="Light · Custom HDRI">
        <IconButton size="sm" icon="chevron-left" label="Back to lighting" onClick={onBack} />
        <IconButton size="sm" icon="close" label="Close HDRI editor" onClick={onClose} />
      </PanelHead>

      <HdriMap />
      <p className="hint2">Drag a light on the map · double-click to add one</p>

      <button type="button" className={`kk-pill kk-grow hdri-pick ${picking ? "is-on" : ""}`} onClick={() => customEnv.setPicking(!picking)} title="Click on the model where the highlight should be (Esc to stop)">
        <Icon name="spark" />
        {picking ? "Click on the model… (Esc)" : "Place highlight on model"}
      </button>

      <div className="kk-card">
        <span className="tlabel">PRESETS</span>
        <div className="hdri-presets">
          {ENV_PRESETS.map((p, i) => (
            <button key={p.name} type="button" className="kk-pill" onClick={() => customEnv.applyPreset(i)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { v: "lights", label: "Lights" },
          { v: "world", label: "Environment" },
        ]}
      />

      {tab === "lights" ? (
        <>
          <div className="kk-card hdri-list">
            {env.lights.map((l) => (
              <div key={l.id} className={`hdri-row ${selected === l.id ? "is-on" : ""}`} onClick={() => customEnv.select(l.id)}>
                <span className="hdri-dot" style={{ background: l.color, opacity: l.on ? 1 : 0.3 }} />
                <span className="hdri-name">{l.name}</span>
                <button
                  type="button"
                  className="kk-ibtn kk-ibtn--ground"
                  aria-label={l.on ? `Hide ${l.name}` : `Show ${l.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    customEnv.setLight(l.id, { on: !l.on })
                  }}
                >
                  <Icon name={l.on ? "eye" : "eye-off"} />
                </button>
                <button
                  type="button"
                  className="kk-ibtn kk-ibtn--ground"
                  aria-label={`Delete ${l.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    customEnv.removeLight(l.id)
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
            <button type="button" className="kk-pill kk-grow" onClick={() => customEnv.addLight()}>
              <Icon name="plus" />
              Add light
            </button>
          </div>

          {sel && (
            <div className="kk-card">
              <span className="tlabel">{sel.name.toUpperCase()}</span>
              <Segmented
                value={sel.shape}
                onChange={(v) => customEnv.setLight(sel.id, { shape: v as EnvLightShape, aspect: v === "strip" ? Math.max(sel.aspect, 5) : v === "rect" ? Math.min(Math.max(sel.aspect, 0.5), 2) : sel.aspect })}
                options={[
                  { v: "circle", label: "Round" },
                  { v: "rect", label: "Soft box" },
                  { v: "strip", label: "Strip" },
                ]}
              />
              <Field icon="sun" label="Brightness" value={sel.brightness} min={0} max={20} step={0.1} onChange={(v) => customEnv.setLight(sel.id, { brightness: v })} />
              <Field icon="circle" label="Size" value={sel.size} min={1} max={60} step={0.5} format={(v) => `${Math.round(v)}°`} onChange={(v) => customEnv.setLight(sel.id, { size: v })} />
              {sel.shape !== "circle" && <Field icon="height" label="Aspect" value={sel.aspect} min={0.2} max={12} step={0.1} onChange={(v) => customEnv.setLight(sel.id, { aspect: v })} />}
              <Field icon="drop" label="Softness" value={sel.softness} min={0} max={1} step={0.01} onChange={(v) => customEnv.setLight(sel.id, { softness: v })} />
              <ColorField label="Colour" value={sel.color} onChange={(v) => customEnv.setLight(sel.id, { color: v })} />
              <Field icon="orbit" label="Around" value={sel.lon} min={-180} max={180} step={0.5} format={(v) => `${Math.round(v)}°`} onChange={(v) => customEnv.setLight(sel.id, { lon: v })} />
              <Field icon="height" label="Height" value={sel.lat} min={-90} max={90} step={0.5} format={(v) => `${Math.round(v)}°`} onChange={(v) => customEnv.setLight(sel.id, { lat: v })} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="kk-card">
            <Caption title="Background" desc="The sky / floor gradient — sets the overall fill and the colour of shadows." />
            <ColorField label="Top" value={env.top} onChange={(v) => customEnv.setEnv({ top: v })} />
            <ColorField label="Horizon" value={env.horizon} onChange={(v) => customEnv.setEnv({ horizon: v })} />
            <ColorField label="Bottom" value={env.bottom} onChange={(v) => customEnv.setEnv({ bottom: v })} />
            <Field icon="sun" label="Intensity" value={env.bgIntensity} min={0} max={2} step={0.01} onChange={(v) => customEnv.setEnv({ bgIntensity: v })} />
          </div>
          <div className="kk-card">
            <span className="tlabel">ADJUSTMENTS</span>
            <Field icon="sun" label="Brightness" value={env.brightness} min={0} max={3} step={0.01} onChange={(v) => customEnv.setEnv({ brightness: v })} />
            <Field icon="dial" label="Contrast" value={env.contrast} min={0.5} max={2} step={0.01} onChange={(v) => customEnv.setEnv({ contrast: v })} />
            <Field icon="orbit" label="Rotation" value={env.rotation} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => customEnv.setEnv({ rotation: v })} />
          </div>
        </>
      )}
    </>
  )
}
