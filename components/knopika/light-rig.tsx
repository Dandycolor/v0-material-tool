"use client"

/* Sun gizmo over the stage: drag the sun around the object to rotate the environment light,
   scroll over it to change the key-light intensity. Angle convention matches the old LightRotationControl
   (0 = top, clockwise, radians). */

import { useEffect, useRef, useState } from "react"
import { Icon } from "./kk"

export function LightRig({
  angle,
  onAngle,
  intensity,
  onIntensity,
}: {
  angle: number
  onAngle: (a: number) => void
  intensity: number
  onIntensity: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const [box, setBox] = useState({ w: 1280, h: 800 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cx = box.w / 2
  const cy = box.h / 2
  const R = Math.max(90, Math.min(box.w, box.h) * 0.34)
  const sx = cx + Math.sin(angle) * R
  const sy = cy - Math.cos(angle) * R

  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    let a = Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx) + Math.PI / 2
    if (a < 0) a += Math.PI * 2
    onAngle(a)
  }

  const deg = Math.round((angle * 180) / Math.PI) % 360
  return (
    <div className="lightrig2" ref={ref} aria-hidden={false}>
      <svg className="rig-svg" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
        <circle className="rg-dim" cx={cx} cy={cy} r={R} />
        <ellipse className="rg-dim" cx={cx} cy={cy} rx={R} ry={R * 0.27} />
        <line className="rg-ray" x1={sx} y1={sy} x2={cx} y2={cy} />
        <circle className="rg-target" cx={cx} cy={cy} r={4.5} />
      </svg>
      <div
        className={`sun-giz2 ${drag ? "dragging" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Light direction"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={deg}
        style={{ transform: `translate(${sx}px, ${sy}px)`, ["--glow" as string]: `${4 + intensity * 4}px` }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          setDrag(true)
          at(e)
        }}
        onPointerMove={(e) => drag && at(e)}
        onPointerUp={() => setDrag(false)}
        onWheel={(e) => onIntensity(Math.max(0, Math.min(5, +(intensity - Math.sign(e.deltaY) * 0.1).toFixed(2))))}
        onKeyDown={(e) => {
          const s = (5 * Math.PI) / 180
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onAngle((angle + s) % (Math.PI * 2))
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onAngle((angle - s + Math.PI * 2) % (Math.PI * 2))
        }}
      >
        <svg className="sun-rays" viewBox="-56 -56 112 112" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <line key={i} x1={Math.cos(a) * 40} y1={Math.sin(a) * 40} x2={Math.cos(a) * 50} y2={Math.sin(a) * 50} />
          })}
        </svg>
        <span className="sun-core">
          <Icon name="sun" />
        </span>
        <span className="sun-read">
          {deg}° · {intensity.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
