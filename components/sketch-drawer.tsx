"use client"

/* Inflate (sketch) input: draw right in the 3D view on the shape's XY plane.
   - a stroke that ends near its start closes into a filled shape (a ring shows when it will snap)
   - open strokes become bands of the current width
   - steadied input, live line preview until the inflated mesh arrives
   - ring cursor = band width; Space held = orbit; Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { sketch } from "@/lib/sketch/store"

const MAXP = 8000

export function SketchGeometry() {
  const geo = useSyncExternalStore(sketch.subscribe, () => sketch.get().geometry, () => sketch.get().geometry)
  return <primitive object={geo} attach="geometry" />
}
export function useSketchDrawing() {
  return useSyncExternalStore(sketch.subscribe, () => sketch.get().drawing, () => true)
}

const closeDist = (w: number) => Math.max(0.07, w * 1.6)

export function SketchDrawer({ active }: { active: boolean }) {
  const { gl, camera } = useThree()
  const group = useRef<THREE.Group>(null)
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3))
    g.setDrawRange(0, 0)
    const m = new THREE.LineBasicMaterial({ color: "#111111", transparent: true, opacity: 0.9, depthTest: false })
    const l = new THREE.Line(g, m)
    l.renderOrder = 999
    l.frustumCulled = false
    return l
  }, [])
  const mk = (g: THREE.BufferGeometry, color: string, opacity: number) => {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }))
    m.renderOrder = 999
    return m
  }
  const cursor = useMemo(() => [mk(new THREE.CircleGeometry(1, 48), "#ffffff", 0.18), mk(new THREE.RingGeometry(0.9, 1, 64), "#111111", 0.85)], [])
  const snap = useMemo(() => mk(new THREE.RingGeometry(0.8, 1, 48), "#2bd47a", 0.95), [])
  useEffect(
    () => () => {
      ;[line, ...cursor, snap].forEach((o: any) => (o.geometry.dispose(), o.material.dispose()))
    },
    [line, cursor, snap],
  )
  const st = useRef({ on: false, pts: [] as number[], sm: null as THREE.Vector2 | null, waitMesh: false, hoverOn: false, hover: new THREE.Vector2(), near: false })
  const cursorGroup = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const inv = new THREE.Matrix4()
    const plane = new THREE.Plane()
    const hit = new THREE.Vector3()
    // pointer → local XY (z = 0) of the shape
    const toPlane = (e: PointerEvent, out: THREE.Vector2) => {
      const g = group.current
      if (!g) return false
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      inv.copy(g.matrixWorld).invert()
      const o = ray.ray.origin.clone().applyMatrix4(inv)
      const d = ray.ray.direction.clone().transformDirection(inv)
      plane.set(new THREE.Vector3(0, 0, 1), 0)
      if (!new THREE.Ray(o, d).intersectPlane(plane, hit)) return false
      out.set(hit.x, hit.y)
      return true
    }
    const pos = line.geometry.attributes.position as THREE.BufferAttribute
    const push = (x: number, y: number) => {
      const s = st.current
      const n = s.pts.length / 2
      if (n >= MAXP - 1) return
      s.pts.push(x, y)
      pos.setXYZ(n, x, y, 0)
      pos.needsUpdate = true
      line.geometry.setDrawRange(0, n + 1)
      line.visible = true
    }
    const p2 = new THREE.Vector2()
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !sketch.get().drawing) return
      if (!toPlane(e, p2)) return
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture?.(e.pointerId)
      const s = st.current
      s.on = true
      s.pts = []
      s.waitMesh = false
      s.near = false
      s.sm = p2.clone()
      push(p2.x, p2.y)
    }
    const onMove = (e: PointerEvent) => {
      const s = st.current
      const r = el.getBoundingClientRect()
      s.hoverOn = (e.target as Element) === el && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!toPlane(e, p2)) return
      if (!s.on || !s.sm) {
        s.hover.copy(p2)
        return
      }
      s.sm.lerp(p2, 1 - sketch.get().settings.steady * 0.85)
      s.hover.copy(s.sm)
      const n = s.pts.length
      const lx = s.pts[n - 2], ly = s.pts[n - 1]
      const step = Math.max(sketch.get().settings.width * 0.2, 0.006)
      if (Math.hypot(s.sm.x - lx, s.sm.y - ly) < step) return
      push(s.sm.x, s.sm.y)
      // will it close?
      const w = sketch.get().settings.width
      let L = 0
      for (let i = 2; i < s.pts.length; i += 2) L += Math.hypot(s.pts[i] - s.pts[i - 2], s.pts[i + 1] - s.pts[i - 1])
      s.near = L > closeDist(w) * 4 && Math.hypot(s.sm.x - s.pts[0], s.sm.y - s.pts[1]) < closeDist(w)
    }
    const onUp = () => {
      const s = st.current
      if (!s.on) return
      s.on = false
      const w = sketch.get().settings.width
      let pts = s.pts
      const closed = s.near
      if (closed) {
        // drop the tail that overlaps the start
        while (pts.length > 6 && Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]) < w * 0.4) pts = pts.slice(0, -2)
        pos.setXYZ(pts.length / 2, pts[0], pts[1], 0)
        line.geometry.setDrawRange(0, pts.length / 2 + 1)
        pos.needsUpdate = true
      }
      s.near = false
      s.waitMesh = true
      sketch.addStroke({ p: pts.map((v) => Math.round(v * 1e5) / 1e5), closed, w })
    }
    let spaceOrbit = false
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) sketch.redoStroke()
        else sketch.undo()
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()
        spaceOrbit = sketch.get().drawing
        if (spaceOrbit) sketch.setDrawing(false)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceOrbit) {
        spaceOrbit = false
        sketch.setDrawing(true)
      }
    }
    el.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
      el.style.cursor = ""
    }
  }, [active, gl, camera, line])

  const cur = useRef("")
  useFrame(() => {
    const s = st.current
    const b = sketch.get()
    const c = active ? (b.drawing ? "crosshair" : "grab") : ""
    if (c !== cur.current) {
      cur.current = c
      gl.domElement.style.cursor = c
    }
    const cg = cursorGroup.current
    if (cg) {
      cg.visible = active && b.drawing && (s.hoverOn || s.on)
      cg.position.set(s.hover.x, s.hover.y, 0)
      cg.scale.setScalar(b.settings.width / 2)
    }
    snap.visible = active && s.on && s.near
    if (s.pts.length) snap.position.set(s.pts[0], s.pts[1], 0)
    snap.scale.setScalar(closeDist(b.settings.width))
    if (s.waitMesh && !b.busy) {
      s.waitMesh = false
      line.visible = false
      line.geometry.setDrawRange(0, 0)
    }
    if (!active && line.visible) line.visible = false
  })

  return (
    <group ref={group}>
      <primitive object={line} />
      <primitive object={snap} />
      <group ref={cursorGroup} visible={false}>
        {cursor.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
    </group>
  )
}
