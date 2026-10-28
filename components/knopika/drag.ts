"use client"

/* Draggable Knopika windows.
   Drag a window by its header anywhere over the stage. "Docked" windows (second-order panels such as
   Material settings next to the library, or the Shape panel next to the tray) snap back to their home
   spot when dropped close to it. Offsets are remembered per window in this browser. */

import { useCallback, useEffect, useRef, useState } from "react"
import type React from "react"
import { UISound } from "@/lib/knopika/sounds"

type Offsets = Record<string, { x: number; y: number }>
const KEY = "polya-knopika-windows"
const SNAP_PX = 90 // screen distance from home that snaps a docked window back

const zoomOf = (el: HTMLElement) => {
  const z = parseFloat(getComputedStyle(el).zoom || "1")
  return z > 0 ? z : 1
}

export function usePanelDrag(enabled: boolean) {
  const [offsets, setOffsets] = useState<Offsets>({})
  const [dragging, setDragging] = useState<string | null>(null)
  const [near, setNear] = useState<string | null>(null)
  const st = useRef<{ id: string; dock: boolean; x0: number; y0: number; ox: number; oy: number; z: number; el: HTMLElement } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setOffsets(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(offsets))
    } catch {}
  }, [offsets])

  const onMove = useCallback((e: PointerEvent) => {
    const s = st.current
    if (!s) return
    const dx = (e.clientX - s.x0) / s.z
    const dy = (e.clientY - s.y0) / s.z
    const x = s.ox + dx
    const y = s.oy + dy
    setOffsets((o) => ({ ...o, [s.id]: { x, y } }))
    if (s.dock) setNear(Math.hypot(x * s.z, y * s.z) < SNAP_PX ? s.id : null)
  }, [])

  const onUp = useCallback(() => {
    const s = st.current
    st.current = null
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    setDragging(null)
    setNear(null)
    if (!s) return
    setOffsets((o) => {
      const cur = o[s.id] || { x: 0, y: 0 }
      // docked windows snap home when dropped near it
      if (s.dock && Math.hypot(cur.x * s.z, cur.y * s.z) < SNAP_PX) {
        UISound.close()
        const { [s.id]: _, ...rest } = o
        return rest
      }
      // keep at least a grab-able strip of the window on screen
      const r = s.el.getBoundingClientRect()
      const W = window.innerWidth
      const H = window.innerHeight
      let fx = 0
      let fy = 0
      const keep = 80
      if (r.right < keep) fx = keep - r.right
      if (r.left > W - keep) fx = W - keep - r.left
      if (r.top < 8) fy = 8 - r.top
      if (r.top > H - 48) fy = H - 48 - r.top
      return { ...o, [s.id]: { x: cur.x + fx / s.z, y: cur.y + fy / s.z } }
    })
  }, [onMove])

  /** Spread onto a window: `<div {...bind("matset", { dock: true })} …>` */
  const bind = (id: string, opts: { dock?: boolean; className?: string } = {}) => {
    const off = offsets[id]
    const moved = !!off && (off.x !== 0 || off.y !== 0)
    return {
      "data-win": id,
      className: [
        "kk-win",
        enabled ? "is-draggable" : "",
        dragging === id ? "is-dragging" : "",
        near === id ? "is-near-home" : "",
        moved && enabled ? "is-floating" : "",
      ].join(" "),
      style: enabled && off ? ({ translate: `${off.x}px ${off.y}px` } as React.CSSProperties) : undefined,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (!enabled || e.button !== 0) return
        const t = e.target as HTMLElement
        // drag by the header only, never from its buttons
        if (!t.closest(".phead") || t.closest("button,a,input,label,select")) return
        const el = e.currentTarget as HTMLElement
        const cur = offsets[id] || { x: 0, y: 0 }
        st.current = { id, dock: !!opts.dock, x0: e.clientX, y0: e.clientY, ox: cur.x, oy: cur.y, z: zoomOf(el), el }
        setDragging(id)
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        e.preventDefault()
      },
    }
  }

  const reset = () => setOffsets({})
  return { bind, reset, anyMoved: Object.keys(offsets).length > 0 }
}
