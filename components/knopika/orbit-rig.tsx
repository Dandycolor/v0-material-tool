"use client"

/* Orbit rig over the stage (from the Knopika concept): a horizontal ring turns the object,
   a vertical ring tilts it. Drag the handles, or drag anywhere on the stage to rotate freely.
   Front halves are solid, back halves dashed; the travelled part of each ring is highlighted. */

import { useEffect, useRef, useState } from "react"
import { Field, Icon, IconButton, PanelHead } from "./kk"
import { rot, useRot } from "@/lib/knopika/rotation"
import { UISound } from "@/lib/knopika/sounds"

const rad = (d: number) => (d * Math.PI) / 180

export function OrbitRig() {
  const ref = useRef<HTMLDivElement>(null)
  const { turn, tilt } = useRot()
  const [box, setBox] = useState({ w: 1280, h: 800 })
  const [drag, setDrag] = useState<null | "turn" | "tilt" | "free">(null)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cx = box.w / 2
  const cy = box.h / 2
  const R = Math.max(110, Math.min(box.w * 0.32, box.h * 0.43, 400))
  const ry = R * 0.27 // horizontal ring, seen from slightly above
  const rv = R * 0.27 // vertical ring, seen slightly from the side

  // horizontal ring: t = 0 is the front (bottom of the ellipse), clockwise seen from above
  const hp = (t: number) => [cx + R * Math.sin(rad(t)), cy + ry * Math.cos(rad(t))] as const
  // vertical ring: p = 0 is the front-right point, +90 the top
  const vp = (p: number) => [cx + rv * Math.cos(rad(p)), cy - R * Math.sin(rad(p))] as const

  const arcH = (a: number, b: number) => {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / 4))
    let d = ""
    for (let i = 0; i <= n; i++) {
      const [x, y] = hp(a + ((b - a) * i) / n)
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return d
  }
  const arcV = (a: number, b: number) => {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / 4))
    let d = ""
    for (let i = 0; i <= n; i++) {
      const [x, y] = vp(a + ((b - a) * i) / n)
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return d
  }
  const turnSigned = turn > 180 ? turn - 360 : turn
  const [hx, hy] = hp(turn)
  const [tx, ty] = vp(tilt)

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const { x, y } = local(e)
    if (drag === "turn") {
      rot.set({ turn: (Math.atan2((x - cx) / R, (y - cy) / ry) * 180) / Math.PI })
    } else if (drag === "tilt") {
      rot.set({ tilt: (Math.atan2(-(y - cy) / R, Math.max(0.0001, (x - cx) / rv)) * 180) / Math.PI })
    } else {
      const dx = x - last.current.x
      const dy = y - last.current.y
      const s = rot.get()
      rot.set({ turn: s.turn + dx * 0.45, tilt: s.tilt + dy * 0.35 })
    }
    last.current = { x, y }
    UISound.tick(((drag === "tilt" ? tilt + 90 : turn) % 180) / 180)
  }
  const start = (kind: "turn" | "tilt" | "free") => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    last.current = local(e)
    if (rot.get().auto) rot.set({ auto: false })
    setDrag(kind)
    if (kind !== "free") UISound.pick(4)
  }
  const end = () => setDrag(null)

  const key = (kind: "turn" | "tilt") => (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 0
    if (!d) return
    e.preventDefault()
    const s = rot.get()
    rot.set(kind === "turn" ? { turn: s.turn + d } : { tilt: s.tilt + d })
  }

  const ticks: [number, number][] = []
  for (let a = 0; a < 360; a += 45) if (a % 90) ticks.push(hp(a) as unknown as [number, number])
  for (const p of [-60, -30, 30, 60]) ticks.push(vp(p) as unknown as [number, number])

  return (
    <div className="orbitrig" ref={ref}>
      {/* free drag surface: rotate by dragging anywhere on the stage */}
      <div className={`orbit-surface ${drag === "free" ? "dragging" : ""}`} onPointerDown={start("free")} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} />
      <svg className="orbit-svg" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
        {/* back halves */}
        <path className="rr-back" d={arcH(90, 270)} />
        <path className="rr-back" d={arcV(90, 270)} />
        {/* front halves */}
        <path className="rr-ring" d={arcH(-90, 90)} />
        <path className="rr-ring" d={arcV(-90, 90)} />
        {/* travelled part */}
        {Math.abs(turnSigned) > 0.5 && <path className="rr-arc" d={arcH(0, turnSigned)} />}
        {Math.abs(tilt) > 0.5 && <path className="rr-arc" d={arcV(0, tilt)} />}
        {ticks.map(([x, y], i) => (
          <circle key={i} className="rr-tick" cx={x} cy={y} r={3.2} />
        ))}
        <text className="rr-lab" x={cx} y={cy + ry + 22}>
          F
        </text>
        <text className="rr-lab" x={cx} y={cy - ry - 18}>
          B
        </text>
        <text className="rr-lab" x={cx - R - 22} y={cy}>
          L
        </text>
        <text className="rr-lab" x={cx + R + 22} y={cy}>
          R
        </text>
      </svg>
      <div
        className={`rhandle ${drag === "turn" ? "dragging" : ""}`}
        style={{ transform: `translate(${hx}px, ${hy}px)` }}
        role="slider"
        tabIndex={0}
        aria-label="Turn"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(turn)}
        onPointerDown={start("turn")}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={key("turn")}
      >
        <Icon name="pan" />
        <span className="rread">turn {Math.round(turn)}°</span>
      </div>
      <div
        className={`rhandle ${drag === "tilt" ? "dragging" : ""}`}
        style={{ transform: `translate(${tx}px, ${ty}px)` }}
        role="slider"
        tabIndex={0}
        aria-label="Tilt"
        aria-valuemin={-90}
        aria-valuemax={90}
        aria-valuenow={Math.round(tilt)}
        onPointerDown={start("tilt")}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={key("tilt")}
      >
        <Icon name="height" />
        <span className="rread">tilt {Math.round(tilt)}°</span>
      </div>
    </div>
  )
}

const VIEWS: { label: string; turn: number; tilt: number }[] = [
  { label: "Front", turn: 0, tilt: 0 },
  { label: "Side", turn: 90, tilt: 0 },
  { label: "Top", turn: 0, tilt: 90 },
  { label: "¾", turn: 25, tilt: 12 },
]

/** Right-hand Rotate panel: views, turn / tilt, auto-rotate, snap, speed. */
export function RotatePanel({ onClose }: { onClose: () => void }) {
  const s = useRot()
  const cur = VIEWS.find((v) => Math.round(s.turn) === v.turn && Math.round(s.tilt) === v.tilt)?.label
  return (
    <div className="kk-panel rotbar enter" aria-label="Rotate model">
      <PanelHead eyebrow="Transform · Orbit">
        <IconButton size="sm" icon="undo" label="Reset rotation" onClick={() => rot.view(0, 0)} />
        <IconButton size="sm" icon="close" label="Close rotate" onClick={onClose} />
      </PanelHead>
      <div className="tseg kk-btngroup views" role="radiogroup">
        {VIEWS.map((v) => (
          <button key={v.label} type="button" role="radio" aria-checked={cur === v.label} className={`kk-pill ${cur === v.label ? "is-on" : ""}`} onClick={() => rot.view(v.turn, v.tilt)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="kk-card">
        <Field icon="pan" label="Turn" value={Math.round(s.turn)} min={0} max={359} step={1} format={(v) => `${v}°`} onChange={(v) => rot.set({ turn: v, auto: false })} />
        <Field icon="height" label="Tilt" value={Math.round(s.tilt)} min={-90} max={90} step={1} format={(v) => `${v}°`} onChange={(v) => rot.set({ tilt: v })} />
      </div>
      <div className="kk-card">
        <div className="autorow">
          <button type="button" className={`kk-pill ${s.auto ? "is-on" : ""}`} aria-pressed={s.auto} onClick={() => rot.set({ auto: !s.auto })}>
            <Icon name={s.auto ? "stop" : "play"} />
            Auto-rotate
          </button>
          <button type="button" className={`kk-pill ${s.snap ? "is-on" : ""}`} aria-pressed={s.snap} title="15° steps" onClick={() => rot.set({ snap: !s.snap })}>
            Snap 15°
          </button>
        </div>
        <Field icon="refresh" label="Speed" value={s.speed} min={5} max={120} step={5} format={(v) => `${v}°/s`} onChange={(v) => rot.set({ speed: v })} />
      </div>
      <p className="hint2">
        <b>Drag the rings</b> or the object itself. The horizontal ring turns, the vertical ring tilts. Arrow keys nudge the focused handle.
      </p>
    </div>
  )
}
